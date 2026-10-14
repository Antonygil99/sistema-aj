import { z } from 'zod';
import { currentUser } from '@/lib/session';
import { normalizeEmail, trustedMutation } from '@/lib/access-policy';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/api';
import { eventData } from '@/modules/events';
export const runtime = 'nodejs';
async function manager(request: Request) {
  const user = await currentUser(request.headers);
  return user?.role === 'SUPERADMIN' ? user : null;
}
export async function GET(request: Request) {
  try {
    if (!await manager(request)) return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
    const data = await getDb().accessGrant.findMany({ orderBy: { createdAt: 'asc' } });
    return Response.json({ data });
  } catch(error) { return apiError(error); }
}
export async function PATCH(request: Request) {
  if (!trustedMutation(request, process.env.BETTER_AUTH_URL ?? '')) return Response.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  try {
    const user = await manager(request);
    if(!user) return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
    const input = z.object({ email: z.email().transform(normalizeEmail), role: z.enum(['USER','ADMIN']), enabled: z.boolean() }).strict().parse(await request.json());
    if(input.email === normalizeEmail(process.env.AJ_SUPERADMIN_EMAIL ?? '')) return Response.json({ error: 'PRIMARY_ADMIN_PROTECTED' }, { status: 409 });
    const data = await getDb().$transaction(async tx => {
      const previous = await tx.accessGrant.findUnique({ where: { email: input.email } });
      const grant = await tx.accessGrant.upsert({ where: { email: input.email }, create: input, update: { role: input.role, enabled: input.enabled } });
      if(!input.enabled) {
        const target = await tx.authUser.findUnique({ where: { email: input.email } });
        if(target) await tx.authSession.deleteMany({ where: { userId: target.id } });
      }
      await tx.accessAudit.create({ data: { actorId: user.id, targetEmail: input.email, change: { role: input.role, enabled: input.enabled } } });
      await tx.crmEvent.create({ data: eventData(user, 'access_changed', 'usuarios', input.email, input.email, { before: previous ? { role: previous.role, enabled: previous.enabled } : null, after: { role: input.role, enabled: input.enabled } }) });
      return grant;
    });
    return Response.json({ data });
  } catch(error) { return apiError(error); }
}
