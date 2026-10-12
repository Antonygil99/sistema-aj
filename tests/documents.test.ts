import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentFiles, type DocumentRepository, type FileStorage, type StoredDocument } from '../src/modules/documentos/file-operations';
import { boundedFormData, FileError, MAX_FILE_BYTES, MAX_REQUEST_BYTES, validateFile } from '../src/modules/documentos/file-policy';
import { createR2, r2Configuration } from '../src/integrations/r2/client';

const pdf = Buffer.from('%PDF-1.7\nTest document\n%%EOF');
function fixture() {
  const objects = new Map<string, Uint8Array>();
  const rows = new Map<string, StoredDocument>();
  const storage: FileStorage = {
    async put(key, body) { assert.equal(objects.has(key), false); objects.set(key, body); },
    async remove(key) { objects.delete(key); },
    async exists(key) { return objects.has(key); },
    async downloadUrl(key) { return 'https://download.example.invalid/' + key; },
  };
  const repository: DocumentRepository = {
    async relatedExists(_field, id) { return id === 'existing'; },
    async create(data) { const row = { ...data, id: 'record-' + rows.size }; rows.set(row.id, row); return row; },
    async find(id) { return rows.get(id) ?? null; },
  };
  return { objects, rows, storage, repository, operations: documentFiles(repository, storage) };
}
test('rechaza archivos vacíos, excesivos, ejecutables y formatos falsificados', () => {
  assert.throws(() => validateFile('a.pdf', 'application/pdf', Buffer.alloc(0)), { code: 'FILE_SIZE_INVALID' });
  assert.throws(() => validateFile('a.pdf', 'application/pdf', Buffer.alloc(MAX_FILE_BYTES + 1)), { code: 'FILE_SIZE_INVALID' });
  assert.throws(() => validateFile('a.exe', 'application/pdf', pdf), { code: 'FILE_TYPE_INVALID' });
  assert.throws(() => validateFile('a.pdf', 'application/pdf', Buffer.from('<html>')), { code: 'FILE_CONTENT_INVALID' });
  assert.equal(validateFile('../../póliza.pdf', 'application/pdf', pdf).name, 'póliza.pdf');
});
test('no escribe en R2 si el expediente no existe o hay más de un enlace', async () => {
  const f = fixture();
  await assert.rejects(f.operations.upload({ name: 'a.pdf', mimeType: 'application/pdf', body: pdf, attachment: { clientId: 'missing' } }), { code: 'RELATED_RECORD_NOT_FOUND' });
  await assert.rejects(f.operations.upload({ name: 'a.pdf', mimeType: 'application/pdf', body: pdf, attachment: { clientId: 'existing', policyId: 'existing' } }));
  assert.equal(f.objects.size, 0);
});
test('carga y descarga usan claves propias únicas, sin sobrescribir archivos del mismo nombre', async () => {
  const f = fixture();
  const input = { name: 'póliza.pdf', mimeType: 'application/pdf', body: pdf, attachment: { clientId: 'existing' } };
  const first = await f.operations.upload(input);
  const second = await f.operations.upload(input);
  assert.notEqual(first.storageKey, second.storageKey);
  assert.equal(f.rows.size, 2);
  assert.match(await f.operations.download(first.id), /aj\/documents\//);
  f.objects.delete(first.storageKey);
  await assert.rejects(f.operations.download(first.id), { code: 'FILE_NOT_FOUND' });
});
test('si falla PostgreSQL elimina solo el objeto recién subido', async () => {
  const f = fixture();
  f.objects.set('existing-file', pdf);
  f.repository.create = async () => { throw new Error('DB failed'); };
  await assert.rejects(f.operations.upload({ name: 'a.pdf', mimeType: 'application/pdf', body: pdf, attachment: {} }), /DB failed/);
  assert.deepEqual([...f.objects.keys()], ['existing-file']);
});
test('no entrega enlaces para referencias heredadas arbitrarias', async () => {
  const f = fixture();
  f.rows.set('legacy', { id: 'legacy', name: 'secret.pdf', mimeType: 'application/pdf', storageKey: 'another-service/secret.pdf' });
  await assert.rejects(f.operations.download('legacy'), { code: 'DOCUMENT_NOT_FOUND' });
});
test('el límite del cuerpo se impone incluso sin Content-Length', async () => {
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(MAX_REQUEST_BYTES + 1)); controller.close(); } });
  const request = new Request('https://app.example.invalid/api/documents', { method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=abc' }, body, duplex: 'half' } as RequestInit);
  await assert.rejects(boundedFormData(request), (error: unknown) => error instanceof FileError && error.status === 413);
  const form = new FormData(); form.set('file', new File([pdf], 'a.pdf', { type: 'application/pdf' }));
  const parsed = await boundedFormData(new Request('https://app.example.invalid/api/documents', { method: 'POST', body: form }));
  assert.equal((parsed.get('file') as File).name, 'a.pdf');
});
const env = { R2_ENDPOINT: 'https://' + 'a'.repeat(32) + '.r2.cloudflarestorage.com', R2_BUCKET_NAME: 'test-bucket', R2_ACCESS_KEY_ID: 'test-access-key', R2_SECRET_ACCESS_KEY: 'test-secret-not-real' };
test('R2 rechaza endpoints ajenos y la firma caduca en 60 segundos con descarga forzada', async () => {
  assert.throws(() => r2Configuration({ ...env, R2_ENDPOINT: 'https://attacker.example.invalid' }), /R2_ENDPOINT_INVALID/);
  assert.throws(() => r2Configuration({ ...env, R2_ENDPOINT: env.R2_ENDPOINT + '/bucket' }), /R2_ENDPOINT_INVALID/);
  const storage = createR2(env);
  try {
    const url = new URL(await storage.downloadUrl('aj/documents/test.pdf', 'Póliza.pdf'));
    assert.equal(url.searchParams.get('X-Amz-Expires'), '60');
    assert.match(url.searchParams.get('response-content-disposition')!, /^attachment;/);
    assert.equal(url.href.includes(env.R2_SECRET_ACCESS_KEY), false);
  } finally { storage.client.destroy(); }
});
