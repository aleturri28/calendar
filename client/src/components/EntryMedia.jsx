import React from 'react';
import { Polaroid } from './Polaroid.jsx';
import { Comments } from './Comments.jsx';

const CAPTIONS = { photo: 'Foto', video: 'Video' };

// Una polaroid con sotto i suoi commenti. Stessa forma nella vista giorno e
// nel flusso sotto il calendario, così le due non divergono.
function Piece({ date, entry, target, onChange }) {
  const url = target === 'photo' ? entry.photoUrl : entry.videoUrl;
  if (!url) return null;

  const late = target === 'photo' ? entry.photoLate : entry.videoLate;
  const caption = late ? `${CAPTIONS[target]}, in ritardo` : CAPTIONS[target];

  return (
    <div className="piece">
      <Polaroid seed={`${date}-${target}-${entry.userId}`} caption={caption}>
        {target === 'photo'
          ? <img src={entry.photoUrl} alt="" loading="lazy" />
          : <video src={entry.videoUrl} poster={entry.videoPoster ?? undefined} controls playsInline preload="none" />}
      </Polaroid>

      <Comments
        date={date}
        userId={entry.userId}
        target={target}
        comments={entry.comments[target]}
        onChange={onChange}
      />
    </div>
  );
}

export function EntryMedia({ date, entry, onChange, emptyText = 'Ancora niente.' }) {
  if (!entry.hasPhoto && !entry.hasVideo) {
    return <p className="day__empty">{emptyText}</p>;
  }

  return (
    <>
      <Piece date={date} entry={entry} target="photo" onChange={onChange} />
      <Piece date={date} entry={entry} target="video" onChange={onChange} />
    </>
  );
}
