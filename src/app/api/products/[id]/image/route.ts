import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, apiError } from '@/lib/api';
import {preserveCompanyImage,productImageSource} from '@/modules/aseguradoras/server';
import { getDb } from '@/lib/db';
import { getR2 } from '@/integrations/r2/server';
import { boundedFormData, FileError, IMAGE_TYPES, isProductImageKey, validateFile } from '@/modules/documentos/file-policy';
import { recordEvent } from '@/modules/events';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
const noStore = { 'Cache-Control': 'no-store' };
const productId = z.string().min(1).max(100);
function failure(error: unknown) {
  if (error instanceof FileError) return NextResponse.json({ error: error.code }, { status: error.status, headers: noStore });
  return apiError(error);
}
// Shows the image through a 60-second signed URL; the bucket stays private.
export async function GET(request: Request, { params }: Context) {
  const auth = await authenticate(request); if (auth.denied) return auth.denied;
  try {
    const product = await productImageSource(getDb(),productId.parse((await params).id));
    if (!product) return NextResponse.json({ error: 'FILE_NOT_FOUND' }, { status: 404, headers: noStore });
    const url = await getR2().downloadUrl(product.key, product.name);
    return new NextResponse(null, { status: 303, headers: { Location: url, 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) { return failure(error); }
}
// Replaces the product image: new object first, then the row, then the previous object.
export async function POST(request: Request, { params }: Context) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try {
    const id = productId.parse((await params).id);
    const db = getDb();
    const product = await db.product.findUnique({ where: { id }, select: { id: true, name: true, imageKey: true,insurerId:true } });
    if (!product) return NextResponse.json({ error: 'RECORD_NOT_FOUND' }, { status: 404, headers: noStore });
    const form = await boundedFormData(request);
    const file = form.get('file');
    if ([...form.keys()].some(key => key !== 'file') || !(file instanceof File)) throw new FileError('FILE_REQUIRED', 400);
    if (!IMAGE_TYPES.has(file.type)) throw new FileError('FILE_TYPE_INVALID', 415);
    const body = new Uint8Array(await file.arrayBuffer());
    const checked = validateFile(file.name, file.type, body);
    await preserveCompanyImage(db,product.insurerId);
    const key = `aj/products/${randomUUID()}.${checked.extension}`;
    const storage = getR2();
    await storage.put(key, body, checked.mimeType);
    try { await db.product.update({ where: { id }, data: { imageKey: key, imageType: checked.mimeType } }); }
    catch (error) { await storage.remove(key).catch(() => console.error('R2_ORPHAN_CLEANUP_REQUIRED')); throw error; }
    if (product.imageKey && isProductImageKey(product.imageKey)) await storage.remove(product.imageKey).catch(() => console.error('R2_ORPHAN_CLEANUP_REQUIRED'));
    await recordEvent(auth.actor, 'updated', 'productos', id, product.name);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) { return failure(error); }
}
// Removing an override returns this product to its insurer image; the company object is never deleted.
export async function DELETE(request: Request, { params }: Context) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try {
    const id = productId.parse((await params).id);
    const db = getDb();
    const product = await db.product.findUnique({ where: { id }, select: { name: true, imageKey: true,insurerId:true } });
    if (!product) return NextResponse.json({ error: 'RECORD_NOT_FOUND' }, { status: 404, headers: noStore });
    if(product.imageKey)await preserveCompanyImage(db,product.insurerId);
    await db.product.update({ where: { id }, data: { imageKey: null, imageType: null } });
    if (product.imageKey && isProductImageKey(product.imageKey)) await getR2().remove(product.imageKey).catch(() => console.error('R2_ORPHAN_CLEANUP_REQUIRED'));
    await recordEvent(auth.actor, 'updated', 'productos', id, product.name);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) { return failure(error); }
}
