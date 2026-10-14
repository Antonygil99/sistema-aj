import { requireUser } from '@/lib/session';
import { hasRole, normalizeEmail } from '@/lib/access-policy';
import { getDb } from '@/lib/db';
import { listNotices, listTemplates, refreshNotices } from '@/modules/email/notices-server';
import { recordPageView } from '@/modules/page-events';
import { NoticesBoard } from '@/components/notices-board';
export const dynamic = 'force-dynamic';
// Client notices (renewals, receipts, open claims) waiting for a person, and the team's email texts.
export default async function Avisos({ searchParams }: { searchParams: Promise<{ scope?: string; tab?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const scope = params.scope === 'all' ? 'all' : 'mine';
  const canAct = hasRole(user.role, 'ADMIN');
  await refreshNotices();
  const email = normalizeEmail(user.email);
  const [pending, resolved, templates] = await Promise.all([listNotices({ scope, email }), listNotices({ scope, email, resolved: true }), canAct ? listTemplates() : Promise.resolve([])]);
  const ownerEmails = [...new Set([...pending, ...resolved].flatMap(notice => notice.ownerEmail ? [notice.ownerEmail] : []))];
  const owners = Object.fromEntries((ownerEmails.length ? await getDb().authUser.findMany({ where: { email: { in: ownerEmails } }, select: { email: true, name: true } }) : []).map(owner => [owner.email.toLowerCase(), owner.name]));
  await recordPageView(user, 'avisos', 'avisos', 'Avisos a clientes');
  return <><div className="eyebrow">SEGUIMIENTO</div><h1>Avisos a clientes</h1>
    <p className="lead-small">Renovaciones a 30, 20 y 10 días, recibos a 20 y 10 días y el día que vencen, y siniestros abiertos cada semana. Nada sale solo: envía el correo sugerido, registra que avisaste por otro medio o descártalo.</p>
    <NoticesBoard pending={pending} resolved={resolved} scope={scope} initialTab={params.tab === 'plantillas' && canAct ? 'plantillas' : 'avisos'} canAct={canAct} templates={templates} senderName={user.name} owners={owners}/>
  </>;
}
