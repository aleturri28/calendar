import React, { useState } from 'react';
import { api } from '../api.js';

const MAX_LENGTH = 140;

export function Comments({ date, userId, target, comments, onChange }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(event) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/days/${date}/comments`, { userId, target, text: trimmed });
      setText('');
      await onChange();
    } catch {
      setError('Non è andata, riprova');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    try {
      await api.del(`/api/comments/${id}`);
      await onChange();
    } catch {
      setError('Non è andata, riprova');
    }
  }

  return (
    <div className="notes">
      {comments.map((comment) => (
        <p key={comment.id} className="note">
          <span className="note__who">{comment.name}</span>
          {comment.text}
          {comment.isMine && (
            <button
              className="note__remove"
              onClick={() => remove(comment.id)}
              aria-label="Cancella il commento"
            >
              ×
            </button>
          )}
        </p>
      ))}

      <form className="notes__form" onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
          placeholder="Scrivi due parole…"
          aria-label="Scrivi un commento"
        />
        {text.trim() && (
          <button disabled={busy}>{busy ? '…' : 'Invia'}</button>
        )}
      </form>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
