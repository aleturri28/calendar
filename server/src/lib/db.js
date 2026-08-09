import { PrismaClient } from '@prisma/client';

let client;

// Lazy: i test impostano DATABASE_URL dopo il caricamento dei moduli.
export function db() {
  if (!client) client = new PrismaClient();
  return client;
}
