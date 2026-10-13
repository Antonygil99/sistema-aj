'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logout } from 'iconsax-reactjs';
import { authClient } from '@/lib/auth-client';
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function signOut() {
    setPending(true);
    try { const result = await authClient.signOut(); if (result.error) throw new Error('SIGN_OUT_FAILED'); router.replace('/login'); router.refresh(); }
    catch { setError(true); setPending(false); }
  }
  return <><button className="text-button" onClick={signOut} disabled={pending}><Logout size={14} aria-hidden="true"/>{pending ? 'Cerrando…' : 'Cerrar sesión'}</button>{error ? <span role="alert">Inténtalo de nuevo.</span> : null}</>;
}
