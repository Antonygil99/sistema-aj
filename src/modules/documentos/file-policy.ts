import { z } from 'zod';

export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 64 * 1024;
export const FILE_TYPES = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'audio/mpeg': ['mp3'],
  'audio/ogg': ['ogg'],
  'audio/wav': ['wav'],
  'video/mp4': ['mp4'],
} as const;
export type FileMime = keyof typeof FILE_TYPES;
export class FileError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}
export const attachmentSchema = z.object({
  clientId: z.string().min(1).max(100).optional(),
  policyId: z.string().min(1).max(100).optional(),
  claimId: z.string().min(1).max(100).optional(),
}).strict().refine(value => Object.values(value).filter(Boolean).length <= 1, { message: 'Elegir un único expediente o archivo general.' });
export type Attachment = z.infer<typeof attachmentSchema>;

export function validateFile(name: string, type: string, body: Uint8Array) {
  if (!body.byteLength || body.byteLength > MAX_FILE_BYTES) throw new FileError('FILE_SIZE_INVALID', 413);
  // Strip path/control characters and keep a readable, bounded original filename.
  const cleanName = name.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!cleanName || cleanName.length > 180) throw new FileError('FILE_NAME_INVALID', 400);
  if (!Object.hasOwn(FILE_TYPES, type)) throw new FileError('FILE_TYPE_INVALID', 415);
  const mime = type as FileMime;
  const extension = cleanName.split('.').pop()!.toLowerCase();
  if (!(FILE_TYPES[mime] as readonly string[]).includes(extension)) throw new FileError('FILE_TYPE_INVALID', 415);
  const starts = (...bytes: number[]) => bytes.every((value, index) => body[index] === value);
  const ascii = (start: number, end: number) => Buffer.from(body.subarray(start, end)).toString('ascii');
  const valid = {
    'application/pdf': ascii(0, 5) === '%PDF-',
    'image/jpeg': starts(0xff, 0xd8, 0xff),
    'image/png': starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    'image/webp': ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP',
    'audio/mpeg': ascii(0, 3) === 'ID3' || (body[0] === 0xff && (body[1] & 0xe0) === 0xe0),
    'audio/ogg': ascii(0, 4) === 'OggS',
    'audio/wav': ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE',
    'video/mp4': ascii(4, 8) === 'ftyp',
  }[mime];
  if (!valid) throw new FileError('FILE_CONTENT_INVALID', 415);
  return { name: cleanName, mimeType: mime, extension };
}

export function isManagedKey(key: string) {
  return /^aj\/documents\/[a-f0-9-]{36}\.(pdf|jpe?g|png|webp|mp3|ogg|wav|mp4)$/.test(key);
}
export const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export function isProductImageKey(key: string) {
  return /^aj\/products\/[a-f0-9-]{36}\.(jpe?g|png|webp)$/.test(key);
}

export async function boundedFormData(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new FileError('MULTIPART_REQUIRED', 415);
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_REQUEST_BYTES) throw new FileError('FILE_SIZE_INVALID', 413);
  if (!request.body) throw new FileError('FILE_REQUIRED', 400);
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) { await reader.cancel(); throw new FileError('FILE_SIZE_INVALID', 413); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    return await new Response(Buffer.concat(parts), { headers: { 'content-type': request.headers.get('content-type')! } }).formData();
  } catch { throw new FileError('MULTIPART_INVALID', 400); }
}
