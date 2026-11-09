import { requireUser } from '@/lib/session';
import { WhatsAppInbox } from '@/components/whatsapp-inbox';
import './whatsapp.css';
import Link from 'next/link';
import {FeatureDiscovery} from '@/components/feature-discovery';
export const dynamic = 'force-dynamic';
export default async function WhatsAppPage({searchParams}:{searchParams:Promise<{conversation?:string}>}) {
  const user = await requireUser();
  const {conversation}=await searchParams;
  return <><div className="eyebrow">RELACIONES · WHATSAPP</div><h1>Mi bandeja</h1><p className="lead-small">Solo tus canales y conversaciones. Cada número empresarial conserva su propio historial.</p>{user.role==='SUPERADMIN'?<Link href="/whatsapp/canales" className="button button-soft">Configurar canales</Link>:null}<FeatureDiscovery feature={user.role==='USER'?'brokers':'whatsappAssistance'}/><WhatsAppInbox key={typeof conversation==='string'?conversation:''} canWrite={user.role !== 'USER'} initialConversationId={typeof conversation==='string'&&conversation.length<=100?conversation:null}/></>;
}
