import {publicResourceLinks} from '@/modules/resource-links/server';
import {resourceCategories} from '@/modules/resource-links/rules';
import '@/components/workflows.css';
export const dynamic='force-dynamic';
export const metadata={title:'Recursos para clientes · Sistema AJ'};
export default async function Page(){const rows=await publicResourceLinks();return <main className="public-resource-catalog" style={{maxWidth:1000,margin:'40px auto',padding:24}}><p className="eyebrow">AJ · SEGUROS</p><h1>Recursos para clientes</h1><p>Accede a los recursos publicados por el equipo. Los pagos se realizan en los portales externos de las aseguradoras.</p><div className="resource-cards">{rows.map(r=><article key={r.id} className="resource-card"><small>{resourceCategories[r.category as keyof typeof resourceCategories]} · {r.insurer}</small><h2>{r.title}</h2><p>{r.description}</p><a className="button" href={r.url} target="_blank" rel="noopener noreferrer">Abrir recurso ↗</a></article>)}</div>{!rows.length?<p>El equipo todavía no ha publicado recursos en este catálogo.</p>:null}</main>;}
