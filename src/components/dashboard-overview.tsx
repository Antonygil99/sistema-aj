import Link from 'next/link';
import { ArrowDown2, ArrowRight, ArrowUp2, Calendar, Add, Danger, MagicStar, Minus } from '@/components/icons';
import { modules } from '@/modules/catalog';
import { agents } from '@/agents/catalog';
import type { DashboardMetrics } from '@/modules/metrics/server';
import { compactMoney, ratio, type Delta } from '@/modules/metrics/period';
import { moduleIcons } from '@/components/module-icons';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '@/components/ui/avatar';
// Funnel stages are ordered, so they share one validated green ramp (dataviz --ordinal, light and dark themes):
// the values live in theme.css as --funnel-1…5.
const money = (byCurrency: Record<string, number>) => Object.entries(byCurrency).filter(([, value]) => value > 0).map(([currency, value]) => compactMoney(value, currency)).join(' + ') || compactMoney(0);
function DeltaLine({ value }: { value: Delta }) {
  const Icon = value.direction === 'up' ? ArrowUp2 : value.direction === 'down' ? ArrowDown2 : Minus;
  return <span className={`metric-delta is-${value.direction}`}><Icon aria-hidden="true"/>{value.text}</span>;
}
export type Teammate = { email: string; name: string; image: string | null };
// Presentational dashboard: receives already computed metrics (owner null = whole team).
export function DashboardOverview({ m, owner, me: viewer, teammates, showAssistants = false }: { m: DashboardMetrics; owner: string | null; me: Teammate; teammates: Teammate[]; showAssistants?: boolean }) {
  const me = viewer.email;
  const funnelTotal = m.funnel.reduce((total, stage) => total + stage.count, 0);
  const funnelMax = Math.max(1, ...m.funnel.map(stage => stage.count));
  const scope = owner === me ? 'Tus números' : owner ? `Números de ${teammates.find(item => item.email === owner)?.name ?? owner}` : 'Todo el equipo';
  return <div className="overview">
    <section className="overview-heading"><div><div className="eyebrow">ESPACIO DE TRABAJO</div><h1>Un buen día para avanzar<span className="heading-dot">.</span></h1><p>Tu equipo, tus relaciones y cada siguiente paso.</p></div><Link className="button" href="/crm/prospectos"><Add aria-hidden="true"/>Ir a prospectos</Link></section>
    <div className="overview-section-label"><h2>Tu operación en {m.period.label}</h2>
      <nav className="segmented" aria-label="Ver números de">
        <Link href="/?owner=all" aria-current={owner === null ? 'page' : undefined}>Todo el equipo</Link>
        <Link href="/?owner=me" aria-current={owner === me ? 'page' : undefined}><Avatar name={viewer.name} email={me} image={viewer.image} size={22}/>Míos</Link>
        {teammates.map(item => <Link key={item.email} href={`/?owner=${encodeURIComponent(item.email)}`} aria-current={owner === item.email ? 'page' : undefined} title={item.email}><Avatar name={item.name} email={item.email} image={item.image} size={22}/>{item.name}</Link>)}
      </nav>
    </div>
    <section className="metrics" aria-label={`Indicadores · ${scope}`}>
      <Link href="/crm/prospectos" className="metric-card tone-lilac"><div className="metric-label"><span>Prospectos activos</span><ArrowRight aria-hidden="true"/></div><strong>{m.prospects.active}</strong><small>{m.prospects.newThisMonth} nuevo{m.prospects.newThisMonth === 1 ? '' : 's'} este mes</small><DeltaLine value={m.prospects.delta}/></Link>
      <Link href="/crm/polizas" className="metric-card tone-blue"><div className="metric-label"><span>Pólizas activas</span><ArrowRight aria-hidden="true"/></div><strong>{m.policies.active}</strong><small>Prima en cartera: {money(m.policies.premium)}</small></Link>
      <Link href="/crm/polizas" className="metric-card tone-mint"><div className="metric-label"><span>Pólizas emitidas este mes</span><ArrowRight aria-hidden="true"/></div><strong>{m.policies.issued}</strong><small>Cierres de {m.period.label}</small><DeltaLine value={m.policies.delta}/></Link>
      <Link href="/crm/renovaciones" className="metric-card tone-sand"><div className="metric-label"><span>Renovaciones próximas</span><ArrowRight aria-hidden="true"/></div><strong>{m.renewals30}</strong><small>En los próximos 30 días</small></Link>
    </section>
    <div className="overview-columns metrics-columns">
      <section className="overview-panel funnel-panel" aria-labelledby="funnel-title">
        <div className="panel-heading"><div><span className="eyebrow">RUTA AJ</span><h2 id="funnel-title">Embudo de prospectos</h2></div><Link className="subtle-pill" href="/crm/prospectos">Abrir embudo</Link></div>
        {funnelTotal ? <>
          <ol className="funnel">{m.funnel.map((stage, index) => { const share = ratio(stage.count, funnelTotal) ?? 0; return <li key={stage.id} className="funnel-row" tabIndex={0} aria-label={`${stage.label}: ${stage.count} (${share} % del embudo)`}>
            <span className="funnel-label">{stage.label}</span>
            <span className="funnel-track"><i className="funnel-bar" style={{ width: stage.count ? `max(4px, ${stage.count / funnelMax * 100}%)` : '0', background: `var(--funnel-${index + 1})` }}/><b className="funnel-value">{stage.count}</b></span>
            <span className="funnel-tip" role="tooltip">{stage.label}: {stage.count} · {share} % del embudo</span>
          </li>; })}</ol>
          <p className="lead-small">{m.lostThisMonth ? `${m.lostThisMonth} prospecto${m.lostThisMonth === 1 ? '' : 's'} marcado${m.lostThisMonth === 1 ? '' : 's'} como perdido este mes. ` : ''}«Clientes este mes» cuenta las conversiones de {m.period.label}.</p>
          <details className="data-table"><summary>Ver como tabla</summary><div className="table-wrap"><table><thead><tr><th>Etapa</th><th>Prospectos</th><th>% del embudo</th></tr></thead><tbody>{m.funnel.map(stage => <tr key={stage.id}><td>{stage.label}</td><td>{stage.count}</td><td>{ratio(stage.count, funnelTotal) ?? 0} %</td></tr>)}</tbody></table></div></details>
        </> : <EmptyState compact illustration="prospectos" title="El embudo está vacío" message="Cuando registres prospectos verás aquí cuántos hay en cada etapa de la Ruta AJ." action={<Link className="button" href="/crm/prospectos"><Add aria-hidden="true"/>Registrar un prospecto</Link>}/>}
      </section>
      <div className="overview-side">
        <section className="overview-panel meter-panel" aria-labelledby="delivery-title">
          <span className="eyebrow">ENTREGA ACTIVA</span>
          <h2 id="delivery-title">Pólizas completadas</h2>
          <p className="meter-figure"><strong>{m.delivery.completion === null ? '—' : `${m.delivery.completion} %`}</strong><small>{m.delivery.active ? `${m.delivery.completed} de ${m.delivery.active} pólizas activas saben usarse` : 'Aún no hay pólizas activas'}</small></p>
          <div className="meter" role="meter" aria-label="Pólizas completadas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={m.delivery.completion ?? 0}><i style={{ width: `${m.delivery.completion ?? 0}%` }}/></div>
          {m.delivery.followUpsLate ? <p className="status-line is-critical"><Danger aria-hidden="true"/>{m.delivery.followUpsLate} seguimiento{m.delivery.followUpsLate === 1 ? '' : 's'} vencido{m.delivery.followUpsLate === 1 ? '' : 's'}</p> : <p className="status-line">Sin seguimientos vencidos</p>}
          <Link className="panel-link" href="/crm/entregas">Abrir entregas<ArrowRight aria-hidden="true"/></Link>
        </section>
        <section className="overview-panel stat-list" aria-labelledby="ops-title">
          <span className="eyebrow">OPERACIÓN</span>
          <h2 id="ops-title" className="sr-only">Operación</h2>
          <Link href="/crm/pagos" className="stat-row"><span>Recibos vencidos</span><strong>{m.collections.overdue}</strong><small>{m.collections.overdue ? <span className="status-line is-critical"><Danger aria-hidden="true"/>{money(m.collections.amount)} por cobrar</span> : 'Cobranza al día'}</small></Link>
          <Link href="/crm/siniestros" className="stat-row"><span>Siniestros abiertos</span><strong>{m.claims.open}</strong><small>{m.claims.closedThisMonth} atendido{m.claims.closedThisMonth === 1 ? '' : 's'} este mes</small></Link>
          <Link href="/crm/prospectos" className="stat-row"><span>Referidos este mes</span><strong>{m.referrals.thisMonth}</strong><small><DeltaLine value={m.referrals.delta}/><span>{m.referrals.total} en total</span></small></Link>
          <Link href="/crm/cotizaciones" className="stat-row"><span>Cotizaciones este mes</span><strong>{m.quotes.thisMonth}</strong><small>{m.quotes.acceptance === null ? 'Sin cotizaciones decididas aún' : `${m.quotes.acceptance} % aceptadas (de ${m.quotes.decided} decididas)`}</small></Link>
        </section>
        <p className="demo-note">Tiempos de respuesta y casos convertidos en contenido se medirán al conectar WhatsApp y el registro de contenido.</p>
      </div>
    </div>
    <div className="overview-columns"><section className="overview-panel"><div className="panel-heading"><div><span className="eyebrow">TODO CONECTADO</span><h2>El ciclo de tus seguros</h2></div><span className="subtle-pill">{modules.length} módulos</span></div><div className="module-grid">{modules.map(module => { const Icon = moduleIcons[module.slug]; return <Link className="module-card" href={`/crm/${module.slug}`} key={module.slug}><span className="module-icon"><Icon aria-hidden="true"/></span><h3>{module.label}</h3><p>{module.description}</p><ArrowRight className="module-arrow" aria-hidden="true"/></Link>; })}</div></section>
      <div className="overview-side"><section className="quick-panel"><span className="eyebrow">POR DÓNDE EMPEZAR</span><h2>Haz espacio para lo importante.</h2><p>Encuentra a tus contactos y mantén sus expedientes a mano.</p><Link href="/crm/clientes">Consultar clientes<ArrowRight aria-hidden="true"/></Link><Link href="/crm/documentos">Abrir documentos<ArrowRight aria-hidden="true"/></Link><Link href="/crm/actividades">Ver actividades<ArrowRight aria-hidden="true"/></Link></section><section className="agenda-preview"><div className="agenda-preview-heading"><Calendar aria-hidden="true"/><span className="subtle-pill">Más adelante</span></div><h2>Tu agenda, aquí.</h2><p>El próximo espacio para citas, seguimientos y recordatorios del equipo.</p><Link className="text-button" href="/agenda">Abrir mi agenda<ArrowRight aria-hidden="true"/></Link><div className="agenda-decoration" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></section></div>
    </div>
    {showAssistants ? <section className="agents-panel"><div className="panel-heading"><div><span className="eyebrow">RUTA AJ</span><h2><MagicStar aria-hidden="true"/>Asistentes para cada etapa</h2></div><Link className="text-button" href="/asistentes">Abrir asistentes</Link></div><div className="agents">{agents.map((agent, index) => <Link key={agent.id} href={`/asistentes?agente=${agent.id}`} className="agent-link"><span className="agent-number">0{index + 1}</span><h3>{agent.name}</h3><p>{agent.short}</p></Link>)}</div></section> : null}
  </div>;
}
