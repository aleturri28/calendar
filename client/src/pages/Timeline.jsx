import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Polaroid } from '../components/Polaroid.jsx';

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu',
  'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

function shortDate(date) {
  const [, month, day] = date.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1]}`;
}

export function Timeline() {
  const [shots, setShots] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/timeline').then((data) => setShots(data.shots));
  }, []);

  return (
    <main className="strip">
      <header className="strip__head">
        <button onClick={() => navigate('/')} aria-label="Torna al calendario">‹</button>
        <h1>La striscia</h1>
      </header>

      {!shots && <p className="loading">…</p>}

      {shots && shots.length === 0 && (
        <p className="day__empty">Ancora nessuna foto. Comincia da oggi.</p>
      )}

      {shots && shots.length > 0 && (
        <>
          <p className="strip__hint">Scorri di lato: {shots.length} scatti, dal primo giorno a oggi.</p>
          <div className="strip__rail">
            {shots.map((shot) => (
              <button
                key={`${shot.date}-${shot.userId}`}
                className="strip__shot"
                onClick={() => navigate(`/day/${shot.date}`)}
              >
                <Polaroid seed={`${shot.date}-${shot.userId}`} caption={`${shortDate(shot.date)} · ${shot.name}`}>
                  <img src={shot.thumb} alt="" loading="lazy" />
                </Polaroid>
              </button>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
