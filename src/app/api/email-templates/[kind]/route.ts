import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, apiError } from '@/lib/api';
import { resetTemplate, saveTemplate } from '@/modules/email/notices-server';
import { templateInput } from '@/modules/email/schema';
import { templateKinds } from '@/modules/email/template-text';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ kind: string }> };
const kindOf = async (context: Context) => z.enum(templateKinds).parse((await context.params).kind);
// Saves the team's text for one kind of client email; DELETE goes back to the suggested text.
export async function PUT(request: Request, context: Context) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try { await saveTemplate(auth.actor, await kindOf(context), templateInput.parse(await request.json())); return NextResponse.json({ ok: true }); }
  catch (error) { return apiError(error); }
}
export async function DELETE(request: Request, context: Context) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try { await resetTemplate(auth.actor, await kindOf(context)); return NextResponse.json({ ok: true }); }
  catch (error) { return apiError(error); }
}
