# MVP Calendario Condiviso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web app per 2 utenti fissi dove ogni giorno ciascuno carica una foto e un video, con durata minima del video decisa dall'altro, visualizzati su un calendario mensile.

**Architecture:** Servizio unico: Express espone le API sotto `/api` e serve il build statico di React per tutto il resto. SQLite via Prisma su volume persistente. I file non passano mai dal backend: il browser li carica direttamente su Cloudinary con una firma emessa dal server, che poi verifica la risorsa via Admin API prima di salvare la riga.

**Tech Stack:** Node 20+ (ESM), Express 5, Prisma + SQLite, jsonwebtoken, bcryptjs, cloudinary, React 18 + Vite + react-router-dom, Vitest + supertest.

## Global Constraints

- **Spec di riferimento:** `docs/superpowers/specs/2026-08-09-calendario-condiviso-design.md`. In caso di conflitto, vince la spec.
- **Tutto in ESM** (`"type": "module"` in ogni package.json). Niente `require`.
- **Fuso orario:** `Europe/Rome`, sempre. Ogni data è una stringa `YYYY-MM-DD` e i confronti tra date sono confronti tra stringhe. Nessuna aritmetica su timestamp UTC fuori da `lib/dates.js`.
- **Data di inizio calendario:** `2026-08-09`. Date precedenti non esistono.
- **Finestra di upload:** `date >= today - 7` e `date <= today`.
- **Durata minima video:** default `30` secondi, range consentito `5`–`600`.
- **`bcryptjs`, non `bcrypt`**: bcrypt richiede compilazione nativa e rompe i build su Railway. Cost 12.
- **Il server non si fida mai del client**: URL e durata dei media si leggono dall'Admin API di Cloudinary, mai dal body della request.
- **Nessun segreto committato.** `.env` è già in `.gitignore`; verificare con `git check-ignore .env` prima di ogni commit che tocchi la configurazione.
- **Lingua:** codice, nomi e commenti in inglese; testo dell'interfaccia in italiano.

---

## File Structure

```
package.json                 workspace root, script di build/start
railway.json                 config deploy
.env.example                 sole chiavi, nessun valore

prisma/
  schema.prisma              User, DayEntry, Event
  seed.js                    crea/aggiorna i 2 account da .env

server/
  package.json
  vitest.config.js
  src/
    index.js                 bootstrap: listen
    app.js                   createApp(): monta middleware, route, static
    lib/
      db.js                  PrismaClient lazy
      dates.js               romeDate, shiftDate, isUploadOpen, isLate
      auth.js                signSession, cookieOptions, requireAuth
      cloudinary.js          signUpload, fetchResource, destroyResource
      days.js                publicIdFor, otherUserId, entryStatus, dayState
    routes/
      auth.js                login, logout, me
      days.js                signature, confirm, min-duration, GET :date
      calendar.js            GET :month
  test/
    setup.js                 crea DB temporaneo prima dei test
    helpers/factory.js       creazione utenti/entry nei test
    dates.test.js
    auth.test.js
    min-duration.test.js
    signature.test.js
    confirm.test.js
    calendar.test.js

client/
  package.json
  vite.config.js
  index.html
  src/
    main.jsx                 router
    api.js                   fetch wrapper con credentials
    upload.js                readVideoDuration, uploadToCloudinary
    pages/
      Login.jsx
      Month.jsx
      Day.jsx
    components/
      CalendarGrid.jsx
      DayCell.jsx
      UploadSlot.jsx
```

Il criterio di divisione è la responsabilità, non il layer tecnico: `lib/dates.js` contiene tutta la logica di calendario ed è puro (testabile senza database né HTTP), `lib/days.js` contiene le regole di dominio sui giorni, le route restano sottili e si limitano a validare input, chiamare le lib e scegliere lo status code.

---

### Task 1: Scaffold workspace ed Express

**Files:**
- Create: `package.json`, `server/package.json`, `server/vitest.config.js`, `server/src/app.js`, `server/src/index.js`, `server/test/health.test.js`, `.env.example`

**Interfaces:**
- Consumes: niente (primo task)
- Produces: `createApp(): express.Application` da `server/src/app.js`

- [ ] **Step 1: Creare il workspace root**

`package.json`:

```json
{
  "name": "calendar",
  "private": true,
  "type": "module",
  "workspaces": ["client", "server"],
  "scripts": {
    "dev:server": "npm run dev --workspace server",
    "dev:client": "npm run dev --workspace client",
    "test": "npm run test --workspace server",
    "build": "npm run build --workspace client",
    "start": "node server/src/index.js"
  }
}
```

- [ ] **Step 2: Creare il package del server**

`server/package.json`:

```json
{
  "name": "server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch src/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@prisma/client": "^6.1.0",
    "bcryptjs": "^2.4.3",
    "cloudinary": "^2.5.1",
    "cookie-parser": "^1.4.7",
    "dotenv": "^16.4.7",
    "express": "^5.0.1",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "prisma": "^6.1.0",
    "supertest": "^7.0.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 3: Installare le dipendenze**

```bash
npm install
```

- [ ] **Step 4: Scrivere il test che fallisce**

`server/test/health.test.js`:

```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 5: Configurare Vitest**

`server/vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.js'],
    fileParallelism: false,
  },
});
```

`server/test/setup.js` — per ora solo le variabili d'ambiente, il database arriva nel Task 2:

```js
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
```

- [ ] **Step 6: Verificare che il test fallisca**

Run: `npm test --workspace server`
Expected: FAIL, `Cannot find module '../src/app.js'`

- [ ] **Step 7: Implementare l'app factory**

`server/src/app.js`:

```js
import express from 'express';
import cookieParser from 'cookie-parser';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  return app;
}
```

`server/src/index.js`:

```js
import 'dotenv/config';
import { createApp } from './app.js';

const port = process.env.PORT || 3000;
createApp().listen(port, () => {
  console.log(`listening on ${port}`);
});
```

- [ ] **Step 8: Verificare che il test passi**

Run: `npm test --workspace server`
Expected: PASS, 1 test

- [ ] **Step 9: Creare `.env.example`**

Solo le chiavi, nessun valore reale:

```
CLOUDINARY_URL=
DATABASE_URL=file:./dev.db
JWT_SECRET=
USER_A_NAME=
USER_A_PASSWORD=
USER_B_NAME=
USER_B_PASSWORD=
```

- [ ] **Step 10: Verificare che nessun segreto sia in stage e committare**

```bash
git add -A
git status --short
git check-ignore -v .env
git commit -m "feat: scaffold express server with health endpoint"
```

`git status --short` non deve elencare `.env`. Se lo elenca, fermarsi e sistemare `.gitignore` prima di committare.

---

### Task 2: Schema Prisma, database e seed

**Files:**
- Create: `prisma/schema.prisma`, `prisma/seed.js`, `server/src/lib/db.js`, `server/test/helpers/factory.js`
- Modify: `server/test/setup.js`

**Interfaces:**
- Consumes: niente
- Produces:
  - `db(): PrismaClient` da `server/src/lib/db.js`
  - `createUsers(): Promise<{a: User, b: User}>` e `resetDb(): Promise<void>` da `server/test/helpers/factory.js`
  - Modelli `User`, `DayEntry`, `Event`

- [ ] **Step 1: Scrivere lo schema**

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id           Int        @id @default(autoincrement())
  name         String     @unique
  passwordHash String
  entries      DayEntry[]
}

model DayEntry {
  id              Int       @id @default(autoincrement())
  date            String
  userId          Int
  user            User      @relation(fields: [userId], references: [id])
  minDuration     Int       @default(30)
  photoUrl        String?
  photoPublicId   String?
  photoUploadedAt DateTime?
  videoUrl        String?
  videoPublicId   String?
  videoDuration   Float?
  videoUploadedAt DateTime?
  createdAt       DateTime  @default(now())

  @@unique([date, userId])
  @@index([date])
}

