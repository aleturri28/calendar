import express from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { romeDate, START_DATE } from '../lib/dates.js';
import { serializeEntry, thumbnailUrl } from '../lib/days.js';

const FEED_DAYS = 21;

export const feedRouter = express.Router();
export const timelineRouter = express.Router();

// Flusso sotto il calendario: gli ultimi giorni con qualcosa dentro, dal più
// recente, con i contenuti di entrambi e i relativi commenti.
feedRouter.get('/', requireAuth, async (req, res) => {
  const users = await db().user.findMany({ orderBy: { id: 'asc' } });

  const entries = await db().dayEntry.findMany({
    where: { date: { gte: START_DATE, lte: romeDate() } },
    include: { comments: { include: { user: true }, orderBy: { createdAt: 'asc' } } },
    orderBy: { date: 'desc' },
  });

  const dates = [...new Set(entries.filter((e) => e.photoUrl || e.videoUrl).map((e) => e.date))]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, FEED_DAYS);

  const days = dates.map((date) => ({
    date,
    users: users
      .map((user) => {
        const entry = entries.find((e) => e.date === date && e.userId === user.id) ?? null;
        return serializeEntry(entry, user, req.userId);
      })
      // L'altro per primo: il flusso serve a guardare lui, non se stessi.
      .sort((x, y) => Number(x.isMe) - Number(y.isMe)),
  }));

  res.json({ days });
});

// Striscia del tempo: solo le foto, in ordine cronologico, leggere.
timelineRouter.get('/', requireAuth, async (req, res) => {
  const users = await db().user.findMany({ orderBy: { id: 'asc' } });
  const byId = Object.fromEntries(users.map((u) => [u.id, u.name]));

  const entries = await db().dayEntry.findMany({
    where: { photoUrl: { not: null } },
    orderBy: [{ date: 'asc' }, { userId: 'asc' }],
  });

  res.json({
    shots: entries.map((entry) => ({
      date: entry.date,
      userId: entry.userId,
      name: byId[entry.userId],
      isMe: entry.userId === req.userId,
      thumb: thumbnailUrl(entry.photoUrl, 400),
    })),
  });
});
