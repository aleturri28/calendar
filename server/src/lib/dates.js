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
