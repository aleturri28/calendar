import express from 'express';
import { db } from '../lib/db.js';
import { romeDate } from '../lib/dates.js';
import { thumbnailUrl, videoPosterUrl } from '../lib/days.js';

export const widgetRouter = express.Router();

function checkToken(req, res) {
  const expected = process.env.WIDGET_TOKEN;
  if (!expected) {
    res.status(503).json({ error: 'widget_disabled', hint: 'WIDGET_TOKEN non configurato' });
    return false;
  }

  const given = req.query.token;
  if (typeof given !== 'string' || given.length !== expected.length || given !== expected) {
    res.status(401).json({ error: 'bad_token' });
    return false;
  }

  return true;
}

// Ogni telefono chiede "io sono X": il widget mostra l'ultima foto dell'altro.
// Ordinata per momento di caricamento e non per data del giorno, così un
// recupero fatto adesso su un giorno indietro compare subito.
widgetRouter.get('/latest', async (req, res) => {
  if (!checkToken(req, res)) return;

  const as = req.query.as;
  if (typeof as !== 'string' || !as.trim()) {
    return res.status(400).json({ error: 'missing_viewer', hint: 'manca il parametro as' });
  }

  const users = await db().user.findMany();
  const viewer = users.find((u) => u.name.toLowerCase() === as.trim().toLowerCase());
  if (!viewer) return res.status(400).json({ error: 'unknown_viewer' });

  const other = users.find((u) => u.id !== viewer.id);
  if (!other) return res.status(404).json({ error: 'no_other_user' });

  const entry = await db().dayEntry.findFirst({
    where: { userId: other.id, photoUrl: { not: null } },
    orderBy: { photoUploadedAt: 'desc' },
  });

  const today = romeDate();

  // Sostituire la foto di un giorno riusa lo stesso public_id, quindi l'URL
  // non cambierebbe e la cache del telefono continuerebbe a mostrare quella
  // vecchia. Il momento di caricamento in coda rende l'indirizzo diverso a
  // ogni contenuto nuovo; Cloudinary ignora i parametri che non conosce.
  const thumb = thumbnailUrl(entry?.photoUrl ?? null, 500);
  const version = entry?.photoUploadedAt?.getTime();

  res.json({
    viewer: viewer.name,
    from: other.name,
    hasPhoto: Boolean(entry),
    date: entry?.date ?? null,
    isToday: entry?.date === today,
    thumb: thumb && version ? `${thumb}?v=${version}` : thumb,
  });
});

// L'unico endpoint senza sessione: lo interroga lo script Scriptable sul
// telefono, che non può fare login. Protetto da un token dedicato, così una
// sua fuga non dà accesso all'app ma solo alle miniature del giorno.
widgetRouter.get('/today', async (req, res) => {
  if (!checkToken(req, res)) return;

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
