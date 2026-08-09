import React from 'react';

const STATE_LABELS = {
  empty: 'niente caricato',
  partial: 'caricato a metà',
  complete: 'giorno completo',
};

export function DayCell({ day, isToday, onOpen }) {
  if (!day.exists) return <div className="cell cell--void" />;

  const late = day.users.some((u) => u.photoLate || u.videoLate);
  // La cella mostra la foto dell'altro: il calendario serve a vedere lui.
  const other = day.users.find((u) => !u.isMe);
  const thumb = other?.thumb ?? null;

  const events = day.events ?? [];
  const meetup = events.find((e) => e.isMeetup);
  const marker = events.find((e) => e.emoji)?.emoji ?? null;

  const classes = ['cell', `cell--${day.state}`];
  if (isToday) classes.push('cell--today');
  if (thumb) classes.push('cell--shot');
  if (meetup) classes.push('cell--meetup');
  else if (events.length) classes.push('cell--event');

  return (
    <button
      className={classes.join(' ')}
      onClick={() => onOpen(day.date)}
      // Le virgolette servono: senza, un URL con virgole rompe la regola CSS.
      style={thumb ? { backgroundImage: `url("${thumb}")` } : undefined}
    >
      <span className="cell__number">{Number(day.date.slice(8))}</span>
      {late && <span className="cell__late" title="caricato in ritardo">·</span>}
      {marker && <span className="cell__event">{marker}</span>}
      {day.users.some((u) => u.fresh) && <span className="cell__fresh" aria-label="nuovo" />}
      <span className="visually-hidden">
        {STATE_LABELS[day.state]}
        {events.length > 0 && `, ${events.map((e) => e.title).join(', ')}`}
      </span>
    </button>
  );
}
