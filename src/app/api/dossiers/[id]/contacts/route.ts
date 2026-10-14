import { NextResponse } from 'next/server';
import { authenticate, apiError } from '@/lib/api';
import { contactInput } from '@/modules/email/schema';
import { listContacts, saveContact } from '@/modules/email/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
// People besides the client who may receive emails about it (HR of a company, a relative).
export async function GET(request: Request, { params }: Context) {
  const auth = await authenticate(request); if (auth.denied) return auth.denied;
  try { return NextResponse.json({ data: await listContacts((await params).id) }, { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return apiError(error); }
}
export async function POST(request: Request, { params }: Context) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try { return NextResponse.json({ data: await saveContact(auth.actor, (await params).id, contactInput.parse(await request.json())) }, { status: 201 }); }
  catch (error) { return apiError(error); }
}
