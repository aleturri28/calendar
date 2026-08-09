import React, { useRef, useState } from 'react';
import { api } from '../api.js';
import { readVideoDuration, uploadToCloudinary } from '../upload.js';
import { Polaroid } from './Polaroid.jsx';

const LABELS = { photo: 'Foto', video: 'Video' };

// Deve restare allineato a MAX_VIDEO_SECONDS lato server.
export const MAX_VIDEO_SECONDS = 60;

// Limiti del piano gratuito di Cloudinary. Superarli fa fallire l'upload con
// un errore poco comprensibile: meglio fermarsi prima e spiegare perché.
const MAX_BYTES = { photo: 10 * 1024 * 1024, video: 100 * 1024 * 1024 };

const SIZE_HINT = {
  photo: 'Prova con una foto meno pesante.',
  video: 'Se registri in 4K, passa a 1080p: Impostazioni → Fotocamera → Registra video.',
};

function megabytes(bytes) {
  return Math.round(bytes / 1048576);
}

export function UploadSlot({ date, kind, url, disabled, onDone }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function pick(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);

    if (file.size > MAX_BYTES[kind]) {
      setError(
        `Il file pesa ${megabytes(file.size)}MB, il massimo è ` +
        `${megabytes(MAX_BYTES[kind])}MB. ${SIZE_HINT[kind]}`
      );
      return;
    }

    if (kind === 'video') {
      const duration = await readVideoDuration(file);
      if (duration !== null && duration > MAX_VIDEO_SECONDS) {
        setError(`Il massimo è ${MAX_VIDEO_SECONDS}s, questo dura ${Math.round(duration)}s`);
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
      if (err.data?.error === 'video_too_long') {
        setError(`Il massimo è ${err.data.maxDuration}s, questo dura ${Math.round(err.data.duration)}s`);
      } else if (err.data?.error === 'window_closed') {
        setError('Questo giorno è chiuso');
      } else if (err.detail) {
        setError(`Caricamento fallito: ${err.detail}`);
      } else {
        setError('Caricamento fallito, riprova');
      }
    } finally {
      setBusy(false);
    }
  }

  const label = LABELS[kind].toLowerCase();

  return (
    <div className="slot">
      {url
        ? (
          <Polaroid seed={`${date}-${kind}-me`} caption={LABELS[kind]}>
            {kind === 'photo'
              ? <img src={url} alt="" />
              : <video src={url} controls playsInline />}
          </Polaroid>
        )
        : <div className="slot__empty">{LABELS[kind]}</div>}

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
            {busy ? 'Sviluppo…' : url ? `Sostituisci ${label}` : `Aggiungi ${label}`}
          </button>
        </>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
