import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, apiError } from '@/lib/api';
import { writeTools } from '@/agents/catalog';
import { executeAction } from '@/agents/tools';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Runs a proposal the superadmin confirmed in the chat. The input is validated again.
export async function POST(request: Request) {
  const auth = await authenticate(request, 'SUPERADMIN'); if (auth.denied) return auth.denied;
  try {
    const { tool, input } = z.object({ tool: z.enum(writeTools as [string, ...string[]]), input: z.unknown() }).strict().parse(await request.json());
    const result = await executeAction(tool, input, { actor: auth.actor, userId: auth.actor.id, email: auth.actor.email, now: new Date() });
    return NextResponse.json({ data: result });
  } catch (error) { return apiError(error); }
}
