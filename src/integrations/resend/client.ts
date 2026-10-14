// Resend REST client (https://resend.com/docs/api-reference). Pure: configuration comes from the given env and
// fetch can be injected, so tests/email.test.ts exercises it without network. Wiring lives in ./server.ts.
export class EmailError extends Error {
  constructor(public code: string, public status = 502) { super(code); }
}
export type ResendConfig = { apiKey: string; from: string; webhookSecret: string | null };
export function resendConfiguration(env: Record<string, string | undefined>): ResendConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  const address = env.RESEND_FROM_ADDRESS?.trim() || 'avisos@segurosaleyjoel.com';
  return { apiKey, from: address, webhookSecret: env.RESEND_WEBHOOK_SECRET?.trim() || null };
}
// "Ale Valencia · AJ Consultoría de Seguros" <avisos@…>: the display name tells clients who writes to them.
export function sender(address: string, name: string) {
  const clean = name.replace(/["<>\r\n]/g, '').trim() || 'Sistema AJ';
  return `"${clean}" <${address}>`;
}
export type OutgoingEmail = {
  from: string; to: string[]; subject: string; html: string; text: string;
  replyTo?: string | null; scheduledAt?: string | null; idempotencyKey: string;
  attachments?: { filename: string; content: string }[];
  tags?: { name: string; value: string }[];
};
type Fetch = typeof fetch;
const BASE = 'https://api.resend.com';
async function call(config: ResendConfig, fetcher: Fetch, path: string, init: { method: string; body?: unknown; idempotencyKey?: string }) {
  let response: Response;
  try {
    response = await fetcher(BASE + path, {
      method: init.method,
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'User-Agent': 'sistema-aj', ...(init.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(20000),
    });
  } catch { throw new EmailError('EMAIL_UNAVAILABLE', 503); }
  const body = await response.json().catch(() => ({})) as { id?: string; name?: string; message?: string };
  if (response.ok) return body;
  // Never surface Resend's message to the browser: it can echo addresses or the request.
  if (response.status === 429) throw new EmailError('EMAIL_RATE_LIMITED', 429);
  if (response.status === 401 || response.status === 403) throw new EmailError('EMAIL_NOT_CONFIGURED', 503);
  if (response.status === 404) throw new EmailError('EMAIL_NOT_FOUND', 404);
  if (response.status === 409) throw new EmailError('EMAIL_DUPLICATE', 409);
  if (response.status === 422 || response.status === 400) throw new EmailError('EMAIL_REJECTED', 422);
  throw new EmailError('EMAIL_UNAVAILABLE', 503);
}
export function createResend(config: ResendConfig, fetcher: Fetch = fetch) {
  return {
    async send(email: OutgoingEmail): Promise<string> {
      const body = await call(config, fetcher, '/emails', { method: 'POST', idempotencyKey: email.idempotencyKey, body: {
        from: email.from, to: email.to, subject: email.subject, html: email.html, text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
        ...(email.scheduledAt ? { scheduled_at: email.scheduledAt } : {}),
        ...(email.attachments?.length ? { attachments: email.attachments } : {}),
        ...(email.tags?.length ? { tags: email.tags } : {}),
      } });
      if (!body.id) throw new EmailError('EMAIL_UNAVAILABLE', 503);
      return body.id;
    },
    async reschedule(id: string, scheduledAt: string) { await call(config, fetcher, `/emails/${encodeURIComponent(id)}`, { method: 'PATCH', body: { scheduled_at: scheduledAt } }); },
    async cancel(id: string) { await call(config, fetcher, `/emails/${encodeURIComponent(id)}/cancel`, { method: 'POST' }); },
  };
}
export type ResendClient = ReturnType<typeof createResend>;
