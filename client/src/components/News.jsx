import React from 'react';
import { api } from '../api.js';

function piece(count, one, many) {
  if (!count) return null;
  return `${count} ${count === 1 ? one : many}`;
}

// "2 foto, 1 video e 3 commenti" — con la e davanti all'ultimo, come si dice.
function phrase(news) {
  const parts = [
    piece(news.photos, 'foto', 'foto'),
    piece(news.videos, 'video', 'video'),
    piece(news.comments, 'commento', 'commenti'),
  ].filter(Boolean);

  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}

export function News({ news, onSeen }) {
  if (!news || news.total === 0) return null;

  async function markSeen() {
    await api.post('/api/news/seen');
    await onSeen();
  }

  return (
    <button className="news" onClick={markSeen}>
      <span className="news__dot" aria-hidden="true" />
      <span>
        {news.from ? `${news.from}: ` : 'Novità: '}
        {phrase(news)}
      </span>
    </button>
  );
}
