import 'server-only';
import { createResend, EmailError, resendConfiguration } from './client';
export function resendConfig() { return resendConfiguration(process.env); }
export function getResend() {
  const config = resendConfig();
  if (!config) throw new EmailError('EMAIL_NOT_CONFIGURED', 503);
  return { config, client: createResend(config) };
}
