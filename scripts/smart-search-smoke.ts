import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '../src/generated/prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {migrationUrl} from './migration-url.mjs';
import {smartSearchWhere,smartSearchSql,type SearchSource} from '../src/modules/smart-search-server';
const db=new PrismaClient({adapter:new PrismaPg({connectionString:migrationUrl(process.env)!,connectionTimeoutMillis:15000,query_timeout:30000,idleTimeoutMillis:1000})});
const marker=randomUUID().replaceAll('-',''),rollback='ROLLBACK_SMART_SEARCH_VERIFIED';let passed=false;
try{
 await db.$transaction(async tx=>{
  const client=await tx.client.create({data:{name:'GÓMEZ, ANTONIO ALDAIR GIL '+marker}});
  const policy=await tx.policy.create({data:{clientId:client.id,number:'HDI-001/09.1519-'+marker,insurer:'Fixture '+marker,product:'Plan de prueba',premium:'1200',currency:'MXN',startDate:new Date('2026-01-01'),endDate:new Date('2027-01-01')}});
  for(const q of ['Antonio Aldair Gil Gomez '+marker,'Gómez, Gil Antonio '+marker,'GIL   ALDAIR '+marker]){
   const filter=await smartSearchWhere('polizas',q,tx);assert.ok(filter.id?.in.includes(policy.id),q);
   assert.equal(await tx.policy.count({where:{...filter,archivedAt:null,status:'CANCELLED'}}),0,'status filters still apply');
  }
  const compact=await smartSearchWhere('polizas','HDI001091519'+marker,tx);assert.ok(compact.id?.in.includes(policy.id),'punctuation-free policy number');
  const dossier=await smartSearchWhere('clientes','HDI001091519'+marker,tx);assert.ok(dossier.id?.in.includes(client.id),'expediente se encuentra también por póliza');
  for(const source of ['prospectos','clientes','polizas','cotizaciones','pagos','renovaciones','siniestros','actividades','productos','documentos','carpetas','aseguradoras','usuarios','whatsapp','agenda','tramites','avisos','auditoria','recursos','plantillas'] as SearchSource[]){
   const sql=smartSearchSql(source,marker)!;await tx.$queryRaw(sql);
  }
  assert.deepEqual(await smartSearchWhere('clientes','%_---',tx),{id:{in:[]}});
  passed=true;throw Error(rollback);
 },{timeout:90000,maxWait:15000});
}catch(e){if(!(e instanceof Error&&e.message===rollback))throw e;}finally{await db.$disconnect();}
assert.ok(passed);console.log('SMART_SEARCH_VERIFIED: nombres en distinto orden, acentos, comas, números con separadores, expediente por póliza, filtros y SQL de todos los módulos. Fixtures revertidas.');
