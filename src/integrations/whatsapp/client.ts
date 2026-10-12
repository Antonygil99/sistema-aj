import 'server-only';
import { z } from 'zod';
const templateSchema = z.object({ to: z.string().regex(/^[1-9]\d{7,14}$/), name: z.string().regex(/^[a-z0-9_]+$/), language: z.string().regex(/^[a-z]{2}(?:_[A-Z]{2})?$/) });
// Solo invocar desde un flujo autorizado, con consentimiento y plantilla aprobada.
export async function sendTemplate(input: z.infer<typeof templateSchema>) {
  const { to, name, language } = templateSchema.parse(input);
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION;
  if (!token || !phoneId || !version || !/^v\d+\.0$/.test(version) || !/^\d+$/.test(phoneId)) throw new Error('WHATSAPP_NOT_CONFIGURED');
  const response = await fetch('https://graph.facebook.com/' + version + '/' + phoneId + '/messages', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'template', template: { name, language: { code: language } } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('WHATSAPP_SEND_FAILED_' + response.status);
  return response.json();
}
