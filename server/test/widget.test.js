import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/lib/db.js';
import { resetDb, createUsers } from './helpers/factory.js';
import { romeDate } from '../src/lib/dates.js';

const app = createApp();
const today = () => romeDate();
const PHOTO = 'https://res.cloudinary.com/testcloud/image/upload/v1/p.jpg';

describe('GET /api/widget/today', () => {
  let users;
  beforeEach(async () => {
    await resetDb();
    users = await createUsers();
    process.env.WIDGET_TOKEN = 'un-token-lungo-abbastanza';
  });

  afterEach(() => { delete process.env.WIDGET_TOKEN; });

  it('returns today with a valid token and no session', async () => {
    await db().dayEntry.create({
      data: { date: today(), userId: users.b.id, photoUrl: PHOTO, photoUploadedAt: new Date() },
    });

    const res = await supertest(app)
      .get('/api/widget/today')
      .query({ token: 'un-token-lungo-abbastanza' });

    expect(res.status).toBe(200);
    expect(res.body.date).toBe(today());
    const hers = res.body.people.find((p) => p.name === 'Lei');
    expect(hers.hasPhoto).toBe(true);
    expect(hers.thumb).toContain('w_400');
  });

  it('refuses a wrong token', async () => {
    const res = await supertest(app).get('/api/widget/today').query({ token: 'sbagliatissimo-x' });
    expect(res.status).toBe(401);
  });

  it('refuses a missing token', async () => {
    expect((await supertest(app).get('/api/widget/today')).status).toBe(401);
  });

  it('never leaks the full media url, only thumbnails', async () => {
    await db().dayEntry.create({
      data: { date: today(), userId: users.b.id, photoUrl: PHOTO, photoUploadedAt: new Date() },
    });

    const res = await supertest(app)
      .get('/api/widget/today')
      .query({ token: 'un-token-lungo-abbastanza' });

    expect(JSON.stringify(res.body)).not.toContain('/upload/v1/p.jpg');
  });

  it('stays off when no token is configured', async () => {
    delete process.env.WIDGET_TOKEN;
    const res = await supertest(app).get('/api/widget/today').query({ token: 'qualsiasi' });
    expect(res.status).toBe(503);
  });
});
