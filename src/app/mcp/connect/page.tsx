import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { getAuth } from '@/lib/auth';
import { oauthQuery, consentRequest, oauthRedirect } from '@/modules/mcp/consent';
import { SignInButton } from '@/components/sign-in-button';
export const dynamic='force-dynamic';
export default async function Connect({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query=oauthQuery(await searchParams),requestHeaders=await headers();
  let request:Awaited<ReturnType<typeof consentRequest>>;
  try {request=await consentRequest(query,'SUPERADMIN');}catch{return <main className="auth-screen"><section className="auth-card"><h1>Vuelve a iniciar la conexión</h1><p>La solicitud ya venció o no es válida. Regresa a tu aplicación y conecta Sistema AJ otra vez.</p></section></main>;}
  const user=await currentUser(requestHeaders);
  if(user) {
    const oauthHeaders=new Headers(requestHeaders);oauthHeaders.set('accept','application/json');
    const request=new Request(new URL('/mcp/connect?'+query,process.env.BETTER_AUTH_URL!),{headers:oauthHeaders});
    const result=await getAuth()!.api.oauth2Continue({request,headers:oauthHeaders,body:{selected:true,oauth_query:query}});
    redirect(await oauthRedirect(result));
  }
  return <main className="auth-screen"><section className="auth-card"><div className="brand">AJ<span>SISTEMA</span></div><h1>Conecta tu espacio AJ</h1><p>Inicia sesión para revisar qué acceso solicitas para {request.name}.</p><SignInButton available callbackURL={'/mcp/connect?'+query}/><small>En el siguiente paso eliges los permisos.</small></section></main>;
}
