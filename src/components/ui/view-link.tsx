'use client';
import Link from 'next/link';
import type { ComponentProps } from 'react';
import type { PreferencesPatch } from '@/modules/preferences';
import { usePreferences } from './preferences';
// A link that switches a module's view and remembers the choice for the next visit.
export function ViewLink({ remember, onClick, ...props }: ComponentProps<typeof Link> & { remember: NonNullable<PreferencesPatch['views']> }) {
  const { update } = usePreferences();
  return <Link {...props} onClick={event => { update({ views: remember }); onClick?.(event); }}/>;
}
