import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { human } from '@/modules/mcp/human';
import { consentRequest, oauthRedirect } from '@/modules/mcp/consent';
import { McpError } from '@/modules/mcp/policy';
export const runtime='nodejs';
export async function POST(request:Request) {
  try {
    const user=await human(request);
    const input=z.object({accept:z.boolean(),query:z.string().max(16000),scopes:z.array(z.string().max(40)).max(5)}).strict().parse(await request.json());
    const valid=await consentRequest(input.query,user.role);
    if(input.scopes.some(scope=>!valid.scopes.includes(scope))||!input.scopes.includes('crm:read'))throw new McpError('INVALID_SCOPES');
    const oauthHeaders=new Headers(request.headers);oauthHeaders.set('accept','application/json');
    const oauthRequest=new Request(request.url,{headers:oauthHeaders});
    const result=await getAuth()!.api.oauth2Consent({request:oauthRequest,headers:oauthHeaders,body:{accept:input.accept,scope:input.scopes.join(' '),oauth_query:input.query}});
    return Response.json({redirect_uri:await oauthRedirect(result)},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return apiError(error);}
}
