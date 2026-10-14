import { NextResponse } from 'next/server';
import { authenticate, apiError } from '@/lib/api';
import { contactInput } from '@/modules/email/schema';
import { deleteContact, saveContact } from '@/modules/email/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string; contactId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try { const { id, contactId } = await params; return NextResponse.json({ data: await saveContact(auth.actor, id, contactInput.parse(await request.json()), contactId) }); }
  catch (error) { return apiError(error); }
}
export async function DELETE(request: Request, { params }: Context) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try { const { id, contactId } = await params; await deleteContact(auth.actor, id, contactId); return NextResponse.json({ ok: true }); }
  catch (error) { return apiError(error); }
}
