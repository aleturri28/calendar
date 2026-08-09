import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { resetDb, createUsers } from './helpers/factory.js';

const app = createApp();

describe('auth', () => {
  beforeEach(async () => {
    await resetDb();
    await createUsers();
  });

  it('logs in with correct credentials and sets an httpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ name: 'Alessandro', password: 'password-a' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Alessandro');
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('rejects a wrong password without revealing which field was wrong', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ name: 'Alessandro', password: 'sbagliata' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_credentials');
  });

  it('rejects an unknown user with the same error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ name: 'Nessuno', password: 'password-a' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_credentials');
  });

  it('returns 401 on /me without a session', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user on /me with a session', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ name: 'Lei', password: 'password-b' });

    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Lei');
  });

  it('clears the session on logout', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ name: 'Lei', password: 'password-b' });
    await agent.post('/api/auth/logout');

    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
