import { requireUser } from '@/lib/session';
import { hasRole, normalizeEmail } from '@/lib/access-policy';
import { agents, isAgentId } from '@/agents/catalog';
import { aiConfigured, modelLabel } from '@/agents/server';
import { getPreferences } from '@/modules/preferences-server';
import { recordPageView } from '@/modules/page-events';
import { AssistantsWorkspace } from '@/components/assistants-workspace';
export const dynamic = 'force-dynamic';
// The eight Ruta AJ assistants. They read the CRM with the user's access and only propose changes.
export default async function Asistentes({ searchParams }: { searchParams: Promise<{ agente?: string }> }) {
  const user = await requireUser();
  const requested = (await searchParams).agente;
  const preferences = await getPreferences(normalizeEmail(user.email));
  await recordPageView(user, 'asistentes', 'asistentes', 'Asistentes');
  return <><div className="eyebrow">RUTA AJ</div><h1>Asistentes</h1>
    <p className="lead-small">Ocho asistentes, cada uno experto en una parte del proceso. Consultan el CRM, te responden con datos reales y te proponen acciones que tú confirmas.</p>
    <AssistantsWorkspace initialAgent={isAgentId(requested) ? requested : agents[0].id} configured={aiConfigured()} canAct={hasRole(user.role, 'ADMIN')} isSuperadmin={user.role === 'SUPERADMIN'} modelLabel={modelLabel(preferences.assistantModel)} senderName={user.name}/>
  </>;
}
