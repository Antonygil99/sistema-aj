import { requireUser } from '@/lib/session';
import { hasRole, normalizeEmail } from '@/lib/access-policy';
import { deliveryBoard } from '@/modules/polizas/delivery-server';
import { DeliveryBoard } from './delivery-board';
export async function DeliveryPage({ owner, openId }: { owner?: string; openId?: string }) {
  const user = await requireUser();
  const cards = await deliveryBoard();
  const me = normalizeEmail(user.email);
  const initialOwner = owner === 'me' ? me : owner && owner !== 'all' ? normalizeEmail(owner).slice(0, 254) : null;
  return <DeliveryBoard key={openId ?? 'board'} initial={cards} canEdit={hasRole(user.role, 'ADMIN')} me={me} initialOwner={initialOwner} openId={openId?.slice(0, 100)}/>;
}
