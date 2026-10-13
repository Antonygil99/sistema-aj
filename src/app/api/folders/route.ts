import { NextResponse } from 'next/server';
import { authenticate, apiError } from '@/lib/api';
import { getDb } from '@/lib/db';
import { folderInput, folderScope } from '@/modules/documentos/folders';
import { recordEvent } from '@/modules/events';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try {
    const input = folderInput.parse(await request.json());
    await folderScope(input.parentId, input.clientId);
    const data = await getDb().documentFolder.create({ data: input });
    await recordEvent(auth.actor, 'created', 'carpetas', data.id, data.name);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return apiError(error); }
}
