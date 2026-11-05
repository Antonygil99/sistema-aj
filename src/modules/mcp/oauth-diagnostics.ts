// Log only protocol outcome metadata. Never log a request body, code, cookie or credential.
export function oauthTokenDiagnostic(status: number, data: unknown) {
  const body = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  const knownErrors = ['invalid_grant', 'invalid_client', 'invalid_scope', 'invalid_request', 'unsupported_grant_type', 'unauthorized_client', 'server_error'];
  return {
    event: 'MCP_OAUTH_TOKEN_RESULT', status,
    expiresIn: typeof body.expires_in === 'number' ? body.expires_in : null,
    refreshIssued: typeof body.refresh_token === 'string' && body.refresh_token.length > 0,
    error: typeof body.error === 'string' && knownErrors.includes(body.error) ? body.error : status >= 400 ? 'unknown_error' : null,
  };
}
