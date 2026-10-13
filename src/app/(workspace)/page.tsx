import Link from 'next/link';
import { modules } from '@/modules/catalog';
import { agents } from '@/agents/catalog';
import { ArrowRight, Calendar, Add, MagicStar } from 'iconsax-reactjs';
import { moduleIcons } from '@/components/module-icons';
const metrics = [
  { label: 'Prospectos', value: '24', note: 'Por contactar', tone: 'lilac', slug: 'prospectos' },
  { label: 'Pólizas activas', value: '128', note: 'Cartera de ejemplo', tone: 'blue', slug: 'polizas' },
  { label: 'Renovaciones', value: '12', note: 'Próximos 30 días', tone: 'sand', slug: 'renovaciones' },
  { label: 'Siniestros', value: '3', note: 'En seguimiento', tone: 'mint', slug: 'siniestros' },
] as const;
export default function Dashboard() {
  return <div className="overview">
    <section className="overview-heading"><div><div className="eyebrow">ESPACIO DE TRABAJO</div><h1>Un buen día para avanzar<span className="heading-dot">.</span></h1><p>Tu equipo, tus relaciones y cada siguiente paso.</p></div><Link className="button" href="/crm/prospectos"><Add aria-hidden="true"/>Ir a prospectos</Link></section>
    <div className="overview-section-label"><h2>Tu operación, de un vistazo</h2><span className="demo-label">Vista de ejemplo</span></div>
    <section className="metrics" aria-label="Indicadores ilustrativos, aún no conectados a la cartera real">{metrics.map(item => <Link href={`/crm/${item.slug}`} className={`metric-card tone-${item.tone}`} key={item.slug}><div className="metric-label"><span>{item.label}</span><ArrowRight aria-hidden="true"/></div><strong>{item.value}</strong><small>{item.note}</small></Link>)}</section>
    <p className="demo-note">Estos indicadores son ilustrativos. Los registros de prospectos, clientes y documentos sí son reales.</p>
    <div className="overview-columns"><section className="overview-panel"><div className="panel-heading"><div><span className="eyebrow">TODO CONECTADO</span><h2>El ciclo de tus seguros</h2></div><span className="subtle-pill">{modules.length} módulos</span></div><div className="module-grid">{modules.map(module => { const Icon = moduleIcons[module.slug]; return <Link className="module-card" href={`/crm/${module.slug}`} key={module.slug}><span className="module-icon"><Icon aria-hidden="true"/></span><h3>{module.label}</h3><p>{module.description}</p><ArrowRight className="module-arrow" aria-hidden="true"/></Link>; })}</div></section>
      <div className="overview-side"><section className="quick-panel"><span className="eyebrow">POR DÓNDE EMPEZAR</span><h2>Haz espacio para lo importante.</h2><p>Encuentra a tus contactos y mantén sus expedientes a mano.</p><Link href="/crm/clientes">Consultar clientes<ArrowRight aria-hidden="true"/></Link><Link href="/crm/documentos">Abrir documentos<ArrowRight aria-hidden="true"/></Link><Link href="/crm/actividades">Ver actividades<ArrowRight aria-hidden="true"/></Link></section><section className="agenda-preview"><div className="agenda-preview-heading"><Calendar aria-hidden="true"/><span className="subtle-pill">Más adelante</span></div><h2>Tu agenda, aquí.</h2><p>El próximo espacio para citas, seguimientos y recordatorios del equipo.</p><div className="agenda-decoration" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></section></div>
    </div>
    <section className="agents-panel"><div className="panel-heading"><div><span className="eyebrow">MÉTODO AJ</span><h2><MagicStar aria-hidden="true"/>Asistencia para cada etapa</h2></div><span className="subtle-pill">En preparación</span></div><div className="agents">{Object.entries(agents).map(([id, agent], index) => <article key={id}><span className="agent-number">0{index + 1}</span><h3>{agent.name}</h3><p>{agent.purpose}</p></article>)}</div></section>
  </div>;
}
