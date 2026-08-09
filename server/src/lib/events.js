import { isValidDate, daysBetween, START_DATE } from './dates.js';

export const MAX_TITLE_LENGTH = 60;
export const MAX_EMOJI_LENGTH = 8;
// Un evento che dura più di un anno non è un evento, è un errore di battitura.
export const MAX_SPAN_DAYS = 366;

// Restituisce il motivo del rifiuto, oppure null se i dati vanno bene.
export function findEventProblem({ title, emoji, startDate, endDate, isMeetup }) {
  if (typeof title !== 'string' || !title.trim()) return 'invalid_title';
  if (title.trim().length > MAX_TITLE_LENGTH) return 'invalid_title';

  if (emoji != null && (typeof emoji !== 'string' || emoji.length > MAX_EMOJI_LENGTH)) {
    return 'invalid_emoji';
  }
  if (isMeetup != null && typeof isMeetup !== 'boolean') return 'invalid_meetup';

  if (!isValidDate(startDate) || startDate < START_DATE) return 'invalid_start';
  if (!isValidDate(endDate) || endDate < startDate) return 'invalid_end';
  if (daysBetween(startDate, endDate) > MAX_SPAN_DAYS) return 'span_too_long';

  return null;
}

export function serializeEvent(event, today) {
  const ongoing = event.startDate <= today && today <= event.endDate;
  return {
    id: event.id,
    title: event.title,
    emoji: event.emoji,
    startDate: event.startDate,
    endDate: event.endDate,
    isMeetup: event.isMeetup,
    isRange: event.startDate !== event.endDate,
    ongoing,
    // Negativo per un evento già passato, 0 se comincia oggi.
    daysAway: daysBetween(today, event.startDate),
    daysLeft: ongoing ? daysBetween(today, event.endDate) : null,
  };
}

// Il countdown guarda un incontro solo: quello in corso, altrimenti il primo
// che arriva. Un conto alla rovescia verso più date insieme non conta niente.
export function nextMeetup(events, today) {
  const meetups = events.filter((e) => e.isMeetup);

  const ongoing = meetups.find((e) => e.startDate <= today && today <= e.endDate);
  if (ongoing) return ongoing;

  return meetups
    .filter((e) => e.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null;
}

export function eventsOnDate(events, date) {
  return events.filter((e) => e.startDate <= date && date <= e.endDate);
}
