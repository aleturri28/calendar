import jwt from 'jsonwebtoken';

export const COOKIE_NAME = 'session';
const MAX_AGE_DAYS = 180;

export function signSession(userId) {
  return jwt.sign({ uid: userId }, process.env.JWT_SECRET, {
    expiresIn: `${MAX_AGE_DAYS}d`,
  });
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'unauthenticated' });

  try {
    req.userId = jwt.verify(token, process.env.JWT_SECRET).uid;
    next();
  } catch {
    res.status(401).json({ error: 'unauthenticated' });
  }
}
