// server/auth.js — JWT authentication with bcrypt password hashing
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'immortal-engine-dev-secret';
const TOKEN_EXPIRY = '7d';
const SALT_ROUNDS = 10;

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function generateToken(username) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Express middleware — validates JWT from Authorization header.
 * Sets req.user = { username } on success, returns 401 on failure.
 */
export function requireAuth(req, res, next) {
  const authHeader = String(req.headers?.authorization || '');
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (!token) {
    return res.status(401).json({ ok: false, error: 'missing_token' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = { username: decoded.username };
    next();
  } catch {
    return res.status(401).json({ ok: false, error: 'invalid_token' });
  }
}
