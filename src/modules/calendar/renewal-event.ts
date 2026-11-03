import { createHash } from 'node:crypto';

export function renewalEventId(userId: string, policyId: string, generation: number) {
  return createHash('sha256').update(JSON.stringify(['renewal', userId, policyId, generation])).digest('hex');
}
export function renewalEvent(policy: { id: string; number: string; clientId: string; endDate: Date; client: { name: string } }, base: string) {
  const date = policy.endDate.toISOString().slice(0, 10);
  const end = new Date(`${date}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 1);
  return {
    summary: `Renovación · ${policy.client.name} · ${policy.number}`,
    description: `Vencimiento de póliza ${policy.number}. Revisa y prepara su renovación en Sistema AJ.\n${base}/crm/clientes/${encodeURIComponent(policy.clientId)}\n\nLa fecha se mantiene desde el CRM. Los recordatorios por correo conservan su configuración.`,
    start: { date }, end: { date: end.toISOString().slice(0, 10) },
    transparency: 'transparent',
  };
}
export type RenewalEventBody = ReturnType<typeof renewalEvent>;
export function renewalFingerprint(body: RenewalEventBody) { return createHash('sha256').update(JSON.stringify(body)).digest('hex'); }
