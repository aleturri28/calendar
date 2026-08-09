import express from 'express';
import { db } from '../lib/db.js';
import { romeDate } from '../lib/dates.js';
import { thumbnailUrl, videoPosterUrl } from '../lib/days.js';

export const widgetRouter = express.Router();

// L'unico endpoint senza sessione: lo interroga lo script Scriptable sul
// telefono, che non può fare login. Protetto da un token dedicato, così una
// sua fuga non dà accesso all'app ma solo alle miniature del giorno.
widgetRouter.get('/today', async (req, res) => {
  const expected = process.env.WIDGET_TOKEN;
  if (!expected) {
    return res.status(503).json({ error: 'widget_disabled', hint: 'WIDGET_TOKEN non configurato' });
  }

  const given = req.query.token;
  if (typeof given !== 'string' || given.length !== expected.length || given !== expected) {
    return res.status(401).json({ error: 'bad_token' });
  }

  const date = romeDate();
  const users = await db().user.findMany({ orderBy: { id: 'asc' } });
  const entries = await db().dayEntry.findMany({ where: { date } });

  res.json({
    date,
    people: users.map((user) => {
      const entry = entries.find((e) => e.userId === user.id) ?? null;
      return {
        name: user.name,
        hasPhoto: Boolean(entry?.photoUrl),
        hasVideo: Boolean(entry?.videoUrl),
        thumb: thumbnailUrl(entry?.photoUrl ?? null, 400)
          ?? videoPosterUrl(entry?.videoUrl ?? null, 400),
      };
    }),
  });
});
