import { PolicyFinancePanel } from '@/components/policy-finance-panel';
import { mexicoDay } from '@/modules/email/notices';
import Link from 'next/link';
import { PolicySourceDetails } from '@/components/policy-source-details';
import { ArrowLeft } from '@/components/icons';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { hasRole } from '@/lib/access-policy';
import { coverageState, frequencies } from '@/modules/clientes/dossier-policy';
import { DossierWizard } from '@/components/dossier-wizard';
import { EmptyState } from '@/components/ui/empty-state';
import { completedChecks, deliveryStage, stages } from '@/modules/polizas/delivery';
import { recordPageView } from '@/modules/page-events';
import { emailHistory, listContacts } from '@/modules/email/server';
import { ClientContacts } from '@/components/client-contacts';
import { DossierEmails } from '@/components/dossier-emails';
export default async function Dossier({params}:{params:Promise<{id:string}>}) {
  const user=await requireUser();const {id}=await params;const client=await getDb().client.findUnique({where:{id},include:{policies:{where:{archivedAt:null},orderBy:{endDate:'desc'},include:{payments:{where:{archivedAt:null},orderBy:{dueDate:'asc'}},claims:{where:{archivedAt:null}},activities:{where:{archivedAt:null,kind:{not:null}},select:{kind:true,status:true,dueDate:true}}}},activities:{where:{archivedAt:null},orderBy:{createdAt:'desc'},take:20},convertedFrom:{select:{id:true,name:true}},_count:{select:{referrals:true}}}});if(!client)notFound();
  await recordPageView(user, 'expedientes', client.id, client.name);
  const [contacts, emails] = await Promise.all([listContacts(client.id), emailHistory(client.id)]);
  const canEdit = hasRole(user.role, 'ADMIN');
  const day=(date:Date)=>date.toISOString().slice(0,10);const today=mexicoDay(new Date());
  return <><Link className="back" href="/crm/clientes"><ArrowLeft size={16} aria-hidden="true"/> Expedientes</Link><div className="eyebrow">EXPEDIENTE DEL CLIENTE</div><div className="contact-toolbar"><h1>{client.name}</h1><span className="badge">{coverageState(client.policies,today)}</span></div>{client.archivedAt?<p className="notice">Este expediente está archivado. Restáuralo desde la lista de clientes para volver a mostrarlo en Expedientes.</p>:null}<p className="lead-small">{client.convertedFrom?<>Llegó como prospecto · <Link href={'/crm/prospectos?q='+encodeURIComponent(client.convertedFrom.name)+'&open='+client.convertedFrom.id}>ver diagnóstico</Link> · </>:null}Referidos que ha recomendado: {client._count.referrals}</p><p>{client.email||'Sin correo'} · {client.phone||'Sin teléfono'} · RFC: {client.taxId||'Sin registrar'}</p><div className="wizard-actions"><Link className="button" href={`/crm/documentos?clientId=${id}`}>Abrir documentos</Link><Link className="text-button" href={`/crm/clientes?view=list&q=${encodeURIComponent(client.name)}`}>Editar datos de contacto</Link></div>
  <ClientContacts clientId={client.id} initial={contacts} canEdit={canEdit}/>
  <p className="lead-small">Activo indica cobertura vigente. Los recibos pendientes o vencidos se muestran por separado y no cancelan automáticamente una póliza.</p>
  {client.policies.map(policy=><section className="document-panel" key={policy.id}><div className="contact-toolbar"><h2>{policy.product} · {policy.number}</h2><span className="badge">{policy.status==='CANCELLED'?'Cancelada':coverageState([policy],today)}</span></div>{policy.status==='ACTIVE'?<div className="delivery-strip"><span className="status-pill tone-blue">Entrega: {stages.find(item=>item.id===deliveryStage(policy,policy.activities))?.label}</span><small>Checklist {completedChecks(policy)}/5</small><Link className="text-button" href={'/crm/entregas?open='+encodeURIComponent(policy.id)}>Abrir entrega activa</Link></div>:null}<p>{policy.insurer} · Vigencia: {day(policy.startDate)} → {day(policy.endDate)}</p><p>Prima total: {policy.premium.toFixed(2)} {policy.currency} · Periodicidad: {frequencies[policy.paymentFrequency as keyof typeof frequencies]||'Sin registrar'}</p><PolicySourceDetails source={policy.sourceData}/><PolicyFinancePanel policyId={policy.id} canEdit={canEdit}/>{policy.claims.length?<p>Siniestros: {policy.claims.map(c=>c.reference).join(', ')}</p>:null}</section>)}
  {!client.policies.length?<EmptyState compact illustration="polizas" title="Aún sin pólizas" message="Registra la primera póliza para definir su vigencia y su calendario de recibos."/>:null}
  {hasRole(user.role,'ADMIN')?<details className="document-panel"><summary>Añadir una póliza y su calendario de pagos</summary><DossierWizard clientId={id}/></details>:null}
  <DossierEmails clientId={client.id} clientName={client.name} senderName={user.name} initial={emails} canSend={canEdit}/>
  <section className="document-panel"><h2>Seguimiento</h2>{client.activities.length?client.activities.map(a=><p key={a.id}>{a.title} · {a.status==='DONE'?'Completada':'Pendiente'}{a.dueDate?` · ${day(a.dueDate)}`:''}</p>):<p>No hay actividades registradas.</p>}</section></>;
}
