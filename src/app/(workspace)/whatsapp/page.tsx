import { requireUser } from '@/lib/session';
import { WhatsAppInbox } from '@/components/whatsapp-inbox';
import './whatsapp.css';
export const dynamic = 'force-dynamic';
export default async function WhatsAppPage() {
  const user = await requireUser();
  return <><div className="eyebrow">RELACIONES · WHATSAPP</div><h1>Conversaciones</h1><p className="lead-small">Un espacio para escuchar, responder y dar seguimiento. Cada número empresarial conserva su propia conversación.</p><WhatsAppInbox canWrite={user.role !== 'USER'}/></>;
}
