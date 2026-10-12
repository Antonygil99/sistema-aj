import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorize, apiError } from '@/lib/api';
import { getDocumentFiles } from '@/modules/documentos/files';
import { FileError } from '@/modules/documentos/file-policy';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await authorize(request); if (denied) return denied;
  try {
    const id = z.string().min(1).max(100).parse((await context.params).id);
    const url = await getDocumentFiles().download(id);
    return new NextResponse(null, { status: 303, headers: { Location: url, 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) {
    if (error instanceof FileError) return NextResponse.json({ error: error.code }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
    return apiError(error);
  }
}
