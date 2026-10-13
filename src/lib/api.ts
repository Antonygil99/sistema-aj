import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { currentUser } from './session';
import { getAuth } from './auth';
import { hasRole, normalizeEmail, trustedMutation, type AccessRole } from './access-policy';
// Who performed a request; the internal token acts as an integration, never as a person.
export type Actor = { id: string | null; name: string; email: string | null; role: AccessRole };
export async function authenticate(request: Request, minimum: AccessRole = 'USER'): Promise<{ denied: NextResponse; actor?: never } | { actor: Actor; denied?: never }> {
  const token = process.env.AJ_API_TOKEN;
  const authorization = request.headers.get('authorization');
  if (authorization) {
    if (!token) return { denied: NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }) };
    const expected = Buffer.from('Bearer ' + token);
    const actual = Buffer.from(authorization);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return { denied: NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }) };
    if (minimum === 'SUPERADMIN') return { denied: NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }) };
    return { actor: { id: null, name: 'Integración interna', email: null, role: 'ADMIN' } };
  }
  if (!getAuth()) return { denied: NextResponse.json({ error: 'AUTH_NOT_CONFIGURED' }, { status: 503 }) };
  if (!trustedMutation(request, process.env.BETTER_AUTH_URL!)) return { denied: NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 }) };
  try {
    const user = await currentUser(request.headers);
    if (!user) return { denied: NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }) };
    if (!hasRole(user.role, minimum)) return { denied: NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }) };
    return { actor: { id: user.id, name: user.name, email: normalizeEmail(user.email), role: user.role } };
  } catch { return { denied: NextResponse.json({ error: 'SERVICE_UNAVAILABLE' }, { status: 503 }) }; }
}
export async function authorize(request: Request, minimum: AccessRole = 'USER') {
  return (await authenticate(request, minimum)).denied;
}
export function apiError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: 'INVALID_INPUT', issues: error.issues }, { status: 400 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  const status = (error as { status?: unknown })?.status;
  const errorCode = (error as { code?: unknown })?.code;
  // Domain errors (ContactError, ResourceError, FileError) carry a public code and HTTP status.
  if (typeof errorCode === 'string' && /^[A-Z_]+$/.test(errorCode) && typeof status === 'number') return NextResponse.json({ error: errorCode }, { status });
  if (errorCode === 'P2002') return NextResponse.json({ error: 'ALREADY_EXISTS' }, { status: 409 });
  if (errorCode === 'P2003') return NextResponse.json({ error: 'RELATED_RECORD_NOT_FOUND' }, { status: 422 });
  return NextResponse.json({ error: 'SERVICE_UNAVAILABLE' }, { status: 503 });
}
