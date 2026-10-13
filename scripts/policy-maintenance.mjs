import 'dotenv/config';
import { createHash } from 'node:crypto';
import pg from 'pg';

// Policy upkeep against the configured database. Dry-run by default; --apply writes inside one transaction.
//   --renewals[=60]   Creates a PENDING renewal for every active policy ending within N days (Mexico City) that has
//                     no open renewal yet. Deterministic ids: running it again never duplicates.
//   --clean-details   Clears placeholder values (S/N, N/E, SINDATO, *, —…) copied into plates/vehicle/use/coverage.
//                     The original text stays in Policy.sourceData.
//   --assign-owners --autos=<email> --medicos=<email>
//                     Sets the responsible of policies and catalog products that have none, by catalog line: autos
//                     (AUTO) and medical (MEDICAL, plus "Accidentes y enfermedades", the health operation). Both emails
//                     must be enabled ADMIN accounts. Existing responsibles are never changed. Emails come from the
//                     command line so the public repository never stores them.
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const renewalArg = args.find(arg => arg.startsWith('--renewals'));
const days = renewalArg ? Number(renewalArg.split('=')[1] ?? 60) : null;
const clean = args.includes('--clean-details');
const assign = args.includes('--assign-owners');
const emailArg = name => args.find(arg => arg.startsWith(`--${name}=`))?.split('=')[1]?.trim().toLowerCase() ?? null;
const owners = { autos: emailArg('autos'), medicos: emailArg('medicos') };
if ((days === null && !clean && !assign) || (days !== null && !(Number.isInteger(days) && days > 0 && days <= 120)) || (assign && !(owners.autos && owners.medicos))) throw new Error('USAGE: --renewals[=1..120], --clean-details and/or --assign-owners --autos=<email> --medicos=<email> [--apply]');
const placeholders = ['N/A', 'N/D', 'N/E', 'N/I', 'S/N', 'S/C', 'S/P', 'SN', 'NN', '*', '—', '-', '0', 'XXX000', 'SINDATO', 'SIN DATO', 'SINPLACAS', 'SIN PLACAS', 'NO APLICA', 'NO ESPECIFICADO', '(NO ESPECIFICADO)', 'NO ASIGNADA'];
const id = key => 'ren_' + createHash('sha256').update('aj-renewal-v1:' + key).digest('hex').slice(0, 40);
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
const db = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.DATA_URL, connectionTimeoutMillis: 20000, query_timeout: 30000 });
const stats = { renewalsCreated: 0, renewalsSkipped: 0, detailsCleared: 0, policiesAssigned: {}, productsAssigned: {} };
let committed = false;
try {
  await db.connect();
  await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  await db.query("SELECT pg_advisory_xact_lock(hashtext('aj-client-catalog-import-v1'))");
  if (days !== null) {
    // Policy dates are stored at UTC midnight of their calendar day.
    const due = (await db.query(`SELECT p.id, p.number, p."endDate", EXISTS (SELECT 1 FROM "Renewal" r WHERE r."policyId" = p.id AND r."archivedAt" IS NULL AND (r.status IN ('PENDING','CONTACTED') OR r."dueDate" = p."endDate")) AS covered
      FROM "Policy" p WHERE p.status = 'ACTIVE' AND p."archivedAt" IS NULL AND p."endDate" >= $1::date AND p."endDate" <= ($1::date + $2::int) ORDER BY p."endDate"`, [today, days])).rows;
    const fresh = due.filter(row => !row.covered).map(row => {
      const end = row.endDate.toISOString().slice(0, 10);
      return { id: id(`${row.id}:${end}`), policyId: row.id, dueDate: end, notes: `Creada automáticamente: la póliza ${row.number} vence el ${end.split('-').reverse().join('/')}.` };
    });
    stats.renewalsCreated = fresh.length; stats.renewalsSkipped = due.length - fresh.length;
    if (apply && fresh.length) {
      const result = await db.query(`INSERT INTO "Renewal" (id, "policyId", "dueDate", status, notes, "updatedAt") SELECT id, "policyId", "dueDate"::timestamp, 'PENDING', notes, NOW() FROM jsonb_to_recordset($1::jsonb) AS x(id text, "policyId" text, "dueDate" text, notes text) ON CONFLICT (id) DO NOTHING`, [JSON.stringify(fresh)]);
      if (result.rowCount !== fresh.length) throw new Error('MAINTENANCE_RENEWALS_CHANGED');
      await db.query('INSERT INTO "CrmEvent" (id, action, module, "recordId", label, "actorName") VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING', [id(`audit:${today}:${days}`), 'created', 'renovaciones', `vencen-${days}-dias`, `${fresh.length} renovaciones pendientes para pólizas que vencen en ${days} días`, 'Mantenimiento de pólizas']);
    }
  }
  if (clean) {
    for (const column of ['plates', 'vehicle', '"vehicleUse"', 'coverage']) {
      const sql = `UPDATE "Policy" SET ${column} = NULL, "updatedAt" = NOW() WHERE ${column} IS NOT NULL AND upper(trim(${column})) = ANY($1::text[])`;
      if (apply) stats.detailsCleared += (await db.query(sql, [placeholders])).rowCount;
      else stats.detailsCleared += Number((await db.query(`SELECT count(*) FROM "Policy" WHERE ${column} IS NOT NULL AND upper(trim(${column})) = ANY($1::text[])`, [placeholders])).rows[0].count);
    }
  }
  if (assign) {
    const grants = (await db.query(`SELECT email FROM "AccessGrant" WHERE enabled AND role IN ('ADMIN','SUPERADMIN') AND email = ANY($1::text[])`, [[owners.autos, owners.medicos]])).rows.map(row => row.email);
    for (const email of [owners.autos, owners.medicos]) if (!grants.includes(email)) throw new Error('MAINTENANCE_OWNER_NOT_ADMIN');
    // Health covers the medical line and the "Accidentes y enfermedades" products (stored under OTHER).
    const lines = { autos: `pr.line = 'AUTO'`, medicos: `(pr.line = 'MEDICAL' OR (pr.line = 'OTHER' AND upper(pr.name) LIKE 'ACCIDENTES Y ENFERMEDADES%'))` };
    for (const [group, email] of Object.entries(owners)) {
      const policies = `FROM "Policy" p JOIN "Product" pr ON pr.id = p."productId" WHERE p."ownerEmail" IS NULL AND ${lines[group]}`;
      const products = `FROM "Product" pr WHERE pr."ownerEmail" IS NULL AND ${lines[group]}`;
      if (apply) {
        stats.policiesAssigned[group] = (await db.query(`UPDATE "Policy" SET "ownerEmail" = $1, "updatedAt" = NOW() WHERE id IN (SELECT p.id ${policies})`, [email])).rowCount;
        stats.productsAssigned[group] = (await db.query(`UPDATE "Product" SET "ownerEmail" = $1, "updatedAt" = NOW() WHERE id IN (SELECT pr.id ${products})`, [email])).rowCount;
      } else {
        stats.policiesAssigned[group] = Number((await db.query(`SELECT count(*) ${policies}`)).rows[0].count);
        stats.productsAssigned[group] = Number((await db.query(`SELECT count(*) ${products}`)).rows[0].count);
      }
    }
    const total = Object.values(stats.policiesAssigned).reduce((sum, value) => sum + value, 0);
    if (apply && total) await db.query('INSERT INTO "CrmEvent" (id, action, module, "recordId", label, "actorName") VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING', [id(`owners:${today}:${total}`), 'updated', 'polizas', 'responsables', `Responsables asignados: ${stats.policiesAssigned.autos} pólizas de autos y ${stats.policiesAssigned.medicos} de gastos médicos y accidentes`, 'Mantenimiento de pólizas']);
  }
  if (apply) { await db.query('COMMIT'); committed = true; console.log('AJ_POLICY_MAINTENANCE_APPLIED', JSON.stringify({ today, days, ...stats })); }
  else { await db.query('ROLLBACK'); console.log('AJ_POLICY_MAINTENANCE_DRY_RUN', JSON.stringify({ today, days, ...stats })); }
} catch (error) {
  if (!committed) await db.query('ROLLBACK').catch(() => {});
  console.error(/^(MAINTENANCE_|USAGE)/.test(error?.message || '') ? error.message : 'MAINTENANCE_DATABASE_ERROR');
  process.exitCode = 1;
} finally { await db.end().catch(() => {}); }
