import 'server-only';
import { getDb } from '@/lib/db';
import { getR2 } from '@/integrations/r2/server';
import { documentFiles, type StoredDocument } from './file-operations';
export function getDocumentFiles(folderId?: string) {
  const db = getDb();
  const select = { id: true, name: true, storageKey: true, mimeType: true, clientId: true, policyId: true, claimId: true };
  const normalize = (row: { id: string; name: string; storageKey: string; mimeType: string; clientId: string | null; policyId: string | null; claimId: string | null }): StoredDocument => ({ ...row, clientId: row.clientId ?? undefined, policyId: row.policyId ?? undefined, claimId: row.claimId ?? undefined });
  return documentFiles({
    async relatedExists(field, id) {
      if (field === 'clientId') return !!await db.client.findUnique({ where: { id }, select: { id: true } });
      if (field === 'policyId') return !!await db.policy.findUnique({ where: { id }, select: { id: true } });
      return !!await db.claim.findUnique({ where: { id }, select: { id: true } });
    },
    async create(data) { return normalize(await db.document.create({ data: { ...data, folderId }, select })); },
    async find(id) { const row = await db.document.findUnique({ where: { id }, select }); return row ? normalize(row) : null; },
  }, getR2());
}
