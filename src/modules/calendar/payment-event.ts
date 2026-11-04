import { createHash } from 'node:crypto';

export function paymentEventId(userId: string, paymentId: string, generation: number) {
  return createHash('sha256').update(JSON.stringify(['payment', userId, paymentId, generation])).digest('hex');
}
export function paymentEvent(payment: { id: string; amount: { toString(): string }; currency: string; dueDate: Date; status: string; policy: { id: string; number: string; clientId: string; client: { name: string } } }, base: string) {
  const date = payment.dueDate.toISOString().slice(0, 10);
  const end = new Date(`${date}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 1);
  const url = `${base}/crm/clientes/${encodeURIComponent(payment.policy.clientId)}?recibo=${encodeURIComponent(payment.id)}#pagos-${encodeURIComponent(payment.policy.id)}`;
  return {
    summary: `Pago · ${payment.policy.client.name} · ${payment.policy.number}`,
    description: `Vencimiento de recibo de la póliza ${payment.policy.number}.\nImporte: ${payment.amount.toString()} ${payment.currency}\nEstado en el CRM: ${payment.status === 'OVERDUE' ? 'Vencido' : 'Pendiente'}\n${url}\n\nConfirma el pago en el expediente. Este evento se retira al sincronizar un recibo pagado o archivado.`,
    start: { date }, end: { date: end.toISOString().slice(0, 10) }, transparency: 'transparent',
  };
}
