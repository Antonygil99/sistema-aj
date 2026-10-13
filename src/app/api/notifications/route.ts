import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, apiError } from '@/lib/api';
import { getDb } from '@/lib/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Polled by the workspace every ~20 s while the tab is visible. Without `since` it only returns a cursor.
export async function GET(request: Request) {
  const auth = await authenticate(request); if (auth.denied) return auth.denied;
  try {
    const sinceParam = new URL(request.url).searchParams.get('since');
    const since = sinceParam ? new Date(z.iso.datetime({ offset: true }).parse(sinceParam)) : null;
    const db = getDb(), now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const week = new Date(today.getTime() + 7 * 86400000);
    const [events, recent, overdue, renewals] = await Promise.all([
      since ? db.crmEvent.findMany({ where: { createdAt: { gt: since, lte: now }, ...(auth.actor.id ? { NOT: { actorId: auth.actor.id } } : {}) }, orderBy: { createdAt: 'asc' }, take: 20 }) : [],
      db.crmEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 15 }),
      db.payment.count({ where: { archivedAt: null, status: { not: 'PAID' }, dueDate: { lt: today } } }),
      db.renewal.count({ where: { archivedAt: null, status: { in: ['PENDING', 'CONTACTED'] }, dueDate: { gte: today, lte: week } } }),
    ]);
    const serialize = (rows: typeof recent) => rows.map(row => ({ id: row.id, action: row.action, module: row.module, recordId: row.recordId, label: row.label, actorName: row.actorName, createdAt: row.createdAt.toISOString(), own: Boolean(auth.actor.id && row.actorId === auth.actor.id) }));
    return NextResponse.json({ cursor: now.toISOString(), events: serialize(events), recent: serialize(recent), reminders: { overduePayments: overdue, renewalsThisWeek: renewals } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
