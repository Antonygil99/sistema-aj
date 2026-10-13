import 'dotenv/config';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';

// Prepared data stays outside Git. Dry-run by default; --apply imports clients and catalog only.
// This importer never invents policy periods, premium totals, payment dates or contact details.
const file = process.argv.find((value, i) => i > 1 && value !== '--apply');
if (!file) throw new Error('PREPARED_JSON_REQUIRED');
const input = JSON.parse(await fs.readFile(file, 'utf8'));
const normalize = value => String(value).normalize('NFC').trim().replace(/\s+/g, ' ').toUpperCase();
const idFor = (kind, key) => 'imp_' + createHash('sha256').update('aj-client-catalog-v1:' + kind + ':' + key).digest('hex').slice(0, 40);
if (input.version !== 1 || !/^[a-f0-9]{64}$/.test(input.sourceSha256) || !Array.isArray(input.clients) || !Array.isArray(input.products)) throw new Error('IMPORT_FORMAT_INVALID');
for (const row of input.clients) if (!row.name || row.name.length > 250 || row.key !== normalize(row.name)) throw new Error('CLIENT_INPUT_INVALID');
for (const row of input.products) if (!row.name || row.name.length > 250 || !row.insurer || !['AUTO','MEDICAL','HOME','OTHER'].includes(row.line)) throw new Error('PRODUCT_INPUT_INVALID');
if (new Set(input.clients.map(row => row.key)).size !== input.clients.length || new Set(input.products.map(row => normalize(row.name))).size !== input.products.length) throw new Error('IMPORT_DUPLICATE_KEY');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.DATA_URL, connectionTimeoutMillis: 15000 });
const apply = process.argv.includes('--apply');
const stats = { clientsCreated: 0, clientsReused: 0, productsCreated: 0, productsReused: 0, foldersCreated: 0, policiesCreated: 0, paymentsCreated: 0 };
let committed = false;
try {
  await db.connect();
  await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  await db.query("SELECT pg_advisory_xact_lock(hashtext('aj-client-catalog-import-v1'))");
  const existingClients = (await db.query('SELECT id,name,"archivedAt" FROM "Client"')).rows;
  const existingProducts = (await db.query('SELECT id,name,insurer,line,"archivedAt" FROM "Product"')).rows;
  const clients = [], products = [], links = [];
  for (const row of input.clients) {
    const matches = existingClients.filter(existing => normalize(existing.name) === row.key);
    if (matches.length > 1 || matches[0]?.archivedAt) throw new Error('CLIENT_MATCH_REQUIRES_REVIEW');
    const id = matches[0]?.id || idFor('client',row.key);
    if (matches.length) stats.clientsReused++; else { clients.push({id,name:row.name});stats.clientsCreated++; }
    links.push({ sourceRows:row.sourceRows,clientId:id });
  }
  for (const row of input.products) {
    const matches = existingProducts.filter(existing => normalize(existing.name) === normalize(row.name));
    if (matches.length > 1 || matches[0]?.archivedAt || (matches[0] && (normalize(matches[0].insurer) !== normalize(row.insurer) || matches[0].line !== row.line))) throw new Error('PRODUCT_MATCH_REQUIRES_REVIEW');
    const id=matches[0]?.id||idFor('product',normalize(row.name));
    if (matches.length) stats.productsReused++; else { products.push({id,name:row.name,insurer:row.insurer,line:row.line,description:'Categoría reportada en '+input.sourceFile+': '+row.category+'. El archivo no especifica el nombre comercial, coberturas ni condiciones del producto.'});stats.productsCreated++; }
  }
  const folders=clients.flatMap(client=>['Identificación','Pólizas','Pagos','Siniestros'].map(name=>({id:idFor('folder',client.id+':'+name),name,clientId:client.id})));
  const manifest={sourceFile:input.sourceFile,sourceSha256:input.sourceSha256,sourceRows:input.rows,stats,clientLinks:links,productIds:products.map(p=>p.id),importedAt:new Date().toISOString()};
  if (apply) {
    await db.query('INSERT INTO "Client" (id,name,"updatedAt") SELECT id,name,NOW() FROM jsonb_to_recordset($1::jsonb) AS x(id text,name text)',[JSON.stringify(clients)]);
    await db.query('INSERT INTO "Product" (id,name,insurer,line,description,"updatedAt") SELECT id,name,insurer,line::"ProductLine",description,NOW() FROM jsonb_to_recordset($1::jsonb) AS x(id text,name text,insurer text,line text,description text)',[JSON.stringify(products)]);
    const result=await db.query('INSERT INTO "DocumentFolder" (id,name,"clientId","updatedAt") SELECT id,name,"clientId",NOW() FROM jsonb_to_recordset($1::jsonb) AS x(id text,name text,"clientId" text) ON CONFLICT DO NOTHING',[JSON.stringify(folders)]);
    stats.foldersCreated=result.rowCount;
    if(clients.length||products.length)await db.query('INSERT INTO "CrmEvent" (id,action,module,"recordId",label,"actorName") VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING',[idFor('audit',input.sourceSha256),'created','importaciones',input.sourceSha256,`${stats.clientsCreated} expedientes y ${stats.productsCreated} categorías por aseguradora importados desde Excel`,'Importación autorizada de Excel']);
    const verification=(await db.query('SELECT (SELECT count(*) FROM "Client" WHERE id=ANY($1::text[])) AS clients, (SELECT count(*) FROM "Product" WHERE id=ANY($2::text[])) AS products',[links.map(l=>l.clientId),input.products.map(row=>existingProducts.find(p=>normalize(p.name)===normalize(row.name))?.id||idFor('product',normalize(row.name)))])).rows[0];
    if(Number(verification.clients)!==input.clients.length||Number(verification.products)!==input.products.length)throw new Error('IMPORT_VERIFICATION_FAILED');
    await db.query('COMMIT');committed=true;
    await fs.writeFile(file.replace(/\.json$/i,'')+'.import-result.json',JSON.stringify(manifest,null,2));
    console.log('AJ_IMPORT_VERIFIED',JSON.stringify(stats));
  } else { await db.query('ROLLBACK');console.log('AJ_IMPORT_DRY_RUN',JSON.stringify({...stats,foldersPlanned:folders.length})); }
} catch(error) {
  if(!committed)await db.query('ROLLBACK').catch(()=>{});
  const known=/^(CLIENT_|PRODUCT_|IMPORT_)/.test(error?.message||'')?error.message:'IMPORT_DATABASE_ERROR';
  console.error(committed?'IMPORT_COMMITTED_MANIFEST_WRITE_FAILED':known);process.exitCode=1;
} finally { await db.end().catch(()=>{}); }
