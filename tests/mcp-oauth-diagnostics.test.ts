import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oauthTokenDiagnostic } from '../src/modules/mcp/oauth-diagnostics';
test('OAuth diagnostics expose only status and lifetime, never credentials or arbitrary provider text', () => {
  const report = oauthTokenDiagnostic(200, { access_token: 'secret-access', refresh_token: 'secret-refresh', code: 'secret-code', client_secret: 'secret-client', expires_in: 3600, scope: 'crm:read offline_access' });
  assert.deepEqual(report, { event: 'MCP_OAUTH_TOKEN_RESULT', status: 200, expiresIn: 3600, refreshIssued: true, error: null });
  assert.equal(JSON.stringify(report).includes('secret'), false);
  assert.equal(oauthTokenDiagnostic(400, { error: 'invalid_grant' }).error, 'invalid_grant');
  assert.equal(oauthTokenDiagnostic(500, { error: 'secret-value', error_description: 'private-details' }).error, 'unknown_error');
});
