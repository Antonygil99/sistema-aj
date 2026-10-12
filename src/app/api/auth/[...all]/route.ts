import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/lib/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handler(request: Request) {
  const auth = getAuth();
  if (!auth) return Response.json({ error: 'AUTH_NOT_CONFIGURED' }, { status: 503 });
  return toNextJsHandler(auth)[request.method === 'GET' ? 'GET' : 'POST'](request);
}
export const GET = handler;
export const POST = handler;
