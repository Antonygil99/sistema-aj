import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { listBatches } from '@/modules/imports/server';
import { ImportWizard } from '@/components/imports/import-wizard';
import { FeatureDiscovery, TourButton } from '@/components/feature-discovery';
import { targetSchema } from '@/modules/imports/rules';
import '../conexiones/connections.css';
import './imports.css';
export const metadata:Metadata={title:'Importar contactos · Sistema AJ'};
export default async function Imports({searchParams}:{searchParams:Promise<{destino?:string}>}){
  const user=await requireUser('ADMIN'),items=await listBatches(user),target=targetSchema.safeParse((await searchParams).destino);
  return <section className="mcp-page"><header className="mcp-heading"><div><p className="eyebrow">TU CARTERA, CON ORDEN</p><h1>Importar contactos</h1><p>Prepara prospectos o clientes y revisa qué se guardará.</p></div><TourButton id="funcion:importaciones"/></header><FeatureDiscovery feature="imports"/><ImportWizard initialTarget={target.success?target.data:'prospectos'}/><section className="mcp-panel"><h2>También desde tu chat</h2><p>Conecta el MCP y pide preparar una tabla de prospectos o clientes. Si partes de una imagen o PDF, el chat puede entregar sus filas con las dudas marcadas. Los lotes aparecen aquí para tu revisión.</p><Link href="/conexiones" className="text-button">Ver conexiones</Link></section><section className="mcp-panel"><h2>Tus revisiones y reportes</h2>{items.length?items.map(item=><article className="mcp-connection" key={item.id}><div><h3>{item.sourceName}</h3><p>{item.target==='clientes'?'Clientes':'Prospectos'} · {item.status==='APPLIED'?'Aplicado':item.status==='CANCELLED'?'Cancelado':item.expiresAt<new Date()?'Vencido':'Por revisar'}</p></div><Link href={'/importaciones/'+item.id} className="button button-soft">{item.status==='APPLIED'?'Ver reporte':'Abrir revisión'}</Link></article>):<p>Todavía no has preparado un lote.</p>}</section></section>;
}