model Event {
  id          Int     @id @default(autoincrement())
  title       String
  emoji       String?
  startDate   String
  endDate     String
  isMeetup    Boolean @default(false)
  createdById Int

  @@index([startDate])
}
```

`Event` viene creato ora e resta inutilizzato in questo giro: le sue route arrivano dopo, ma così la migrazione si fa una volta sola.

- [ ] **Step 2: Generare la migrazione**

```bash
npx prisma migrate dev --name init
```

Expected: crea `prisma/migrations/*_init/` e genera il client.

- [ ] **Step 3: Scrivere il client lazy**

`server/src/lib/db.js` — la creazione è pigra perché `DATABASE_URL` viene impostata dai test **dopo** il caricamento dei moduli:

```js
import { PrismaClient } from '@prisma/client';

let client;

export function db() {
  if (!client) client = new PrismaClient();
  return client;
}
```

- [ ] **Step 4: Preparare il database dei test**

`server/test/setup.js` (sostituisce il contenuto del Task 1):

```js
import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.CLOUDINARY_URL = 'cloudinary://key:secret@testcloud';

const dir = mkdtempSync(join(tmpdir(), 'calendar-test-'));
process.env.DATABASE_URL = `file:${join(dir, 'test.db')}`;

execSync('npx prisma db push --skip-generate --accept-data-loss', {
  env: process.env,
  stdio: 'ignore',
});
```

- [ ] **Step 5: Scrivere la factory per i test**

`server/test/helpers/factory.js`:

```js
import bcrypt from 'bcryptjs';
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
```

- [ ] **Step 6: Scrivere il test che fallisce**

`server/test/db.test.js`:

```js
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
```

- [ ] **Step 7: Eseguire i test**

Run: `npm test --workspace server`
Expected: PASS, 3 test totali (health + i due nuovi)

- [ ] **Step 8: Scrivere il seed**

`prisma/seed.js` — rilanciabile: aggiorna le password senza toccare i DayEntry già caricati.

```js
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function required(key) {
  const value = process.env[key];
  if (!value || !value.trim()) {
    throw new Error(`${key} mancante in .env — riempilo prima di lanciare il seed`);
  }
  return value.trim();
}

async function upsertUser(nameKey, passwordKey) {
  const name = required(nameKey);
  const passwordHash = await bcrypt.hash(required(passwordKey), 12);
  await prisma.user.upsert({
    where: { name },
    update: { passwordHash },
    create: { name, passwordHash },
  });
  console.log(`utente pronto: ${name}`);
}

await upsertUser('USER_A_NAME', 'USER_A_PASSWORD');
await upsertUser('USER_B_NAME', 'USER_B_PASSWORD');
await prisma.$disconnect();
```

Aggiungere allo script del root `package.json`: `"seed": "node prisma/seed.js"`.

- [ ] **Step 9: Verificare che il seed fallisca in modo esplicito**

Con `USER_B_PASSWORD` ancora vuota in `.env`:

Run: `npm run seed`
Expected: errore `USER_B_PASSWORD mancante in .env — riempilo prima di lanciare il seed`, exit code diverso da 0.

Non riempire le password al posto dell'utente: sono sue. Annotare che il seed va rilanciato quando le avrà inserite.

- [ ] **Step 10: Committare**

```bash
git add -A
git status --short
git commit -m "feat: add prisma schema, lazy client and seed script"
```

---

### Task 3: Libreria date

**Files:**
- Create: `server/src/lib/dates.js`, `server/test/dates.test.js`

**Interfaces:**
- Consumes: niente
- Produces, da `server/src/lib/dates.js`:
  - `START_DATE: string` (`'2026-08-09'`)
  - `WINDOW_DAYS: number` (`7`)
  - `romeDate(instant?: Date): string` → `'YYYY-MM-DD'`
  - `shiftDate(date: string, days: number): string`
  - `isValidDate(date: string): boolean`
  - `isUploadOpen(date: string, now?: Date): boolean`
  - `isLate(date: string, uploadedAt: Date | null): boolean`

- [ ] **Step 1: Scrivere i test che falliscono**

`server/test/dates.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  romeDate, shiftDate, isValidDate, isUploadOpen, isLate,
} from '../src/lib/dates.js';

describe('romeDate', () => {
  it('formats an instant as a Rome calendar date', () => {
    expect(romeDate(new Date('2026-08-09T10:00:00Z'))).toBe('2026-08-09');
  });

  it('rolls over at Rome midnight, not UTC midnight', () => {
    // 22:30 UTC in estate = 00:30 del giorno dopo a Roma (CEST, +2)
    expect(romeDate(new Date('2026-08-09T22:30:00Z'))).toBe('2026-08-10');
  });

  it('handles winter offset (+1)', () => {
    expect(romeDate(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
  });
});

describe('shiftDate', () => {
  it('moves backwards across a month boundary', () => {
    expect(shiftDate('2026-09-03', -7)).toBe('2026-08-27');
  });

  it('moves forwards across a year boundary', () => {
    expect(shiftDate('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('is unaffected by the DST switch', () => {
    // ultima domenica di ottobre 2026: 25 ottobre
    expect(shiftDate('2026-10-24', 2)).toBe('2026-10-26');
  });
});

describe('isValidDate', () => {
  it('accepts a well-formed date', () => {
    expect(isValidDate('2026-08-09')).toBe(true);
  });

  it('rejects malformed input', () => {
    expect(isValidDate('2026-8-9')).toBe(false);
    expect(isValidDate('nope')).toBe(false);
    expect(isValidDate('2026-02-30')).toBe(false);
  });
});

describe('isUploadOpen', () => {
  const now = new Date('2026-09-10T09:00:00Z'); // a Roma: 2026-09-10

  it('accepts today', () => {
    expect(isUploadOpen('2026-09-10', now)).toBe(true);
  });

  it('accepts the oldest day still in the window', () => {
    expect(isUploadOpen('2026-09-03', now)).toBe(true);
  });

  it('rejects the day just outside the window', () => {
    expect(isUploadOpen('2026-09-02', now)).toBe(false);
  });

  it('rejects the future', () => {
    expect(isUploadOpen('2026-09-11', now)).toBe(false);
  });

  it('rejects dates before the calendar start', () => {
    expect(isUploadOpen('2026-08-08', new Date('2026-08-09T09:00:00Z'))).toBe(false);
  });
});

describe('isLate', () => {
  it('is false when uploaded on the same Rome day', () => {
    expect(isLate('2026-08-09', new Date('2026-08-09T21:00:00Z'))).toBe(false);
  });

  it('is true when uploaded after Rome midnight', () => {
    expect(isLate('2026-08-09', new Date('2026-08-09T22:30:00Z'))).toBe(true);
  });

  it('is false when nothing was uploaded', () => {
    expect(isLate('2026-08-09', null)).toBe(false);
  });
});
```

- [ ] **Step 2: Verificare che i test falliscano**

Run: `npm test --workspace server -- dates`
Expected: FAIL, `Cannot find module '../src/lib/dates.js'`

- [ ] **Step 3: Implementare la libreria**

`server/src/lib/dates.js`:

```js
const TZ = 'Europe/Rome';
const FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const START_DATE = '2026-08-09';
export const WINDOW_DAYS = 7;

// 'en-CA' produce esattamente YYYY-MM-DD
export function romeDate(instant = new Date()) {
  return FORMATTER.format(instant);
}

// L'aritmetica gira su UTC puro, così il cambio d'ora non sposta mai il risultato.
export function shiftDate(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function isValidDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return utc.toISOString().slice(0, 10) === date;
}

export function isUploadOpen(date, now = new Date()) {
  if (!isValidDate(date) || date < START_DATE) return false;
  const today = romeDate(now);
  return date <= today && date >= shiftDate(today, -WINDOW_DAYS);
}

export function isLate(date, uploadedAt) {
  if (!uploadedAt) return false;
  return romeDate(uploadedAt) > date;
}
```

- [ ] **Step 4: Verificare che i test passino**

Run: `npm test --workspace server -- dates`
Expected: PASS, 15 test

- [ ] **Step 5: Committare**

```bash
git add server/src/lib/dates.js server/test/dates.test.js
git commit -m "feat: add Rome-timezone date helpers with upload window rules"
```

---

### Task 4: Autenticazione

**Files:**
- Create: `server/src/lib/auth.js`, `server/src/routes/auth.js`, `server/test/auth.test.js`
- Modify: `server/src/app.js`

**Interfaces:**
- Consumes: `db()` (Task 2), `createUsers`/`resetDb` (Task 2)
- Produces:
  - da `server/src/lib/auth.js`: `signSession(userId: number): string`, `cookieOptions(): object`, `requireAuth(req, res, next)` che imposta `req.userId: number`, `COOKIE_NAME: string`
  - route `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
  - helper di test `loginAs(app, name, password)` in `server/test/helpers/factory.js`

- [ ] **Step 1: Scrivere i test che falliscono**

`server/test/auth.test.js`:

```js
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
```

- [ ] **Step 2: Verificare che i test falliscano**

Run: `npm test --workspace server -- auth`
Expected: FAIL, 404 su tutte le route

- [ ] **Step 3: Implementare la libreria auth**

`server/src/lib/auth.js`:

```js
import jwt from 'jsonwebtoken';

export const COOKIE_NAME = 'session';
const MAX_AGE_DAYS = 180;

export function signSession(userId) {
  return jwt.sign({ uid: userId }, process.env.JWT_SECRET, {
    expiresIn: `${MAX_AGE_DAYS}d`,
  });
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'unauthenticated' });

  try {
    req.userId = jwt.verify(token, process.env.JWT_SECRET).uid;
    next();
  } catch {
    res.status(401).json({ error: 'unauthenticated' });
  }
}
```

- [ ] **Step 4: Implementare le route**

`server/src/routes/auth.js`. Il confronto bcrypt gira anche quando l'utente non esiste: senza, il tempo di risposta rivelerebbe quali nomi utente sono validi.

```js
import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db.js';
import { signSession, cookieOptions, requireAuth, COOKIE_NAME } from '../lib/auth.js';

const DUMMY_HASH = '$2a$12$0000000000000000000000000000000000000000000000000000';

export const authRouter = express.Router();

authRouter.post('/login', async (req, res) => {
  const { name, password } = req.body ?? {};
  if (typeof name !== 'string' || typeof password !== 'string') {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const user = await db().user.findUnique({ where: { name } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: 'invalid_credentials' });

  res.cookie(COOKIE_NAME, signSession(user.id), cookieOptions());
  res.json({ id: user.id, name: user.name });
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await db().user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(401).json({ error: 'unauthenticated' });
  res.json({ id: user.id, name: user.name });
});
```

- [ ] **Step 5: Montare il router**

In `server/src/app.js`, aggiungere l'import e la riga di mount prima del `return app`:

```js
import { authRouter } from './routes/auth.js';
// ...
  app.use('/api/auth', authRouter);
```

- [ ] **Step 6: Verificare che i test passino**

Run: `npm test --workspace server -- auth`
Expected: PASS, 6 test

- [ ] **Step 7: Aggiungere l'helper di login per i task successivi**

In fondo a `server/test/helpers/factory.js`:

```js
import request from 'supertest';

export async function loginAs(app, name, password) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ name, password });
  if (res.status !== 200) throw new Error(`login fallito per ${name}: ${res.status}`);
  return agent;
}
```

- [ ] **Step 8: Committare**

```bash
git add -A
git commit -m "feat: add cookie session auth with login, logout and me"
```

---

### Task 5: Regole di dominio e durata minima

**Files:**
- Create: `server/src/lib/days.js`, `server/src/routes/days.js`, `server/test/min-duration.test.js`
- Modify: `server/src/app.js`

**Interfaces:**
- Consumes: `requireAuth` (Task 4), `db()` (Task 2), `isValidDate`/`romeDate`/`isUploadOpen`/`isLate`/`START_DATE` (Task 3)
- Produces, da `server/src/lib/days.js`:
  - `MIN_SECONDS = 5`, `MAX_SECONDS = 600`, `DEFAULT_MIN_DURATION = 30`
  - `publicIdFor(date: string, userId: number, kind: 'photo'|'video'): string`
  - `resourceTypeFor(kind: 'photo'|'video'): 'image'|'video'`
  - `otherUserId(userId: number): Promise<number>`
  - `entryStatus(entry: DayEntry|null, user: User): object`
  - `dayState(statuses: object[]): 'empty'|'partial'|'complete'`
  - route `PUT /api/days/:date/min-duration`

- [ ] **Step 1: Scrivere i test che falliscono**

`server/test/min-duration.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { db } from '../src/lib/db.js';
import { resetDb, createUsers, loginAs } from './helpers/factory.js';
import { romeDate, shiftDate } from '../src/lib/dates.js';

const app = createApp();
const today = () => romeDate();

describe('PUT /api/days/:date/min-duration', () => {
  let users;
  beforeEach(async () => {
    await resetDb();
    users = await createUsers();
  });

  it('writes the minimum onto the OTHER user entry', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent
      .put(`/api/days/${today()}/min-duration`)
      .send({ seconds: 90 });

    expect(res.status).toBe(200);

    const mine = await db().dayEntry.findUnique({
      where: { date_userId: { date: today(), userId: users.a.id } },
    });
    const theirs = await db().dayEntry.findUnique({
      where: { date_userId: { date: today(), userId: users.b.id } },
    });

    expect(theirs.minDuration).toBe(90);
    expect(mine).toBeNull();
  });

  it('can be set in advance for a future day', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const future = shiftDate(today(), 3);
    const res = await agent.put(`/api/days/${future}/min-duration`).send({ seconds: 45 });
    expect(res.status).toBe(200);
  });

  it('refuses to change a day that has already passed', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const yesterday = shiftDate(today(), -1);
    const res = await agent.put(`/api/days/${yesterday}/min-duration`).send({ seconds: 45 });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('day_closed_for_min_duration');
  });

  it('rejects values outside 5-600', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    for (const seconds of [0, 4, 601, 3.5, 'tanto']) {
      const res = await agent.put(`/api/days/${today()}/min-duration`).send({ seconds });
      expect(res.status).toBe(400);
    }
  });

  it('rejects an invalid date', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.put('/api/days/2026-13-40/min-duration').send({ seconds: 45 });
    expect(res.status).toBe(400);
  });

  it('requires a session', async () => {
    const res = await (await import('supertest')).default(app)
      .put(`/api/days/${today()}/min-duration`)
      .send({ seconds: 45 });
    expect(res.status).toBe(401);
  });

  it('updates an existing entry instead of duplicating it', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    await agent.put(`/api/days/${today()}/min-duration`).send({ seconds: 40 });
    await agent.put(`/api/days/${today()}/min-duration`).send({ seconds: 60 });

    const rows = await db().dayEntry.findMany({ where: { date: today(), userId: users.b.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].minDuration).toBe(60);
  });
});
```

- [ ] **Step 2: Verificare che i test falliscano**

Run: `npm test --workspace server -- min-duration`
Expected: FAIL, 404 sulle route

- [ ] **Step 3: Implementare le regole di dominio**

`server/src/lib/days.js`:

```js
import { db } from './db.js';
import { isLate } from './dates.js';

export const MIN_SECONDS = 5;
export const MAX_SECONDS = 600;
export const DEFAULT_MIN_DURATION = 30;

export function publicIdFor(date, userId, kind) {
  return `calendar/${date}/${userId}-${kind}`;
}

export function resourceTypeFor(kind) {
  return kind === 'video' ? 'video' : 'image';
}

// Ci sono esattamente due utenti: l'altro è quello che non sei tu.
export async function otherUserId(userId) {
  const other = await db().user.findFirst({ where: { id: { not: userId } } });
  if (!other) throw new Error('secondo utente mancante: lanciare il seed');
  return other.id;
}

export function entryStatus(entry, user) {
  return {
    userId: user.id,
    name: user.name,
    minDuration: entry?.minDuration ?? DEFAULT_MIN_DURATION,
    hasPhoto: Boolean(entry?.photoUrl),
    hasVideo: Boolean(entry?.videoUrl),
    photoLate: isLate(entry?.date ?? '', entry?.photoUploadedAt ?? null),
    videoLate: isLate(entry?.date ?? '', entry?.videoUploadedAt ?? null),
  };
}

export function dayState(statuses) {
  const slots = statuses.flatMap((s) => [s.hasPhoto, s.hasVideo]);
  if (slots.every(Boolean)) return 'complete';
  if (slots.some(Boolean)) return 'partial';
  return 'empty';
}
```

- [ ] **Step 4: Implementare la route**

`server/src/routes/days.js`. Il minimo si imposta solo per oggi o per il futuro: alzare l'asticella su un giorno già passato invaliderebbe a posteriori un video già caricato.

```js
import express from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { isValidDate, romeDate, START_DATE } from '../lib/dates.js';
import { otherUserId, MIN_SECONDS, MAX_SECONDS } from '../lib/days.js';

export const daysRouter = express.Router();

daysRouter.put('/:date/min-duration', requireAuth, async (req, res) => {
  const { date } = req.params;
  const { seconds } = req.body ?? {};

  if (!isValidDate(date) || date < START_DATE) {
    return res.status(400).json({ error: 'invalid_date' });
  }
  if (!Number.isInteger(seconds) || seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
    return res.status(400).json({ error: 'invalid_duration' });
  }
  if (date < romeDate()) {
    return res.status(403).json({ error: 'day_closed_for_min_duration' });
  }

  const targetId = await otherUserId(req.userId);
  const entry = await db().dayEntry.upsert({
    where: { date_userId: { date, userId: targetId } },
    update: { minDuration: seconds },
    create: { date, userId: targetId, minDuration: seconds },
  });

  res.json({ date, userId: targetId, minDuration: entry.minDuration });
});
```

- [ ] **Step 5: Montare il router**

In `server/src/app.js`:

```js
import { daysRouter } from './routes/days.js';
// ...
  app.use('/api/days', daysRouter);
```

- [ ] **Step 6: Verificare che i test passino**

Run: `npm test --workspace server -- min-duration`
Expected: PASS, 7 test

- [ ] **Step 7: Committare**

```bash
git add -A
git commit -m "feat: let each user set the other's minimum video duration"
```

---

### Task 6: Firma dell'upload

**Files:**
- Create: `server/src/lib/cloudinary.js`, `server/test/signature.test.js`
- Modify: `server/src/routes/days.js`

**Interfaces:**
- Consumes: `publicIdFor`/`resourceTypeFor` (Task 5), `isUploadOpen` (Task 3), `requireAuth` (Task 4)
- Produces:
  - da `server/src/lib/cloudinary.js`: `signUpload({publicId}): {cloudName, apiKey, publicId, timestamp, overwrite, invalidate, signature}`, `fetchResource(publicId, resourceType): Promise<object>`, `destroyResource(publicId, resourceType): Promise<object>`
  - route `POST /api/days/:date/signature`

- [ ] **Step 1: Scrivere i test che falliscono**

`server/test/signature.test.js`:

```js
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
    const res = await supertest(app).post(`/api/days/${today()}/signature`).send({ kind: 'photo' });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Verificare che i test falliscano**

Run: `npm test --workspace server -- signature`
Expected: FAIL, 404 sulla route

- [ ] **Step 3: Implementare il wrapper Cloudinary**

`server/src/lib/cloudinary.js`. La firma copre esattamente i parametri che il browser rispedirà, `file` e `api_key` esclusi: se il client ne cambia uno, Cloudinary rifiuta l'upload.

```js
import { v2 as cloudinary } from 'cloudinary';

// La SDK legge da sé CLOUDINARY_URL, ma solo alla prima chiamata utile.
function config() {
  return cloudinary.config();
}

export function signUpload({ publicId }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { public_id: publicId, timestamp, overwrite: true, invalidate: true };
  const signature = cloudinary.utils.api_sign_request(params, config().api_secret);

  return {
    cloudName: config().cloud_name,
    apiKey: config().api_key,
    publicId,
    timestamp,
    overwrite: true,
    invalidate: true,
    signature,
  };
}

export function fetchResource(publicId, resourceType) {
  return cloudinary.api.resource(publicId, { resource_type: resourceType });
}

export function destroyResource(publicId, resourceType) {
  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true,
  });
}
```

- [ ] **Step 4: Implementare la route**

In `server/src/routes/days.js`, aggiungere gli import e la route:

```js
import { isUploadOpen } from '../lib/dates.js';
import { publicIdFor, resourceTypeFor } from '../lib/days.js';
import { signUpload } from '../lib/cloudinary.js';

const KINDS = ['photo', 'video'];

daysRouter.post('/:date/signature', requireAuth, (req, res) => {
  const { date } = req.params;
  const { kind } = req.body ?? {};

  if (!KINDS.includes(kind)) return res.status(400).json({ error: 'invalid_kind' });
  if (!isValidDate(date)) return res.status(400).json({ error: 'invalid_date' });
  if (!isUploadOpen(date)) return res.status(403).json({ error: 'window_closed' });

  const publicId = publicIdFor(date, req.userId, kind);
  res.json({ ...signUpload({ publicId }), resourceType: resourceTypeFor(kind) });
});
```

- [ ] **Step 5: Verificare che i test passino**

Run: `npm test --workspace server -- signature`
Expected: PASS, 7 test

- [ ] **Step 6: Committare**

```bash
git add -A
git commit -m "feat: issue signed cloudinary upload params scoped to day and user"
```

---

### Task 7: Conferma e verifica dell'upload

**Files:**
- Create: `server/test/confirm.test.js`
- Modify: `server/src/routes/days.js`

**Interfaces:**
- Consumes: `fetchResource`/`destroyResource` (Task 6), `publicIdFor`/`resourceTypeFor`/`DEFAULT_MIN_DURATION` (Task 5)
- Produces: route `POST /api/days/:date/confirm`

- [ ] **Step 1: Scrivere i test che falliscono**

`server/test/confirm.test.js`. Cloudinary è mockato: i test verificano che il server si fidi della sua risposta e non del body del client.

```js
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

  it('rejects and deletes a video shorter than the minimum', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    await db().dayEntry.create({
      data: { date: today(), userId: users.a.id, minDuration: 60 },
    });

    vi.spyOn(cloud, 'fetchResource').mockResolvedValue({
      secure_url: 'https://res.cloudinary.com/testcloud/video/upload/v1/short.mp4',
      duration: 12,
    });
    const destroy = vi.spyOn(cloud, 'destroyResource').mockResolvedValue({ result: 'ok' });

    const res = await agent.post(`/api/days/${today()}/confirm`).send({
      kind: 'video',
      publicId: `calendar/${today()}/${users.a.id}-video`,
    });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: 'video_too_short', duration: 12, minDuration: 60 });
    expect(destroy).toHaveBeenCalledWith(`calendar/${today()}/${users.a.id}-video`, 'video');

    const entry = await db().dayEntry.findUnique({
      where: { date_userId: { date: today(), userId: users.a.id } },
    });
    expect(entry.videoUrl).toBeNull();
  });

  it('applies the default minimum of 30s when nobody set one', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    vi.spyOn(cloud, 'fetchResource').mockResolvedValue({
      secure_url: 'https://res.cloudinary.com/testcloud/video/upload/v1/x.mp4',
      duration: 20,
    });
    vi.spyOn(cloud, 'destroyResource').mockResolvedValue({ result: 'ok' });

    const res = await agent.post(`/api/days/${today()}/confirm`).send({
      kind: 'video',
      publicId: `calendar/${today()}/${users.a.id}-video`,
    });

    expect(res.status).toBe(422);
    expect(res.body.minDuration).toBe(30);
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
```

- [ ] **Step 2: Verificare che i test falliscano**

Run: `npm test --workspace server -- confirm`
Expected: FAIL, 404 sulla route

- [ ] **Step 3: Implementare la route**

In `server/src/routes/days.js`. L'ordine conta: prima si legge il minimo già in essere, poi si valida, e solo alla fine si scrive. Così un video rifiutato non lascia né una riga sporca nel database né un file orfano su Cloudinary.

Aggiungere agli import: `import { signUpload, fetchResource, destroyResource } from '../lib/cloudinary.js';` e `DEFAULT_MIN_DURATION` da `../lib/days.js`.

```js
daysRouter.post('/:date/confirm', requireAuth, async (req, res) => {
  const { date } = req.params;
  const { kind, publicId } = req.body ?? {};

  if (!KINDS.includes(kind)) return res.status(400).json({ error: 'invalid_kind' });
  if (!isValidDate(date)) return res.status(400).json({ error: 'invalid_date' });
  if (!isUploadOpen(date)) return res.status(403).json({ error: 'window_closed' });
  if (publicId !== publicIdFor(date, req.userId, kind)) {
    return res.status(403).json({ error: 'public_id_mismatch' });
  }

  const resourceType = resourceTypeFor(kind);
  let resource;
  try {
    resource = await fetchResource(publicId, resourceType);
  } catch {
    return res.status(404).json({ error: 'resource_not_found' });
  }

  const existing = await db().dayEntry.findUnique({
    where: { date_userId: { date, userId: req.userId } },
  });

  if (kind === 'video') {
    const minDuration = existing?.minDuration ?? DEFAULT_MIN_DURATION;
    const duration = resource.duration ?? 0;
    if (duration < minDuration) {
      await destroyResource(publicId, resourceType);
      return res.status(422).json({ error: 'video_too_short', duration, minDuration });
    }
  }

  const now = new Date();
  const fields = kind === 'video'
    ? {
        videoUrl: resource.secure_url,
        videoPublicId: publicId,
        videoDuration: resource.duration,
        videoUploadedAt: now,
      }
    : {
        photoUrl: resource.secure_url,
        photoPublicId: publicId,
        photoUploadedAt: now,
      };

  const entry = await db().dayEntry.upsert({
    where: { date_userId: { date, userId: req.userId } },
    update: fields,
    create: { date, userId: req.userId, ...fields },
  });

  res.json({ date, kind, url: resource.secure_url, minDuration: entry.minDuration });
});
```

- [ ] **Step 4: Verificare che i test passino**

Run: `npm test --workspace server -- confirm`
Expected: PASS, 6 test

Se i mock `vi.spyOn` sul modulo non hanno effetto, è perché la route ha importato le funzioni per riferimento diretto. In quel caso importare il modulo intero nella route (`import * as cloud from '../lib/cloudinary.js'` e chiamare `cloud.fetchResource(...)`), che è la forma che `vi.spyOn` intercetta.

- [ ] **Step 5: Committare**

```bash
git add -A
git commit -m "feat: verify uploads against cloudinary before persisting them"
```

---

### Task 8: Lettura del giorno e del mese

**Files:**
- Create: `server/src/routes/calendar.js`, `server/test/calendar.test.js`
- Modify: `server/src/routes/days.js`, `server/src/app.js`

**Interfaces:**
- Consumes: `entryStatus`/`dayState` (Task 5), `isUploadOpen`/`romeDate`/`START_DATE`/`isValidDate` (Task 3)
- Produces: `GET /api/days/:date`, `GET /api/calendar/:month`

- [ ] **Step 1: Scrivere i test che falliscono**

`server/test/calendar.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { db } from '../src/lib/db.js';
import { resetDb, createUsers, loginAs } from './helpers/factory.js';
import { romeDate } from '../src/lib/dates.js';

const app = createApp();
const today = () => romeDate();

describe('GET /api/days/:date', () => {
  let users;
  beforeEach(async () => {
    await resetDb();
    users = await createUsers();
  });

  it('returns both users, mine first', async () => {
    const agent = await loginAs(app, 'Lei', 'password-b');
    const res = await agent.get(`/api/days/${today()}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
    expect(res.body.users[0].userId).toBe(users.b.id);
    expect(res.body.users[0].isMe).toBe(true);
    expect(res.body.isOpen).toBe(true);
  });

  it('reports the minimum the other user set for me', async () => {
    await db().dayEntry.create({
      data: { date: today(), userId: users.b.id, minDuration: 75 },
    });
    const agent = await loginAs(app, 'Lei', 'password-b');
    const res = await agent.get(`/api/days/${today()}`);

    expect(res.body.users[0].minDuration).toBe(75);
  });

  it('rejects a date before the calendar start', async () => {
    const agent = await loginAs(app, 'Lei', 'password-b');
    const res = await agent.get('/api/days/2026-08-08');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/calendar/:month', () => {
  let users;
  beforeEach(async () => {
    await resetDb();
    users = await createUsers();
  });

  it('returns one entry per day of the month', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.get('/api/calendar/2026-09');

    expect(res.status).toBe(200);
    expect(res.body.days).toHaveLength(30);
    expect(res.body.days[0].date).toBe('2026-09-01');
  });

  it('marks a day complete only when both posted photo and video', async () => {
    const url = 'https://res.cloudinary.com/testcloud/x';
    await db().dayEntry.create({
      data: {
        date: '2026-09-05', userId: users.a.id,
        photoUrl: url, videoUrl: url,
        photoUploadedAt: new Date('2026-09-05T10:00:00Z'),
        videoUploadedAt: new Date('2026-09-05T10:00:00Z'),
      },
    });
    await db().dayEntry.create({
      data: {
        date: '2026-09-05', userId: users.b.id,
        photoUrl: url, videoUrl: url,
        photoUploadedAt: new Date('2026-09-05T10:00:00Z'),
        videoUploadedAt: new Date('2026-09-05T10:00:00Z'),
      },
    });
    await db().dayEntry.create({
      data: { date: '2026-09-06', userId: users.a.id, photoUrl: url,
              photoUploadedAt: new Date('2026-09-06T10:00:00Z') },
    });

    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.get('/api/calendar/2026-09');
    const byDate = Object.fromEntries(res.body.days.map((d) => [d.date, d]));

    expect(byDate['2026-09-05'].state).toBe('complete');
    expect(byDate['2026-09-06'].state).toBe('partial');
    expect(byDate['2026-09-07'].state).toBe('empty');
  });

  it('flags content uploaded after its own day as late', async () => {
    await db().dayEntry.create({
      data: {
        date: '2026-09-10', userId: users.a.id,
        photoUrl: 'https://res.cloudinary.com/testcloud/x',
        photoUploadedAt: new Date('2026-09-12T08:00:00Z'),
      },
    });

    const agent = await loginAs(app, 'Alessandro', 'password-a');
    const res = await agent.get('/api/calendar/2026-09');
    const day = res.body.days.find((d) => d.date === '2026-09-10');
    const mine = day.users.find((u) => u.userId === users.a.id);

    expect(mine.photoLate).toBe(true);
  });

  it('rejects a malformed month', async () => {
    const agent = await loginAs(app, 'Alessandro', 'password-a');
    expect((await agent.get('/api/calendar/2026-13')).status).toBe(400);
    expect((await agent.get('/api/calendar/nope')).status).toBe(400);
  });

  it('requires a session', async () => {
    const res = await (await import('supertest')).default(app).get('/api/calendar/2026-09');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Verificare che i test falliscano**

Run: `npm test --workspace server -- calendar`
Expected: FAIL, 404 sulle route

- [ ] **Step 3: Aggiungere `GET /api/days/:date`**

In `server/src/routes/days.js`, aggiungere `entryStatus` agli import da `../lib/days.js`:

```js
daysRouter.get('/:date', requireAuth, async (req, res) => {
  const { date } = req.params;
  if (!isValidDate(date) || date < START_DATE) {
    return res.status(400).json({ error: 'invalid_date' });
  }

  const users = await db().user.findMany({ orderBy: { id: 'asc' } });
  const entries = await db().dayEntry.findMany({ where: { date } });

  const statuses = users.map((user) => {
    const entry = entries.find((e) => e.userId === user.id) ?? null;
    const status = entryStatus(entry, user);
    return {
      ...status,
      isMe: user.id === req.userId,
      photoUrl: entry?.photoUrl ?? null,
      videoUrl: entry?.videoUrl ?? null,
      videoDuration: entry?.videoDuration ?? null,
    };
  });

  // L'utente corrente per primo: la sua colonna è quella su cui agisce.
  statuses.sort((x, y) => Number(y.isMe) - Number(x.isMe));

  res.json({ date, isOpen: isUploadOpen(date), today: romeDate(), users: statuses });
});
```

Nota: `entryStatus` legge `entry.date` per calcolare i flag di ritardo, quindi la riga letta dal database ha già il campo giusto e non serve passarlo a parte.

- [ ] **Step 4: Implementare la route del mese**

`server/src/routes/calendar.js`:

```js
import express from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { isUploadOpen, romeDate, START_DATE } from '../lib/dates.js';
import { entryStatus, dayState } from '../lib/days.js';

export const calendarRouter = express.Router();

function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) =>
    `${month}-${String(i + 1).padStart(2, '0')}`
  );
}

calendarRouter.get('/:month', requireAuth, async (req, res) => {
  const { month } = req.params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ error: 'invalid_month' });
  }

  const users = await db().user.findMany({ orderBy: { id: 'asc' } });
  const entries = await db().dayEntry.findMany({
    where: { date: { startsWith: `${month}-` } },
  });

  const days = daysInMonth(month).map((date) => {
    const statuses = users.map((user) => {
      const entry = entries.find((e) => e.date === date && e.userId === user.id) ?? null;
      return entryStatus(entry, user);
    });
    return {
      date,
      state: dayState(statuses),
      isOpen: isUploadOpen(date),
      exists: date >= START_DATE,
      users: statuses,
    };
  });

  res.json({ month, today: romeDate(), startDate: START_DATE, days });
});
```

- [ ] **Step 5: Montare il router**

In `server/src/app.js`:

```js
import { calendarRouter } from './routes/calendar.js';
// ...
  app.use('/api/calendar', calendarRouter);
```

- [ ] **Step 6: Verificare che tutta la suite passi**

Run: `npm test --workspace server`
Expected: PASS, tutti i test

- [ ] **Step 7: Committare**

```bash
git add -A
git commit -m "feat: expose day detail and month calendar endpoints"
```

---

### Task 9: Client React e login

**Files:**
- Create: `client/package.json`, `client/vite.config.js`, `client/index.html`, `client/src/main.jsx`, `client/src/api.js`, `client/src/pages/Login.jsx`, `client/src/styles.css`

**Interfaces:**
- Consumes: `POST /api/auth/login`, `GET /api/auth/me` (Task 4)
- Produces: `api.get(path)`, `api.post(path, body)`, `api.put(path, body)` da `client/src/api.js`; componente `<Login />`

- [ ] **Step 1: Creare il package del client**

`client/package.json`:

```json
{
  "name": "client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.5"
  }
}
```

- [ ] **Step 2: Configurare Vite**

`client/vite.config.js` — il proxy fa sì che in sviluppo il cookie di sessione valga per una sola origine, esattamente come in produzione:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:3000' },
  },
  build: { outDir: 'dist' },
});
```

- [ ] **Step 3: Installare**

```bash
npm install
```

- [ ] **Step 4: Scrivere il wrapper API**

`client/src/api.js`. `credentials: 'include'` è obbligatorio: senza, il cookie di sessione non viaggia.

```js
async function call(method, path, body) {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `http_${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  get: (path) => call('GET', path),
  post: (path, body) => call('POST', path, body),
  put: (path, body) => call('PUT', path, body),
};
```

- [ ] **Step 5: Scrivere l'entry point e il routing**

`client/index.html`:

```html
<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Calendario</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

`client/src/main.jsx`:

```jsx
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { api } from './api.js';
import { Login } from './pages/Login.jsx';
import { Month } from './pages/Month.jsx';
import { Day } from './pages/Day.jsx';
import './styles.css';

function App() {
  const [user, setUser] = useState(undefined); // undefined = ancora da verificare

  useEffect(() => {
    api.get('/api/auth/me').then(setUser).catch(() => setUser(null));
  }, []);

  if (user === undefined) return <p className="loading">…</p>;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <Routes>
      <Route path="/" element={<Month user={user} />} />
      <Route path="/day/:date" element={<Day user={user} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
```

`Month` e `Day` arrivano nei Task 10 e 11; fino ad allora il build fallisce, ed è atteso.

- [ ] **Step 6: Scrivere la pagina di login**

`client/src/pages/Login.jsx`:

```jsx
import React, { useState } from 'react';
import { api } from '../api.js';

export function Login({ onLogin }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onLogin(await api.post('/api/auth/login', { name, password }));
    } catch {
      setError('Nome o password non validi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login" onSubmit={submit}>
      <h1>Calendario</h1>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome"
        autoComplete="username"
        autoCapitalize="none"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        autoComplete="current-password"
      />
      <button disabled={busy || !name || !password}>
        {busy ? 'Attendi…' : 'Entra'}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 7: Aggiungere gli stili di base**

`client/src/styles.css` — minimo funzionale, il design pass arriva in un giro successivo. `16px` sugli input evita che Safari iOS faccia zoom automatico al focus.

```css
:root { --bg: #fbf7f0; --ink: #3b3330; --line: #ded3c4; --accent: #c08a72; }

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
}

.login { display: flex; flex-direction: column; gap: 12px; max-width: 320px; margin: 15vh auto; padding: 0 20px; }
.login input, .login button { font-size: 16px; padding: 12px; border-radius: 10px; border: 1px solid var(--line); }
.login button { background: var(--accent); color: white; border: none; }
.error { color: #a33; }
.loading { text-align: center; margin-top: 40vh; }
```

- [ ] **Step 8: Committare**

```bash
git add -A
git commit -m "feat: add react client shell with login screen"
```

---

### Task 10: Vista mensile

**Files:**
- Create: `client/src/pages/Month.jsx`, `client/src/components/CalendarGrid.jsx`, `client/src/components/DayCell.jsx`
- Modify: `client/src/styles.css`

**Interfaces:**
- Consumes: `GET /api/calendar/:month` (Task 8), `api` (Task 9)
- Produces: `<Month user />`, `<CalendarGrid month days onOpen />`, `<DayCell day onOpen />`

- [ ] **Step 1: Implementare la cella**

`client/src/components/DayCell.jsx`:

```jsx
import React from 'react';

export function DayCell({ day, isToday, onOpen }) {
  if (!day.exists) return <div className="cell cell--void" />;

  const late = day.users.some((u) => u.photoLate || u.videoLate);
  const classes = ['cell', `cell--${day.state}`];
  if (isToday) classes.push('cell--today');

  return (
    <button className={classes.join(' ')} onClick={() => onOpen(day.date)}>
      <span className="cell__number">{Number(day.date.slice(8))}</span>
      {late && <span className="cell__late" title="caricato in ritardo">·</span>}
    </button>
  );
}
```

- [ ] **Step 2: Implementare la griglia**

`client/src/components/CalendarGrid.jsx`. Le celle vuote iniziali allineano il primo del mese al giorno della settimana giusto, con la settimana che parte da lunedì.

```jsx
import React from 'react';
import { DayCell } from './DayCell.jsx';

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

function leadingBlanks(firstDate) {
  const [y, m, d] = firstDate.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domenica
  return (weekday + 6) % 7;
}

export function CalendarGrid({ days, today, onOpen }) {
  return (
    <div className="grid">
      {WEEKDAYS.map((label, i) => (
        <div key={i} className="grid__weekday">{label}</div>
      ))}
      {Array.from({ length: leadingBlanks(days[0].date) }, (_, i) => (
        <div key={`blank-${i}`} className="cell cell--void" />
      ))}
      {days.map((day) => (
        <DayCell key={day.date} day={day} isToday={day.date === today} onOpen={onOpen} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Implementare la pagina**

`client/src/pages/Month.jsx`:

```jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { CalendarGrid } from '../components/CalendarGrid.jsx';

const MONTH_NAMES = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function Month({ user }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setData(null);
    api.get(`/api/calendar/${month}`).then(setData);
  }, [month]);

  // Al primo caricamento allinea il mese a quello del server (fuso di Roma).
  useEffect(() => {
    if (data?.today) setMonth((current) => current || data.today.slice(0, 7));
  }, [data]);

  const [year, monthIndex] = month.split('-');

  return (
    <main className="month">
      <header className="month__head">
        <button onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <h1>{MONTH_NAMES[Number(monthIndex) - 1]} {year}</h1>
        <button onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
      </header>

      {data
        ? <CalendarGrid days={data.days} today={data.today} onOpen={(date) => navigate(`/day/${date}`)} />
        : <p className="loading">…</p>}

      <p className="month__hint">Ciao {user.name}</p>
    </main>
  );
}
```

- [ ] **Step 4: Aggiungere gli stili della griglia**

In fondo a `client/src/styles.css`:

```css
.month { max-width: 480px; margin: 0 auto; padding: 16px; }
.month__head { display: flex; align-items: center; justify-content: space-between; }
.month__head h1 { font-size: 20px; font-weight: 500; }
.month__head button { background: none; border: none; font-size: 24px; color: var(--ink); }
.month__hint { text-align: center; opacity: .5; font-size: 13px; }

.grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
.grid__weekday { text-align: center; font-size: 12px; opacity: .5; padding-bottom: 4px; }

.cell {
  aspect-ratio: 1; border: 1px solid var(--line); border-radius: 10px;
  background: transparent; color: var(--ink); font-size: 14px;
  display: flex; align-items: center; justify-content: center; position: relative;
}
.cell--void { border: none; }
.cell--partial { background: #f0e4d8; }
.cell--complete { background: var(--accent); color: white; border-color: var(--accent); }
.cell--today { outline: 2px solid var(--accent); outline-offset: 1px; }
.cell__late { position: absolute; top: 3px; right: 6px; opacity: .6; }
```

- [ ] **Step 5: Verificare a mano**

Avviare server (`npm run dev:server`) e client (`npm run dev:client`), fare login, controllare che la griglia si disegni, che il 1° del mese cada nel giorno della settimana corretto e che le frecce cambino mese.

- [ ] **Step 6: Committare**

```bash
git add -A
git commit -m "feat: add monthly calendar grid with per-day completion states"
```

---

### Task 11: Vista giorno e upload

**Files:**
- Create: `client/src/pages/Day.jsx`, `client/src/components/UploadSlot.jsx`, `client/src/upload.js`
- Modify: `client/src/styles.css`

**Interfaces:**
- Consumes: `GET /api/days/:date`, `POST /api/days/:date/signature`, `POST /api/days/:date/confirm`, `PUT /api/days/:date/min-duration` (Task 5-8)
- Produces: `readVideoDuration(file): Promise<number>`, `uploadToCloudinary(file, signature): Promise<void>`, `<Day user />`, `<UploadSlot ... />`

- [ ] **Step 1: Implementare i helper di upload**

`client/src/upload.js`. Safari su iOS a volte riporta `Infinity` come durata di un file appena scelto: in quel caso il controllo lato client si arrende e lascia decidere al server, che legge il dato reale da Cloudinary.

```js
export function readVideoDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(Number.isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(null);
    };
    video.src = URL.createObjectURL(file);
  });
}

export async function uploadToCloudinary(file, signature) {
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signature.apiKey);
  form.append('timestamp', String(signature.timestamp));
  form.append('public_id', signature.publicId);
  form.append('overwrite', 'true');
  form.append('invalidate', 'true');
  form.append('signature', signature.signature);

  const url = `https://api.cloudinary.com/v1_1/${signature.cloudName}/${signature.resourceType}/upload`;
  const res = await fetch(url, { method: 'POST', body: form });
  if (!res.ok) throw new Error('upload_failed');
}
```

I campi `overwrite` e `invalidate` devono valere esattamente `'true'`, la stessa stringa firmata dal server: qualunque differenza fa fallire la verifica della firma lato Cloudinary.

- [ ] **Step 2: Implementare lo slot di upload**

`client/src/components/UploadSlot.jsx`:

```jsx
import React, { useRef, useState } from 'react';
import { api } from '../api.js';
import { readVideoDuration, uploadToCloudinary } from '../upload.js';

const LABELS = { photo: 'Foto', video: 'Video' };

export function UploadSlot({ date, kind, url, minDuration, disabled, onDone }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function pick(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);

    if (kind === 'video') {
      const duration = await readVideoDuration(file);
      if (duration !== null && duration < minDuration) {
        setError(`Servono almeno ${minDuration}s, questo dura ${Math.round(duration)}s`);
        return;
      }
    }

    setBusy(true);
    try {
      const signature = await api.post(`/api/days/${date}/signature`, { kind });
      await uploadToCloudinary(file, signature);
      await api.post(`/api/days/${date}/confirm`, { kind, publicId: signature.publicId });
      await onDone();
    } catch (err) {
      if (err.data?.error === 'video_too_short') {
        setError(`Servono almeno ${err.data.minDuration}s, questo dura ${Math.round(err.data.duration)}s`);
      } else if (err.data?.error === 'window_closed') {
        setError('Questo giorno è chiuso');
      } else {
        setError('Caricamento fallito, riprova');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="slot">
      {kind === 'photo'
        ? url && <img className="slot__media" src={url} alt="" />
        : url && <video className="slot__media" src={url} controls playsInline />}

      {!url && <div className="slot__empty">{LABELS[kind]}</div>}

      {!disabled && (
        <>
          <input
            ref={input}
            type="file"
            hidden
            accept={kind === 'photo' ? 'image/*' : 'video/*'}
            onChange={pick}
          />
          <button className="slot__button" disabled={busy} onClick={() => input.current.click()}>
            {busy ? 'Carico…' : url ? `Sostituisci ${LABELS[kind].toLowerCase()}` : `Carica ${LABELS[kind].toLowerCase()}`}
          </button>
        </>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Implementare la pagina del giorno**

`client/src/pages/Day.jsx`:

```jsx
import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { UploadSlot } from '../components/UploadSlot.jsx';

export function Day() {
  const { date } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  const load = useCallback(() => api.get(`/api/days/${date}`).then(setData), [date]);
  useEffect(() => { load(); }, [load]);

  async function setMinimum(seconds) {
    await api.put(`/api/days/${date}/min-duration`, { seconds });
    await load();
  }

  if (!data) return <p className="loading">…</p>;

  const me = data.users.find((u) => u.isMe);
  const other = data.users.find((u) => !u.isMe);
  const canSetMinimum = date >= data.today;

  return (
    <main className="day">
      <header className="day__head">
        <button onClick={() => navigate('/')}>‹</button>
        <h1>{date.split('-').reverse().join('/')}</h1>
      </header>

      {!data.isOpen && <p className="day__closed">Giorno chiuso, non è più modificabile</p>}

      <section className="day__column">
        <h2>Tu</h2>
        <p className="day__min">Minimo video: {me.minDuration}s</p>
        <UploadSlot date={date} kind="photo" url={me.photoUrl} disabled={!data.isOpen} onDone={load} />
        <UploadSlot date={date} kind="video" url={me.videoUrl} minDuration={me.minDuration}
                    disabled={!data.isOpen} onDone={load} />
      </section>

      <section className="day__column">
        <h2>{other.name}</h2>
        <p className="day__min">
          Minimo che hai imposto: {other.minDuration}s
          {canSetMinimum && (
            <select value={other.minDuration} onChange={(e) => setMinimum(Number(e.target.value))}>
              {[15, 30, 45, 60, 90, 120, 180].map((s) => <option key={s} value={s}>{s}s</option>)}
            </select>
          )}
        </p>
        {other.photoUrl && <img className="slot__media" src={other.photoUrl} alt="" />}
        {other.videoUrl && <video className="slot__media" src={other.videoUrl} controls playsInline />}
        {!other.photoUrl && !other.videoUrl && <p className="day__empty">Ancora niente</p>}
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Aggiungere gli stili**

In fondo a `client/src/styles.css`:

```css
.day { max-width: 480px; margin: 0 auto; padding: 16px; }
.day__head { display: flex; align-items: center; gap: 12px; }
.day__head button { background: none; border: none; font-size: 24px; color: var(--ink); }
.day__head h1 { font-size: 18px; font-weight: 500; }
.day__column { margin-top: 24px; }
.day__column h2 { font-size: 15px; font-weight: 600; opacity: .7; }
.day__min { font-size: 13px; opacity: .6; display: flex; gap: 8px; align-items: center; }
.day__closed, .day__empty { font-size: 13px; opacity: .5; }

.slot { margin-bottom: 16px; }
.slot__media { width: 100%; border-radius: 10px; display: block; background: #000; }
.slot__empty {
  aspect-ratio: 4/3; border: 1px dashed var(--line); border-radius: 10px;
  display: flex; align-items: center; justify-content: center; opacity: .5; font-size: 14px;
}
.slot__button {
  margin-top: 8px; width: 100%; font-size: 16px; padding: 10px;
  border-radius: 10px; border: 1px solid var(--line); background: white; color: var(--ink);
}
```

- [ ] **Step 5: Provare il flusso completo a mano**

Con Cloudinary reale: caricare una foto, poi un video più corto del minimo (deve essere rifiutato dal client), poi uno abbastanza lungo. Controllare su Cloudinary che il video rifiutato dal server non sia rimasto.

- [ ] **Step 6: Committare**

```bash
git add -A
git commit -m "feat: add day view with direct-to-cloudinary upload flow"
```

---

### Task 12: Servizio statico e deploy

**Files:**
- Create: `railway.json`
- Modify: `server/src/app.js`, `package.json`, `server/test/health.test.js`

**Interfaces:**
- Consumes: build del client (Task 9-11)
- Produces: servizio unico che serve API e SPA

- [ ] **Step 1: Scrivere il test che fallisce**

Aggiungere a `server/test/health.test.js`:

```js
it('returns json 404 for unknown api routes, not the SPA', async () => {
  const res = await request(createApp()).get('/api/nope');
  expect(res.status).toBe(404);
  expect(res.body.error).toBe('not_found');
});
```

- [ ] **Step 2: Verificare che fallisca**

Run: `npm test --workspace server -- health`
Expected: FAIL, il body non contiene `error: 'not_found'`

- [ ] **Step 3: Servire il client e gestire il fallback**

In `server/src/app.js`, dopo i mount dei router e prima del `return app`. L'ordine è essenziale: il 404 JSON sotto `/api` deve venire prima del fallback SPA, altrimenti una chiamata API sbagliata riceve HTML e il client va in errore di parsing.

```js
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const clientDist = join(here, '../../client/dist');

// ...dentro createApp(), dopo i router:

  app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res) => res.sendFile(join(clientDist, 'index.html')));
  }
```

- [ ] **Step 4: Verificare che i test passino**

Run: `npm test --workspace server`
Expected: PASS, tutta la suite

- [ ] **Step 5: Configurare Railway**

`railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "NIXPACKS", "buildCommand": "npm ci && npm run build" },
  "deploy": {
    "startCommand": "npx prisma migrate deploy && node server/src/index.js",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

`prisma migrate deploy` gira a ogni avvio: è idempotente e tiene lo schema allineato senza interventi manuali.

- [ ] **Step 6: Verificare il build in locale**

```bash
npm run build && npm start
```

Aprire `http://localhost:3000`: deve comparire il login servito da Express, non da Vite.

- [ ] **Step 7: Committare**

```bash
git add -A
git commit -m "feat: serve the built client from express and add railway config"
```

- [ ] **Step 8: Deploy**

Su Railway: creare il progetto dal repo, montare un volume su `/data`, e impostare le variabili d'ambiente `CLOUDINARY_URL`, `JWT_SECRET`, `DATABASE_URL=file:/data/app.db`, `USER_A_NAME`, `USER_A_PASSWORD`, `USER_B_NAME`, `USER_B_PASSWORD`, `NODE_ENV=production`.

Al primo deploy lanciare il seed una volta sola dalla shell del servizio:

```bash
npm run seed
```

Poi provare il login da entrambi gli iPhone e caricare un contenuto reale per giorno.

---

## Self-Review

**Copertura della spec:**

| Requisito della spec | Task |
|---|---|
| Servizio unico Express + static | 1, 12 |
| Volume persistente / Railway | 12 |
| Schema `User`/`DayEntry`/`Event` | 2 |
| Seed rilanciabile, fallisce se le password mancano | 2 |
| Date come stringhe, fuso Roma | 3 |
| Finestra 7 giorni, start 2026-08-09 | 3, 6, 7 |
| "In ritardo" derivato, non memorizzato | 3, 5, 8 |
| Sessione cookie httpOnly 180 giorni | 4 |
| `minDuration` scritto sull'altro utente, range 5-600, default 30 | 5, 7 |
| Upload firmato diretto a Cloudinary | 6, 11 |
| Verifica server-side via Admin API | 7 |
| 422 + cancellazione della risorsa rifiutata | 7 |
| Stati cella empty/partial/complete | 5, 8, 10 |
| Login, calendario, vista giorno | 9, 10, 11 |
| `.env.example` committato, `.env` ignorato | 1 |

Nessun requisito dell'MVP resta scoperto. Gli eventi entrano solo come tabella (Task 2), come previsto dalla spec.

**Coerenza dei nomi:** `publicIdFor`, `resourceTypeFor`, `entryStatus`, `dayState`, `otherUserId`, `signUpload`, `fetchResource`, `destroyResource`, `romeDate`, `shiftDate`, `isUploadOpen`, `isLate`, `isValidDate` sono usati con la stessa firma in ogni task che li consuma. Il campo API è `minDuration` ovunque; il body di `PUT min-duration` usa `seconds`, che è l'unico punto in cui il nome differisce, ed è intenzionale.

**Punti di attenzione noti:**

- Il Task 7 dipende dal fatto che `vi.spyOn` intercetti le funzioni del modulo Cloudinary; lo step 4 documenta il rimedio se non accade.
- `romeDate()` senza argomento legge l'ora reale, quindi i test di `min-duration`, `signature` e `confirm` calcolano le date rispetto a `romeDate()` invece di usare valori fissi: restano verdi anche eseguiti a mezzanotte.
