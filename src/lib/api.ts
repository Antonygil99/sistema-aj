import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
export function authorize(request: Request) {
  const token = process.env.AJ_API_TOKEN;
  if (!token) return NextResponse.json({ error: 'API_NOT_CONFIGURED' }, { status: 503 });
  const expected = Buffer.from('Bearer ' + token);
  const actual = Buffer.from(request.headers.get('authorization') ?? '');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
}
export function apiError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: 'INVALID_INPUT', issues: error.issues }, { status: 400 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  const code = (error as { code?: string })?.code;
  if (code === 'P2002') return NextResponse.json({ error: 'ALREADY_EXISTS' }, { status: 409 });
  if (code === 'P2003') return NextResponse.json({ error: 'RELATED_RECORD_NOT_FOUND' }, { status: 422 });
  return NextResponse.json({ error: 'SERVICE_UNAVAILABLE' }, { status: 503 });
}
