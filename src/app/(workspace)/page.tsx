import { requireUser } from '@/lib/session';
import { normalizeEmail } from '@/lib/access-policy';
import { getDb } from '@/lib/db';
import { dashboardMetrics } from '@/modules/metrics/server';
import { DashboardOverview } from '@/components/dashboard-overview';
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ owner?: string }> }) {
  const user = await requireUser();
  const me = normalizeEmail(user.email);
  const ownerParam = (await searchParams).owner;
  const owner = ownerParam === 'me' ? me : ownerParam && ownerParam !== 'all' ? normalizeEmail(ownerParam).slice(0, 254) : null;
  const db = getDb();
  const [m, grants] = await Promise.all([dashboardMetrics(owner), db.accessGrant.findMany({ where: { enabled: true, role: { in: ['ADMIN', 'SUPERADMIN'] } }, select: { email: true } })]);
  const profiles = await db.authUser.findMany({ where: { email: { in: grants.map(grant => grant.email), mode: 'insensitive' } }, select: { email: true, name: true, image: true } });
  // Name and Google photo appear after a teammate's first sign-in; until then the chip shows initials and the email's user part.
  const teammates = grants.filter(grant => grant.email !== me).map(grant => {
    const profile = profiles.find(item => normalizeEmail(item.email) === grant.email);
    return { email: grant.email, name: profile?.name?.split(' ')[0] || grant.email.split('@')[0], image: profile?.image ?? null };
  });
  return <DashboardOverview m={m} owner={owner} me={{ email: me, name: user.name, image: user.image }} teammates={teammates}/>;
}
