import 'server-only';
import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import { CalendarError } from './schema';
import { safeGoogleLink } from './google';
import { paymentEvent, paymentEventId } from './payment-event';
import { renewalFingerprint } from './renewal-event';

// Only server-resolved users can enter here. No request can choose another broker's ID.
const paymentCredentials = async (userId: string, headers?: Headers) => (await import('./server')).calendarCredentials(userId, headers);
export async function syncCalendarPayments(userId: string, headers?: Headers, deadline = Date.now() + 35000, credentials = paymentCredentials) {
  const db = getDb();
  const user = await db.authUser.findUnique({ where: { id: userId }, select: { email: true } });
  const grant = user && await db.accessGrant.findUnique({ where: { email: user.email.toLowerCase() } });
  if (!grant?.enabled || !['ADMIN', 'SUPERADMIN'].includes(grant.role)) throw new CalendarError('FORBIDDEN', 403);
  const lease = randomUUID();
  const acquired = await db.calendarConnection.updateMany({ where: { userId, enabled: true, OR: [{ renewalLeaseUntil: null }, { renewalLeaseUntil: { lt: new Date() } }] }, data: { renewalLeaseToken: lease, renewalLeaseUntil: new Date(Date.now() + 120000) } });
  if (!acquired.count) return { changed: 0, more: false, running: true };
  let changed = 0;
  let retry = false;
  try {
    const google = await credentials(userId, headers);
    const base = new URL(process.env.BETTER_AUTH_URL!).origin;
    const payments = await db.payment.findMany({ where: {
      archivedAt: null, status: { in: ['PENDING', 'OVERDUE'] },
      policy: { ownerEmail: { equals: user!.email, mode: 'insensitive' }, archivedAt: null, status: { not: 'CANCELLED' }, client: { archivedAt: null } },
    }, select: { id: true, amount: true, currency: true, dueDate: true, status: true, policy: { select: { id: true, number: true, clientId: true, client: { select: { name: true } } } } }, orderBy: { dueDate: 'asc' } });
    const existing = await db.calendarPayment.findMany({ where: { userId } });
    const byPayment = new Map(existing.map(row => [row.paymentId, row]));
    const valid = new Set(payments.map(payment => payment.id));
    const work: Array<() => Promise<void>> = [];
    // Remove managed events for paid/archived receipts, cancelled policies, and reassigned portfolios.
    for (const row of existing.filter(row => row.active && !valid.has(row.paymentId))) work.push(async () => {
      await google.cancelPayment(paymentEventId(userId, row.paymentId, row.generation));
      await db.calendarPayment.update({ where: { id: row.id }, data: { active: false, fingerprint: '', generation: { increment: 1 }, googleUrl: null, checkedAt: new Date() } });
    });
    // Uncreated/changed entries first; then oldest checks. Large portfolios cannot starve behind yesterday's first batch.
    payments.sort((a, b) => (byPayment.get(a.id)?.checkedAt?.getTime() ?? 0) - (byPayment.get(b.id)?.checkedAt?.getTime() ?? 0));
    for (const payment of payments) {
      const body = paymentEvent(payment, base);
      const fingerprint = renewalFingerprint(body);
      const old = byPayment.get(payment.id);
      if (old?.active && old.fingerprint === fingerprint && old.checkedAt && Date.now() - old.checkedAt.getTime() < 86400000) continue;
      work.push(async () => {
        const row = await db.calendarPayment.upsert({ where: { userId_paymentId: { userId, paymentId: payment.id } }, create: { id: paymentEventId(userId, payment.id, 0), userId, paymentId: payment.id, active: true }, update: { active: true } });
        const id = paymentEventId(userId, payment.id, row.generation);
        try {
          const event = await google.syncPayment(id, body);
          await db.calendarPayment.update({ where: { id: row.id }, data: { active: true, fingerprint, googleUrl: safeGoogleLink(event.htmlLink), checkedAt: new Date() } });
        } catch (error) {
          // A deleted Google ID cannot be reused. Persist a new generation before retrying.
          if (!(error instanceof CalendarError) || error.code !== 'CALENDAR_EVENT_NOT_FOUND') throw error;
          await db.calendarPayment.update({ where: { id: row.id }, data: { active: false, fingerprint: '', generation: { increment: 1 }, checkedAt: null } });
          retry = true;
        }
      });
    }
    for (const job of work) {
      if (Date.now() >= deadline || changed >= 15) break;
      // Disconnecting or losing the lease stops further writes, including scheduled jobs.
      if (!await db.calendarConnection.findFirst({ where: { userId, enabled: true, renewalLeaseToken: lease } })) break;
      await job(); changed++;
    }
    await db.calendarConnection.updateMany({ where: { userId, renewalLeaseToken: lease }, data: { renewalLastRunAt: new Date() } });
    return { changed, more: work.length > changed || retry, running: false };
  } finally {
    await db.calendarConnection.updateMany({ where: { userId, renewalLeaseToken: lease }, data: { renewalLeaseToken: null, renewalLeaseUntil: null } });
  }
}
