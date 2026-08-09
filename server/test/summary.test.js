import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/lib/db.js';
import { resetDb, createUsers, loginAs } from './helpers/factory.js';
import { longestStreak, isFullDay } from '../src/lib/summary.js';

const app = createApp();
const PHOTO = 'https://res.cloudinary.com/testcloud/image/upload/v1/p.jpg';
const VIDEO = 'https://res.cloudinary.com/testcloud/video/upload/v1/v.mp4';

describe('longestStreak', () => {
  it('counts the longest run of consecutive days', () => {
    expect(longestStreak(['2026-08-09', '2026-08-10', '2026-08-11', '2026-08-14'])).toBe(3);
  });

  it('handles a run across a month boundary', () => {
    expect(longestStreak(['2026-08-30', '2026-08-31', '2026-09-01'])).toBe(3);
  });

  it('is zero without any full day', () => {
    expect(longestStreak([])).toBe(0);
  });

  it('does not care about the order it is given', () => {
    expect(longestStreak(['2026-08-11', '2026-08-09', '2026-08-10'])).toBe(3);
  });
});

describe('isFullDay', () => {
  const complete = { photoUrl: PHOTO, videoUrl: VIDEO };

  it('needs both people with both pieces', () => {
    expect(isFullDay([complete, complete], 2)).toBe(true);
  });

  it('rejects a day where one is missing entirely', () => {
    expect(isFullDay([complete], 2)).toBe(false);
  });

  it('rejects a day where someone skipped the video', () => {
    expect(isFullDay([complete, { photoUrl: PHOTO, videoUrl: null }], 2)).toBe(false);
  });
});

describe('GET /api/summary/:month', () => {
  let users;
  beforeEach(async () => {
    await resetDb();
    users = await createUsers();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-08-31T10:00:00Z'));
  });

  afterEach(() => { vi.useRealTimers(); });

  async function fullDay(date) {
    for (const user of [users.a, users.b]) {
      await db().dayEntry.create({
        data: {
          date, userId: user.id,
          photoUrl: PHOTO, photoUploadedAt: new Date(),
          videoUrl: VIDEO, videoUploadedAt: new Date(),
        },
      });
    }
  }

  it('counts full days, the streak and the media', async () => {
    await fullDay('2026-08-09');
    await fullDay('2026-08-10');
    await db().dayEntry.create({
      data: { date: '2026-08-12', userId: users.a.id, photoUrl: PHOTO, photoUploadedAt: new Date() },
    });

    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.get('/api/summary/2026-08');

    expect(res.status).toBe(200);
    expect(res.body.fullDays).toBe(2);
    expect(res.body.longestStreak).toBe(2);
    expect(res.body.photos).toBe(5);
    expect(res.body.videos).toBe(4);
    expect(res.body.collage).toHaveLength(5);
  });

  it('names the most commented day and who wrote more', async () => {
    await fullDay('2026-08-09');
    const entry = await db().dayEntry.findFirst({ where: { date: '2026-08-09' } });
    for (const text of ['uno', 'due', 'tre']) {
      await db().comment.create({
        data: { dayEntryId: entry.id, target: 'photo', userId: users.b.id, text },
      });
    }

    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.get('/api/summary/2026-08');

    expect(res.body.mostCommented).toEqual({ date: '2026-08-09', count: 3 });
    expect(res.body.comments).toBe(3);
    expect(res.body.commentsBy.find((c) => c.userId === users.b.id).count).toBe(3);
    expect(res.body.commentsBy.find((c) => c.userId === users.a.id).count).toBe(0);
  });

  it('counts only days that have actually happened', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.get('/api/summary/2026-08');
    // Dal 9 (inizio del calendario) al 31: 23 giorni, non 31.
    expect(res.body.days).toBe(23);
  });

  it('rejects a malformed month', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    expect((await agent.get('/api/summary/2026-13')).status).toBe(400);
  });

  it('requires a session', async () => {
    expect((await supertest(app).get('/api/summary/2026-08')).status).toBe(401);
  });
});
