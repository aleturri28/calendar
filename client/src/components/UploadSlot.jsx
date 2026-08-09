import React, { useRef, useState } from 'react';
import { api } from '../api.js';
import { readVideoDuration, uploadToCloudinary } from '../upload.js';

const LABELS = { photo: 'Foto', video: 'Video' };

export function UploadSlot({ date, kind, url, minDuration, disabled, onDone }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function pick(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);

    if (kind === 'video') {
      const duration = await readVideoDuration(file);
      if (duration !== null && duration < minDuration) {
        setError(`Servono almeno ${minDuration}s, questo dura ${Math.round(duration)}s`);
        return;
      }
    }

    setBusy(true);
    try {
      const signature = await api.post(`/api/days/${date}/signature`, { kind });
      await uploadToCloudinary(file, signature);
      await api.post(`/api/days/${date}/confirm`, { kind, publicId: signature.publicId });
      await onDone();
    } catch (err) {
      if (err.data?.error === 'video_too_short') {
        setError(`Servono almeno ${err.data.minDuration}s, questo dura ${Math.round(err.data.duration)}s`);
      } else if (err.data?.error === 'window_closed') {
        setError('Questo giorno è chiuso');
      } else {
        setError('Caricamento fallito, riprova');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="slot">
      {kind === 'photo'
        ? url && <img className="slot__media" src={url} alt="" />
        : url && <video className="slot__media" src={url} controls playsInline />}

      {!url && <div className="slot__empty">{LABELS[kind]}</div>}

      {!disabled && (
        <>
          <input
            ref={input}
            type="file"
            hidden
            accept={kind === 'photo' ? 'image/*' : 'video/*'}
            onChange={pick}
          />
          <button className="slot__button" disabled={busy} onClick={() => input.current.click()}>
            {busy ? 'Carico…' : url ? `Sostituisci ${LABELS[kind].toLowerCase()}` : `Carica ${LABELS[kind].toLowerCase()}`}
          </button>
        </>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
