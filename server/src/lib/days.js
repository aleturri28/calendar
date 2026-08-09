import { isLate } from './dates.js';

// Tetto assoluto sulla durata di un video. Non esiste più una durata minima:
// il tetto da solo tiene i file in una dimensione gestibile.
export const MAX_VIDEO_SECONDS = 60;

export function publicIdFor(date, userId, kind) {
  return `calendar/${date}/${userId}-${kind}`;
}

export function resourceTypeFor(kind) {
  return kind === 'video' ? 'video' : 'image';
}

export function entryStatus(entry, user) {
  return {
    userId: user.id,
    name: user.name,
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
