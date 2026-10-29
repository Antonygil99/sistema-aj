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

export async function verifyDriveEvidence(clientId:string,linkId:string,actor:Actor,headers:Headers){
 if(!actor.id||!actor.email||actor.role==='USER')throw new DriveError('FORBIDDEN',403);
 const {connection,google}=await driveCredentials(actor.id,headers),link=await getDb().clientDriveLink.findFirst({where:{id:linkId,clientId,rootFolderId:connection.folderId!}});
 if(!link)throw new DriveError('DRIVE_ACCESS_DENIED',403);
 const file=await google.withinRoot(link.fileId,link.resourceKey);
 if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.mimeType))throw new DriveError('FILE_TYPE_INVALID',415);
 return {linkId:link.id,fileId:link.fileId,rootFolderId:connection.folderId!,connectionUpdatedAt:connection.updatedAt,name:file.name};
}
export async function driveEvidenceOptions(clientId:string,actor:Actor,headers:Headers){
 if(!actor.id||actor.role==='USER')return [];
 const connection=await getDb().driveConnection.findUnique({where:{userId:actor.id}});if(!connection?.enabled||!connection.folderId)return [];
 const {google}=await driveCredentials(actor.id,headers);
 const links=await getDb().clientDriveLink.findMany({where:{clientId,rootFolderId:connection.folderId},select:{id:true,fileId:true,resourceKey:true},take:20,orderBy:{createdAt:'desc'}});
 const checked=await Promise.allSettled(links.map(async l=>{const f=await google.withinRoot(l.fileId,l.resourceKey);if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(f.mimeType))return null;return {id:'drive:'+l.id,name:f.name+' · Drive',href:`/api/dossiers/${clientId}/drive/${l.id}`};}));
 for(const r of checked)if(r.status==='rejected'&&r.reason instanceof DriveError&&['DRIVE_RECONNECT','DRIVE_UNAVAILABLE'].includes(r.reason.code))throw r.reason;
 return checked.flatMap(r=>r.status==='fulfilled'&&r.value?[r.value]:[]);
}
