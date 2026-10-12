import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { hasRole } from '@/lib/access-policy';
import { r2Ready } from '@/integrations/r2/server';
import { DocumentLibrary, type DocumentOption } from './document-library';

export async function DocumentsPage() {
  const user = await requireUser();
  const db = getDb();
  const canUpload = hasRole(user.role, 'ADMIN');
  const [documents, total, clients, policies, claims] = await Promise.all([
    db.document.findMany({ take: 20, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, name: true, mimeType: true, createdAt: true, client: { select: { name: true } }, policy: { select: { number: true } }, claim: { select: { reference: true } } } }),
    db.document.count(),
    canUpload ? db.client.findMany({ take: 100, orderBy: { createdAt: 'desc' }, select: { id: true, name: true } }) : [],
    canUpload ? db.policy.findMany({ take: 100, orderBy: { createdAt: 'desc' }, select: { id: true, number: true } }) : [],
    canUpload ? db.claim.findMany({ take: 100, orderBy: { createdAt: 'desc' }, select: { id: true, reference: true } }) : [],
  ]);
  const options: DocumentOption[] = [...clients.map(row => ({ id: row.id, label: `Cliente · ${row.name}`, kind: 'clientId' as const })), ...policies.map(row => ({ id: row.id, label: `Póliza · ${row.number}`, kind: 'policyId' as const })), ...claims.map(row => ({ id: row.id, label: `Siniestro · ${row.reference}`, kind: 'claimId' as const }))];
  return <DocumentLibrary initial={documents.map(row => ({ ...row, createdAt: row.createdAt.toISOString() }))} initialTotal={total} options={options} canUpload={canUpload} configured={r2Ready()}/>;
}
