import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/lib/db.js';
import { resetDb, createUsers, loginAs } from './helpers/factory.js';
import { nextMeetup, findEventProblem, serializeEvent } from '../src/lib/events.js';

const app = createApp();

describe('findEventProblem', () => {
  const valid = { title: 'Volo per Palma', startDate: '2026-09-01', endDate: '2026-09-07' };

  it('accepts a well-formed event', () => {
    expect(findEventProblem(valid)).toBeNull();
  });

  it('rejects an empty title', () => {
    expect(findEventProblem({ ...valid, title: '   ' })).toBe('invalid_title');
  });

  it('rejects an end before the start', () => {
    expect(findEventProblem({ ...valid, endDate: '2026-08-30' })).toBe('invalid_end');
  });

  it('rejects a start before the calendar begins', () => {
    expect(findEventProblem({ ...valid, startDate: '2026-08-01' })).toBe('invalid_start');
  });

  it('rejects an absurdly long span', () => {
    expect(findEventProblem({ ...valid, endDate: '2028-09-01' })).toBe('span_too_long');
  });
});

describe('nextMeetup', () => {
  const meetup = (id, startDate, endDate) =>
    ({ id, startDate, endDate, isMeetup: true });

  it('prefers a meetup happening right now', () => {
    const events = [meetup(1, '2026-09-01', '2026-09-10'), meetup(2, '2026-10-01', '2026-10-02')];
    expect(nextMeetup(events, '2026-09-05').id).toBe(1);
  });

  it('otherwise picks the closest one still ahead', () => {
    const events = [meetup(1, '2026-11-01', '2026-11-02'), meetup(2, '2026-10-01', '2026-10-02')];
    expect(nextMeetup(events, '2026-09-05').id).toBe(2);
  });

  it('ignores events that are not meetups', () => {
    const events = [{ id: 9, startDate: '2026-09-06', endDate: '2026-09-06', isMeetup: false }];
    expect(nextMeetup(events, '2026-09-05')).toBeNull();
  });

  it('ignores meetups already over', () => {
    expect(nextMeetup([meetup(1, '2026-08-20', '2026-08-25')], '2026-09-05')).toBeNull();
  });
});

describe('serializeEvent', () => {
  it('counts the days left before a meetup', () => {
    const event = { id: 1, title: 'x', emoji: null, startDate: '2026-10-01', endDate: '2026-10-05', isMeetup: true };
    const serialized = serializeEvent(event, '2026-09-21');
    expect(serialized.daysAway).toBe(10);
    expect(serialized.ongoing).toBe(false);
    expect(serialized.isRange).toBe(true);
  });

  it('counts the days remaining while it is happening', () => {
    const event = { id: 1, title: 'x', emoji: null, startDate: '2026-10-01', endDate: '2026-10-05', isMeetup: true };
    const serialized = serializeEvent(event, '2026-10-03');
    expect(serialized.ongoing).toBe(true);
    expect(serialized.daysLeft).toBe(2);
  });
});

describe('events API', () => {
  beforeEach(async () => {
    await resetDb();
    await createUsers();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-09-20T10:00:00Z'));
  });

  afterEach(() => { vi.useRealTimers(); });

  it('creates an event and returns the countdown', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.post('/api/events').send({
      title: '  Annina a Trento  ', emoji: '✈️',
      startDate: '2026-10-10', endDate: '2026-10-17', isMeetup: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Annina a Trento');
    expect(res.body.daysAway).toBe(20);

    const list = await agent.get('/api/events');
    expect(list.body.nextMeetup.id).toBe(res.body.id);
    expect(list.body.nextMeetup.daysAway).toBe(20);
  });

  it('treats a missing end date as a single day', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.post('/api/events').send({ title: 'Esame', startDate: '2026-09-25' });

    expect(res.status).toBe(201);
    expect(res.body.endDate).toBe('2026-09-25');
    expect(res.body.isRange).toBe(false);
  });

  it('leaves past events out of the list', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    await db().event.create({
      data: { title: 'Passato', startDate: '2026-09-01', endDate: '2026-09-02', createdById: 1 },
    });

    const res = await agent.get('/api/events');
    expect(res.body.events).toEqual([]);
    expect(res.body.nextMeetup).toBeNull();
  });

  it('lets either of the two delete a shared event', async () => {
    const mine = await loginAs(app, 'Alessandro', 'password-a');
    const created = await mine.post('/api/events').send({ title: 'Cena', startDate: '2026-09-30' });

    const hers = await loginAs(app, 'Lei', 'password-b');
    const res = await hers.delete(`/api/events/${created.body.id}`);

    expect(res.status).toBe(200);
    expect(await db().event.count()).toBe(0);
  });

  it('rejects an invalid event', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.post('/api/events').send({ title: '', startDate: '2026-10-01' });
    expect(res.status).toBe(400);
  });

  it('requires a session', async () => {
    expect((await supertest(app).get('/api/events')).status).toBe(401);
  });

  it('attaches events to every day they cover in the calendar', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    await agent.post('/api/events').send({
      title: 'Insieme', startDate: '2026-09-28', endDate: '2026-10-02', isMeetup: true,
    });

    const res = await agent.get('/api/calendar/2026-09');
    const byDate = Object.fromEntries(res.body.days.map((d) => [d.date, d]));

    expect(byDate['2026-09-27'].events).toEqual([]);
    expect(byDate['2026-09-28'].events[0].title).toBe('Insieme');
    expect(byDate['2026-09-30'].events[0].title).toBe('Insieme');

    // Lo stesso evento continua nel mese successivo.
    const next = await agent.get('/api/calendar/2026-10');
    const october = Object.fromEntries(next.body.days.map((d) => [d.date, d]));
    expect(october['2026-10-02'].events[0].title).toBe('Insieme');
    expect(october['2026-10-03'].events).toEqual([]);
  });
});
