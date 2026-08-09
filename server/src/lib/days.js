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
