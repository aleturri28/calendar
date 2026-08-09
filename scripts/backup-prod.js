import 'dotenv/config';
import { spawnSync } from 'node:child_process';

// Salva il database di produzione invece di quello locale.
//
// La stringa di Neon non si può recuperare da Vercel: le variabili lì sono
// marcate "Sensitive" e vengono restituite come [SENSITIVE]. Deve quindi
// stare in .env, che resta solo su questa macchina e fuori da git.

const url = process.env.PROD_DATABASE_URL;

if (!url) {
  console.error(`
PROD_DATABASE_URL non è impostata in .env.

Dove prenderla:
  Neon → il tuo progetto → Connect (o "Connection details")
  → disattiva "Connection pooling" → copia la stringa.
  È quella SENZA "-pooler" nell'host.

Poi incollala in .env, su una riga sua:
  PROD_DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require"

Incollala nel file, non in una chat.
`.trim());
  process.exit(1);
}

if (!/^postgres(ql)?:\/\//.test(url)) {
  console.error('PROD_DATABASE_URL non sembra una stringa di connessione Postgres.');
  process.exit(1);
}

if (url.includes('-pooler.')) {
  console.error('PROD_DATABASE_URL contiene "-pooler": serve la connessione diretta.');
  process.exit(1);
}

const result = spawnSync('node', ['scripts/backup.js'], {
  env: { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url },
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
