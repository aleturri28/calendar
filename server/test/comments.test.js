import { describe, it, expect, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/lib/db.js';
import { resetDb, createUsers, loginAs } from './helpers/factory.js';
import { romeDate } from '../src/lib/dates.js';

const app = createApp();
const today = () => romeDate();
const URL = 'https://res.cloudinary.com/testcloud/image/upload/v1/p.jpg';

async function entryWithPhoto(userId) {
  return db().dayEntry.create({
    data: { date: today(), userId, photoUrl: URL, photoUploadedAt: new Date() },
  });
}

describe('comments', () => {
  let users;
  beforeEach(async () => {
    await resetDb();
    users = await createUsers();
  });

  it('adds a comment to the other user photo', async () => {
    await entryWithPhoto(users.b.id);
    const agent = await loginAs(app, 'Alessandro', 'password-a');

    const res = await agent.post(`/api/days/${today()}/comments`)
      .send({ userId: users.b.id, target: 'photo', text: '  che luce  ' });

    expect(res.status).toBe(201);
    expect(res.body.text).toBe('che luce');
    expect(res.body.name).toBe('Alessandro');
    expect(res.body.isMine).toBe(true);
  });

  it('returns comments grouped by target on the day view', async () => {
    const entry = await entryWithPhoto(users.b.id);
    await db().comment.create({
      data: { dayEntryId: entry.id, target: 'photo', userId: users.a.id, text: 'bella' },
    });

    const agent = await loginAs(app, 'Lei', 'password-b');
    const res = await agent.get(`/api/days/${today()}`);
    const hers = res.body.users.find((u) => u.userId === users.b.id);

    expect(hers.comments.photo).toHaveLength(1);
    expect(hers.comments.photo[0].text).toBe('bella');
    expect(hers.comments.photo[0].isMine).toBe(false);
    expect(hers.comments.video).toEqual([]);
  });

  it('refuses a comment on something that was never uploaded', async () => {
    await entryWithPhoto(users.b.id);
    const agent = await loginAs(app, 'Alessandro', 'password-a');

    const res = await agent.post(`/api/days/${today()}/comments`)
      .send({ userId: users.b.id, target: 'video', text: 'bello' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('nothing_to_comment');
  });

  it('rejects empty and oversized text', async () => {
    await entryWithPhoto(users.b.id);
    const agent = await loginAs(app, 'Alessandro', 'password-a');

    for (const text of ['', '   ', 'x'.repeat(141)]) {
      const res = await agent.post(`/api/days/${today()}/comments`)
        .send({ userId: users.b.id, target: 'photo', text });
      expect(res.status).toBe(400);
    }
  });

  it('lets me delete my own comment', async () => {
    const entry = await entryWithPhoto(users.b.id);
    const comment = await db().comment.create({
      data: { dayEntryId: entry.id, target: 'photo', userId: users.a.id, text: 'mia' },
    });

    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.delete(`/api/comments/${comment.id}`);

    expect(res.status).toBe(200);
    expect(await db().comment.count()).toBe(0);
  });

  it('refuses to delete a comment written by the other', async () => {
    const entry = await entryWithPhoto(users.b.id);
    const comment = await db().comment.create({
      data: { dayEntryId: entry.id, target: 'photo', userId: users.b.id, text: 'sua' },
    });

    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.delete(`/api/comments/${comment.id}`);

    expect(res.status).toBe(403);
    expect(await db().comment.count()).toBe(1);
  });

  it('requires a session', async () => {
    const res = await supertest(app).post(`/api/days/${today()}/comments`)
      .send({ userId: users.b.id, target: 'photo', text: 'ciao' });
    expect(res.status).toBe(401);
  });
});
