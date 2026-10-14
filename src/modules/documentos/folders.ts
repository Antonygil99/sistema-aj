import { z } from 'zod';
import { getDb } from '@/lib/db';
import { FileError } from './file-policy';
import { folderColorIds } from './folder-view';
export const folderName = z.string().trim().min(1).max(100).refine(n => !/[\\/\u0000-\u001f\u007f]/.test(n) && n !== '.' && n !== '..', 'Nombre de carpeta inválido');
export const folderInput = z.object({ name: folderName, parentId: z.string().min(1).max(100).nullable().default(null), clientId: z.string().min(1).max(100).nullable().default(null) }).strict();
// Rename and/or recolor; null color goes back to the library's alternating tone.
export const folderPatch = z.object({ name: folderName.optional(), color: z.enum(folderColorIds).nullable().optional(), expectedUpdatedAt: z.iso.datetime() }).strict().refine(value => value.name !== undefined || value.color !== undefined, 'Indica el nombre o el color de la carpeta.');
// What the library needs of a folder (never more): archived folders are listed apart.
export const folderSelect = { id: true, name: true, parentId: true, clientId: true, color: true, updatedAt: true } as const;
export async function folderScope(folderId: string | null, clientId: string | null) {
  if (folderId) { const folder = await getDb().documentFolder.findUnique({ where: { id: folderId } }); if (!folder || folder.clientId !== clientId) throw new FileError('FOLDER_NOT_FOUND',404); return folder; }
  if (clientId && !await getDb().client.findUnique({ where: { id: clientId }, select: { id: true } })) throw new FileError('RELATED_RECORD_NOT_FOUND',404);
  return null;
}
export const documentSelect = { id: true, name: true, mimeType: true, folderId: true, createdAt: true, updatedAt: true, client: { select: { name: true } }, policy: { select: { number: true } }, claim: { select: { reference: true } } } as const;
export function scopeWhere(clientId: string | null) {
  return clientId ? { OR: [{ clientId }, { policy: { clientId } }, { claim: { policy: { clientId } } }] } : {};
}
