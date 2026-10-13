'use client';
import { useState } from 'react';
export function initialsOf(name: string | null | undefined, email = '') {
  return (name || email).replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || '?';
}
// Google profile photo with an initials fallback (no photo yet, or the image fails to load).
export function Avatar({ name, email, image, size = 34 }: { name?: string | null; email?: string; image?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  return <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} aria-hidden="true">
    {/* eslint-disable-next-line @next/next/no-img-element -- remote Google avatar; next/image would need a remote host allowlist */}
    {image && !failed ? <img src={image} alt="" width={size} height={size} referrerPolicy="no-referrer" loading="lazy" onError={() => setFailed(true)}/> : initialsOf(name, email)}
  </span>;
}
