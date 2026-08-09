import React from 'react';
import { DayCell } from './DayCell.jsx';

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

// Celle vuote iniziali: allineano il primo del mese al giorno della settimana
// giusto, con la settimana che parte da lunedì.
function leadingBlanks(firstDate) {
  const [y, m, d] = firstDate.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domenica
  return (weekday + 6) % 7;
}

export function CalendarGrid({ days, today, onOpen }) {
  return (
    <div className="grid">
      {WEEKDAYS.map((label, i) => (
        <div key={i} className="grid__weekday">{label}</div>
      ))}
      {Array.from({ length: leadingBlanks(days[0].date) }, (_, i) => (
        <div key={`blank-${i}`} className="cell cell--void" />
      ))}
      {days.map((day) => (
        <DayCell key={day.date} day={day} isToday={day.date === today} onOpen={onOpen} />
      ))}
    </div>
  );
}
