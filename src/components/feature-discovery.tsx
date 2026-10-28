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
  return <FeatureDiscovery feature="intake"/>;
}
const discoveries={
  intake:{id:'ficha-cliente',tour:'funcion:ficha-cliente',title:'La ficha la puede llenar tu cliente',body:'Comparte un formulario por WhatsApp y recibe sus datos aquí. Tú revisas qué incorporar al expediente.',anchor:'2026-10-27-fichas',art:'client-intake'},
  procedures:{id:'tramites',tour:'funcion:tramites',title:'Un cambio de póliza, con cada paso en orden',body:'Reutiliza la ficha del cliente, prepara la solicitud y revisa sus documentos hasta recibir el endoso.',anchor:'2026-10-27-tramites',art:'policy-procedure'},
  mcp:{id:'conexiones',tour:'funcion:conexiones',title:'Tu espacio AJ también conversa contigo',body:'Conecta ChatGPT o Claude, consulta expedientes y revisa las propuestas de tu asistente antes de aplicarlas.',anchor:'2026-10-28-conexiones',art:'crm-connections'},
} as const;
export function FeatureDiscovery({feature}:{feature:keyof typeof discoveries}) {
  const item=discoveries[feature];
  const { preferences, update } = usePreferences();
  const { start } = useTours();
  if (preferences.tours.seen.includes('novedad:'+item.id) || preferences.tours.seen.includes(item.tour)) return null;
  return <aside className="feature-discovery" aria-label={'Nueva función: '+item.title}>
    <div className="feature-discovery-art" style={{backgroundImage:`url('/illustrations/${item.art}.svg')`}} aria-hidden="true"/>
    <div className="feature-discovery-copy"><span className="release-eyebrow">NUEVO EN TU ESPACIO AJ</span><h2>{item.title}</h2><p>{item.body}</p><div className="release-actions"><button type="button" className="button" onClick={() => start(item.tour)}><PlayCircle aria-hidden="true"/>Muéstrame cómo</button><Link className="text-button" href={'/novedades#'+item.anchor}>Ver la novedad</Link></div></div>
    <button type="button" className="feature-discovery-close" aria-label={'Cerrar tarjeta: '+item.title} onClick={() => update({ tours: { seen: [...preferences.tours.seen, 'novedad:'+item.id] } })}><CloseCircle aria-hidden="true"/></button>
  </aside>;
}
