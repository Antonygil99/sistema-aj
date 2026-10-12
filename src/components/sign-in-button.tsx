'use client';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
export function SignInButton({ available }: { available: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function signIn() {
    setPending(true); setError('');
    try {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/', errorCallbackURL: '/login?error=acceso' });
      if (result.error) { setError('No fue posible iniciar sesión. Comprueba que tu cuenta esté autorizada.'); setPending(false); }
    } catch { setError('No fue posible conectar. Inténtalo de nuevo.'); setPending(false); }
  }
  return <><button className="button google-button" disabled={!available || pending} onClick={signIn}><span aria-hidden="true">G</span>{pending ? 'Conectando…' : 'Continuar con Google'}</button>{error ? <p role="alert">{error}</p> : null}</>;
}
