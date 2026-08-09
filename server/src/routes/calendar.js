import express from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { isUploadOpen, romeDate, START_DATE } from '../lib/dates.js';
import { entryStatus, dayState, thumbnailUrl, videoPosterUrl } from '../lib/days.js';

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

  const days = daysInMonth(month).map((date) => {
    const statuses = users.map((user) => {
      const entry = entries.find((e) => e.date === date && e.userId === user.id) ?? null;
      return {
        ...entryStatus(entry, user),
        isMe: user.id === req.userId,
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
    };
  });

  res.json({ month, today: romeDate(), startDate: START_DATE, days });
});
