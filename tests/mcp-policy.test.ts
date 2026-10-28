import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedScopes, checkPermission, fields, moduleSchema, project, safePatch } from '../src/modules/mcp/policy';
import { authorizationChallenge, toolScopes } from '../src/modules/mcp/authorization';

test('MCP tools declare administrative write and file scopes without requesting permanent deletion by default',()=>{
  assert.deepEqual(toolScopes('aj_capabilities'),['crm:read']);
  assert.deepEqual(toolScopes('aj_prepare_intake'),['crm:read','crm:write']);
  assert.deepEqual(toolScopes('aj_prepare_import'),['crm:read','crm:write']);
  assert.deepEqual(toolScopes('aj_prepare_upload'),['crm:read','crm:files']);
  assert.deepEqual(toolScopes('aj_request_change_access'),['crm:read','crm:write','crm:files']);
  assert.deepEqual(toolScopes('aj_propose_change',{module:'carpetas',operation:'update'}),['crm:read','crm:files']);
  assert.deepEqual(toolScopes('aj_propose_change',{module:'clientes',operation:'delete'}),['crm:read','crm:delete']);
});

test('MCP incremental authorization preserves existing scopes, enforces live roles and never upgrades a read token silently',()=>{
  const required=toolScopes('aj_request_change_access'),challenge=authorizationChallenge('ADMIN',['crm:read','offline_access','unrecognized'],required)!;
  assert.match(challenge,/error="insufficient_scope"/);assert.match(challenge,/error_description="[^"]+"/);
  assert.match(challenge,/scope="crm:read offline_access crm:write crm:files"/);assert.ok(!challenge.includes('crm:delete')&&!challenge.includes('unrecognized'));
  assert.equal(authorizationChallenge('USER',['crm:read'],required),null);
  assert.equal(authorizationChallenge('ADMIN',['crm:read'],['crm:read','crm:delete']),null);
  assert.equal(authorizationChallenge('ADMIN',required,required),null);
  assert.throws(()=>checkPermission('ADMIN',['crm:read'],'create'),{code:'PERMISSION_DENIED'});
});

test('MCP intersects delegated scopes with the current CRM role',()=>{
  assert.deepEqual(allowedScopes('USER'),['crm:read','offline_access']);
  assert.throws(()=>checkPermission('USER',['crm:read','crm:write'],'update'),{code:'PERMISSION_DENIED'});
  assert.throws(()=>checkPermission('ADMIN',['crm:delete'],'delete'),{code:'PERMISSION_DENIED'});
  assert.throws(()=>checkPermission('SUPERADMIN',['crm:read'],'delete'),{code:'PERMISSION_DENIED'});
  assert.doesNotThrow(()=>checkPermission('SUPERADMIN',['crm:delete'],'delete'));
  assert.throws(()=>checkPermission('ADMIN',['crm:write'],'update','documentos'),{code:'PERMISSION_DENIED'});
  assert.doesNotThrow(()=>checkPermission('ADMIN',['crm:files'],'upload','documentos'));
});
test('MCP projection and patch allowlists exclude clinical, banking, storage and auth data',()=>{
  const row={id:'a',name:'Cliente',email:'test@example.invalid',storageKey:'secret-key',diagMedicalHistory:'SI',description:'private diagnosis',iban:'secret-bank',token:'secret-token'};
  assert.deepEqual(project('clientes',row),{id:'a',name:'Cliente',email:'test@example.invalid'});
  for(const key of ['storageKey','diagMedicalHistory','description','iban','token','role','__proto__'])assert.throws(()=>safePatch('clientes',Object.fromEntries([[key,'x']])),{code:'FIELD_NOT_AVAILABLE'});
  for(const keys of Object.values(fields))assert.ok(keys.every(k=>!['storageKey','token','description','diagMedicalHistory'].includes(k)));
  assert.equal(moduleSchema.safeParse('AuthUser').success,false);
  assert.equal(moduleSchema.safeParse('api/auth').success,false);
});
test('MCP has no arbitrary JSON, nested data, SQL or code module',()=>{
  assert.deepEqual(safePatch('clientes',{phone:'+529991112233'}),{phone:'+529991112233'});
  assert.throws(()=>safePatch('clientes',{name:'x'.repeat(13000)}),{code:'INPUT_TOO_LARGE'});
  for(const key of ['codigo','deployments','usuarios','email','whatsapp'])assert.equal(moduleSchema.safeParse(key).success,false);
});
