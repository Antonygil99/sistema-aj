import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { migrationUrl } from './migration-url.mjs';

const connectionString = migrationUrl(process.env);
if (!connectionString) throw new Error('DATABASE_CONNECTION_NOT_CONFIGURED');
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 15000 });
const required = ['Prospect','Client','Policy','Quote','Payment','Renewal','Claim','Document','Activity','WebhookEvent','AgentRun','AccessGrant','AuthUser','AuthSession','AuthAccount','AuthVerification','AuthRateLimit','AccessAudit','DocumentFolder','CrmEvent','Product','UserPreference','CalendarConnection','CalendarMeeting','ClientIntake','ClientIntakeRevision','InsuranceProcedure','ProcedureRevision','ProcedureAttachment','ProcedureExport','InsuranceTemplate','Jwks','OauthClient','OauthResource','OauthClientResource','OauthAccessToken','OauthRefreshToken','OauthConsent','OauthClientAssertion','McpChange','McpRevocation','CrmImport','CrmImportRow','WhatsAppChannel','RenewalPreparation','CrmResourceLink','DriveConnection','ClientDriveLink','BrokerEmailTemplate','Insurer'];
const scrub = text => {
  let safe = text;
  for (const value of [connectionString, process.env.DIRECT_URL, process.env.DATABASE_URL, process.env.DATA_URL]) {
    if (value) safe = safe.split(value).join('[connection redacted]');
  }
  return safe.replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[connection redacted]');
};
try {
  await client.connect();
  const before = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  const existing = before.rows.map(row => row.tablename);
  if (existing.length && !existing.includes('_prisma_migrations')) throw new Error('DATABASE_NOT_EMPTY_REVIEW_REQUIRED');
  console.log('Database connection verified; no existing data will be deleted.');
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js','migrate','deploy'], {
    env: { ...process.env, DIRECT_URL: connectionString }, encoding: 'utf8', timeout: 180000,
  });
  if (result.status !== 0) {
    console.error(scrub((result.stdout ?? '') + (result.stderr ?? '')));
    throw new Error('MIGRATION_DEPLOY_FAILED');
  }
  const after = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  const tables = new Set(after.rows.map(row => row.tablename));
  const missing = required.filter(name => !tables.has(name));
  if (missing.length) throw new Error('EXPECTED_TABLES_MISSING');
  const pending = await client.query('SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL');
  if (pending.rows[0].count) throw new Error('MIGRATION_INCOMPLETE');
  const primary = process.env.AJ_SUPERADMIN_EMAIL?.trim().toLowerCase();
  const admins = [...new Set((process.env.AJ_ADMIN_EMAILS ?? '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean))];
  if(primary) {
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primary) || admins.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('AUTH_EMAIL_CONFIGURATION_INVALID');
    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO "AccessGrant" (id,email,role,enabled,"updatedAt") VALUES ($1,$2,\'SUPERADMIN\',true,NOW()) ON CONFLICT (email) DO UPDATE SET role=\'SUPERADMIN\',enabled=true,"updatedAt"=NOW()', [randomUUID(),primary]);
      for(const email of admins.filter(email => email !== primary)) {
        await client.query('INSERT INTO "AccessGrant" (id,email,role,enabled,"updatedAt") VALUES ($1,$2,\'ADMIN\',true,NOW()) ON CONFLICT (email) DO NOTHING', [randomUUID(),email]);
      }
      await client.query('COMMIT');
    } catch(error) { await client.query('ROLLBACK'); throw error; }
    console.log('Initial access grants configured without changing existing secondary users.');
  }
  console.log(`AJ_DATABASE_VERIFIED: ${required.length} required application tables and completed migrations.`);
} catch (error) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  const known = error instanceof Error && /^(DATABASE_|POSTGRESQL_|MIGRATION_|EXPECTED_)/.test(error.message) ? error.message : 'DATABASE_CONNECTION_OR_QUERY_FAILED';
  console.error(known + (code ? ' (' + String(code) + ')' : ''));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
