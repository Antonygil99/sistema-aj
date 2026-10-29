import 'server-only';
import { getDb } from '@/lib/db';
import { ResourceError } from '@/modules/resources/rules';
import { recordEvent, eventData } from '@/modules/events';
import type { Actor } from '@/lib/api';
import { confirmationInput, policyDay, renewalInput, scheduleInput, scheduleIssues } from './finance';
import { mexicoDay } from '@/modules/email/notices';
import type { Prisma } from '@/generated/prisma/client';

export async function policyFinance(id: string) {
  const db = getDb();
  const policy = await db.policy.findUnique({ where: { id }, include: { payments: { where: { archivedAt: null }, orderBy: [{ dueDate: 'asc' }, { id: 'asc' }], include: { evidenceDocument: { select: { id: true, name: true, archivedAt: true } } } }, previousPolicy: { select: { id: true, number: true, startDate: true, endDate: true } }, nextPolicy: { select: { id: true, number: true, startDate: true, endDate: true } } } });
  if (!policy) throw new ResourceError('RECORD_NOT_FOUND',404);
  const evidence = await db.document.findMany({ where: { archivedAt: null, OR: [{ policyId: id }, { clientId: policy.clientId, policyId: null, claimId: null }] }, select: { id: true, name: true }, orderBy: { createdAt: 'desc' }, take: 200 });
  return { policy, evidence, today: mexicoDay(new Date()) };
}
export async function createPolicySchedule(id: string, input: unknown, actor: Actor) {
  const data = scheduleInput.parse(input), db = getDb();
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Policy" WHERE id = ${id} FOR UPDATE`;
    const policy = await tx.policy.findUnique({ where: { id }, include: { client: true, _count: { select: { payments: true } } } });
    if (!policy || policy.archivedAt || policy.client.archivedAt || policy.status === 'CANCELLED') throw new ResourceError('RECORD_NOT_FOUND',404);
    if (policy.updatedAt.toISOString() !== new Date(data.expectedUpdatedAt).toISOString()) throw new ResourceError('RECORD_CHANGED',409);
    if (policy._count.payments) throw new ResourceError('FINANCE_SCHEDULE_EXISTS',409);
    if (policy.currency === 'UDI') throw new ResourceError('FINANCE_UDI_REVIEW',422);
    const issue = scheduleIssues({ premium: Number(policy.premium), startDate: policyDay(policy.startDate), endDate: policyDay(policy.endDate) },data.payments,data.paymentFrequency);
    if (issue) throw new ResourceError('FINANCE_SCHEDULE_INVALID',422);
    const oldSource = policy.sourceData && typeof policy.sourceData === 'object' && !Array.isArray(policy.sourceData) ? policy.sourceData as Prisma.InputJsonObject : {};
    await tx.payment.createMany({ data: data.payments.map(row => ({ policyId: id, currency: policy.currency, amount: row.amount, dueDate: new Date(row.dueDate), status: 'PENDING' })) });
    await tx.policy.update({ where: { id }, data: { paymentFrequency: data.paymentFrequency, sourceData: { ...oldSource, paymentsNeedReview: false, paymentScheduleReviewedAt: new Date().toISOString() } } });
  });
  await recordEvent(actor,'updated','polizas',id,'Calendario de recibos revisado');
}
export async function confirmPayment(id: string, input: unknown, actor: Actor) {
  const data = confirmationInput.parse(input), db = getDb();
  if (data.paidAt > mexicoDay(new Date())) throw new ResourceError('FINANCE_FUTURE_PAYMENT',422);
  await db.$transaction(async tx => {
    const payment = await tx.payment.findUnique({ where: { id }, include: { policy: { include: { client: true } } } });
    if (!payment || payment.archivedAt || payment.policy.archivedAt || payment.policy.client.archivedAt || payment.policy.status === 'CANCELLED') throw new ResourceError('RECORD_NOT_FOUND',404);
    if (payment.status === 'PAID') throw new ResourceError('FINANCE_ALREADY_PAID',409);
    const document = await tx.document.findUnique({ where: { id: data.evidenceDocumentId } });
    const sameScope = document && !document.archivedAt && (document.policyId === payment.policyId || (document.clientId === payment.policy.clientId && !document.policyId && !document.claimId));
    if (!sameScope) throw new ResourceError('FINANCE_EVIDENCE_SCOPE',422);
    const saved = await tx.payment.updateMany({ where: { id, updatedAt: new Date(data.expectedUpdatedAt), status: { not: 'PAID' } }, data: { status: 'PAID', paidAt: new Date(data.paidAt), reference: data.reference, evidenceDocumentId: data.evidenceDocumentId } });
    if (!saved.count) throw new ResourceError('RECORD_CHANGED',409);
  });
  await recordEvent(actor,'updated','pagos',id,'Pago confirmado con evidencia');
}
export async function renewPolicy(id: string, input: unknown, actor: Actor) {
  const data = renewalInput.parse(input), db = getDb();
  const renewed = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Policy" WHERE id = ${id} FOR UPDATE`;
    const previous = await tx.policy.findUnique({ where: { id }, include: { client: true, nextPolicy: { select: { id: true } } } });
    if (!previous || previous.archivedAt || previous.client.archivedAt || previous.status === 'CANCELLED') throw new ResourceError('RECORD_NOT_FOUND',404);
    if (previous.nextPolicy) throw new ResourceError('FINANCE_RENEWAL_EXISTS',409);
    if (previous.updatedAt.toISOString() !== new Date(data.expectedUpdatedAt).toISOString()) throw new ResourceError('RECORD_CHANGED',409);
    if (data.startDate < policyDay(previous.endDate)) throw new ResourceError('FINANCE_RENEWAL_DATES',422);
    const next = await tx.policy.create({ data: { number: data.number, insurer: previous.insurer, product: previous.product, productId: previous.productId, clientId: previous.clientId,
      currency: previous.currency, premium: data.premium, paymentFrequency: previous.paymentFrequency, ownerEmail: previous.ownerEmail,
      coverage: previous.coverage, vehicle: previous.vehicle, plates: previous.plates, vehicleUse: previous.vehicleUse,
      startDate: new Date(data.startDate), endDate: new Date(data.endDate), previousPolicyId: id,
      sourceData: { paymentsNeedReview: true, renewalCreatedFrom: id } } });
    await tx.policy.update({ where: { id }, data: { updatedAt: new Date() } });
    // Historical dates, premium and number stay intact. Existing receipts remain on their original term.
    const dueDate = previous.endDate;
    const pending = await tx.renewal.findMany({ where: { policyId: id, archivedAt: null, status: { in: ['PENDING','CONTACTED'] } }, select: { id: true } });
    if (pending.length) await tx.renewal.updateMany({ where: { id: { in: pending.map(row => row.id) } }, data: { status: 'RENEWED' } });
    else await tx.renewal.create({ data: { policyId: id, dueDate, status: 'RENEWED', notes: 'Nueva vigencia vinculada desde el expediente.' } });
    const preparation=await tx.renewalPreparation.findUnique({where:{policyId:id}});
    if(preparation){
      const oldData=preparation.data&&typeof preparation.data==='object'&&!Array.isArray(preparation.data)?preparation.data as Prisma.InputJsonObject:{};
      await tx.renewalPreparation.update({where:{policyId:id},data:{status:'RENEWED',updatedBy:actor.id??'integration',data:{...oldData,status:'RENEWED'}}});
      await tx.crmEvent.create({data:eventData(actor,'updated','renovaciones',id,'Nueva vigencia registrada',{from:preparation.status,to:'RENEWED',nextPolicyId:next.id})});
    }
    await tx.activity.updateMany({where:{policyId:id,kind:'RENOVACION_'+id,archivedAt:null},data:{status:'DONE'}});
    return next;
  });
  await recordEvent(actor,'created','renovaciones',renewed.id,'Nueva vigencia conservando el historial',{previousPolicyId:id});
  return { id: renewed.id, clientId: renewed.clientId };
}
