import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

const MONTH_NAMES = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

function readableMonth(month) {
  const [year, index] = month.split('-');
  return `${MONTH_NAMES[Number(index) - 1]} ${year}`;
}

function readableDay(date) {
  const [, month, day] = date.split('-');
  return `${Number(day)} ${MONTH_NAMES[Number(month) - 1]}`;
}

function Stat({ value, label }) {
  return (
    <div className="stat">
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  );
}

export function Summary() {
  const { month } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api.get(`/api/summary/${month}`).then(setData);
  }, [month]);

  if (!data) return <p className="loading">…</p>;

  const leader = [...data.commentsBy].sort((a, b) => b.count - a.count);
  const someoneWrote = leader[0]?.count > 0;

  return (
    <main className="recap">
      <header className="day__head">
        <button onClick={() => navigate('/')} aria-label="Torna al calendario">‹</button>
        <h1>{readableMonth(month)}</h1>
      </header>

      <div className="stats">
        <Stat value={data.fullDays} label={data.fullDays === 1 ? 'giorno pieno' : 'giorni pieni'} />
        <Stat value={data.longestStreak} label="di fila" />
        <Stat value={data.photos} label={data.photos === 1 ? 'foto' : 'foto'} />
        <Stat value={data.videos} label="video" />
      </div>

      <p className="recap__line">
        {data.fullDays === data.days && data.days > 0
          ? 'Nessun giorno saltato. Tutti e due, tutti i giorni.'
          : `${data.fullDays} giorni su ${data.days} completi in due.`}
      </p>

      {data.comments > 0 && (
        <p className="recap__line">
          {data.comments} {data.comments === 1 ? 'commento' : 'commenti'}
          {someoneWrote && `, di cui ${leader[0].count} da ${leader[0].name}`}.
          {data.mostCommented && ` Il giorno più chiacchierato è stato il ${readableDay(data.mostCommented.date)}.`}
        </p>
      )}

      {data.collage.length > 0 && (
        <div className="collage">
          {data.collage.map((shot) => (
            <button
              key={`${shot.date}-${shot.userId}`}
              className="collage__tile"
              onClick={() => navigate(`/day/${shot.date}`)}
              style={{ backgroundImage: `url("${shot.thumb}")` }}
              aria-label={readableDay(shot.date)}
            />
          ))}
        </div>
      )}

      {data.collage.length === 0 && (
        <p className="day__empty">Questo mese non ha ancora foto.</p>
      )}
    </main>
  );
}
