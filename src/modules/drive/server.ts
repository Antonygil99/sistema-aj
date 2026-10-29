import 'server-only';
import {getDb} from '@/lib/db';import {getAuth} from '@/lib/auth';import {authenticate,type Actor} from '@/lib/api';import {DriveError,driveScope,driveId} from './rules';import {driveGoogle} from './google';
export const noStore={'Cache-Control':'private, no-store'};
export async function driveUser(request:Request){const auth=await authenticate(request,'ADMIN');if(auth.denied)return auth;if(!auth.actor.id||!auth.actor.email)return {denied:Response.json({error:'SESSION_REQUIRED'},{status:403})};return {actor:{...auth.actor,id:auth.actor.id,email:auth.actor.email}};}
export async function driveCredentials(userId:string,headers:Headers,requireConnected=true){
 const connection=await getDb().driveConnection.findUnique({where:{userId}});
 if(!connection?.folderId||(requireConnected&&!connection.enabled))throw new DriveError('DRIVE_NOT_CONNECTED',409);
 const account=await getDb().authAccount.findFirst({where:{userId,providerId:'google'},select:{id:true,scope:true,refreshToken:true,refreshTokenExpiresAt:true}});
 if(!account?.scope?.split(/[\s,]+/).includes(driveScope)||!account.refreshToken||(account.refreshTokenExpiresAt&&account.refreshTokenExpiresAt<=new Date()))throw new DriveError('DRIVE_RECONNECT',409);
 try{const token=await getAuth()!.api.getAccessToken({headers,body:{accountId:account.id}});if(!token.accessToken)throw Error();return {connection,google:driveGoogle(token.accessToken,{folderId:connection.folderId,resourceKey:connection.resourceKey})};}catch(e){if(e instanceof DriveError)throw e;throw new DriveError('DRIVE_RECONNECT',409);}
}
export async function activeClient(id:string){const client=await getDb().client.findFirst({where:{id:driveId.parse(id),archivedAt:null},select:{id:true,name:true}});if(!client)throw new DriveError('RECORD_NOT_FOUND',404);return client;}
export async function linkFile(clientId:string,fileId:string,key:string|null,actor:Actor&{id:string},headers:Headers){
 await activeClient(clientId);const {connection,google}=await driveCredentials(actor.id,headers),file=await google.withinRoot(fileId,key);
 const saved=await getDb().clientDriveLink.upsert({where:{clientId_fileId:{clientId,fileId}},create:{clientId,fileId,rootFolderId:connection.folderId!,resourceKey:file.resourceKey??key,name:file.name,mimeType:file.mimeType,createdBy:actor.id},update:{rootFolderId:connection.folderId!,resourceKey:file.resourceKey??key,name:file.name,mimeType:file.mimeType}});
 return {id:saved.id,name:file.name,mimeType:file.mimeType};
}
