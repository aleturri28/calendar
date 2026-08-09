import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/lib/db.js';
import { resetDb, createUsers, loginAs } from './helpers/factory.js';
import { romeDate, shiftDate } from '../src/lib/dates.js';

const app = createApp();
const today = () => romeDate();

describe('PUT /api/days/:date/min-duration', () => {
  let users;
  beforeEach(async () => {
    await resetDb();
    users = await createUsers();
  });

  it('writes the minimum onto the OTHER user entry', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent
      .put(`/api/days/${today()}/min-duration`)
      .send({ seconds: 90 });

    expect(res.status).toBe(200);

    const mine = await db().dayEntry.findUnique({
      where: { date_userId: { date: today(), userId: users.a.id } },
    });
    const theirs = await db().dayEntry.findUnique({
      where: { date_userId: { date: today(), userId: users.b.id } },
    });

    expect(theirs.minDuration).toBe(90);
    expect(mine).toBeNull();
  });

  it('can be set in advance for a future day', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const future = shiftDate(today(), 3);
    const res = await agent.put(`/api/days/${future}/min-duration`).send({ seconds: 45 });
    expect(res.status).toBe(200);
  });

  // Serve un orologio finto: finché la data odierna coincide con l'inizio del
  // calendario non esiste alcun giorno passato che sia anche valido.
  it('refuses to change a day that has already passed', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-09-15T10:00:00Z'));

    const res = await agent.put('/api/days/2026-09-14/min-duration').send({ seconds: 45 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('day_closed_for_min_duration');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects values outside 5-600', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    for (const seconds of [0, 4, 601, 3.5, 'tanto']) {
      const res = await agent.put(`/api/days/${today()}/min-duration`).send({ seconds });
      expect(res.status).toBe(400);
    }
  });

  it('rejects an invalid date', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.put('/api/days/2026-13-40/min-duration').send({ seconds: 45 });
    expect(res.status).toBe(400);
  });

  it('requires a session', async () => {
    const res = await supertest(app)
      .put(`/api/days/${today()}/min-duration`)
      .send({ seconds: 45 });
    expect(res.status).toBe(401);
  });

  it('updates an existing entry instead of duplicating it', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    await agent.put(`/api/days/${today()}/min-duration`).send({ seconds: 40 });
    await agent.put(`/api/days/${today()}/min-duration`).send({ seconds: 60 });

    const rows = await db().dayEntry.findMany({ where: { date: today(), userId: users.b.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].minDuration).toBe(60);
  });
});
