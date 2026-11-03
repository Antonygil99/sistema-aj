import 'server-only';
import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import { CalendarError } from './schema';
import { safeGoogleLink } from './google';
import { renewalEvent, renewalEventId, renewalFingerprint } from './renewal-event';
import { mexicoDay } from '@/modules/email/notices';

// Only server-resolved users can enter here. No request can choose another broker's ID.
const renewalCredentials = async (userId: string, headers?: Headers) => (await import('./server')).calendarCredentials(userId, headers);
export async function syncCalendarRenewals(userId: string, headers?: Headers, deadline = Date.now() + 35000, credentials = renewalCredentials) {
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
    const today = mexicoDay(new Date());
    const policies = await db.policy.findMany({ where: {
      ownerEmail: { equals: user!.email, mode: 'insensitive' }, archivedAt: null, status: 'ACTIVE', client: { archivedAt: null },
      nextPolicy: null, renewalPreparation: { isNot: { status: { in: ['RENEWED', 'NOT_RENEWED'] } } },
    }, select: { id: true, number: true, clientId: true, endDate: true, client: { select: { name: true } } }, orderBy: { endDate: 'asc' } });
    const existing = await db.calendarRenewal.findMany({ where: { userId } });
    const byPolicy = new Map(existing.map(row => [row.policyId, row]));
    const valid = new Set(policies.map(policy => policy.id));
    const work: Array<() => Promise<void>> = [];
    // Remove only managed events whose policy was archived, renewed, cancelled or reassigned.
    for (const row of existing.filter(row => row.active && !valid.has(row.policyId))) work.push(async () => {
      await google.cancelRenewal(renewalEventId(userId, row.policyId, row.generation));
      await db.calendarRenewal.update({ where: { id: row.id }, data: { active: false, fingerprint: '', generation: { increment: 1 }, googleUrl: null, checkedAt: new Date() } });
    });
    // Uncreated/changed entries first; then oldest checks. Large portfolios cannot starve behind yesterday's first batch.
    policies.sort((a, b) => (byPolicy.get(a.id)?.checkedAt?.getTime() ?? 0) - (byPolicy.get(b.id)?.checkedAt?.getTime() ?? 0));
    for (const policy of policies) {
      if (policy.endDate.toISOString().slice(0, 10) < today) continue; // Keep historical events, do not backfill past renewals.
      const body = renewalEvent(policy, base);
      const fingerprint = renewalFingerprint(body);
      const old = byPolicy.get(policy.id);
      if (old?.active && old.fingerprint === fingerprint && old.checkedAt && Date.now() - old.checkedAt.getTime() < 86400000) continue;
      work.push(async () => {
        const row = await db.calendarRenewal.upsert({ where: { userId_policyId: { userId, policyId: policy.id } }, create: { id: renewalEventId(userId, policy.id, 0), userId, policyId: policy.id, active: true }, update: { active: true } });
        const id = renewalEventId(userId, policy.id, row.generation);
        try {
          const event = await google.syncRenewal(id, body);
          await db.calendarRenewal.update({ where: { id: row.id }, data: { active: true, fingerprint, googleUrl: safeGoogleLink(event.htmlLink), checkedAt: new Date() } });
        } catch (error) {
          // A deleted Google ID cannot be reused. Persist a new generation before retrying.
          if (!(error instanceof CalendarError) || error.code !== 'CALENDAR_EVENT_NOT_FOUND') throw error;
          await db.calendarRenewal.update({ where: { id: row.id }, data: { active: false, fingerprint: '', generation: { increment: 1 }, checkedAt: null } });
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
