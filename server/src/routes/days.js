import express from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { isValidDate, isUploadOpen, romeDate, START_DATE } from '../lib/dates.js';
import {
  otherUserId, publicIdFor, resourceTypeFor, MIN_SECONDS, MAX_SECONDS,
} from '../lib/days.js';
// Import del modulo intero, non delle singole funzioni: è la forma che
// vi.spyOn può intercettare nei test.
import * as cloud from '../lib/cloudinary.js';

const KINDS = ['photo', 'video'];

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

daysRouter.post('/:date/signature', requireAuth, (req, res) => {
  const { date } = req.params;
  const { kind } = req.body ?? {};

  if (!KINDS.includes(kind)) return res.status(400).json({ error: 'invalid_kind' });
  if (!isValidDate(date)) return res.status(400).json({ error: 'invalid_date' });
  if (!isUploadOpen(date)) return res.status(403).json({ error: 'window_closed' });

  const publicId = publicIdFor(date, req.userId, kind);
  res.json({ ...cloud.signUpload({ publicId }), resourceType: resourceTypeFor(kind) });
});
