import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, apiError } from '@/lib/api';
import { composeInput } from '@/modules/email/schema';
import { emailHistory, sendClientEmail } from '@/modules/email/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const noStore = { 'Cache-Control': 'private, no-store' };
// Emails written to one client (its dossier history).
export async function GET(request: Request) {
  const auth = await authenticate(request); if (auth.denied) return auth.denied;
  try {
    const clientId = z.string().min(1).max(100).parse(new URL(request.url).searchParams.get('clientId'));
    return NextResponse.json({ data: await emailHistory(clientId) }, { headers: noStore });
  } catch (error) { return apiError(error); }
}
// Sends a reviewed email (documents or welcome) to the client and/or its contacts. requestId makes it send once.
export async function POST(request: Request) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try {
    const message = await sendClientEmail(auth.actor, composeInput.parse(await request.json()));
    return NextResponse.json({ data: { id: message.id, status: message.status, to: message.to, subject: message.subject } }, { status: 201, headers: noStore });
  } catch (error) { return apiError(error); }
}
