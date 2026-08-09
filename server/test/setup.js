import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: join(root, '.env') });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.CLOUDINARY_URL = 'cloudinary://key:secret@testcloud';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

// Stesse credenziali dello sviluppo, database diverso: i test non devono
// dipendere da un utente scritto a mano che potrebbe non esistere più.
function testUrlFromDev(devUrl) {
  if (!devUrl) {
    throw new Error('DATABASE_URL mancante: i test non sanno a quale Postgres collegarsi');
  }

  const url = new URL(devUrl);
  if (!LOCAL_HOSTS.includes(url.hostname)) {
    throw new Error(
      `DATABASE_URL punta a ${url.hostname}, non a localhost. I test creano e ` +
      'svuotano tabelle: per usare un database remoto imposta TEST_DATABASE_URL ' +
      'in modo esplicito.'
    );
  }

  url.pathname = '/calendar_test';
  return url.toString();
}

const url = process.env.TEST_DATABASE_URL ?? testUrlFromDev(process.env.DATABASE_URL);
process.env.DATABASE_URL = url;
process.env.DIRECT_DATABASE_URL = url;

// Vitest gira con cwd server/, lo schema sta nella root del repo.
const schema = join(root, 'prisma/schema.prisma');

// --accept-data-loss serve quando lo schema perde una colonna: su un database
// di test è il comportamento voluto, ed è sicuro perché testUrlFromDev qui
// sopra rifiuta qualunque host che non sia locale.
execSync(`npx prisma db push --schema "${schema}" --skip-generate --accept-data-loss`, {
  env: process.env,
  stdio: 'ignore',
});
