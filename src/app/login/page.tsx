import Image from 'next/image';
import { redirect } from 'next/navigation';
import { authConfigured } from '@/lib/auth';
import { pageUser } from '@/lib/session';
import { SignInButton } from '@/components/sign-in-button';
// Placeholder photo (Unsplash License) until the team supplies its own imagery.
import photo from '../../../public/login/izamal.jpg';
export const dynamic = 'force-dynamic';
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await pageUser()) redirect('/');
  const available = authConfigured();
  const failed = Boolean((await searchParams).error);
  return <main className="auth-screen"><Image src={photo} alt="" fill priority sizes="100vw" placeholder="blur" className="auth-photo"/><section className="auth-card"><div className="brand">AJ<span>SISTEMA</span></div><p className="eyebrow">TU EQUIPO. TU OPERACIÓN.</p><h1>Bienvenido <em>a Sistema AJ.</em></h1><p>Ingresa con la cuenta de Google autorizada para tu equipo.</p><SignInButton available={available}/>{failed ? <p role="alert">No se completó el acceso. Usa una cuenta autorizada o contacta al administrador.</p> : null}{!available ? <p role="status">El acceso todavía no está disponible. Contacta al administrador.</p> : null}<small>CRM de seguros · Acceso privado</small></section><p className="photo-credit">Foto: <a href="https://unsplash.com/photos/TCyn0FNXiqg" target="_blank" rel="noreferrer">Alejandro Zayas</a> · Unsplash</p></main>;
}
