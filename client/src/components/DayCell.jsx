import React from 'react';

export function DayCell({ day, isToday, onOpen }) {
  if (!day.exists) return <div className="cell cell--void" />;

  const late = day.users.some((u) => u.photoLate || u.videoLate);
  const classes = ['cell', `cell--${day.state}`];
  if (isToday) classes.push('cell--today');

  return (
    <button className={classes.join(' ')} onClick={() => onOpen(day.date)}>
      <span className="cell__number">{Number(day.date.slice(8))}</span>
      {late && <span className="cell__late" title="caricato in ritardo">·</span>}
    </button>
  );
}
