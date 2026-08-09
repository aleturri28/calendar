import { shiftDate } from './dates.js';

// Un giorno è "pieno" quando entrambi hanno messo foto e video: è la sola
// definizione che rende onesta la striscia dei giorni consecutivi.
export function isFullDay(entriesOfDay, userCount) {
  if (entriesOfDay.length < userCount) return false;
  return entriesOfDay.every((e) => e.photoUrl && e.videoUrl);
}

export function longestStreak(fullDates) {
  const sorted = [...fullDates].sort();
  let best = 0;
  let run = 0;
  let previous = null;

  for (const date of sorted) {
    run = previous && shiftDate(previous, 1) === date ? run + 1 : 1;
    if (run > best) best = run;
    previous = date;
  }

  return best;
}

export function summarize({ month, dates, entries, comments, users }) {
  const byDate = {};
  for (const entry of entries) {
    (byDate[entry.date] ??= []).push(entry);
  }

  const fullDates = dates.filter((date) => isFullDay(byDate[date] ?? [], users.length));

  const commentsByDate = {};
  for (const comment of comments) {
    commentsByDate[comment.date] = (commentsByDate[comment.date] ?? 0) + 1;
  }

  const mostCommented = Object.entries(commentsByDate)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? null;

  return {
    month,
    days: dates.length,
    photos: entries.filter((e) => e.photoUrl).length,
    videos: entries.filter((e) => e.videoUrl).length,
    fullDays: fullDates.length,
    longestStreak: longestStreak(fullDates),
    comments: comments.length,
    commentsBy: users.map((user) => ({
      userId: user.id,
      name: user.name,
      count: comments.filter((c) => c.userId === user.id).length,
    })),
    mostCommented: mostCommented ? { date: mostCommented[0], count: mostCommented[1] } : null,
  };
}
