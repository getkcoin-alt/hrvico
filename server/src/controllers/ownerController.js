import bcrypt from 'bcryptjs';
import db from '../db.js';
import { recordAuditLog } from '../services/audit.js';

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

export async function getProfile(req, res) {
  try {
    const user = await db.prepare(`
      SELECT u.id, u.tenant_id, u.role, u.full_name, u.email, u.mobile, u.status, u.created_at, t.name as tenant_name
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.id = ?
    `).get(req.user.id);

    const restaurantCountRow = await db.prepare('SELECT COUNT(*) as count FROM restaurants WHERE tenant_id = ?').get(req.user.tenant_id);
    const restaurantCount = restaurantCountRow ? parseInt(restaurantCountRow.count, 10) : 0;

    return res.json({
      success: true,
      message: 'Profile retrieved.',
      data: {
        id: user.id,
        tenantId: user.tenant_id,
        role: user.role,
        fullName: user.full_name,
        email: user.email,
        mobile: user.mobile,
        status: user.status,
        tenantName: user.tenant_name,
        restaurantCount,
        createdAt: user.created_at
      },
      request_id: req.requestId
    });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving profile.',
      data: null,
      request_id: req.requestId
    });
  }
}

export async function updateProfile(req, res) {
  try {
    const { fullName, mobile } = req.body;
    const updates = [];
    const params = [];
    const changes = {};

    if (fullName !== undefined) {
      if (!fullName || fullName.trim().length < 2 || fullName.trim().length > 80) {
        return res.status(422).json({
          success: false,
          message: 'Full name must be between 2 and 80 characters.',
          data: null,
          request_id: req.requestId
        });
      }
      updates.push('full_name = ?');
      params.push(fullName.trim());
      changes.fullName = fullName.trim();
    }

    if (mobile !== undefined) {
      const normMobile = normalizeMobile(mobile);
      if (!normMobile) {
        return res.status(422).json({
          success: false,
          message: 'Invalid mobile number.',
          data: null,
          request_id: req.requestId
        });
      }

      const existingMobile = await db.prepare('SELECT id FROM users WHERE mobile = ? AND id != ?').get(normMobile, req.user.id);
      if (existingMobile) {
        return res.status(422).json({
          success: false,
          message: 'This mobile number is already registered to another account.',
          data: null,
          request_id: req.requestId
        });
      }

      updates.push('mobile = ?');
      params.push(normMobile);
      changes.mobile = normMobile;
    }

    if (updates.length === 0) {
      return res.status(422).json({
        success: false,
        message: 'No profile fields provided to update.',
        data: null,
        request_id: req.requestId
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.user.id);

    await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    await recordAuditLog({
      tenantId: req.user.tenant_id,
      userId: req.user.id,
      action: 'Profile Update',
      entityType: 'User',
      entityId: req.user.id,
      metadata: { changes },
      ip: req.ip
    });

    const updatedUser = await db.prepare('SELECT id, full_name, email, mobile, status FROM users WHERE id = ?').get(req.user.id);

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        fullName: updatedUser.full_name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        status: updatedUser.status
      },
      request_id: req.requestId
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error updating profile.',
      data: null,
      request_id: req.requestId
    });
  }
}

export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(422).json({
        success: false,
        message: 'Current password, new password, and confirm password are required.',
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
        message: 'New password and confirm password do not match.',
        data: null,
        request_id: req.requestId
      });
    }

    const user = await db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    const validCurrent = await bcrypt.compare(currentPassword, user.password_hash);

    if (!validCurrent) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect current password.',
        data: null,
        request_id: req.requestId
      });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, req.user.id);

    await recordAuditLog({
      tenantId: req.user.tenant_id,
      userId: req.user.id,
      action: 'Change Password',
      entityType: 'User',
      entityId: req.user.id,
      metadata: {},
      ip: req.ip
    });

    return res.json({
      success: true,
      message: 'Password changed successfully.',
      data: null,
      request_id: req.requestId
    });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error changing password.',
      data: null,
      request_id: req.requestId
    });
  }
}
