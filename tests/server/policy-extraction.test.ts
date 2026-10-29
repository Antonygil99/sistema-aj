import {test} from 'node:test';import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import type {PrismaClient} from '../../src/generated/prisma/client';
import {extractPolicy} from '../../src/modules/polizas/extraction-server';
test('carátula con proveedor simulado: autorización, límites, salida revisada y ausencia de escrituras de pólizas',async()=>{
 const state=globalThis as typeof globalThis&{ajDb?:PrismaClient},oldDb=state.ajDb,oldFetch=globalThis.fetch;
 const keys=['ANTHROPIC_API_KEY','DATABASE_URL'] as const,env=keys.map(k=>process.env[k]);let calls=0,mode='ok';
 const data={number:'000-3403/26-01',insurer:'Aseguradora de prueba',product:null,clientName:null,premium:'12000.00',currency:'MXN',startDate:'2026-10-01',endDate:'2027-10-01',paymentFrequency:null,evidence:[{field:'number',page:1,quote:'000-3403/26-01'}],warnings:[]};
 const actor={id:'fixture',email:'fixture@example.invalid',name:'Fixture',role:'ADMIN' as const};
 try{
  process.env.DATABASE_URL='postgresql://fixture:fixture@127.0.0.1/never-connect';process.env.ANTHROPIC_API_KEY='fixture-not-real';
  state.ajDb={userPreference:{findUnique:async()=>null},$queryRaw:async()=>[{count:1}]} as unknown as PrismaClient;
  globalThis.fetch=async(url,init)=>{calls++;assert.equal(new URL(String(url)).hostname,'api.anthropic.com');const body=JSON.parse(String(init?.body));assert.equal(body.tools.length,1);assert.equal(body.tool_choice.name,'extract_policy');return Response.json({id:'msg_fixture',type:'message',role:'assistant',model:body.model,content:[{type:'tool_use',id:'tool_fixture',name:'extract_policy',input:mode==='bad'?{...data,number:3403}:data}],stop_reason:'tool_use',stop_sequence:null,usage:{input_tokens:10,output_tokens:10}});};
  const pdf=await PDFDocument.create();pdf.addPage();const file=new File([new Uint8Array(await pdf.save()).buffer],'caratula.pdf',{type:'application/pdf'});
  const result=await extractPolicy(file,actor);assert.equal(result.data.number,data.number);assert.equal(result.saved,false);assert.equal(calls,1);
  mode='bad';await assert.rejects(extractPolicy(file,actor),{code:'POLICY_EXTRACTION_UNAVAILABLE'});
  await assert.rejects(extractPolicy(file,{...actor,role:'USER'}),{code:'FORBIDDEN'});
  const long=await PDFDocument.create();for(let i=0;i<11;i++)long.addPage();await assert.rejects(extractPolicy(new File([new Uint8Array(await long.save()).buffer],'long.pdf',{type:'application/pdf'}),actor),{code:'POLICY_PDF_PAGE_LIMIT'});
  assert.equal(calls,2,'los rechazos locales no llaman al proveedor');
 }finally{state.ajDb=oldDb;globalThis.fetch=oldFetch;keys.forEach((k,i)=>{if(env[i]===undefined)delete process.env[k];else process.env[k]=env[i];});}
});
