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
export async function consentRequest(query:string,role:AccessRole,userId?:string) {
  if(query.length>16000||!await verifyOAuthQueryParams(query,process.env.BETTER_AUTH_SECRET!))throw new McpError('OAUTH_REQUEST_EXPIRED',400);
  const params=new URLSearchParams(query),clientId=params.get('client_id');
  if(!clientId)throw new McpError('INVALID_CLIENT');
  const client=await getDb().oauthClient.findFirst({where:{OR:[{clientId},{clientDiscoveryId:clientId}]}});
  if(!client||client.disabled)throw new McpError('INVALID_CLIENT');
  const requested=(params.get('scope')??mcpScopes.join(' ')).split(' ').filter(Boolean);
  const scopes=requested.filter(scope=>allowedScopes(role).includes(scope));
  if(!scopes.includes('crm:read'))throw new McpError('READ_SCOPE_REQUIRED');
  const previous=userId?await getDb().oauthConsent.findFirst({where:{userId,clientId:client.clientId},select:{scopes:true}}):null;
  return {clientId:client.clientId,name:client.name??'Aplicación externa',redirect:params.get('redirect_uri')??'',scopes,canRequestPersistence:client.grantTypes.includes('refresh_token')&&params.get('code_challenge_method')==='S256'&&Boolean(params.get('code_challenge')),previousScopes:previous?.scopes.filter(scope=>scopes.includes(scope))??[]};
}
// Call only after consentRequest has verified the original signed query and the human's session.
// Start a NEW provider-validated request; never alter or re-sign the signed consent request.
export function persistentAuthorizationUrl(query:string) {
  const source=new URLSearchParams(query),params=new URLSearchParams();
  for(const key of ['response_type','client_id','redirect_uri','state','code_challenge','code_challenge_method','resource','nonce','ui_locales','login_hint','max_age'])for(const value of source.getAll(key))params.append(key,value);
  params.set('scope',[...new Set([...(source.get('scope')??'crm:read').split(/\s+/).filter(Boolean),'offline_access'])].join(' '));
  params.set('prompt','consent');
  return '/api/auth/oauth2/authorize?'+params.toString();
}
export async function oauthRedirect(result:unknown):Promise<string> {
  if(result instanceof Response){const location=result.headers.get('location');if(location)return location;if(!result.ok)throw new McpError('OAUTH_REQUEST_FAILED',400);return oauthRedirect(await result.json());}
  const url=result&&typeof result==='object'&&'url' in result?result.url:null;
  if(typeof url!=='string'||!url)throw new McpError('OAUTH_REQUEST_FAILED',400);
  return url;
}
