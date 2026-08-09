// Safari su iOS a volte riporta Infinity come durata di un file appena scelto:
// in quel caso restituiamo null e lasciamo decidere al server, che legge il
// dato reale da Cloudinary.
export function readVideoDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(Number.isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(null);
    };
    video.src = URL.createObjectURL(file);
  });
}

// overwrite e invalidate devono valere esattamente 'true', la stessa stringa
// firmata dal server: qualunque differenza fa fallire la verifica della firma.
export async function uploadToCloudinary(file, signature) {
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signature.apiKey);
  form.append('timestamp', String(signature.timestamp));
  form.append('public_id', signature.publicId);
  form.append('overwrite', 'true');
  form.append('invalidate', 'true');
  form.append('signature', signature.signature);

  const url = `https://api.cloudinary.com/v1_1/${signature.cloudName}/${signature.resourceType}/upload`;
  const res = await fetch(url, { method: 'POST', body: form });

  if (!res.ok) {
    // Il messaggio di Cloudinary dice cosa è andato storto davvero (chiave
    // sbagliata, firma scaduta, formato non supportato): perderlo qui
    // significa mostrare "riprova" per un problema che nessun retry risolve.
    const body = await res.json().catch(() => null);
    const error = new Error('upload_failed');
    error.detail = body?.error?.message ?? `HTTP ${res.status}`;
    throw error;
  }
}
