import bcrypt from 'bcryptjs';
import request from 'supertest';
import { db } from '../../src/lib/db.js';

export async function resetDb() {
  await db().dayEntry.deleteMany();
  await db().event.deleteMany();
  await db().user.deleteMany();
}

export async function createUsers() {
  const passwordHash = await bcrypt.hash('password-a', 12);
  const passwordHashB = await bcrypt.hash('password-b', 12);
  const a = await db().user.create({ data: { name: 'Alessandro', passwordHash } });
  const b = await db().user.create({ data: { name: 'Lei', passwordHash: passwordHashB } });
  return { a, b };
}

export async function loginAs(app, name, password) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ name, password });
  if (res.status !== 200) throw new Error(`login fallito per ${name}: ${res.status}`);
  return agent;
}
