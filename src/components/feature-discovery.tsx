'use client';
import Link from 'next/link';
import { CloseCircle, PlayCircle } from '@/components/icons';
import { usePreferences } from './ui/preferences';
import { useTours } from './ui/tours';

export function TourButton({ id, children = 'Ver recorrido', className = 'text-button' }: { id: string; children?: React.ReactNode; className?: string }) {
  const { start } = useTours();
  return <button type="button" className={className} onClick={() => start(id)}><PlayCircle aria-hidden="true"/>{children}</button>;
}
// Dismissal is a per-user preference, separate from the tour ID: it never disables help or writes client data.
export function IntakeDiscovery() {
  const { preferences, update } = usePreferences();
  const { start } = useTours();
  if (preferences.tours.seen.includes('novedad:ficha-cliente') || preferences.tours.seen.includes('funcion:ficha-cliente')) return null;
  return <aside className="feature-discovery" aria-label="Nueva función: ficha del cliente">
    <div className="feature-discovery-art" aria-hidden="true"/>
    <div className="feature-discovery-copy"><span className="release-eyebrow">NUEVO EN TU EXPEDIENTE</span><h2>La ficha la puede llenar tu cliente</h2><p>Comparte un formulario por WhatsApp y recibe sus datos aquí. Tú revisas qué incorporar al expediente.</p><div className="release-actions"><button type="button" className="button" onClick={() => start('funcion:ficha-cliente')}><PlayCircle aria-hidden="true"/>Muéstrame cómo</button><Link className="text-button" href="/novedades#2026-10-27-fichas">Ver la novedad</Link></div></div>
    <button type="button" className="feature-discovery-close" aria-label="Cerrar tarjeta de la ficha del cliente" onClick={() => update({ tours: { seen: [...preferences.tours.seen, 'novedad:ficha-cliente'] } })}><CloseCircle aria-hidden="true"/></button>
  </aside>;
}
