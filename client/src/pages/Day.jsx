import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { UploadSlot, MAX_VIDEO_SECONDS } from '../components/UploadSlot.jsx';
import { Polaroid } from '../components/Polaroid.jsx';

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

function readableDate(date) {
  const [, month, day] = date.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1]}`;
}

export function Day() {
  const { date } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  const load = useCallback(() => api.get(`/api/days/${date}`).then(setData), [date]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <p className="loading">…</p>;

  const me = data.users.find((u) => u.isMe);
  const other = data.users.find((u) => !u.isMe);

  return (
    <main className="day">
      <header className="day__head">
        <button onClick={() => navigate('/')} aria-label="Torna al calendario">‹</button>
        <h1>{readableDate(date)}</h1>
      </header>

      {!data.isOpen && <p className="day__closed">Giorno chiuso, non è più modificabile.</p>}

      <section className="day__column">
        <h2>Tu</h2>
        <p className="day__hint">Una foto e un video, fino a {MAX_VIDEO_SECONDS} secondi.</p>
        <UploadSlot date={date} kind="photo" url={me.photoUrl} disabled={!data.isOpen} onDone={load} />
        <UploadSlot date={date} kind="video" url={me.videoUrl} disabled={!data.isOpen} onDone={load} />
      </section>

      <section className="day__column">
        <h2>{other.name}</h2>

        {other.photoUrl && (
          <Polaroid seed={`${date}-photo-${other.userId}`} caption={other.photoLate ? 'Foto, in ritardo' : 'Foto'}>
            <img src={other.photoUrl} alt="" />
          </Polaroid>
        )}

        {other.videoUrl && (
          <Polaroid seed={`${date}-video-${other.userId}`} caption={other.videoLate ? 'Video, in ritardo' : 'Video'}>
            <video src={other.videoUrl} controls playsInline />
          </Polaroid>
        )}

        {!other.photoUrl && !other.videoUrl && <p className="day__empty">Ancora niente.</p>}
      </section>
    </main>
  );
}
