import express from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

export const newsRouter = express.Router();

// Novità = cose fatte dall'altro da quando ho guardato l'ultima volta.
// Al primo accesso lastSeenAt è vuoto: in quel caso conta tutto, così chi
// entra la prima volta vede subito che c'è qualcosa.
newsRouter.get('/', requireAuth, async (req, res) => {
  const me = await db().user.findUnique({ where: { id: req.userId } });
  const other = await db().user.findFirst({ where: { id: { not: req.userId } } });
  const since = me?.lastSeenAt ?? new Date(0);

  const entries = await db().dayEntry.findMany({
    where: { userId: { not: req.userId } },
    select: { photoUploadedAt: true, videoUploadedAt: true },
  });

  const photos = entries.filter((e) => e.photoUploadedAt && e.photoUploadedAt > since).length;
  const videos = entries.filter((e) => e.videoUploadedAt && e.videoUploadedAt > since).length;

  const comments = await db().comment.count({
    where: { userId: { not: req.userId }, createdAt: { gt: since } },
  });

  res.json({
    since: me?.lastSeenAt ?? null,
    from: other?.name ?? null,
    photos,
    videos,
    comments,
    total: photos + videos + comments,
  });
});

newsRouter.post('/seen', requireAuth, async (req, res) => {
  await db().user.update({ where: { id: req.userId }, data: { lastSeenAt: new Date() } });
  res.json({ ok: true });
});
