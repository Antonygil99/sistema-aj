import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {authenticate,apiError} from '@/lib/api';
import {getDb} from '@/lib/db';
import {getR2} from '@/integrations/r2/server';
import {boundedFormData,FileError,IMAGE_TYPES,isInsurerImageKey,validateFile} from '@/modules/documentos/file-policy';
import {recordEvent} from '@/modules/events';
export const runtime='nodejs';export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
async function cleanup(key:string){try{await getR2().remove(key);}catch{console.error('R2_ORPHAN_CLEANUP_REQUIRED');}}
const input=z.object({description:z.string().trim().max(600),expectedUpdatedAt:z.iso.datetime(),removeImage:z.enum(['0','1'])});
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await authenticate(request,'ADMIN');if(auth.denied)return auth.denied;
 let uploaded:string|null=null;
 try{
  const id=z.string().min(1).max(100).parse((await params).id),db=getDb();
  const old=await db.insurer.findUnique({where:{id}});if(!old)return Response.json({error:'RECORD_NOT_FOUND'},{status:404,headers});
  const form=await boundedFormData(request);if([...form.keys()].some(k=>!['description','expectedUpdatedAt','removeImage','file'].includes(k)))throw new FileError('INVALID_INPUT',400);
  const d=input.parse({description:form.get('description'),expectedUpdatedAt:form.get('expectedUpdatedAt'),removeImage:form.get('removeImage')??'0'});
  if(old.updatedAt.toISOString()!==d.expectedUpdatedAt)return Response.json({error:'RECORD_CHANGED'},{status:409,headers});
  const file=form.get('file');if(file!==null&&!(file instanceof File))throw new FileError('FILE_REQUIRED',400);if(file&&d.removeImage==='1')throw new FileError('INVALID_INPUT',400);
  let imageKey=old.imageKey,imageType=old.imageType;
  if(file instanceof File){if(!IMAGE_TYPES.has(file.type))throw new FileError('FILE_TYPE_INVALID',415);const bytes=new Uint8Array(await file.arrayBuffer()),checked=validateFile(file.name,file.type,bytes);uploaded=`aj/insurers/${randomUUID()}.${checked.extension}`;await getR2().put(uploaded,bytes,checked.mimeType);imageKey=uploaded;imageType=checked.mimeType;}
  else if(d.removeImage==='1'){imageKey=null;imageType=null;}
  const changed=await db.insurer.updateMany({where:{id,updatedAt:new Date(d.expectedUpdatedAt)},data:{description:d.description||null,imageKey,imageType,...(file instanceof File||d.removeImage==='1'?{useProductImage:false}:{})}});
  if(!changed.count)throw Object.assign(new Error('RECORD_CHANGED'),{code:'RECORD_CHANGED',status:409});
  uploaded=null;
  if(old.imageKey&&old.imageKey!==imageKey&&isInsurerImageKey(old.imageKey))await cleanup(old.imageKey);
  await recordEvent(auth.actor,'updated','aseguradoras',id,old.name);
  return Response.json({ok:true},{headers});
 }catch(error){if(uploaded)await cleanup(uploaded);if(error instanceof FileError)return Response.json({error:error.code},{status:error.status,headers});return apiError(error);}
}
