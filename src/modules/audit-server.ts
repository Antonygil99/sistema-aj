import 'server-only';
import {smartSearchWhere} from './smart-search-server';
import { getDb } from '@/lib/db';
import { auditPageSize, auditWhere, type AuditFilters } from './audit';
import { logCutoff } from './log-retention';
export async function auditHistory(filters: AuditFilters) {
  const db = getDb(), where = { AND: [auditWhere({...filters,q:''}),await smartSearchWhere('auditoria',filters.q), { createdAt: { gte: logCutoff() },module:{notIn:['whatsapp']} }] };
  const [total, data] = await db.$transaction([
    db.crmEvent.count({ where }),
    db.crmEvent.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (filters.page - 1) * auditPageSize, take: auditPageSize }),
  ], { isolationLevel: 'RepeatableRead' });
  return { total, data, page: filters.page, pageSize: auditPageSize };
}
