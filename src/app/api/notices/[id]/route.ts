import { NextResponse } from 'next/server';
import { authenticate, apiError } from '@/lib/api';
import { noticeAction } from '@/modules/email/schema';
import { resolveNotice } from '@/modules/email/notices-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Records that the client was reached another way (phone, WhatsApp…), dismisses the notice or reopens it (undo).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try { await resolveNotice(auth.actor, (await params).id, noticeAction.parse(await request.json())); return NextResponse.json({ ok: true }); }
  catch (error) { return apiError(error); }
}
