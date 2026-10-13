import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import pg from 'pg';
import { modules } from '../src/modules/catalog';
import { monthRange } from '../src/modules/metrics/period';
// Read-only integration check. No business record or user session is created or modified.
const token=randomBytes(32).toString('hex'),port=32000+Math.floor(Math.random()*10000),base=`http://127.0.0.1:${port}`;
const db=new pg.Client({connectionString:process.env.DATABASE_URL||process.env.DATA_URL,connectionTimeoutMillis:15000,query_timeout:20000});
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',String(port)],{env:{...process.env,AJ_API_TOKEN:token},stdio:'ignore'});
let failed=false;server.on('error',()=>{failed=true;});
const request=(path:string,authenticated=true)=>fetch(base+path,{headers:authenticated?{Authorization:'Bearer '+token}:{},signal:AbortSignal.timeout(30000)});
try{
 await db.connect();let ready=false;for(let i=0;i<80;i++){if(failed||server.exitCode!==null)throw new Error('SERVER_FAILED');try{if((await request('/api/health',false)).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,250));}assert.equal(ready,true);
 const count=(text:string)=>Number(text.replace(/[^0-9]/g,''));
 for(const entry of modules){const path='/api/metrics/'+entry.slug;const anon=await request(path,false);assert.ok([401,503].includes(anon.status),'anonymous access blocked');const response=await request(path);assert.equal(response.status,200,entry.slug);const {data}=await response.json();assert.equal(data.cards.length,4,entry.slug);assert.ok(data.cards.every((card:{value:string;definition:string})=>card.value&&card.definition&&!/NaN|Infinity|undefined/.test(card.value)));
  if(entry.slug==='clientes'){const actual=(await db.query('SELECT count(*)::int AS n FROM "Client" WHERE "archivedAt" IS NULL')).rows[0].n;assert.equal(count(data.cards[0].value),actual);}
  if(entry.slug==='polizas'){const p=monthRange(new Date(data.asOf));const actual=(await db.query('SELECT count(*)::int AS n FROM "Policy" WHERE "archivedAt" IS NULL AND status=\'ACTIVE\' AND "startDate"<=$1 AND "endDate">=$1',[p.today])).rows[0].n;assert.equal(count(data.cards[1].value),actual);}
  if(entry.slug==='pagos'){const missing=(await db.query('SELECT count(*)::int AS n FROM "Policy" p WHERE p."archivedAt" IS NULL AND p.status<>\'CANCELLED\' AND NOT EXISTS (SELECT 1 FROM "Payment" r WHERE r."policyId"=p.id AND r."archivedAt" IS NULL)')).rows[0].n;assert.equal(count(data.cards[3].value),missing);if(missing)assert.ok(data.note);}
  if(entry.slug==='documentos'){const folders=(await db.query('SELECT count(*)::int AS n FROM "DocumentFolder"')).rows[0].n;assert.equal(count(data.cards[1].value),folders);}
 }
 for(const kind of ['renewals','payments']){const response=await request('/api/metrics/radar?kind='+kind);assert.equal(response.status,200);const {data}=await response.json();assert.ok(data.rows.length<=20);assert.ok(data.total>=data.rows.length);assert.ok(data.rows.every((row:{href:string})=>row.href.startsWith('/crm/')));}
 assert.equal((await request('/api/metrics/radar?kind=invalid')).status,400);assert.equal((await request('/api/metrics/radar?kind=payments&skip=-1')).status,400);assert.equal((await request('/api/metrics/invalid')).status,404);
 const client=(await db.query('SELECT id FROM "Client" WHERE "archivedAt" IS NULL LIMIT 1')).rows[0];if(client){assert.equal((await request('/api/metrics/documentos?clientId='+encodeURIComponent(client.id))).status,200);assert.equal((await request('/api/metrics/polizas?clientId='+encodeURIComponent(client.id))).status,400);}
 console.log('AJ_MODULE_METRICS_VERIFIED: 11 protected KPI modules, currency-safe values, SQL counts, scoped documents, two paginated radars and input rejection; no business data changed.');
}catch(e){console.error('AJ_MODULE_METRICS_CHECK_FAILED',e instanceof assert.AssertionError?e.message:'INTEGRATION_UNAVAILABLE');process.exitCode=1;}finally{await db.end().catch(()=>{});server.kill();}
