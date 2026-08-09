import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { CalendarGrid } from '../components/CalendarGrid.jsx';

const MONTH_NAMES = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function Month({ user }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setData(null);
    api.get(`/api/calendar/${month}`).then(setData);
  }, [month]);

  const [year, monthIndex] = month.split('-');

  return (
    <main className="month">
      <header className="month__head">
        <button onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <h1>{MONTH_NAMES[Number(monthIndex) - 1]} {year}</h1>
        <button onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
      </header>

      {data
        ? <CalendarGrid days={data.days} today={data.today} onOpen={(date) => navigate(`/day/${date}`)} />
        : <p className="loading">…</p>}

      <p className="month__hint">Ciao {user.name}</p>
    </main>
  );
}
