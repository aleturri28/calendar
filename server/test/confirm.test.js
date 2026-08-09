import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { db } from '../src/lib/db.js';
import { resetDb, createUsers, loginAs } from './helpers/factory.js';
import { romeDate } from '../src/lib/dates.js';
import * as cloud from '../src/lib/cloudinary.js';

const app = createApp();
const today = () => romeDate();

describe('POST /api/days/:date/confirm', () => {
  let users;
  beforeEach(async () => {
    await resetDb();
    users = await createUsers();
    vi.restoreAllMocks();
  });

  it('saves the url and duration read from cloudinary, not from the client', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const publicId = `calendar/${today()}/${users.a.id}-video`;

    vi.spyOn(cloud, 'fetchResource').mockResolvedValue({
      secure_url: 'https://res.cloudinary.com/testcloud/video/upload/v1/real.mp4',
      duration: 42.5,
    });

    const res = await agent.post(`/api/days/${today()}/confirm`).send({
      kind: 'video',
      publicId,
      url: 'https://evil.example/fake.mp4',
      duration: 999,
    });

    expect(res.status).toBe(200);

    const entry = await db().dayEntry.findUnique({
      where: { date_userId: { date: today(), userId: users.a.id } },
    });
    expect(entry.videoUrl).toBe('https://res.cloudinary.com/testcloud/video/upload/v1/real.mp4');
    expect(entry.videoDuration).toBe(42.5);
    expect(entry.videoUploadedAt).toBeInstanceOf(Date);
  });

  // Non esiste più una durata minima: un video brevissimo è accettabile.
  it('accepts a very short video', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    vi.spyOn(cloud, 'fetchResource').mockResolvedValue({
      secure_url: 'https://res.cloudinary.com/testcloud/video/upload/v1/brief.mp4',
      duration: 3,
    });

    const res = await agent.post(`/api/days/${today()}/confirm`).send({
      kind: 'video',
      publicId: `calendar/${today()}/${users.a.id}-video`,
    });

    expect(res.status).toBe(200);
  });

  it('rejects and deletes a video longer than one minute', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');

    vi.spyOn(cloud, 'fetchResource').mockResolvedValue({
      secure_url: 'https://res.cloudinary.com/testcloud/video/upload/v1/long.mp4',
      duration: 74,
    });
    const destroy = vi.spyOn(cloud, 'destroyResource').mockResolvedValue({ result: 'ok' });

    const res = await agent.post(`/api/days/${today()}/confirm`).send({
      kind: 'video',
      publicId: `calendar/${today()}/${users.a.id}-video`,
    });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: 'video_too_long', duration: 74, maxDuration: 60 });
    expect(destroy).toHaveBeenCalledWith(`calendar/${today()}/${users.a.id}-video`, 'video');

    const entry = await db().dayEntry.findUnique({
      where: { date_userId: { date: today(), userId: users.a.id } },
    });
    expect(entry).toBeNull();
  });

  it('accepts a video of exactly one minute', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    vi.spyOn(cloud, 'fetchResource').mockResolvedValue({
      secure_url: 'https://res.cloudinary.com/testcloud/video/upload/v1/exact.mp4',
      duration: 60,
    });

    const res = await agent.post(`/api/days/${today()}/confirm`).send({
      kind: 'video',
      publicId: `calendar/${today()}/${users.a.id}-video`,
    });

    expect(res.status).toBe(200);
  });

  it('does not apply a duration check to photos', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    vi.spyOn(cloud, 'fetchResource').mockResolvedValue({
      secure_url: 'https://res.cloudinary.com/testcloud/image/upload/v1/p.jpg',
    });

    const res = await agent.post(`/api/days/${today()}/confirm`).send({
      kind: 'photo',
      publicId: `calendar/${today()}/${users.a.id}-photo`,
    });

    expect(res.status).toBe(200);
  });

  it('refuses a publicId belonging to the other user', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.post(`/api/days/${today()}/confirm`).send({
      kind: 'photo',
      publicId: `calendar/${today()}/${users.b.id}-photo`,
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('public_id_mismatch');
  });

  it('returns 404 when the resource is not on cloudinary', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    vi.spyOn(cloud, 'fetchResource').mockRejectedValue(new Error('Resource not found'));

    const res = await agent.post(`/api/days/${today()}/confirm`).send({
      kind: 'photo',
      publicId: `calendar/${today()}/${users.a.id}-photo`,
    });

    expect(res.status).toBe(404);
  });
});
