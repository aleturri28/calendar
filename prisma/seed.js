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
