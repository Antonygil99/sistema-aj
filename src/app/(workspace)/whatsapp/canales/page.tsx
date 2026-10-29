import Link from 'next/link';
import {requireUser} from '@/lib/session';
import {WhatsAppChannels} from '@/components/whatsapp-channels';
export const dynamic='force-dynamic';
export default async function Page(){await requireUser('SUPERADMIN');return <><Link href="/whatsapp">← Mi bandeja</Link><h1>Canales de WhatsApp</h1><WhatsAppChannels/></>;}
