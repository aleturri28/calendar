import React, { useState } from 'react';
import { api } from '../api.js';

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu',
  'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

function shortDate(date) {
  const [, month, day] = date.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1]}`;
}

function when(event) {
  if (!event.isRange) return shortDate(event.startDate);
  return `${shortDate(event.startDate)} – ${shortDate(event.endDate)}`;
}

const ERRORS = {
  invalid_title: 'Serve un titolo, massimo 60 caratteri',
  invalid_start: 'Data di inizio non valida',
  invalid_end: 'La fine non può venire prima dell\'inizio',
  span_too_long: 'Un evento non può durare più di un anno',
  invalid_emoji: 'Emoji troppo lunga',
};

function AddForm({ today, onDone, onCancel }) {
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [isMeetup, setIsMeetup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/events', {
        title, emoji: emoji || null, startDate, endDate: endDate || startDate, isMeetup,
      });
      await onDone();
    } catch (err) {
      setError(ERRORS[err.data?.error] ?? 'Non è andata, riprova');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="events__form" onSubmit={submit}>
      <div className="events__row">
        <input
          className="events__emoji"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value.slice(0, 8))}
          placeholder="🌙"
          aria-label="Emoji"
        />
        <input
          className="events__title"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 60))}
          placeholder="Cosa succede"
          aria-label="Titolo"
          autoFocus
        />
      </div>

      <label className="events__field">
        Dal
        <input type="date" value={startDate} min={today}
               onChange={(e) => setStartDate(e.target.value)} />
      </label>

      <label className="events__field">
        Al <span className="events__optional">(se dura più giorni)</span>
        <input type="date" value={endDate} min={startDate}
               onChange={(e) => setEndDate(e.target.value)} />
      </label>

      <label className="events__check">
        <input type="checkbox" checked={isMeetup}
               onChange={(e) => setIsMeetup(e.target.checked)} />
        È un incontro — fallo contare alla rovescia
      </label>

      <div className="events__actions">
        <button type="button" className="events__ghost" onClick={onCancel}>Annulla</button>
        <button disabled={busy || !title.trim()}>{busy ? '…' : 'Segna'}</button>
      </div>

      {error && <p className="error">{error}</p>}
    </form>
  );
}

export function Events({ today, events, onChange }) {
  const [adding, setAdding] = useState(false);

  async function remove(id) {
    await api.del(`/api/events/${id}`);
    await onChange();
  }

  return (
    <section className="events">
      <h2 className="feed__title">Cosa ci aspetta</h2>

      {events.length === 0 && !adding && (
        <p className="day__empty">Niente in programma, per ora.</p>
      )}

      <ul className="events__list">
        {events.map((event) => (
          <li key={event.id} className={`events__item${event.ongoing ? ' events__item--now' : ''}`}>
            <span className="events__when">{when(event)}</span>
            <span className="events__what">
              {event.emoji && <span className="events__badge">{event.emoji}</span>}
              {event.title}
              {event.isMeetup && <span className="events__meetup" title="incontro">♥</span>}
            </span>
            <button className="events__remove" onClick={() => remove(event.id)}
                    aria-label={`Cancella ${event.title}`}>×</button>
          </li>
        ))}
      </ul>

      {adding
        ? <AddForm today={today} onCancel={() => setAdding(false)}
                   onDone={async () => { setAdding(false); await onChange(); }} />
        : <button className="events__add" onClick={() => setAdding(true)}>+ Segna una data</button>}
    </section>
  );
}
