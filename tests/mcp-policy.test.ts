import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedScopes, checkPermission, fields, moduleSchema, project, safePatch } from '../src/modules/mcp/policy';

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
