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

  it('shows the other person latest photo, not my own', async () => {
    await db().dayEntry.create({
      data: {
        date: today(), userId: users.a.id,
        photoUrl: 'https://res.cloudinary.com/testcloud/image/upload/v1/mine.jpg',
        photoUploadedAt: new Date('2026-08-09T18:00:00Z'),
      },
    });
    await db().dayEntry.create({
      data: {
        date: today(), userId: users.b.id,
        photoUrl: PHOTO, photoUploadedAt: new Date('2026-08-09T09:00:00Z'),
      },
    });

    const res = await supertest(app).get('/api/widget/latest')
      .query({ token: 'un-token-lungo-abbastanza', as: 'Alessandro' });

    expect(res.status).toBe(200);
    expect(res.body.from).toBe('Lei');
    expect(res.body.thumb).not.toContain('mine.jpg');
    expect(res.body.isToday).toBe(true);
  });

  it('picks the most recently uploaded photo, not the most recent day', async () => {
    await db().dayEntry.create({
      data: {
        date: '2026-08-15', userId: users.b.id,
        photoUrl: 'https://res.cloudinary.com/testcloud/image/upload/v1/vecchia.jpg',
        photoUploadedAt: new Date('2026-08-15T09:00:00Z'),
      },
    });
    // Giorno precedente, ma caricata dopo: è questa la novità da mostrare.
    await db().dayEntry.create({
      data: {
        date: '2026-08-12', userId: users.b.id,
        photoUrl: 'https://res.cloudinary.com/testcloud/image/upload/v1/recuperata.jpg',
        photoUploadedAt: new Date('2026-08-16T20:00:00Z'),
      },
    });

    const res = await supertest(app).get('/api/widget/latest')
      .query({ token: 'un-token-lungo-abbastanza', as: 'Alessandro' });

    expect(res.body.date).toBe('2026-08-12');
    expect(res.body.thumb).toContain('recuperata.jpg');
  });

  it('is symmetric: she sees him', async () => {
    await db().dayEntry.create({
      data: { date: today(), userId: users.a.id, photoUrl: PHOTO, photoUploadedAt: new Date() },
    });

    const res = await supertest(app).get('/api/widget/latest')
      .query({ token: 'un-token-lungo-abbastanza', as: 'Lei' });

    expect(res.body.from).toBe('Alessandro');
    expect(res.body.hasPhoto).toBe(true);
  });

  it('says so when the other has never posted', async () => {
    const res = await supertest(app).get('/api/widget/latest')
      .query({ token: 'un-token-lungo-abbastanza', as: 'Alessandro' });

    expect(res.status).toBe(200);
    expect(res.body.hasPhoto).toBe(false);
    expect(res.body.thumb).toBeNull();
  });

  it('rejects an unknown or missing viewer', async () => {
    const unknown = await supertest(app).get('/api/widget/latest')
      .query({ token: 'un-token-lungo-abbastanza', as: 'Nessuno' });
    expect(unknown.status).toBe(400);

    const missing = await supertest(app).get('/api/widget/latest')
      .query({ token: 'un-token-lungo-abbastanza' });
    expect(missing.status).toBe(400);
  });

  it('still needs the token', async () => {
    const res = await supertest(app).get('/api/widget/latest')
      .query({ token: 'sbagliatissimo-x', as: 'Alessandro' });
    expect(res.status).toBe(401);
  });

  it('stays off when no token is configured', async () => {
    delete process.env.WIDGET_TOKEN;
    const res = await supertest(app).get('/api/widget/today').query({ token: 'qualsiasi' });
    expect(res.status).toBe(503);
  });
});
