import 'server-only';
import type { JWTPayload } from 'jose';
import { getDb } from '@/lib/db';
import { normalizeEmail, permittedRole } from '@/lib/access-policy';
import type { Actor } from '@/lib/api';
import { McpError } from './policy';
export type McpActor = Actor & {id:string;email:string;clientId:string;scopes:string[];issuedAt:number};
export async function actorFromClaims(claims:JWTPayload):Promise<McpActor> {
  const userId=claims.sub, clientId=claims.client_id;
  if(typeof userId!=='string'||typeof clientId!=='string'||typeof claims.iat!=='number'||typeof claims.scope!=='string')throw new McpError('INVALID_TOKEN',401);
  const db=getDb();
  const [user,client,consent,revocation]=await Promise.all([
    db.authUser.findUnique({where:{id:userId}}),db.oauthClient.findUnique({where:{clientId}}),
    db.oauthConsent.findFirst({where:{userId,clientId}}),db.mcpRevocation.findUnique({where:{userId_clientId:{userId,clientId}}}),
  ]);
  if(!user||!client||client.disabled||!consent|| (revocation && claims.iat<=Math.floor(revocation.revokedBefore.getTime()/1000)))throw new McpError('CONNECTION_REVOKED',401);
  const email=normalizeEmail(user.email),grant=await db.accessGrant.findUnique({where:{email}});
  const role=permittedRole(grant,user.emailVerified,email,process.env.AJ_SUPERADMIN_EMAIL);
  if(!role)throw new McpError('ACCESS_DISABLED',403);
  const scopes=claims.scope.split(' ').filter(scope=>consent.scopes.includes(scope));
  return {id:userId,email,name:user.name,role,clientId,scopes,issuedAt:claims.iat};
}
export async function revalidateActor(actor:McpActor) {
  return actorFromClaims({sub:actor.id,client_id:actor.clientId,iat:actor.issuedAt,scope:actor.scopes.join(' ')});
}
export async function purgeExpiredUploads() { await getDb().mcpChange.updateMany({where:{expiresAt:{lt:new Date()},fileBytes:{not:null}},data:{fileBytes:null}}); }
export async function rateLimitMcp(userId:string) {
  const now=BigInt(Date.now()),cutoff=now-60000n,key='mcp:'+userId;
  const rows=await getDb().$queryRaw<{count:number}[]>`INSERT INTO "AuthRateLimit" (id,key,count,"lastRequest") VALUES (${key},${key},1,${now}) ON CONFLICT (key) DO UPDATE SET count=CASE WHEN "AuthRateLimit"."lastRequest"<${cutoff} THEN 1 ELSE "AuthRateLimit".count+1 END,"lastRequest"=CASE WHEN "AuthRateLimit"."lastRequest"<${cutoff} THEN ${now} ELSE "AuthRateLimit"."lastRequest" END RETURNING count`;
  if(rows[0].count>120)throw new McpError('RATE_LIMITED',429);
}
export async function revokeConnection(userId:string,clientId:string) {
  const db=getDb(),now=new Date();
  await db.$transaction([
    db.mcpRevocation.upsert({where:{userId_clientId:{userId,clientId}},create:{userId,clientId,revokedBefore:now},update:{revokedBefore:now}}),
    db.oauthConsent.deleteMany({where:{userId,clientId}}),
    db.oauthRefreshToken.updateMany({where:{userId,clientId},data:{revoked:now,rotationReplayResponse:null}}),
    db.oauthAccessToken.updateMany({where:{userId,clientId},data:{revoked:now}}),
    db.mcpChange.updateMany({where:{userId,clientId,status:'PENDING'},data:{status:'CANCELLED',fileBytes:null}}),
  ]);
}
