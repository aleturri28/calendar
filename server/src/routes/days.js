import express from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { isValidDate, romeDate, START_DATE } from '../lib/dates.js';
import { otherUserId, MIN_SECONDS, MAX_SECONDS } from '../lib/days.js';

export const daysRouter = express.Router();

daysRouter.put('/:date/min-duration', requireAuth, async (req, res) => {
  const { date } = req.params;
  const { seconds } = req.body ?? {};

  if (!isValidDate(date) || date < START_DATE) {
    return res.status(400).json({ error: 'invalid_date' });
  }
  if (!Number.isInteger(seconds) || seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
    return res.status(400).json({ error: 'invalid_duration' });
  }
  // Solo oggi o in avanti: alzare l'asticella su un giorno passato
  // invaliderebbe a posteriori un video già caricato.
  if (date < romeDate()) {
    return res.status(403).json({ error: 'day_closed_for_min_duration' });
  }

  const targetId = await otherUserId(req.userId);
  const entry = await db().dayEntry.upsert({
    where: { date_userId: { date, userId: targetId } },
    update: { minDuration: seconds },
    create: { date, userId: targetId, minDuration: seconds },
  });

  res.json({ date, userId: targetId, minDuration: entry.minDuration });
});
