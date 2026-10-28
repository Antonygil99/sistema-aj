import 'server-only';
import { verifyOAuthQueryParams } from '@better-auth/oauth-provider';
import { getDb } from '@/lib/db';
import { allowedScopes, mcpScopes, McpError } from './policy';
import type { AccessRole } from '@/lib/access-policy';
export function oauthQuery(params:Record<string,string|string[]|undefined>) {
  const query=new URLSearchParams();
  for(const [key,value]of Object.entries(params)){
    if(value===undefined)continue;
    // Better Auth signs a repeated ba_param entry for each protected query field.
    // Preserve every value; repeated OAuth credentials/redirects remain ambiguous and are rejected.
    if(Array.isArray(value)){
      if(key!=='ba_param'||value.length>64)throw new McpError('INVALID_OAUTH_QUERY');
      for(const item of value)query.append(key,item);
    }else query.append(key,value);
  }
  const serialized=query.toString();
  if(serialized.length>16000)throw new McpError('INVALID_OAUTH_QUERY');
  return serialized;
}
export async function consentRequest(query:string,role:AccessRole) {
  if(query.length>16000||!await verifyOAuthQueryParams(query,process.env.BETTER_AUTH_SECRET!))throw new McpError('OAUTH_REQUEST_EXPIRED',400);
  const params=new URLSearchParams(query),clientId=params.get('client_id');
  if(!clientId)throw new McpError('INVALID_CLIENT');
  const client=await getDb().oauthClient.findFirst({where:{OR:[{clientId},{clientDiscoveryId:clientId}]}});
  if(!client||client.disabled)throw new McpError('INVALID_CLIENT');
  const requested=(params.get('scope')??mcpScopes.join(' ')).split(' ').filter(Boolean);
  const scopes=requested.filter(scope=>allowedScopes(role).includes(scope));
  if(!scopes.includes('crm:read'))throw new McpError('READ_SCOPE_REQUIRED');
  return {clientId:client.clientId,name:client.name??'Aplicación externa',redirect:params.get('redirect_uri')??'',scopes};
}
export async function oauthRedirect(result:unknown):Promise<string> {
  if(result instanceof Response){const location=result.headers.get('location');if(location)return location;if(!result.ok)throw new McpError('OAUTH_REQUEST_FAILED',400);return oauthRedirect(await result.json());}
  const url=result&&typeof result==='object'&&'url' in result?result.url:null;
  if(typeof url!=='string'||!url)throw new McpError('OAUTH_REQUEST_FAILED',400);
  return url;
}
