import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { UploadSlot } from '../components/UploadSlot.jsx';

export function Day() {
  const { date } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  const load = useCallback(() => api.get(`/api/days/${date}`).then(setData), [date]);
  useEffect(() => { load(); }, [load]);

  async function setMinimum(seconds) {
    await api.put(`/api/days/${date}/min-duration`, { seconds });
    await load();
  }

  if (!data) return <p className="loading">…</p>;

  const me = data.users.find((u) => u.isMe);
  const other = data.users.find((u) => !u.isMe);
  const canSetMinimum = date >= data.today;

  return (
    <main className="day">
      <header className="day__head">
        <button onClick={() => navigate('/')}>‹</button>
        <h1>{date.split('-').reverse().join('/')}</h1>
      </header>

      {!data.isOpen && <p className="day__closed">Giorno chiuso, non è più modificabile</p>}

      <section className="day__column">
        <h2>Tu</h2>
        <p className="day__min">Minimo video: {me.minDuration}s</p>
        <UploadSlot date={date} kind="photo" url={me.photoUrl} disabled={!data.isOpen} onDone={load} />
        <UploadSlot date={date} kind="video" url={me.videoUrl} minDuration={me.minDuration}
                    disabled={!data.isOpen} onDone={load} />
      </section>

      <section className="day__column">
        <h2>{other.name}</h2>
        <p className="day__min">
          Minimo che hai imposto: {other.minDuration}s
          {canSetMinimum && (
            <select value={other.minDuration} onChange={(e) => setMinimum(Number(e.target.value))}>
              {[15, 30, 45, 60, 90, 120, 180].map((s) => <option key={s} value={s}>{s}s</option>)}
            </select>
          )}
        </p>
        {other.photoUrl && <img className="slot__media" src={other.photoUrl} alt="" />}
        {other.videoUrl && <video className="slot__media" src={other.videoUrl} controls playsInline />}
        {!other.photoUrl && !other.videoUrl && <p className="day__empty">Ancora niente</p>}
      </section>
    </main>
  );
}
