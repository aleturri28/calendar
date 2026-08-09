import { describe, it, expect, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/lib/db.js';
import { resetDb, createUsers, loginAs } from './helpers/factory.js';
import { romeDate } from '../src/lib/dates.js';

const app = createApp();
const today = () => romeDate();
const PHOTO = 'https://res.cloudinary.com/testcloud/image/upload/v1/p.jpg';

describe('news', () => {
  let users;
  beforeEach(async () => {
    await resetDb();
    users = await createUsers();
  });

  it('counts what the other did since I last looked', async () => {
    await db().user.update({
      where: { id: users.a.id },
      data: { lastSeenAt: new Date('2026-08-09T10:00:00Z') },
    });

    const entry = await db().dayEntry.create({
      data: {
        date: today(), userId: users.b.id,
        photoUrl: PHOTO, photoUploadedAt: new Date('2026-08-09T12:00:00Z'),
      },
    });
    await db().comment.create({
      data: {
        dayEntryId: entry.id, target: 'photo', userId: users.b.id, text: 'ciao',
        createdAt: new Date('2026-08-09T13:00:00Z'),
      },
    });

    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.get('/api/news');

    expect(res.body).toMatchObject({ photos: 1, videos: 0, comments: 1, total: 2 });
  });

  it('ignores what happened before I last looked', async () => {
    await db().user.update({
      where: { id: users.a.id },
      data: { lastSeenAt: new Date('2026-08-09T14:00:00Z') },
    });
    await db().dayEntry.create({
      data: {
        date: today(), userId: users.b.id,
        photoUrl: PHOTO, photoUploadedAt: new Date('2026-08-09T12:00:00Z'),
      },
    });

    const agent = await loginAs(app, 'Alessandro', 'password-a');
    expect((await agent.get('/api/news')).body.total).toBe(0);
  });

  it('never counts my own uploads as news', async () => {
    await db().dayEntry.create({
      data: { date: today(), userId: users.a.id, photoUrl: PHOTO, photoUploadedAt: new Date() },
    });

    const agent = await loginAs(app, 'Alessandro', 'password-a');
    expect((await agent.get('/api/news')).body.total).toBe(0);
  });

  it('counts everything on the very first visit', async () => {
    await db().dayEntry.create({
      data: { date: today(), userId: users.b.id, photoUrl: PHOTO, photoUploadedAt: new Date() },
    });

    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.get('/api/news');
    expect(res.body.since).toBeNull();
    expect(res.body.total).toBe(1);
  });

  it('clears the count once marked as seen', async () => {
    await db().dayEntry.create({
      data: { date: today(), userId: users.b.id, photoUrl: PHOTO, photoUploadedAt: new Date() },
    });

    const agent = await loginAs(app, 'Alessandro', 'password-a');
    expect((await agent.get('/api/news')).body.total).toBe(1);

    await agent.post('/api/news/seen');
    expect((await agent.get('/api/news')).body.total).toBe(0);
  });

  it('flags fresh days in the calendar', async () => {
    await db().user.update({
      where: { id: users.a.id },
      data: { lastSeenAt: new Date('2026-08-09T10:00:00Z') },
    });
    await db().dayEntry.create({
      data: {
        date: today(), userId: users.b.id,
        photoUrl: PHOTO, photoUploadedAt: new Date('2026-08-09T12:00:00Z'),
      },
    });

    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.get(`/api/calendar/${today().slice(0, 7)}`);
    const day = res.body.days.find((d) => d.date === today());

    expect(day.users.find((u) => !u.isMe).fresh).toBe(true);
    expect(day.users.find((u) => u.isMe).fresh).toBe(false);
  });

  it('requires a session', async () => {
    expect((await supertest(app).get('/api/news')).status).toBe(401);
  });
});
