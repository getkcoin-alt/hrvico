import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { recordAuditLog } from '../services/audit.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/mailer.js';
import { generateAccessToken, generateRefreshToken } from '../middleware/auth.js';

function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : '';
}

function normalizeMobile(mobile) {
  if (!mobile) return '';
  let cleaned = mobile.trim().replace(/\s+/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) {
      cleaned = '+91' + cleaned;
    } else if (!cleaned.startsWith('91') && cleaned.length === 12) {
      cleaned = '+' + cleaned;
    }
  }
  return cleaned;
}

function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain at least one letter and one number.';
  }
  return null;
}

export async function signup(req, res) {
  try {
    const { fullName, email, mobile, password, confirmPassword, termsAccepted } = req.body;

    if (!fullName || fullName.trim().length < 2 || fullName.trim().length > 80) {
      return res.status(422).json({
        success: false,
        message: 'Full name must be between 2 and 80 characters.',
        data: null,
        request_id: req.requestId
      });
    }

    const normEmail = normalizeEmail(email);
    if (!normEmail || !/^\S+@\S+\.\S+$/.test(normEmail)) {
      return res.status(422).json({
        success: false,
        message: 'Please provide a valid email address.',
        data: null,
        request_id: req.requestId
      });
    }

    const normMobile = normalizeMobile(mobile);
    if (!normMobile) {
      return res.status(422).json({
        success: false,
        message: 'Please provide a valid mobile number.',
        data: null,
        request_id: req.requestId
      });
    }

    const passError = validatePassword(password);
    if (passError) {
      return res.status(422).json({
        success: false,
        message: passError,
        data: null,
        request_id: req.requestId
      });
    }

    if (password !== confirmPassword) {
      return res.status(422).json({
        success: false,
        message: 'Passwords do not match.',
        data: null,
        request_id: req.requestId
      });
    }

    if (!termsAccepted) {
      return res.status(422).json({
        success: false,
        message: 'You must accept the Terms of Service and Privacy Policy.',
        data: null,
        request_id: req.requestId
      });
    }

    // Check duplicate email / mobile
    const existingEmail = await db.prepare('SELECT id FROM users WHERE email = ?').get(normEmail);
    if (existingEmail) {
      return res.status(422).json({
        success: false,
        message: 'An account with this email address already exists.',
        data: null,
        request_id: req.requestId
      });
    }

    const existingMobile = await db.prepare('SELECT id FROM users WHERE mobile = ?').get(normMobile);
    if (existingMobile) {
      return res.status(422).json({
        success: false,
        message: 'An account with this mobile number already exists.',
        data: null,
        request_id: req.requestId
      });
    }

    const tenantId = uuidv4();
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    const tenantName = `${fullName.trim()}'s Restaurant Group`;
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const createTx = db.transaction(async () => {
      await db.prepare('INSERT INTO tenants (id, name, status) VALUES (?, ?, ?)').run(tenantId, tenantName, 'ACTIVE');
      
      await db.prepare(`
        INSERT INTO users (id, tenant_id, role, full_name, email, mobile, password_hash, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, tenantId, 'OWNER', fullName.trim(), normEmail, normMobile, passwordHash, 'PENDING_VERIFICATION');

      await db.prepare(`
        INSERT INTO email_verifications (id, user_id, token_hash, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(uuidv4(), userId, tokenHash, expiresAt);
    });

    await createTx();

    await recordAuditLog({
      tenantId,
      userId,
      action: 'Signup',
      entityType: 'User',
      entityId: userId,
      metadata: { email: normEmail, mobile: normMobile, role: 'OWNER' },
      ip: req.ip
    });

    await sendVerificationEmail({ email: normEmail, name: fullName.trim(), token: rawToken });

    return res.status(201).json({
      success: true,
      message: 'Owner account created successfully. Verification link has been sent to your email.',
      data: {
        userId,
        email: normEmail,
        status: 'PENDING_VERIFICATION',
        devVerificationToken: rawToken
      },
      request_id: req.requestId
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error during owner signup.',
      data: null,
      request_id: req.requestId
    });
  }
}

export async function verifyEmail(req, res) {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(422).json({
        success: false,
        message: 'Verification token is required.',
        data: null,
        request_id: req.requestId
      });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const record = await db.prepare(`
      SELECT * FROM email_verifications
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
    `).get(tokenHash);

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification link.',
        data: null,
        request_id: req.requestId
      });
    }

    const verifyTx = db.transaction(async () => {
      await db.prepare('UPDATE email_verifications SET used_at = CURRENT_TIMESTAMP WHERE id = ?').run(record.id);
      await db.prepare(`
        UPDATE users
        SET email_verified_at = CURRENT_TIMESTAMP, status = 'ACTIVE'
        WHERE id = ?
      `).run(record.user_id);
    });

    await verifyTx();

    const user = await db.prepare('SELECT id, tenant_id, full_name, email FROM users WHERE id = ?').get(record.user_id);

    await recordAuditLog({
      tenantId: user ? user.tenant_id : null,
      userId: user ? user.id : null,
      action: 'Email Verify',
      entityType: 'User',
      entityId: user ? user.id : null,
      metadata: { result: 'SUCCESS' },
      ip: req.ip
    });

    return res.json({
      success: true,
      message: 'Email address verified successfully. You can now log in.',
      data: {
        userId: user.id,
        email: user.email,
        status: 'ACTIVE'
      },
      request_id: req.requestId
    });
  } catch (err) {
    console.error('Verify email error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error verifying email.',
      data: null,
      request_id: req.requestId
    });
  }
}

