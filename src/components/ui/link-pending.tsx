'use client';
import { useLinkStatus } from 'next/link';
// Placed inside a <Link>: flags the link while its navigation is in flight so CSS (:has) can show progress.
export function LinkPending() {
  const { pending } = useLinkStatus();
  return <span className="link-pending" data-pending={pending ? 'true' : undefined} aria-hidden="true"/>;
}
