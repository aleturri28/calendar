import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.CLOUDINARY_URL = 'cloudinary://key:secret@testcloud';

// Database dedicato ai test, separato da quello di sviluppo. Sovrascrivibile
// con TEST_DATABASE_URL per puntare altrove (per esempio in CI).
const url = process.env.TEST_DATABASE_URL
  ?? 'postgresql://postgres@localhost:5432/calendar_test';
process.env.DATABASE_URL = url;
process.env.DIRECT_DATABASE_URL = url;

// Vitest gira con cwd server/, lo schema sta nella root del repo.
const schema = join(dirname(fileURLToPath(import.meta.url)), '../../prisma/schema.prisma');

// Solo allineamento dello schema: niente reset distruttivo, sono i test a
// svuotare le tabelle con resetDb() prima di ciascun caso.
execSync(`npx prisma db push --schema "${schema}" --skip-generate`, {
  env: process.env,
  stdio: 'ignore',
});
