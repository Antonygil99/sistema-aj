import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileSchema, approvalSchema, agentProfileSchema } from '../src/modules/intake/schema';
import { randomSecret, hashSecret, makePin, hashPin, checkPin } from '../src/modules/intake/tokens';
test('administrative intake separates consent, representatives and forbidden extra data',()=>{
  const valid={fullName:'Cliente de prueba',email:'example@example.test',privacyAccepted:true,informationConfirmed:true};
  assert.equal(profileSchema.safeParse(valid).success,true);
  assert.equal(profileSchema.safeParse({...valid,privacyAccepted:false}).success,false);
  assert.equal(profileSchema.safeParse({...valid,email:''}).success,false);
  assert.equal(profileSchema.safeParse({...valid,respondent:'REPRESENTATIVE'}).success,false);
  assert.equal(profileSchema.safeParse({...valid,personType:'COMPANY',birthDate:'1990-01-01'}).success,false);
  assert.equal(profileSchema.safeParse({...valid,diagnosis:'not permitted'}).success,false);
  assert.equal(profileSchema.safeParse({...valid,bankAccount:'not permitted'}).success,false);
  assert.equal(approvalSchema.safeParse({expectedRevision:1,expectedClientUpdatedAt:'2026-10-27T00:00:00Z',fields:[],reviewed:false}).success,false);
  assert.equal(agentProfileSchema.safeParse({cliente_id:'c',expectedRevision:0,nombre:'Cliente',privacyAccepted:true}).success,false);
});
test('link secrets are opaque; PIN hashes bind the code to its own link',()=>{
  const token=randomSecret(),salt=hashSecret(token),pin=makePin();
  assert.match(token,/^[A-Za-z0-9_-]{43}$/);assert.match(pin,/^\d{8}$/);
  const hash=hashPin(pin,salt);assert.equal(checkPin(pin,salt,hash),true);
  assert.equal(checkPin(pin,hashSecret(randomSecret()),hash),false);
  assert.equal(checkPin(pin==='00000000'?'11111111':'00000000',salt,hash),false);
  assert.notEqual(salt,token);assert.notEqual(randomSecret(),token);
});
