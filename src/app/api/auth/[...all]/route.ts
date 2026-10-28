import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/lib/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handler(request: Request) {
  const path = new URL(request.url).pathname.replace('/api/auth','');
  if(path.startsWith('/admin/oauth2/'))return Response.json({error:'FORBIDDEN'},{status:403});
  // OAuth grants are reviewed through the CRM, never through a model-visible consent endpoint.
  if (path.startsWith('/oauth2/') && !['/oauth2/authorize','/oauth2/token','/oauth2/register','/oauth2/revoke','/oauth2/introspect','/oauth2/continue'].includes(path)) return Response.json({error:'FORBIDDEN'},{status:403});
  // Calendar tokens are consumed through server-side auth.api calls, never returned to browser clients.
  if (['get-access-token', 'refresh-token'].includes(new URL(request.url).pathname.split('/').at(-1) ?? '')) return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
  const auth = getAuth();
  if (!auth) return Response.json({ error: 'AUTH_NOT_CONFIGURED' }, { status: 503 });
  return toNextJsHandler(auth)[request.method === 'GET' ? 'GET' : 'POST'](request);
}
export const GET = handler;
export const POST = handler;
