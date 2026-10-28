import 'server-only';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { nextCookies } from 'better-auth/next-js';
import { APIError } from 'better-auth/api';
import { jwt } from 'better-auth/plugins';
import { mcp } from '@better-auth/mcp';
import { cimd } from '@better-auth/cimd';
import { fetchClientMetadataResource } from '@better-auth/cimd/node';
import { mcpResource, mcpScopes } from '@/modules/mcp/policy';
import { getDb } from './db';
import { normalizeEmail, permittedRole } from './access-policy';
import { recordEvent } from '@/modules/events';

async function recordSessionEvent(userId: string, action: 'signed_in' | 'signed_out') {
  try {
    const db = getDb();
    const user = await db.authUser.findUnique({ where: { id: userId } });
    if (!user) return;
    const email = normalizeEmail(user.email);
    const grant = await db.accessGrant.findUnique({ where: { email } });
    const role = permittedRole(grant, user.emailVerified, email, process.env.AJ_SUPERADMIN_EMAIL);
    if (role) await recordEvent({ id: user.id, name: user.name, email, role }, action, 'sesiones', user.id, 'Sesión de la plataforma');
  } catch { console.error('SESSION_EVENT_NOT_RECORDED'); }
}

export function authConfigured() {
  return Boolean(process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_URL && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && (process.env.DATABASE_URL || process.env.DATA_URL) && process.env.AJ_SUPERADMIN_EMAIL);
}
async function assertAccess(email: string, verified: boolean) {
  const normalized = normalizeEmail(email);
  const grant = await getDb().accessGrant.findUnique({ where: { email: normalized } });
  if (!permittedRole(grant, verified, normalized, process.env.AJ_SUPERADMIN_EMAIL)) throw new APIError('FORBIDDEN', { message: 'Esta cuenta no tiene acceso a Sistema AJ.' });
}
function createAuth() {
  return betterAuth({
    appName: 'Sistema AJ',
    baseURL: process.env.BETTER_AUTH_URL!,
    secret: process.env.BETTER_AUTH_SECRET!,
    trustedOrigins: [process.env.BETTER_AUTH_URL!],
    database: prismaAdapter(getDb(), { provider: 'postgresql' }),
    emailAndPassword: { enabled: false },
    user: { modelName: 'authUser', changeEmail: { enabled: false }, deleteUser: { enabled: false } },
    session: { modelName: 'authSession', expiresIn: 60 * 60 * 24, updateAge: 60 * 60, cookieCache: { enabled: false } },
    account: { modelName: 'authAccount', accountLinking: { enabled: true, trustedProviders: ['google'], allowDifferentEmails: false }, encryptOAuthTokens: true },
    verification: { modelName: 'authVerification' },
    rateLimit: { enabled: true, storage: 'database', modelName: 'authRateLimit', window: 60, max: 60, customRules: {'/oauth2/register':{window:3600,max:10},'/oauth2/token':{window:60,max:30}} },
    socialProviders: {
      google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!, prompt: 'select_account', accessType: 'online', includeGrantedScopes: true },
    },
    databaseHooks: {
      user: { create: { before: async user => { await assertAccess(user.email, user.emailVerified); return { data: { ...user, email: normalizeEmail(user.email) } }; } }, update: { before: async data => { if(data.email !== undefined) { if(!data.emailVerified) throw new APIError('FORBIDDEN', { message: 'El correo debe estar verificado.' }); await assertAccess(data.email, data.emailVerified); } return { data }; } } },
      session: {
        create: {
          before: async session => { const user = await getDb().authUser.findUnique({ where: { id: session.userId } }); if(!user) throw new APIError('FORBIDDEN'); await assertAccess(user.email, user.emailVerified); return { data: session }; },
          after: async session => { await recordSessionEvent(session.userId, 'signed_in'); },
        },
        delete: { after: async (session, context) => { if (context?.path === '/sign-out') await recordSessionEvent(session.userId, 'signed_out'); } },
      },
    },
    plugins: [jwt(), mcp({
      loginPage: '/mcp/connect', consentPage: '/mcp/consent', resource: mcpResource(),
      scopes: mcpScopes, grantTypes: ['authorization_code', 'refresh_token'],
      resources: [{ identifier: mcpResource(), name: 'Sistema AJ', allowedScopes: mcpScopes, accessTokenTtl: 300 }],
      // Some deployed chat hosts still use RFC 7591; registration alone grants no access.
      allowDynamicClientRegistration: true, allowUnauthenticatedClientRegistration: true,
      refreshTokenReuseInterval: 0,
    }), cimd({fetchClientMetadataResource, metadataProfile:'mcp-2026-07-28'}), nextCookies()],
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  if (!authConfigured()) return null;
  return instance ??= createAuth();
}
