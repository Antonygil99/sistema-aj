import { requireUser } from '@/lib/session';
import { WhatsAppInbox } from '@/components/whatsapp-inbox';
import './whatsapp.css';
import Link from 'next/link';
import {FeatureDiscovery} from '@/components/feature-discovery';
export const dynamic = 'force-dynamic';
export default async function WhatsAppPage() {
  const user = await requireUser();
  return <><div className="eyebrow">RELACIONES · WHATSAPP</div><h1>Mi bandeja</h1><p className="lead-small">Solo tus canales y conversaciones. Cada número empresarial conserva su propio historial.</p>{user.role==='SUPERADMIN'?<Link href="/whatsapp/canales" className="button button-soft">Configurar canales</Link>:null}<FeatureDiscovery feature="brokers"/><WhatsAppInbox canWrite={user.role !== 'USER'}/></>;
}
