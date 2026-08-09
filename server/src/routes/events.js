import express from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { romeDate } from '../lib/dates.js';
import { findEventProblem, serializeEvent, nextMeetup } from '../lib/events.js';

export const eventsRouter = express.Router();

eventsRouter.get('/', requireAuth, async (req, res) => {
  const today = romeDate();
  const all = await db().event.findMany({ orderBy: [{ startDate: 'asc' }, { id: 'asc' }] });

  // In elenco solo ciò che deve ancora arrivare o è in corso: il passato sta
  // già nel calendario e qui farebbe solo rumore.
  const upcoming = all.filter((e) => e.endDate >= today);
  const meetup = nextMeetup(all, today);

  res.json({
    today,
    events: upcoming.map((e) => serializeEvent(e, today)),
    nextMeetup: meetup ? serializeEvent(meetup, today) : null,
  });
});

eventsRouter.post('/', requireAuth, async (req, res) => {
  const { title, emoji, startDate, isMeetup } = req.body ?? {};
  // Un evento di un giorno solo: la fine coincide con l'inizio.
  const endDate = req.body?.endDate || startDate;

  const problem = findEventProblem({ title, emoji, startDate, endDate, isMeetup });
  if (problem) return res.status(400).json({ error: problem });

  const event = await db().event.create({
    data: {
      title: title.trim(),
      emoji: emoji?.trim() || null,
      startDate,
      endDate,
      isMeetup: Boolean(isMeetup),
      createdById: req.userId,
    },
  });

  res.status(201).json(serializeEvent(event, romeDate()));
});

// Un evento è un fatto condiviso, non una frase di qualcuno: lo cancella
// chiunque dei due, al contrario dei commenti.
eventsRouter.delete('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });

  const event = await db().event.findUnique({ where: { id } });
  if (!event) return res.status(404).json({ error: 'event_not_found' });

  await db().event.delete({ where: { id } });
  res.json({ ok: true });
});
