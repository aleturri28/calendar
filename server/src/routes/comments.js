import express from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { isValidDate, START_DATE } from '../lib/dates.js';
import { COMMENT_TARGETS, MAX_COMMENT_LENGTH, serializeComment } from '../lib/days.js';

export const commentsRouter = express.Router();

// Si commenta il contenuto di uno dei due, non il proprio giorno in astratto:
// serve quindi sapere di chi è la polaroid. Nessuna finestra temporale — un
// commento si può lasciare anche su un giorno ormai chiuso.
commentsRouter.post('/days/:date/comments', requireAuth, async (req, res) => {
  const { date } = req.params;
  const { userId, target, text } = req.body ?? {};

  if (!isValidDate(date) || date < START_DATE) {
    return res.status(400).json({ error: 'invalid_date' });
  }
  if (!COMMENT_TARGETS.includes(target)) {
    return res.status(400).json({ error: 'invalid_target' });
  }
  if (!Number.isInteger(userId)) {
    return res.status(400).json({ error: 'invalid_user' });
  }

  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) {
    return res.status(400).json({ error: 'invalid_text', maxLength: MAX_COMMENT_LENGTH });
  }

  const entry = await db().dayEntry.findUnique({ where: { date_userId: { date, userId } } });
  if (!entry) return res.status(404).json({ error: 'entry_not_found' });

  const hasTarget = target === 'photo' ? entry.photoUrl : entry.videoUrl;
  if (!hasTarget) return res.status(404).json({ error: 'nothing_to_comment' });

  const comment = await db().comment.create({
    data: { dayEntryId: entry.id, target, userId: req.userId, text: trimmed },
    include: { user: true },
  });

  res.status(201).json(serializeComment(comment, req.userId));
});

commentsRouter.delete('/comments/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });

  const comment = await db().comment.findUnique({ where: { id } });
  if (!comment) return res.status(404).json({ error: 'comment_not_found' });
  // Ognuno cancella solo i propri: le parole dell'altro non si toccano.
  if (comment.userId !== req.userId) return res.status(403).json({ error: 'not_yours' });

  await db().comment.delete({ where: { id } });
  res.json({ ok: true });
});
