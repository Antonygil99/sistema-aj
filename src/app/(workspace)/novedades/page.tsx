import type { Metadata } from 'next';
import { requireUser } from '@/lib/session';
import { visibleReleases } from '@/modules/help/releases';
import { ReleaseNotes } from '@/components/release-notes';
import './releases.css';
export const metadata: Metadata = { title: 'Novedades · Sistema AJ' };
export default async function NovedadesPage() {
  const user = await requireUser();
  return <ReleaseNotes items={visibleReleases(user.role)} role={user.role}/>;
}
