import { describe, it, expect, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/lib/db.js';
import { resetDb, createUsers, loginAs } from './helpers/factory.js';
import { romeDate } from '../src/lib/dates.js';

const app = createApp();
const today = () => romeDate();

describe('GET /api/days/:date', () => {
  let users;
  beforeEach(async () => {
    await resetDb();
    users = await createUsers();
  });

  it('returns both users, mine first', async () => {
    const agent = await loginAs(app, 'Lei', 'password-b');
    const res = await agent.get(`/api/days/${today()}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
    expect(res.body.users[0].userId).toBe(users.b.id);
    expect(res.body.users[0].isMe).toBe(true);
    expect(res.body.isOpen).toBe(true);
  });

  it('reports the minimum the other user set for me', async () => {
    await db().dayEntry.create({
      data: { date: today(), userId: users.b.id, minDuration: 75 },
    });
    const agent = await loginAs(app, 'Lei', 'password-b');
    const res = await agent.get(`/api/days/${today()}`);

    expect(res.body.users[0].minDuration).toBe(75);
  });

  it('rejects a date before the calendar start', async () => {
    const agent = await loginAs(app, 'Lei', 'password-b');
    const res = await agent.get('/api/days/2026-08-08');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/calendar/:month', () => {
  let users;
  beforeEach(async () => {
    await resetDb();
    users = await createUsers();
  });

  it('returns one entry per day of the month', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.get('/api/calendar/2026-09');

    expect(res.status).toBe(200);
    expect(res.body.days).toHaveLength(30);
    expect(res.body.days[0].date).toBe('2026-09-01');
  });

  it('marks a day complete only when both posted photo and video', async () => {
    const url = 'https://res.cloudinary.com/testcloud/x';
    await db().dayEntry.create({
      data: {
        date: '2026-09-05', userId: users.a.id,
        photoUrl: url, videoUrl: url,
        photoUploadedAt: new Date('2026-09-05T10:00:00Z'),
        videoUploadedAt: new Date('2026-09-05T10:00:00Z'),
      },
    });
    await db().dayEntry.create({
      data: {
        date: '2026-09-05', userId: users.b.id,
        photoUrl: url, videoUrl: url,
        photoUploadedAt: new Date('2026-09-05T10:00:00Z'),
        videoUploadedAt: new Date('2026-09-05T10:00:00Z'),
      },
    });
    await db().dayEntry.create({
      data: {
        date: '2026-09-06', userId: users.a.id, photoUrl: url,
        photoUploadedAt: new Date('2026-09-06T10:00:00Z'),
      },
    });

    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.get('/api/calendar/2026-09');
    const byDate = Object.fromEntries(res.body.days.map((d) => [d.date, d]));

    expect(byDate['2026-09-05'].state).toBe('complete');
    expect(byDate['2026-09-06'].state).toBe('partial');
    expect(byDate['2026-09-07'].state).toBe('empty');
  });

  it('flags content uploaded after its own day as late', async () => {
    await db().dayEntry.create({
      data: {
        date: '2026-09-10', userId: users.a.id,
        photoUrl: 'https://res.cloudinary.com/testcloud/x',
        photoUploadedAt: new Date('2026-09-12T08:00:00Z'),
      },
    });

    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.get('/api/calendar/2026-09');
    const day = res.body.days.find((d) => d.date === '2026-09-10');
    const mine = day.users.find((u) => u.userId === users.a.id);

    expect(mine.photoLate).toBe(true);
  });

  it('rejects a malformed month', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    expect((await agent.get('/api/calendar/2026-13')).status).toBe(400);
    expect((await agent.get('/api/calendar/nope')).status).toBe(400);
  });

  it('requires a session', async () => {
    const res = await supertest(app).get('/api/calendar/2026-09');
    expect(res.status).toBe(401);
  });
});
