import React from 'react';

function plural(n, one, many) {
  return n === 1 ? one : many;
}

export function Countdown({ meetup }) {
  if (!meetup) {
    return (
      <p className="countdown countdown--empty">
        Nessun incontro segnato. Quando sapete la data, mettetela qui sotto.
      </p>
    );
  }

  if (meetup.ongoing) {
    const left = meetup.daysLeft;
    return (
      <div className="countdown countdown--now">
        <p className="countdown__lead">Siete insieme</p>
        <p className="countdown__note">
          {left === 0
            ? 'Ultimo giorno.'
            : `Ancora ${left} ${plural(left, 'giorno', 'giorni')}.`}
        </p>
      </div>
    );
  }

  return (
    <div className="countdown">
      <p className="countdown__lead">
        {meetup.daysAway === 0 ? 'Oggi' : meetup.daysAway}
      </p>
      {meetup.daysAway === 0 && <span className="visually-hidden">comincia</span>}
      {/* Niente preposizione davanti al titolo: "a Annina" inciamperebbe. */}
      <p className="countdown__note">
        {meetup.daysAway > 0 && `${plural(meetup.daysAway, 'giorno', 'giorni')} · `}
        <strong>{meetup.title}</strong>
        {meetup.emoji && <span className="countdown__emoji"> {meetup.emoji}</span>}
      </p>
    </div>
  );
}
