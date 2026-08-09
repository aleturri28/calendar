import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { CalendarGrid } from '../components/CalendarGrid.jsx';
import { EntryMedia } from '../components/EntryMedia.jsx';
import { Countdown } from '../components/Countdown.jsx';
import { Events } from '../components/Events.jsx';

const MONTH_NAMES = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Quanti giorni sono passati dall'inizio, estremi inclusi.
function dayNumber(startDate, today) {
  const toUtc = (date) => {
    const [y, m, d] = date.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(today) - toUtc(startDate)) / 86400000) + 1;
}

function readableDay(date) {
  const [, month, day] = date.split('-');
  return `${Number(day)} ${MONTH_NAMES[Number(month) - 1]}`;
}

export function Month({ user }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const [feed, setFeed] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setData(null);
    api.get(`/api/calendar/${month}`).then(setData);
  }, [month]);

  const loadFeed = useCallback(() => api.get('/api/feed').then((r) => setFeed(r.days)), []);
  useEffect(() => { loadFeed(); }, [loadFeed]);

  const [agenda, setAgenda] = useState(null);
  // Gli eventi ricadono anche sul calendario, quindi il mese va riletto.
  const loadEvents = useCallback(async () => {
    setAgenda(await api.get('/api/events'));
    setData(await api.get(`/api/calendar/${month}`));
  }, [month]);
  useEffect(() => { api.get('/api/events').then(setAgenda); }, []);

  const [year, monthIndex] = month.split('-');

  return (
    <main className="month">
      {agenda && <Countdown meetup={agenda.nextMeetup} />}

      <header className="month__head">
        <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mese precedente">‹</button>
        <h1>{MONTH_NAMES[Number(monthIndex) - 1]} {year}</h1>
        <button onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mese successivo">›</button>
      </header>

      {data
        ? <CalendarGrid days={data.days} today={data.today} onOpen={(date) => navigate(`/day/${date}`)} />
        : <p className="loading">…</p>}

      {data && (
        <p className="month__hint">
          Giorno {dayNumber(data.startDate, data.today)} insieme, {user.name}.
        </p>
      )}

      {agenda && (
        <Events today={agenda.today} events={agenda.events} onChange={loadEvents} />
      )}

      <nav className="month__links">
        <button onClick={() => navigate('/timeline')}>Vedi la striscia del tempo →</button>
      </nav>

      {feed && feed.length > 0 && (
        <section className="feed">
          <h2 className="feed__title">Gli ultimi giorni</h2>

          {feed.map((day) => (
            <article key={day.date} className="feed__day">
              <button className="feed__date" onClick={() => navigate(`/day/${day.date}`)}>
                {readableDay(day.date)}
              </button>

              {day.users.map((entry) => (
                (entry.hasPhoto || entry.hasVideo) && (
                  <div key={entry.userId} className="feed__entry">
                    <h3 className="feed__who">{entry.isMe ? 'Tu' : entry.name}</h3>
                    <EntryMedia date={day.date} entry={entry} onChange={loadFeed} />
                  </div>
                )
              ))}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
