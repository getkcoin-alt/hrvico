import jwt from 'jsonwebtoken';
import db from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'restrovico-dev-jwt-secret-key-2026';

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. No token provided.',
      data: null,
      request_id: req.requestId
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch fresh user state from DB
    const user = await db.prepare(`
      SELECT id, tenant_id, role, full_name, email, mobile, status
      FROM users WHERE id = ?
    `).get(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session or user no longer exists.',
        data: null,
        request_id: req.requestId
      });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Account is pending verification or inactive.',
        data: null,
        request_id: req.requestId
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
      data: null,
      request_id: req.requestId
    });
  }
}

export function generateAccessToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
}

export function generateRefreshToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      type: 'refresh'
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}
