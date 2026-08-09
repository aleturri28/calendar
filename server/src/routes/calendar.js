import express from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { isUploadOpen, romeDate, START_DATE } from '../lib/dates.js';
import { entryStatus, dayState, thumbnailUrl, videoPosterUrl } from '../lib/days.js';
import { eventsOnDate, serializeEvent } from '../lib/events.js';

export const calendarRouter = express.Router();

function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) =>
    `${month}-${String(i + 1).padStart(2, '0')}`
  );
}

calendarRouter.get('/:month', requireAuth, async (req, res) => {
  const { month } = req.params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ error: 'invalid_month' });
  }

  const users = await db().user.findMany({ orderBy: { id: 'asc' } });
  const entries = await db().dayEntry.findMany({
    where: { date: { startsWith: `${month}-` } },
  });

  const since = users.find((u) => u.id === req.userId)?.lastSeenAt ?? null;
  const isFresh = (entry, userId) => {
    if (!since || userId === req.userId || !entry) return false;
    return (entry.photoUploadedAt && entry.photoUploadedAt > since)
      || (entry.videoUploadedAt && entry.videoUploadedAt > since);
  };

  // Eventi che toccano il mese, anche se cominciano prima o finiscono dopo.
  const monthDays = daysInMonth(month);
  const first = monthDays[0];
  const last = monthDays[monthDays.length - 1];
  const events = await db().event.findMany({
    where: { startDate: { lte: last }, endDate: { gte: first } },
    orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
  });

  const today = romeDate();

  const days = monthDays.map((date) => {
    const statuses = users.map((user) => {
      const entry = entries.find((e) => e.date === date && e.userId === user.id) ?? null;
      return {
        ...entryStatus(entry, user),
        isMe: user.id === req.userId,
        fresh: Boolean(isFresh(entry, user.id)),
        // Miniatura piccola: la cella la usa come sfondo.
        thumb: thumbnailUrl(entry?.photoUrl ?? null) ?? videoPosterUrl(entry?.videoUrl ?? null),
      };
    });
    return {
      date,
      state: dayState(statuses),
      isOpen: isUploadOpen(date),
      exists: date >= START_DATE,
      users: statuses,
      events: eventsOnDate(events, date).map((e) => serializeEvent(e, today)),
    };
  });

  res.json({ month, today, startDate: START_DATE, days });
});
