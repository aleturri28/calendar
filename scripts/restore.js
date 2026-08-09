import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

// Ricostruisce il database da un backup. Si rifiuta di partire se c'è già
// qualcosa: un ripristino che sovrascrive è un modo di perdere i dati, non di
// salvarli. Per rifare tutto da zero: cancella il database, applica le
// migrazioni, lancia il seed, poi questo.

const file = process.argv[2];
if (!file) {
  console.error('Uso: node scripts/restore.js <file-di-backup.json>');
  process.exit(1);
}

const backup = JSON.parse(readFileSync(file, 'utf8'));
if (backup.version !== 1) {
  console.error(`Formato di backup sconosciuto: versione ${backup.version}`);
  process.exit(1);
}

const prisma = new PrismaClient();

const existing = await prisma.dayEntry.count();
if (existing > 0) {
  console.error(`Il database contiene già ${existing} giorni: mi fermo per non sovrascriverli.`);
  await prisma.$disconnect();
  process.exit(1);
}

// Gli id degli utenti possono cambiare fra un database e l'altro: il nome è
// l'unico riferimento stabile.
const users = await prisma.user.findMany();
const idByName = Object.fromEntries(users.map((u) => [u.name, u.id]));
const nameByOldId = Object.fromEntries(backup.users.map((u) => [u.id, u.name]));

const mapUser = (oldId) => {
  const name = nameByOldId[oldId];
  const id = idByName[name];
  if (!id) throw new Error(`Utente "${name}" assente: lancia prima "npm run seed"`);
  return id;
};

const entryIdMap = {};

for (const entry of backup.entries) {
  const { id, userId, ...rest } = entry;
  const created = await prisma.dayEntry.create({
    data: { ...rest, userId: mapUser(userId) },
  });
  entryIdMap[id] = created.id;
}

for (const comment of backup.comments) {
  const { id, dayEntryId, userId, ...rest } = comment;
  await prisma.comment.create({
    data: { ...rest, dayEntryId: entryIdMap[dayEntryId], userId: mapUser(userId) },
  });
}

for (const event of backup.events) {
  const { id, createdById, ...rest } = event;
  await prisma.event.create({ data: { ...rest, createdById: mapUser(createdById) } });
}

console.log(`ripristinati ${backup.entries.length} giorni, ${backup.comments.length} commenti, ${backup.events.length} eventi`);
console.log(`dal backup del ${backup.takenAt}`);

await prisma.$disconnect();
