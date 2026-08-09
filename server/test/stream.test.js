import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/lib/db.js';
import { resetDb, createUsers, loginAs } from './helpers/factory.js';
import { romeDate } from '../src/lib/dates.js';
import { thumbnailUrl, videoPosterUrl } from '../src/lib/days.js';

const app = createApp();
const today = () => romeDate();
const PHOTO = 'https://res.cloudinary.com/testcloud/image/upload/v1/p.jpg';
const VIDEO = 'https://res.cloudinary.com/testcloud/video/upload/v1/v.mp4';

describe('thumbnailUrl', () => {
  it('injects a resize transformation into a cloudinary url', () => {
    expect(thumbnailUrl(PHOTO, 160))
      .toBe('https://res.cloudinary.com/testcloud/image/upload/c_fill,g_auto,w_160,h_160,q_auto,f_auto/v1/p.jpg');
  });

  it('leaves a foreign url untouched', () => {
    expect(thumbnailUrl('https://example.com/x.jpg')).toBe('https://example.com/x.jpg');
  });

  it('returns null when there is nothing to resize', () => {
    expect(thumbnailUrl(null)).toBeNull();
  });

  it('turns a video into a jpg cover frame', () => {
    expect(videoPosterUrl(VIDEO, 160)).toMatch(/\.jpg$/);
  });
});

describe('GET /api/feed', () => {
  let users;
  beforeEach(async () => {
    await resetDb();
    users = await createUsers();
  });

  // Orologio finto: finché oggi coincide con l'inizio del calendario non
  // esiste un "ieri" che sia anche dentro il periodo.
  it('lists days with content, newest first, the other user first', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-09-20T10:00:00Z'));

    await db().dayEntry.create({
      data: { date: '2026-09-19', userId: users.a.id, photoUrl: PHOTO, photoUploadedAt: new Date() },
    });
    await db().dayEntry.create({
      data: { date: '2026-09-20', userId: users.b.id, photoUrl: PHOTO, photoUploadedAt: new Date() },
    });

    const res = await agent.get('/api/feed');

    expect(res.status).toBe(200);
    expect(res.body.days.map((d) => d.date)).toEqual(['2026-09-20', '2026-09-19']);
    expect(res.body.days[0].users[0].isMe).toBe(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips days where nobody posted anything', async () => {
    await db().dayEntry.create({ data: { date: today(), userId: users.a.id } });

    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.get('/api/feed');

    expect(res.body.days).toEqual([]);
  });

  it('requires a session', async () => {
    expect((await supertest(app).get('/api/feed')).status).toBe(401);
  });
});

describe('GET /api/timeline', () => {
  let users;
  beforeEach(async () => {
    await resetDb();
    users = await createUsers();
  });

  it('returns every photo in chronological order', async () => {
    await db().dayEntry.create({
      data: { date: '2026-08-11', userId: users.a.id, photoUrl: PHOTO, photoUploadedAt: new Date() },
    });
    await db().dayEntry.create({
      data: { date: '2026-08-09', userId: users.b.id, photoUrl: PHOTO, photoUploadedAt: new Date() },
    });
    // Senza foto: non deve comparire nella striscia.
    await db().dayEntry.create({
      data: { date: '2026-08-10', userId: users.a.id, videoUrl: VIDEO, videoUploadedAt: new Date() },
    });

    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.get('/api/timeline');

    expect(res.body.shots.map((s) => s.date)).toEqual(['2026-08-09', '2026-08-11']);
    expect(res.body.shots[0].thumb).toContain('w_400');
    expect(res.body.shots[0].name).toBe('Lei');
  });

  it('requires a session', async () => {
    expect((await supertest(app).get('/api/timeline')).status).toBe(401);
  });
});
