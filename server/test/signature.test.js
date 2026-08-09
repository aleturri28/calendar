import { describe, it, expect, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../src/app.js';
import { resetDb, createUsers, loginAs } from './helpers/factory.js';
import { romeDate, shiftDate } from '../src/lib/dates.js';

const app = createApp();
const today = () => romeDate();

describe('POST /api/days/:date/signature', () => {
  let users;
  beforeEach(async () => {
    await resetDb();
    users = await createUsers();
  });

  it('returns a signature scoped to the caller and the day', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.post(`/api/days/${today()}/signature`).send({ kind: 'video' });

    expect(res.status).toBe(200);
    expect(res.body.publicId).toBe(`calendar/${today()}/${users.a.id}-video`);
    expect(res.body.resourceType).toBe('video');
    expect(res.body.signature).toMatch(/^[a-f0-9]{40}$/);
    expect(res.body.cloudName).toBe('testcloud');
    expect(res.body.overwrite).toBe(true);
  });

  it('uses the image resource type for photos', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.post(`/api/days/${today()}/signature`).send({ kind: 'photo' });
    expect(res.body.resourceType).toBe('image');
  });

  it('never leaks the api secret', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.post(`/api/days/${today()}/signature`).send({ kind: 'photo' });
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  it('refuses a day outside the 7-day window', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const old = shiftDate(today(), -8);
    const res = await agent.post(`/api/days/${old}/signature`).send({ kind: 'photo' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('window_closed');
  });

  it('refuses a future day', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent
      .post(`/api/days/${shiftDate(today(), 1)}/signature`)
      .send({ kind: 'photo' });
    expect(res.status).toBe(403);
  });

  it('rejects an unknown kind', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.post(`/api/days/${today()}/signature`).send({ kind: 'audio' });
    expect(res.status).toBe(400);
  });

  it('requires a session', async () => {
    const res = await supertest(app)
      .post(`/api/days/${today()}/signature`)
      .send({ kind: 'photo' });
    expect(res.status).toBe(401);
  });
});
