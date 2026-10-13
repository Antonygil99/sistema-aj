import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { hasRole } from '@/lib/access-policy';
import { storageStatus } from '@/integrations/r2/server';
import { documentSelect, scopeWhere } from '@/modules/documentos/folders';
import { DocumentLibrary, type DocumentOption } from './document-library';
export async function DocumentsPage({ clientId = null, folderId = null }: { clientId?: string | null; folderId?: string | null }) {
  const user = await requireUser();
  const db = getDb();
  const canUpload = hasRole(user.role, 'ADMIN');
  const storage = storageStatus();
  const client = clientId ? await db.client.findUnique({ where: { id: clientId }, select: { name: true } }) : null;
  if (clientId && !client) notFound();
  // A folder from the global search opens directly, but only within the library it belongs to.
  const folder = folderId ? await db.documentFolder.findUnique({ where: { id: folderId.slice(0, 100) }, select: { id: true, clientId: true } }) : null;
  const openFolder = folder && folder.clientId === clientId ? folder.id : null;
  const where = { folderId: openFolder, archivedAt: null, ...scopeWhere(clientId) };
  const active = { archivedAt: null };
  const [documents, total, folders, clients, policies, claims] = await Promise.all([
    db.document.findMany({ where, take: 20, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: documentSelect }),
    db.document.count({ where }),
    db.documentFolder.findMany({ where: { clientId }, orderBy: { name: 'asc' } }),
    db.client.findMany({ where: active, take: 100, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    canUpload ? db.policy.findMany({ where: active, take: 100, orderBy: { createdAt: 'desc' }, select: { id: true, number: true } }) : [],
    canUpload ? db.claim.findMany({ where: active, take: 100, orderBy: { createdAt: 'desc' }, select: { id: true, reference: true } }) : [],
  ]);
  const options: DocumentOption[] = [...clients.map(c => ({ id: c.id, label: c.name, kind: 'clientId' as const })), ...policies.map(p => ({ id: p.id, label: `Póliza · ${p.number}`, kind: 'policyId' as const })), ...claims.map(c => ({ id: c.id, label: `Siniestro · ${c.reference}`, kind: 'claimId' as const }))];
  return <DocumentLibrary key={`${clientId || 'team'}:${openFolder ?? ''}`} clientId={clientId} initialFolderId={openFolder} clientName={client?.name}
    initial={documents.map(d => ({ ...d, createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString() }))} initialTotal={total}
    initialFolders={folders.map(f => ({ id: f.id, name: f.name, parentId: f.parentId, clientId: f.clientId, updatedAt: f.updatedAt.toISOString() }))}
    options={options} canUpload={canUpload} canDelete={user.role === 'SUPERADMIN'} configured={storage.configured} configurationMessage={canUpload ? storage.message : undefined}/>;
}
