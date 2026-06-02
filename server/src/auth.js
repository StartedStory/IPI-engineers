import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { users } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const TOKEN_TTL = '7d';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

export function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

export const findUserByEmail = (email) => users.findByEmail(email);
export const findUserById = (id) => users.findById(id);

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    req.user = { id: user.id, role: user.role, name: user.name, email: user.email };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: requires one of ' + roles.join(', ') });
    }
    next();
  };
}
