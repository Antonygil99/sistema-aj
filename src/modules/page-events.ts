import 'server-only';
import { after } from 'next/server';
import { headers } from 'next/headers';
import type { Actor } from '@/lib/api';
import { recordEvent } from './events';

// Prefetching a link is not a consultation. Record completed page requests after rendering.
export async function recordPageView(actor: Actor, module: string, recordId: string, label: string) {
  const requestHeaders = await headers();
  if (requestHeaders.has('next-router-prefetch') || requestHeaders.get('purpose') === 'prefetch' || requestHeaders.get('sec-purpose')?.includes('prefetch')) return;
  after(() => recordEvent(actor, 'viewed', module, recordId, label));
}
