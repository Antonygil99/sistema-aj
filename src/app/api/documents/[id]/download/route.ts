import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, apiError } from '@/lib/api';
import { getDb } from '@/lib/db';
import { recordEvent } from '@/modules/events';
import { getDocumentFiles } from '@/modules/documentos/files';
import { FileError } from '@/modules/documentos/file-policy';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request); if (auth.denied) return auth.denied;
  try {
    const id = z.string().min(1).max(100).parse((await context.params).id);
    const url = await getDocumentFiles().download(id);
    const document = await getDb().document.findUnique({ where: { id }, select: { name: true } });
    await recordEvent(auth.actor, 'downloaded', 'documentos', id, document?.name ?? 'Archivo');
    return new NextResponse(null, { status: 303, headers: { Location: url, 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) {
    if (error instanceof FileError) return NextResponse.json({ error: error.code }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
    return apiError(error);
  }
}
