import 'server-only';
import { getDb } from '@/lib/db';
import { auditPageSize, auditWhere, type AuditFilters } from './audit';
export async function auditHistory(filters: AuditFilters) {
  const db = getDb(), where = auditWhere(filters);
  const [total, data] = await db.$transaction([
    db.crmEvent.count({ where }),
    db.crmEvent.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (filters.page - 1) * auditPageSize, take: auditPageSize }),
  ], { isolationLevel: 'RepeatableRead' });
  return { total, data, page: filters.page, pageSize: auditPageSize };
}
