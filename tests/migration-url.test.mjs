import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrationUrl } from '../scripts/migration-url.mjs';
test('direct Prisma endpoint keeps database, credentials and TLS options', () => {
  const source = 'postgresql://test:local-example@pooled.db.prisma.io:5432/postgres?sslmode=require';
  const result = new URL(migrationUrl({ DATABASE_URL: source }));
  assert.equal(result.hostname, 'db.prisma.io');
  assert.equal(result.username, 'test');
  assert.equal(result.password, 'local-example');
  assert.equal(result.pathname, '/postgres');
  assert.equal(result.searchParams.get('sslmode'), 'require');
});
test('explicit direct URL takes precedence and legacy variable is accepted', () => {
  assert.equal(new URL(migrationUrl({ DIRECT_URL: 'postgres://test:local-example@localhost:5432/aj', DATABASE_URL: 'postgres://test:local-example@elsewhere:5432/aj' })).hostname, 'localhost');
  assert.equal(new URL(migrationUrl({ DATA_URL: 'postgres://test:local-example@localhost:5432/aj' })).hostname, 'localhost');
  assert.equal(migrationUrl({}), undefined);
});
test('unsupported credentials and malformed URLs are rejected without disclosure', () => {
  assert.throws(() => migrationUrl({ DATABASE_URL: 'prisma+postgres://example?api_key=test-only' }), /POSTGRESQL_TCP_URL_REQUIRED/);
  assert.throws(() => migrationUrl({ DATABASE_URL: 'invalid-test-only' }), /DATABASE_URL_INVALID/);
});
