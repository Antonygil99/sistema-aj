import {z} from 'zod';
import {DriveError,driveId,keySchema,folderMime} from './rules';
const fileSchema=z.object({id:driveId,name:z.string().max(1000),mimeType:z.string(),parents:z.array(driveId).optional(),resourceKey:keySchema.optional(),trashed:z.boolean().optional(),thumbnailLink:z.string().optional()});
export type DriveFile=z.infer<typeof fileSchema>;
export function driveNameQuery(search:string){return search.trim().slice(0,120).split(/\s+/).filter(Boolean).map(term=>"name contains '"+term.replace(/\\/g,'\\\\').replace(/'/g,"\\'")+"'").join(' and ');}
export function driveGoogle(token:string,root:{folderId:string;resourceKey:string|null},fetcher:typeof fetch=fetch){
 const deadline=AbortSignal.timeout(45000);
 async function get(path:string,params:Record<string,string>,keys:{id:string;key:string}[]=[]){
  const url=new URL('https://www.googleapis.com/drive/v3/'+path);for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
  const pairs=[...(root.resourceKey?[{id:root.folderId,key:root.resourceKey}]:[]),...keys].map(p=>driveId.parse(p.id)+'/'+keySchema.parse(p.key));
  const r=await fetcher(url,{headers:{Authorization:'Bearer '+token,...(pairs.length?{'X-Goog-Drive-Resource-Keys':pairs.join(',')}:{})},redirect:'error',cache:'no-store',signal:AbortSignal.any([deadline,AbortSignal.timeout(12000)])});
  if(!r.ok)throw new DriveError(r.status===401?'DRIVE_RECONNECT':r.status===403||r.status===404?'DRIVE_ACCESS_DENIED':'DRIVE_UNAVAILABLE',r.status===401?409:r.status===403||r.status===404?403:502);
  return r.json();
 }
 const fields='id,name,mimeType,parents,resourceKey,trashed,thumbnailLink';
 const cache=new Map<string,Promise<DriveFile>>();
 const uncached=(id:string,key?:string|null)=>get('files/'+driveId.parse(id),{fields,supportsAllDrives:'true'},key?[{id,key}]:[]).then(v=>fileSchema.parse(v));
 function file(id:string,key?:string|null){const k=id+'/'+(key??'');let p=cache.get(k);if(!p){p=uncached(id,key);cache.set(k,p);}return p;}
 async function withinRoot(id:string,key?:string|null){
  let current=await file(id,key);const first=current,seen=new Set<string>();
  for(let i=0;i<32;i++){
   if(current.trashed||current.mimeType==='application/vnd.google-apps.shortcut'||seen.has(current.id))break;
   if(current.id===root.folderId)return first;
   seen.add(current.id);if(current.parents?.length!==1)break;current=await file(current.parents[0]);
  }
  throw new DriveError('DRIVE_OUTSIDE_FOLDER',403);
 }
 return {file,withinRoot,async thumbnail(id:string,key?:string|null){
  const f=await withinRoot(id,key);if(!f.thumbnailLink)throw new DriveError('RECORD_NOT_FOUND',404);
  const u=new URL(f.thumbnailLink);if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.endsWith('.googleusercontent.com'))throw new DriveError('DRIVE_UNAVAILABLE',502);
  const response=await fetcher(u,{headers:{Authorization:'Bearer '+token},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new DriveError('DRIVE_UNAVAILABLE',502);
  const type=response.headers.get('content-type')?.split(';')[0];if(!type||!['image/jpeg','image/png','image/webp','image/gif'].includes(type))throw new DriveError('FILE_TYPE_INVALID',415);
  const reader=response.body?.getReader();if(!reader)throw new DriveError('DRIVE_UNAVAILABLE',502);let size=0;const chunks:Uint8Array[]=[];
  try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>2097152)throw new DriveError('FILE_SIZE_INVALID',413);chunks.push(r.value);}}finally{await reader.cancel();}
  return {bytes:Buffer.concat(chunks),type};
 },async verify(){const f=await file(root.folderId);if(f.trashed||f.mimeType!==folderMime)throw new DriveError('DRIVE_FOLDER_INVALID');return f;},async list(id:string=root.folderId,pageToken?:string,search=''){const f=await withinRoot(id);if(f.mimeType!==folderMime)throw new DriveError('DRIVE_FOLDER_INVALID');const raw=await get('files',{q:"'"+driveId.parse(id)+"' in parents and trashed = false and mimeType != 'application/vnd.google-apps.shortcut'"+(search.trim()?' and ('+driveNameQuery(search)+')':''),fields:'nextPageToken,files('+fields+')',pageSize:'50',orderBy:'folder,name',supportsAllDrives:'true',includeItemsFromAllDrives:'true',...(pageToken?{pageToken}:{})},f.resourceKey?[{id:f.id,key:f.resourceKey}]:[]);const result=z.object({files:z.array(fileSchema),nextPageToken:z.string().max(2000).optional()}).parse(raw);return {...result,files:result.files.filter(item=>item.parents?.includes(id)&&!item.trashed)};}};
}
