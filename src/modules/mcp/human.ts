import 'server-only';
import { currentUser } from '@/lib/session';
import { trustedMutation } from '@/lib/access-policy';
import { McpError } from './policy';
export async function human(request:Request) {
  // The global internal integration token and OAuth bearer tokens cannot approve their own proposals.
  if(request.headers.has('authorization')||!trustedMutation(request,process.env.BETTER_AUTH_URL!))throw new McpError('HUMAN_SESSION_REQUIRED',403);
  const user=await currentUser(request.headers);
  if(!user)throw new McpError('UNAUTHORIZED',401);
  return user;
}
