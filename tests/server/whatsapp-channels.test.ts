import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {PrismaClient} from '../../src/generated/prisma/client';
import {ownConversation,conversationScope,channelCredentials} from '../../src/modules/whatsapp/channels';
test('bandejas privadas: usuarios, integraciones e IDs ajenos no revelan conversaciones ni credenciales',async()=>{
  const globalDb=globalThis as typeof globalThis&{ajDb?:PrismaClient},old=globalDb.ajDb,oldUrl=process.env.DATABASE_URL;
  const rows=[{ownerEmail:'ale@example.invalid',phoneNumberId:'10001',enabled:true},{ownerEmail:'joel@example.invalid',phoneNumberId:'20002',enabled:true}];
  const conversations=[{id:'a',phoneNumberId:'10001'},{id:'j',phoneNumberId:'20002'},{id:'legacy',phoneNumberId:'30003'}];
  const fake={whatsAppChannel:{findMany:async({where}:{where:{ownerEmail:string}})=>rows.filter(r=>r.ownerEmail===where.ownerEmail)},whatsAppConversation:{findFirst:async({where}:{where:{id:string;phoneNumberId:{in:string[]}}})=>conversations.find(c=>c.id===where.id&&where.phoneNumberId.in.includes(c.phoneNumberId))??null}};
  const actor=(email:string,role:'ADMIN'|'SUPERADMIN'='ADMIN')=>({id:'fixture',name:'Fixture',email,role});
  try{
    globalDb.ajDb=fake as unknown as PrismaClient;process.env.DATABASE_URL='postgresql://fixture:fixture@127.0.0.1/never-connect';
    assert.equal((await ownConversation('a',actor('ale@example.invalid'))).id,'a');
    await assert.rejects(ownConversation('j',actor('ale@example.invalid')),{code:'WA_NOT_FOUND'});
    await assert.rejects(ownConversation('a',actor('joel@example.invalid')),{code:'WA_NOT_FOUND'});
    await assert.rejects(ownConversation('legacy',actor('ale@example.invalid')),{code:'WA_NOT_FOUND'});
    await assert.rejects(ownConversation('a',actor('super@example.invalid','SUPERADMIN')),{code:'WA_NOT_FOUND'});
    assert.deepEqual(await conversationScope({id:null,name:'Integración',email:null,role:'ADMIN'}),{phoneNumberId:{in:[]}});
    assert.deepEqual(await conversationScope(actor('joel@example.invalid')),{phoneNumberId:{in:['20002']}});
    assert.equal(channelCredentials({phoneNumberId:'10001',credentialSlot:'UNTRUSTED_ENV_NAME',enabled:true}),null);
    assert.equal(channelCredentials({phoneNumberId:'10001',credentialSlot:'ALE',enabled:false}),null);
  }finally{globalDb.ajDb=old;if(oldUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=oldUrl;}
});
