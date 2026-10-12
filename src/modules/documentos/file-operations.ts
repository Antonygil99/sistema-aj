import { randomUUID } from 'node:crypto';
import { attachmentSchema, FileError, isManagedKey, validateFile, type Attachment } from './file-policy';

export type StoredDocument = Attachment & { id: string; name: string; storageKey: string; mimeType: string };
export interface DocumentRepository {
  relatedExists(field: keyof Attachment, id: string): Promise<boolean>;
  create(data: Attachment & { name: string; storageKey: string; mimeType: string }): Promise<StoredDocument>;
  find(id: string): Promise<StoredDocument | null>;
}
export interface FileStorage {
  put(key: string, body: Uint8Array, mimeType: string): Promise<void>;
  remove(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  downloadUrl(key: string, name: string): Promise<string>;
}
export function documentFiles(repository: DocumentRepository, storage: FileStorage) {
  return {
    async upload(input: { name: string; mimeType: string; body: Uint8Array; attachment: unknown }) {
      const attachment = attachmentSchema.parse(input.attachment);
      const file = validateFile(input.name, input.mimeType, input.body);
      for (const [field, id] of Object.entries(attachment)) {
        if (id && !await repository.relatedExists(field as keyof Attachment, id)) throw new FileError('RELATED_RECORD_NOT_FOUND', 422);
      }
      const storageKey = `aj/documents/${randomUUID()}.${file.extension}`;
      await storage.put(storageKey, input.body, file.mimeType);
      try {
        return await repository.create({ ...attachment, name: file.name, mimeType: file.mimeType, storageKey });
      } catch (error) {
        // Only this request's new object can be removed; existing files are never touched.
        await storage.remove(storageKey).catch(() => console.error('R2_ORPHAN_CLEANUP_REQUIRED'));
        throw error;
      }
    },
    async download(id: string) {
      const document = await repository.find(id);
      if (!document || !isManagedKey(document.storageKey)) throw new FileError('DOCUMENT_NOT_FOUND', 404);
      if (!await storage.exists(document.storageKey)) throw new FileError('FILE_NOT_FOUND', 404);
      return storage.downloadUrl(document.storageKey, document.name);
    },
  };
}
