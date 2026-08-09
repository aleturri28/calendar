import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.CLOUDINARY_URL = 'cloudinary://key:secret@testcloud';

const dir = mkdtempSync(join(tmpdir(), 'calendar-test-'));
process.env.DATABASE_URL = `file:${join(dir, 'test.db')}`;

// Vitest gira con cwd server/, lo schema sta nella root del repo.
const schema = join(dirname(fileURLToPath(import.meta.url)), '../../prisma/schema.prisma');

execSync(`npx prisma db push --schema "${schema}" --skip-generate --accept-data-loss`, {
  env: process.env,
  stdio: 'ignore',
});
