import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {PrismaClient} from '../../src/generated/prisma/client';
import {smartSearchSql,smartSearchWhere} from '../../src/modules/smart-search-server';
import {searchSupplement} from '../../src/modules/search-server';

test('SQL parametriza cada término y no busca notas privadas en MCP',async()=>{
  const query="Gómez, %_' OR 1=1 --";
  const sql=smartSearchSql('polizas',query)!;
  assert.ok(!sql.sql.includes(query));
  assert.ok(sql.values.includes('%gomez%'));
  assert.ok(!smartSearchSql('siniestros','secreto')!.sql.includes('r.description'));
  assert.ok(smartSearchSql('siniestros','secreto',{includePrivateNotes:true})!.sql.includes('r.description'));
  assert.ok(smartSearchSql('whatsapp','+52 (999) 409-7043')!.values.includes('%5219994097043%'),'conserva el alias histórico mexicano solo para buscar');
  let called=false;
  const db={$queryRaw:async()=>{called=true;return [];}} as unknown as Pick<PrismaClient,'$queryRaw'>;
  assert.deepEqual(await smartSearchWhere('clientes','%_---',db),{id:{in:[]}});
  assert.equal(called,false,'los comodines no se convierten en una búsqueda de todo');
});

test('buscador global limita bandeja, agenda, plantillas y trámites según la persona',async()=>{
  const globalDb=globalThis as typeof globalThis&{ajDb?:PrismaClient},old=globalDb.ajDb,oldUrl=process.env.DATABASE_URL;
  const calls:Record<string,Record<string,unknown>[]>={};
  const collected=(model:string)=>calls[model]??[];
  const models=['document','documentFolder','accessGrant','authUser','insurer','calendarMeeting','whatsAppConversation','insuranceProcedure','clientNotice','policy','crmResourceLink','brokerEmailTemplate'];
  const fake:Record<string,unknown>={$queryRaw:async()=>[{id:'candidate'}]};
  for(const model of models)fake[model]={findMany:async(args:Record<string,unknown>)=>{(calls[model]??=[]).push(args);return []}};
  fake.whatsAppChannel={findMany:async()=>[{phoneNumberId:'own-number'}]};
  try{
    globalDb.ajDb=fake as unknown as PrismaClient;process.env.DATABASE_URL='postgresql://fixture:fixture@127.0.0.1/never-connect';
    const actor={id:'ale',name:'Ale',email:'ale@example.invalid',role:'ADMIN' as const};
    await searchSupplement('Gómez, Antonio',actor);
    assert.deepEqual((calls.whatsAppConversation[0].where as Record<string,unknown>).phoneNumberId,{in:['own-number']});
    assert.equal((calls.calendarMeeting[0].where as Record<string,unknown>).userId,'ale');
    assert.equal((calls.brokerEmailTemplate[0].where as Record<string,unknown>).ownerEmail,actor.email);
    assert.deepEqual((calls.insuranceProcedure[0].where as Record<string,unknown>).OR,[{createdById:'ale'},{policy:{ownerEmail:{equals:actor.email,mode:'insensitive'}}}]);
    assert.equal((calls.document[0].where as Record<string,unknown>).archivedAt,null);
    assert.equal(calls.accessGrant,undefined,'un administrador no busca accesos de usuarios');
    for(const key of Object.keys(calls))delete calls[key];
    await searchSupplement('Gómez',{...actor,role:'USER'});
    assert.equal(calls.brokerEmailTemplate,undefined);assert.equal(calls.insuranceProcedure,undefined);assert.equal(calls.clientNotice,undefined);
    await searchSupplement('Gómez',{...actor,role:'SUPERADMIN'});
    assert.equal(collected('accessGrant').length,1);
    assert.equal((collected('insuranceProcedure')[0].where as Record<string,unknown>).OR,undefined);
    assert.deepEqual((calls.whatsAppConversation.at(-1)!.where as Record<string,unknown>).phoneNumberId,{in:['own-number']},'superadmin tampoco obtiene bandejas ajenas');
  }finally{globalDb.ajDb=old;if(oldUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=oldUrl;}
});
