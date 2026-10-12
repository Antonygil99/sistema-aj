import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasRole, permittedRole, trustedMutation } from '../src/lib/access-policy';
test('ninguna cuenta desactivada o no verificada obtiene acceso', () => {
  assert.equal(permittedRole(null,true,'demo@example.invalid'),null);
  assert.equal(permittedRole({role:'ADMIN',enabled:false},true,'demo@example.invalid'),null);
  assert.equal(permittedRole({role:'ADMIN',enabled:true},false,'demo@example.invalid'),null);
});
test('solo la identidad principal puede usar el rol superadmin', () => {
  const grant={role:'SUPERADMIN' as const,enabled:true};
  assert.equal(permittedRole(grant,true,'other@example.invalid','owner@example.invalid'),null);
  assert.equal(permittedRole(grant,true,'OWNER@example.invalid','owner@example.invalid'),'SUPERADMIN');
  assert.equal(hasRole('ADMIN','SUPERADMIN'),false);
  assert.equal(hasRole('USER','ADMIN'),false);
  assert.equal(hasRole('SUPERADMIN','ADMIN'),true);
});
test('los cambios con cookies exigen el origen exacto, sin confiar en dominios parecidos', () => {
  const request=(origin?:string)=>new Request('https://app.example.invalid/api/users',{method:'PATCH',headers:origin?{origin}:undefined});
  assert.equal(trustedMutation(request('https://app.example.invalid'),'https://app.example.invalid'),true);
  assert.equal(trustedMutation(request('https://app.example.invalid.attacker.invalid'),'https://app.example.invalid'),false);
  assert.equal(trustedMutation(request(),'https://app.example.invalid'),false);
});
