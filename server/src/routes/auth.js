import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db.js';
import { signSession, cookieOptions, requireAuth, COOKIE_NAME } from '../lib/auth.js';

// Confrontare comunque un hash valido quando l'utente non esiste: senza,
// il tempo di risposta rivelerebbe quali nomi sono registrati.
const DUMMY_HASH = bcrypt.hashSync('__no_such_user__', 12);

export const authRouter = express.Router();

authRouter.post('/login', async (req, res) => {
  const { name, password } = req.body ?? {};
  if (typeof name !== 'string' || typeof password !== 'string') {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const user = await db().user.findUnique({ where: { name } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: 'invalid_credentials' });

  res.cookie(COOKIE_NAME, signSession(user.id), cookieOptions());
  res.json({ id: user.id, name: user.name });
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await db().user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(401).json({ error: 'unauthenticated' });
  res.json({ id: user.id, name: user.name });
});
