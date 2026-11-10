import 'dotenv/config';
import pg from 'pg';
import {migrationUrl} from './migration-url.mjs';
// Private invocation only: identities are supplied by the operator, never in public source.
const params=new Map(process.argv.slice(2).filter(arg=>arg.includes('=')).map(arg=>{const at=arg.indexOf('=');return [arg.slice(0,at),arg.slice(at+1)];}));
const email=params.get('--email')?.trim().toLowerCase(),lines=[...new Set((params.get('--lines')??'').split(',').filter(Boolean))];
const allowed=['AUTO','MEDICAL','LIFE','ACCIDENT','HOME','TRAVEL','OTHER'];
if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!lines.length||lines.some(line=>!allowed.includes(line)))throw Error('Use --email=cuenta --lines=AUTO o MEDICAL,LIFE; agrega --apply para guardar.');
const client=new pg.Client({connectionString:migrationUrl(process.env),connectionTimeoutMillis:15000});
try{
 await client.connect();
 const grant=await client.query('SELECT role,enabled FROM "AccessGrant" WHERE email=$1',[email]);
 if(grant.rowCount!==1||!grant.rows[0].enabled||grant.rows[0].role!=='ADMIN')throw Error('ACTIVE_ADMIN_REQUIRED');
 const legacy=await client.query('SELECT count(*)::int AS count FROM "Prospect" WHERE lower("ownerEmail")=$1 AND "archivedAt" IS NULL AND "line"<>ALL($2::"ProductLine"[])',[email,lines]);
 console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'preview',areas:lines,prospectsOutsideAreas:legacy.rows[0].count}));
 if(process.argv.includes('--apply')){
  // Existing prospects are deliberately not rewritten; diagnose/classify them individually.
  await client.query('UPDATE "AccessGrant" SET "productLines"=$2::"ProductLine"[],"updatedAt"=NOW() WHERE email=$1 AND enabled=true AND role=\'ADMIN\'',[email,lines]);
  console.log('BROKER_AREAS_SAVED');
 }
}catch(error){console.error(error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'BROKER_AREAS_CONFIGURATION_FAILED');process.exitCode=1;}
finally{await client.end().catch(()=>{});}
