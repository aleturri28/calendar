import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

// Esporta tutto ciò che lega i file al percorso: giorni, autori, commenti,
// eventi. I file veri stanno su Cloudinary e sopravvivono da soli; quello che
// si perderebbe senza questo file è il filo che li tiene insieme.
//
// Gli hash delle password NON finiscono nel backup: sono segreti, e il seed
// ricrea i due account da .env quando serve.

const prisma = new PrismaClient();

const [users, entries, comments, events] = await Promise.all([
  prisma.user.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' } }),
  prisma.dayEntry.findMany({ orderBy: [{ date: 'asc' }, { userId: 'asc' }] }),
  prisma.comment.findMany({ orderBy: { id: 'asc' } }),
  prisma.event.findMany({ orderBy: { id: 'asc' } }),
]);

const backup = {
  version: 1,
  takenAt: new Date().toISOString(),
  users,
  entries,
  comments,
  events,
};

const dir = process.env.BACKUP_DIR ?? 'backups';
mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const file = join(dir, `calendario-${stamp}.json`);
writeFileSync(file, JSON.stringify(backup, null, 2));

console.log(`backup scritto in ${file}`);
console.log(`  ${users.length} persone, ${entries.length} giorni, ${comments.length} commenti, ${events.length} eventi`);

const withMedia = entries.filter((e) => e.photoUrl || e.videoUrl).length;
console.log(`  di cui ${withMedia} giorni con foto o video`);

await prisma.$disconnect();
