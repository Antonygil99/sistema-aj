import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { FileStorage } from '../../modules/documentos/file-operations';

export function r2Configuration(env: Record<string, string | undefined>) {
  const endpoint = env.R2_ENDPOINT?.trim();
  const bucket = env.R2_BUCKET_NAME?.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) throw new Error('R2_NOT_CONFIGURED');
  let url: URL;
  try { url = new URL(endpoint); } catch { throw new Error('R2_ENDPOINT_INVALID'); }
  // Cloudflare's bucket screen may include /<bucket>. The SDK expects the account origin.
  const path = url.pathname.replace(/\/$/, '');
  if (url.protocol !== 'https:' || !/^[a-f0-9]{32}(?:\.(?:eu|fedramp))?\.r2\.cloudflarestorage\.com$/.test(url.hostname) || url.username || url.password || url.search || url.hash || url.port || (path && path !== '/' + bucket)) throw new Error('R2_ENDPOINT_INVALID');
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error('R2_BUCKET_INVALID');
  return { endpoint: url.origin, bucket, credentials: { accessKeyId, secretAccessKey } };
}
export function r2Status(env: Record<string, string | undefined>) {
  try { r2Configuration(env); return { configured: true, message: '' }; }
  catch (error) {
    const code = error instanceof Error ? error.message : '';
    const messages: Record<string, string> = {
      R2_NOT_CONFIGURED: 'Falta al menos una variable de almacenamiento en este entorno. Un administrador debe revisar la configuración.',
      R2_ENDPOINT_INVALID: 'La dirección de conexión de R2 no tiene el formato esperado. Revisa R2_ENDPOINT en Vercel: debe ser el endpoint S3 de Cloudflare, no una dirección pública.',
      R2_BUCKET_INVALID: 'El nombre del depósito no tiene el formato esperado. Revisa R2_BUCKET_NAME en Vercel: debe contener únicamente el nombre del bucket.',
    };
    return { configured: false, message: messages[code] ?? 'La configuración del almacenamiento no es válida. Un administrador debe revisarla.' };
  }
}
export function createR2(env: Record<string, string | undefined>): FileStorage & { client: S3Client; bucket: string } {
  const { endpoint, bucket, credentials } = r2Configuration(env);
  const client = new S3Client({ region: 'auto', endpoint, credentials, forcePathStyle: true, maxAttempts: 2, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
  const sendOptions = () => ({ abortSignal: AbortSignal.timeout(20000) });
  return {
    client, bucket,
    async put(key, body, mimeType) { await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: mimeType, ContentDisposition: 'attachment' }), sendOptions()); },
    async remove(key) { await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), sendOptions()); },
    async exists(key) {
      try { await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }), sendOptions()); return true; }
      catch (error) {
        if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return false;
        throw error;
      }
    },
    async downloadUrl(key, name) {
      const fallback = name.replace(/[^a-zA-Z0-9._-]/g, '_');
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentDisposition: `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, character => '%' + character.charCodeAt(0).toString(16).toUpperCase())}` }), { expiresIn: 60 });
    },
  };
}
