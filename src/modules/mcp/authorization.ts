import { allowedScopes, mcpResource, moduleSchema, operationSchema } from './policy';
import type { AccessRole } from '@/lib/access-policy';

export function toolScopes(name:string,input:Record<string,unknown>={}) {
  if(name==='aj_request_persistent_access')return ['crm:read','offline_access'];
  if(name==='aj_request_change_access')return ['crm:read','crm:write','crm:files','offline_access'];
  if(name==='aj_prepare_upload')return ['crm:read','crm:files'];
  if(name==='aj_propose_change'){
    const operation=operationSchema.safeParse(input.operation),resource=moduleSchema.safeParse(input.module);
    const scope=operation.success&&operation.data==='delete'?'crm:delete':resource.success&&['documentos','carpetas'].includes(resource.data)?'crm:files':'crm:write';
    return ['crm:read',scope];
  }
  return ['aj_prepare_intake','aj_prepare_import'].includes(name)?['crm:read','crm:write']:['crm:read'];
}
// Suggest refresh permission on the initial OAuth challenge. Existing short-lived
// connections retain read access; persistence always requires human consent.
export function initialAuthorizationChallenge() {
  return `Bearer resource_metadata="${new URL('/.well-known/oauth-protected-resource/mcp',mcpResource()).href}", scope="crm:read offline_access"`;
}
export function persistentAuthorizationChallenge(challenge:string|null) {
  if(!challenge)return initialAuthorizationChallenge();
  if(!/\bscope=/.test(challenge))return challenge+', scope="crm:read offline_access"';
  return challenge.replace(/\bscope="([^"]*)"/,(_,scopes:string)=>`scope="${[...new Set([...scopes.split(/\s+/).filter(Boolean),'offline_access'])].join(' ')}"`);
}
// Only offer incremental authorization when the live CRM role can actually receive the missing scopes.
export function authorizationChallenge(role:AccessRole,active:string[],required:string[]){
  const allowed=allowedScopes(role);
  if(!required.every(scope=>allowed.includes(scope))||required.every(scope=>active.includes(scope)))return null;
  const scopes=[...new Set([...active.filter(scope=>allowed.includes(scope)),...required])];
  return `Bearer resource_metadata="${new URL('/.well-known/oauth-protected-resource/mcp',mcpResource()).href}", error="insufficient_scope", error_description="Authorize additional CRM permissions to continue", scope="${scopes.join(' ')}"`;
}
