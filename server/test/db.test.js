import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/lib/db.js';
import { resetDb, createUsers } from './helpers/factory.js';

describe('schema', () => {
  beforeEach(resetDb);

  it('enforces one entry per user per day', async () => {
    const { a } = await createUsers();
    await db().dayEntry.create({ data: { date: '2026-08-09', userId: a.id } });
    await expect(
      db().dayEntry.create({ data: { date: '2026-08-09', userId: a.id } })
    ).rejects.toThrow();
  });

  it('defaults minDuration to 30', async () => {
    const { a } = await createUsers();
    const entry = await db().dayEntry.create({ data: { date: '2026-08-10', userId: a.id } });
    expect(entry.minDuration).toBe(30);
  });
});
