import React from 'react';

const STATE_LABELS = {
  empty: 'niente caricato',
  partial: 'caricato a metà',
  complete: 'giorno completo',
};

export function DayCell({ day, isToday, onOpen }) {
  if (!day.exists) return <div className="cell cell--void" />;

  const late = day.users.some((u) => u.photoLate || u.videoLate);
  const classes = ['cell', `cell--${day.state}`];
  if (isToday) classes.push('cell--today');

  return (
    <button className={classes.join(' ')} onClick={() => onOpen(day.date)}>
      <span className="cell__number">{Number(day.date.slice(8))}</span>
      {late && <span className="cell__late" title="caricato in ritardo">·</span>}
      <span className="visually-hidden">{STATE_LABELS[day.state]}</span>
    </button>
  );
}
