import { isLate } from './dates.js';

// Tetto assoluto sulla durata di un video. Non esiste una durata minima:
// il tetto da solo tiene i file in una dimensione gestibile.
export const MAX_VIDEO_SECONDS = 60;

export const COMMENT_TARGETS = ['photo', 'video'];
export const MAX_COMMENT_LENGTH = 140;

export function publicIdFor(date, userId, kind) {
  return `calendar/${date}/${userId}-${kind}`;
}

export function resourceTypeFor(kind) {
  return kind === 'video' ? 'video' : 'image';
}

// Miniatura servita da Cloudinary invece della foto piena: una griglia
// mensile mostra fino a 60 immagini, e a piena risoluzione sarebbero decine
// di megabyte su rete mobile.
export function thumbnailUrl(url, size = 160) {
  if (!url) return null;
  const marker = '/upload/';
  const at = url.indexOf(marker);
  if (at === -1) return url;
  const transform = `c_fill,g_auto,w_${size},h_${size},q_auto,f_auto`;
  return `${url.slice(0, at + marker.length)}${transform}/${url.slice(at + marker.length)}`;
}

// Fotogramma di copertina di un video, come immagine.
export function videoPosterUrl(url, size = 160) {
  if (!url) return null;
  return thumbnailUrl(url, size)?.replace(/\.(mp4|mov|m4v|webm)$/i, '.jpg') ?? null;
}

export function serializeComment(comment, meId) {
  return {
    id: comment.id,
    target: comment.target,
    text: comment.text,
    userId: comment.userId,
    name: comment.user?.name ?? null,
    createdAt: comment.createdAt,
    isMine: comment.userId === meId,
  };
}

function commentsByTarget(comments, meId) {
  const grouped = { photo: [], video: [] };
  for (const comment of comments ?? []) {
    if (grouped[comment.target]) grouped[comment.target].push(serializeComment(comment, meId));
  }
  return grouped;
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

// Vista completa di un contenuto: usata dalla vista giorno, dal flusso sotto
// il calendario e dalla striscia del tempo, così le tre restano coerenti.
export function serializeEntry(entry, user, meId) {
  return {
    ...entryStatus(entry, user),
    isMe: user.id === meId,
    photoUrl: entry?.photoUrl ?? null,
    videoUrl: entry?.videoUrl ?? null,
    photoThumb: thumbnailUrl(entry?.photoUrl ?? null, 480),
    videoPoster: videoPosterUrl(entry?.videoUrl ?? null, 480),
    videoDuration: entry?.videoDuration ?? null,
    comments: commentsByTarget(entry?.comments, meId),
  };
}

export function dayState(statuses) {
  const slots = statuses.flatMap((s) => [s.hasPhoto, s.hasVideo]);
  if (slots.every(Boolean)) return 'complete';
  if (slots.some(Boolean)) return 'partial';
  return 'empty';
}
