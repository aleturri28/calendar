import React from 'react';

// Rotazione stabile: dipende solo dal seme, così una polaroid non "salta" a
// ogni render. Intervallo stretto (±2.5°) — deve sembrare posata a mano,
// non buttata lì.
export function tiltFor(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 500) / 100 - 2.5;
}

export function Polaroid({ seed, caption, children, flat = false }) {
  const style = flat ? undefined : { '--tilt': `${tiltFor(seed).toFixed(2)}deg` };

  return (
    <figure className={`polaroid${flat ? ' polaroid--flat' : ''}`} style={style}>
      <div className="polaroid__window">{children}</div>
      {caption && <figcaption className="polaroid__caption">{caption}</figcaption>}
    </figure>
  );
}
