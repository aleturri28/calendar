import express from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { romeDate, START_DATE } from '../lib/dates.js';
import { thumbnailUrl } from '../lib/days.js';
import { summarize } from '../lib/summary.js';

export const summaryRouter = express.Router();

function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

// Calcolato al volo a ogni richiesta invece che generato il primo del mese da
// un cron: i numeri sono pochi, la query è banale, e così il riepilogo è
// sempre aggiornato anche a mese in corso.
summaryRouter.get('/:month', requireAuth, async (req, res) => {
  const { month } = req.params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ error: 'invalid_month' });
  }

  const users = await db().user.findMany({ orderBy: { id: 'asc' } });
  const entries = await db().dayEntry.findMany({
    where: { date: { startsWith: `${month}-` } },
    include: { comments: true },
    orderBy: [{ date: 'asc' }, { userId: 'asc' }],
  });

  const comments = entries.flatMap((entry) =>
    entry.comments.map((c) => ({ ...c, date: entry.date })));

  // Solo i giorni che esistono davvero: né prima dell'inizio, né nel futuro.
  const today = romeDate();
  const dates = daysInMonth(month).filter((d) => d >= START_DATE && d <= today);

  const stats = summarize({ month, dates, entries, comments, users });

  // Il collage: le foto del mese in ordine, che il client dispone a griglia.
  const collage = entries
    .filter((e) => e.photoUrl)
    .map((e) => ({ date: e.date, userId: e.userId, thumb: thumbnailUrl(e.photoUrl, 300) }));

  res.json({ ...stats, collage });
});
