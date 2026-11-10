import {requireUser} from '@/lib/session';
import {reviewQueue} from '@/modules/revision/server';
import {ReviewQueue} from '@/components/review-queue';
export const dynamic='force-dynamic';
export const metadata={title:'Por revisar · Sistema AJ'};
export default async function ReviewPage(){
  await requireUser('ADMIN');
  const initial=await reviewQueue({});
  return <><h1>Por revisar</h1><p className="lead-small">Una vista del equipo para completar expedientes y mantener sus datos relacionados.</p><ReviewQueue initial={initial}/></>;
}
