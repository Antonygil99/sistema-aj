import { headers } from 'next/headers';
import { currentUser } from '@/lib/session';
import { consentRequest, oauthQuery } from '@/modules/mcp/consent';
import { McpConsent } from '@/components/mcp/consent';
export const dynamic='force-dynamic';
export default async function Consent({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  let query:string;
  try{query=oauthQuery(await searchParams);}catch{return <main className="auth-screen"><section className="auth-card"><h1>Solicitud no válida</h1><p>Vuelve a conectar Sistema AJ desde tu chat para obtener una solicitud nueva.</p></section></main>;}
  const user=await currentUser(await headers());
  if(!user)return <main className="auth-screen"><section className="auth-card"><h1>Inicia la conexión otra vez</h1><p>Tu sesión terminó. Vuelve al chat y conecta Sistema AJ para entrar con Google.</p></section></main>;
  const request=await consentRequest(query,user.role).catch(()=>null);
  if(!request)return <main className="auth-screen"><section className="auth-card"><h1>Solicitud vencida</h1><p>Vuelve a conectar Sistema AJ desde tu chat.</p></section></main>;
  return <main className="auth-screen"><section className="auth-card"><McpConsent request={request} query={query} email={user.email}/></section></main>;
}
