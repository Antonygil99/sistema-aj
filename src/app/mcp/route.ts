import { createMcpHandler } from '@modelcontextprotocol/server';
import { requireMcpAuth } from '@better-auth/mcp';
import { getAuth } from '@/lib/auth';
import { actorFromClaims, purgeExpiredUploads, rateLimitMcp } from '@/modules/mcp/actor';
import { createCrmMcp } from '@/modules/mcp/server';
import { mcpResource, McpError } from '@/modules/mcp/policy';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
async function handler(request:Request) {
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(mcpResource()).origin)return new Response(null,{status:403});
  const auth=getAuth();if(!auth)return Response.json({error:'AUTH_NOT_CONFIGURED'},{status:503});
  return requireMcpAuth(auth,async(req,claims)=>{
    try {
      const actor=await actorFromClaims(claims);
      await rateLimitMcp(actor.id);
      await purgeExpiredUploads();
      const mcp=createMcpHandler(()=>createCrmMcp(actor),{legacy:'stateless',responseMode:'json',maxRequestBodySize:1500000});
      const response=await mcp.fetch(req);
      response.headers.set('Cache-Control','private, no-store');
      return response;
    } catch(error) {
      const status=error instanceof McpError?error.status:503;
      return Response.json({error:error instanceof McpError?error.code:'SERVICE_UNAVAILABLE'},{status,headers:{'Cache-Control':'no-store',...(status===401?{'WWW-Authenticate':`Bearer resource_metadata="${new URL('/.well-known/oauth-protected-resource/mcp',mcpResource()).href}"`}:{})}});
    }
  },{resource:mcpResource(),requiredScopes:['crm:read']})(request);
}
export const GET=handler;
export const POST=handler;
export const DELETE=handler;