export async function resendVerification(req, res) {
  try {
    const { email } = req.body;
    const normEmail = normalizeEmail(email);

    if (normEmail) {
      const user = await db.prepare('SELECT * FROM users WHERE email = ? AND status = ?').get(normEmail, 'PENDING_VERIFICATION');
      if (user) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        await db.prepare(`
          INSERT INTO email_verifications (id, user_id, token_hash, expires_at)
          VALUES (?, ?, ?, ?)
        `).run(uuidv4(), user.id, tokenHash, expiresAt);

        await sendVerificationEmail({ email: user.email, name: user.full_name, token: rawToken });
      }
    }

    return res.json({
      success: true,
      message: 'If a pending account exists for this email, a new verification link has been sent.',
      data: null,
      request_id: req.requestId
    });
  } catch (err) {
    console.error('Resend verification error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error requesting verification email resend.',
      data: null,
      request_id: req.requestId
    });
  }
}

export async function login(req, res) {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(422).json({
        success: false,
        message: 'Email or Mobile and Password are required.',
        data: null,
        request_id: req.requestId
      });
    }

    const normInput = identifier.trim();
    const isEmailInput = normInput.includes('@');
    const lookupField = isEmailInput ? normalizeEmail(normInput) : normalizeMobile(normInput);

    const user = await db.prepare(`
      SELECT * FROM users
      WHERE ${isEmailInput ? 'email' : 'mobile'} = ?
    `).get(lookupField);

    if (!user) {
      await recordAuditLog({
        action: 'Login Failure',
        metadata: { identifier: normInput, reason: 'User not found' },
        ip: req.ip
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid email/mobile or password.',
        data: null,
        request_id: req.requestId
      });
    }

    const validPass = await bcrypt.compare(password, user.password_hash);
    if (!validPass) {
      await recordAuditLog({
        tenantId: user.tenant_id,
        userId: user.id,
        action: 'Login Failure',
        metadata: { reason: 'Incorrect password' },
        ip: req.ip
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid email/mobile or password.',
        data: null,
        request_id: req.requestId
      });
    }

    if (user.status === 'PENDING_VERIFICATION') {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address before logging in.',
        data: { userId: user.id, email: user.email, status: user.status },
        request_id: req.requestId
      });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Your account is disabled. Please contact support.',
        data: null,
        request_id: req.requestId
      });
    }

    await db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.prepare(`
      INSERT INTO auth_sessions (id, user_id, token_hash, device_info, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), user.id, refreshHash, req.headers['user-agent'] || 'unknown', sessionExpiresAt);

    await recordAuditLog({
      tenantId: user.tenant_id,
      userId: user.id,
      action: 'Login Success',
      entityType: 'User',
      entityId: user.id,
      metadata: { role: user.role },
      ip: req.ip
    });

    const tenant = await db.prepare('SELECT id, name FROM tenants WHERE id = ?').get(user.tenant_id);
    const restaurantCountRow = await db.prepare('SELECT COUNT(*) as count FROM restaurants WHERE tenant_id = ?').get(user.tenant_id);
    const restaurantCount = restaurantCountRow ? parseInt(restaurantCountRow.count, 10) : 0;

    return res.json({
      success: true,
      message: 'Logged in successfully.',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          tenantId: user.tenant_id,
          role: user.role,
          fullName: user.full_name,
          email: user.email,
          mobile: user.mobile,
          status: user.status,
          tenantName: tenant ? tenant.name : '',
          restaurantCount
        }
      },
      request_id: req.requestId
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error during login.',
      data: null,
      request_id: req.requestId
    });
  }
}

export async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(422).json({
        success: false,
        message: 'Refresh token is required.',
        data: null,
        request_id: req.requestId
      });
    }

    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const session = await db.prepare(`
      SELECT * FROM auth_sessions
      WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP
    `).get(refreshHash);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or revoked refresh token.',
        data: null,
        request_id: req.requestId
      });
    }

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        message: 'User account is inactive.',
        data: null,
        request_id: req.requestId
      });
    }

    const accessToken = generateAccessToken(user);

    return res.json({
      success: true,
      message: 'Token refreshed.',
      data: { accessToken },
      request_id: req.requestId
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error refreshing token.',
      data: null,
      request_id: req.requestId
    });
  }
}

export async function logout(req, res) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await db.prepare('UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?').run(refreshHash);
    }

    if (req.user) {
      await recordAuditLog({
        tenantId: req.user.tenant_id,
        userId: req.user.id,
        action: 'Logout',
        entityType: 'User',
        entityId: req.user.id,
        metadata: {},
        ip: req.ip
      });
    }

    return res.json({
      success: true,
      message: 'Logged out successfully.',
      data: null,
      request_id: req.requestId
    });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error during logout.',
      data: null,
      request_id: req.requestId
    });
  }
}

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    const normEmail = normalizeEmail(email);

    if (!normEmail) {
      return res.status(422).json({
        success: false,
        message: 'A valid email address is required.',
        data: null,
        request_id: req.requestId
      });
    }

    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(normEmail);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address.',
        data: null,
        request_id: req.requestId
      });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await db.prepare(`
      INSERT INTO password_resets (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), user.id, tokenHash, expiresAt);

    await recordAuditLog({
      tenantId: user.tenant_id,
      userId: user.id,
      action: 'Password Reset Request',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email },
      ip: req.ip
    });

    const { resetLink, previewUrl } = await sendPasswordResetEmail({ email: user.email, name: user.full_name, token: rawToken });

    return res.json({
      success: true,
      message: `Password reset instructions have been sent to ${user.email}.`,
      data: {
        previewUrl: previewUrl || undefined,
        resetLink: previewUrl ? resetLink : undefined
      },
      request_id: req.requestId
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error processing password reset request.',
      data: null,
      request_id: req.requestId
    });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token) {
      return res.status(422).json({
        success: false,
        message: 'Reset token is required.',
        data: null,
        request_id: req.requestId
      });
    }

    const passErr = validatePassword(newPassword);
    if (passErr) {
      return res.status(422).json({
        success: false,
        message: passErr,
        data: null,
        request_id: req.requestId
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(422).json({
        success: false,
        message: 'Passwords do not match.',
        data: null,
        request_id: req.requestId
      });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetRecord = await db.prepare(`
      SELECT * FROM password_resets
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
    `).get(tokenHash);

    if (!resetRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset token.',
        data: null,
        request_id: req.requestId
      });
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    const resetTx = db.transaction(async () => {
      await db.prepare('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = ?').run(resetRecord.id);
      await db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, resetRecord.user_id);
      await db.prepare('UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(resetRecord.user_id);
    });

    await resetTx();

    const user = await db.prepare('SELECT id, tenant_id FROM users WHERE id = ?').get(resetRecord.user_id);

    await recordAuditLog({
      tenantId: user ? user.tenant_id : null,
      userId: resetRecord.user_id,
      action: 'Password Reset Success',
      entityType: 'User',
      entityId: resetRecord.user_id,
      metadata: {},
      ip: req.ip
    });

    return res.json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
      data: null,
      request_id: req.requestId
    });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error resetting password.',
      data: null,
      request_id: req.requestId
    });
  }
}
