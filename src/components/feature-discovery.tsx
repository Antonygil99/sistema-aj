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
  drive:{id:'drive-referencias',tour:'funcion:drive',title:'El expediente apunta a Drive',body:'Conecta tu cuenta, explora la carpeta del equipo y vincula referencias sin copiar originales ni cambiar sus permisos.',anchor:'2026-10-29-drive',art:'drive-references'},
  brokers:{id:'brokers-privados',tour:'funcion:brokers',title:'Tu bandeja, tu atención',body:'Solo ves los canales asignados a tu cuenta. Cada broker conserva sus conversaciones y el superadmin prepara la configuración.',anchor:'2026-10-29-brokers',art:'broker-inboxes'},
  renewal:{id:'renovacion-preparada',tour:'funcion:renovacion-preparada',title:'Primero prepara, después comunica',body:'Compara primas de dos vigencias, vincula las carátulas y revisa el resumen antes de contactar al cliente.',anchor:'2026-10-29-brokers',art:'renewal-comparison'},
  policy:{id:'caratula-revisada',tour:'funcion:caratula',title:'De la carátula al formulario',body:'La IA propone datos con evidencia. Tú revisas el número completo, la moneda y las fechas antes de incorporarlos.',anchor:'2026-10-29-brokers',art:'policy-extraction'},
  resources:{id:'recursos-equipo',tour:'funcion:recursos',title:'Tus recursos, en un solo lugar',body:'Organiza pagos, calculadoras y comparativas. Mantén herramientas internas o publica enlaces revisados para tus clientes.',anchor:'2026-10-29-brokers',art:'resource-library'},
  intake:{id:'ficha-cliente',tour:'funcion:ficha-cliente',title:'La ficha la puede llenar tu cliente',body:'Comparte un formulario por WhatsApp y recibe sus datos aquí. Tú revisas qué incorporar al expediente.',anchor:'2026-10-27-fichas',art:'client-intake'},
  procedures:{id:'tramites',tour:'funcion:tramites',title:'Un cambio de póliza, con cada paso en orden',body:'Reutiliza la ficha del cliente, prepara la solicitud y revisa sus documentos hasta recibir el endoso.',anchor:'2026-10-27-tramites',art:'policy-procedure'},
  mcp:{id:'conexiones',tour:'funcion:conexiones',title:'Tu espacio AJ también conversa contigo',body:'Conecta ChatGPT o Claude, consulta expedientes y revisa las propuestas de tu asistente antes de aplicarlas.',anchor:'2026-10-28-conexiones',art:'crm-connections'},
  imports:{id:'importaciones',tour:'funcion:importaciones',title:'Tu lista de contactos, lista para revisar',body:'Trae un Excel o una tabla del chat. Revisa coincidencias, corrige los datos y elige qué contactos guardar.',anchor:'2026-10-28-importaciones',art:'contact-import'},
  mcpForms:{id:'formularios-mcp',tour:'funcion:ficha-mcp',title:'Del chat al formulario de tu cliente',body:'Pide preparar su ficha o un enlace para compartir. Confirma aquí y conserva el código de acceso del cliente.',anchor:'2026-10-28-importaciones',art:'intake-assistant'},
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
