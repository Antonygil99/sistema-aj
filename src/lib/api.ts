import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { currentUser } from './session';
import { getAuth } from './auth';
import { hasRole, trustedMutation, type AccessRole } from './access-policy';
export async function authorize(request: Request, minimum: AccessRole = 'USER') {
  const token = process.env.AJ_API_TOKEN;
  const authorization = request.headers.get('authorization');
  if (authorization) {
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const expected = Buffer.from('Bearer ' + token);
    const actual = Buffer.from(authorization);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    if (minimum === 'SUPERADMIN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    return;
  }
  if (!getAuth()) return NextResponse.json({ error: 'AUTH_NOT_CONFIGURED' }, { status: 503 });
  if (!trustedMutation(request, process.env.BETTER_AUTH_URL!)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  try {
    const user = await currentUser(request.headers);
    if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    if (!hasRole(user.role, minimum)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  } catch { return NextResponse.json({ error: 'SERVICE_UNAVAILABLE' }, { status: 503 }); }
}
export function apiError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: 'INVALID_INPUT', issues: error.issues }, { status: 400 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  const code = (error as { code?: string })?.code;
  if (code === 'P2002') return NextResponse.json({ error: 'ALREADY_EXISTS' }, { status: 409 });
  if (code === 'P2003') return NextResponse.json({ error: 'RELATED_RECORD_NOT_FOUND' }, { status: 422 });
  return NextResponse.json({ error: 'SERVICE_UNAVAILABLE' }, { status: 503 });
}
