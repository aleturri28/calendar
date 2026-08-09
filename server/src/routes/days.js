import express from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { isValidDate, isUploadOpen, romeDate, START_DATE } from '../lib/dates.js';
import {
  publicIdFor, resourceTypeFor, serializeEntry, MAX_VIDEO_SECONDS,
} from '../lib/days.js';
// Import del modulo intero, non delle singole funzioni: è la forma che
// vi.spyOn può intercettare nei test.
import * as cloud from '../lib/cloudinary.js';

const KINDS = ['photo', 'video'];

export const daysRouter = express.Router();

daysRouter.post('/:date/signature', requireAuth, (req, res) => {
  const { date } = req.params;
  const { kind } = req.body ?? {};

  if (!KINDS.includes(kind)) return res.status(400).json({ error: 'invalid_kind' });
  if (!isValidDate(date)) return res.status(400).json({ error: 'invalid_date' });
  if (!isUploadOpen(date)) return res.status(403).json({ error: 'window_closed' });

  const publicId = publicIdFor(date, req.userId, kind);
  res.json({ ...cloud.signUpload({ publicId }), resourceType: resourceTypeFor(kind) });
});

// L'ordine conta: prima si valida contro il dato reale di Cloudinary, e solo
// dopo si scrive. Così un video rifiutato non lascia né una riga sporca nel
// database né un file orfano nello storage.
daysRouter.post('/:date/confirm', requireAuth, async (req, res) => {
  const { date } = req.params;
  const { kind, publicId } = req.body ?? {};

  if (!KINDS.includes(kind)) return res.status(400).json({ error: 'invalid_kind' });
  if (!isValidDate(date)) return res.status(400).json({ error: 'invalid_date' });
  if (!isUploadOpen(date)) return res.status(403).json({ error: 'window_closed' });
  if (publicId !== publicIdFor(date, req.userId, kind)) {
    return res.status(403).json({ error: 'public_id_mismatch' });
  }

  const resourceType = resourceTypeFor(kind);
  let resource;
  try {
    resource = await cloud.fetchResource(publicId, resourceType);
  } catch {
    return res.status(404).json({ error: 'resource_not_found' });
  }

  if (kind === 'video') {
    const duration = resource.duration ?? 0;
    if (duration > MAX_VIDEO_SECONDS) {
      await cloud.destroyResource(publicId, resourceType);
      return res.status(422).json({
        error: 'video_too_long', duration, maxDuration: MAX_VIDEO_SECONDS,
      });
    }
  }

  const now = new Date();
  const fields = kind === 'video'
    ? {
        videoUrl: resource.secure_url,
        videoPublicId: publicId,
        videoDuration: resource.duration,
        videoUploadedAt: now,
      }
    : {
        photoUrl: resource.secure_url,
        photoPublicId: publicId,
        photoUploadedAt: now,
      };

  await db().dayEntry.upsert({
    where: { date_userId: { date, userId: req.userId } },
    update: fields,
    create: { date, userId: req.userId, ...fields },
  });

  res.json({ date, kind, url: resource.secure_url });
});

daysRouter.get('/:date', requireAuth, async (req, res) => {
  const { date } = req.params;
  if (!isValidDate(date) || date < START_DATE) {
    return res.status(400).json({ error: 'invalid_date' });
  }

  const users = await db().user.findMany({ orderBy: { id: 'asc' } });
  const entries = await db().dayEntry.findMany({
    where: { date },
    include: { comments: { include: { user: true }, orderBy: { createdAt: 'asc' } } },
  });

  const statuses = users.map((user) => {
    const entry = entries.find((e) => e.userId === user.id) ?? null;
    return serializeEntry(entry, user, req.userId);
  });

  // L'utente corrente per primo: la sua colonna è quella su cui agisce.
  statuses.sort((x, y) => Number(y.isMe) - Number(x.isMe));

  res.json({ date, isOpen: isUploadOpen(date), today: romeDate(), users: statuses });
});
