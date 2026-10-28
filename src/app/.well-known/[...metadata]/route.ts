import { getAuth } from '@/lib/auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  const path=new URL(request.url).pathname;
  if(!['/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/mcp','/.well-known/oauth-authorization-server/api/auth','/.well-known/openid-configuration/api/auth'].includes(path))return new Response(null,{status:404});
  return getAuth()?.handler(request) ?? Response.json({error:'AUTH_NOT_CONFIGURED'},{status:503});
}
export const HEAD=GET;
