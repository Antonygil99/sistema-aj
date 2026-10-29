import {authenticate,apiError} from '@/lib/api';
import {boundedFormData,FileError} from '@/modules/documentos/file-policy';
import {extractPolicy} from '@/modules/polizas/extraction-server';
export const runtime='nodejs';export const maxDuration=60;
export async function POST(request:Request){const auth=await authenticate(request,'ADMIN');if(auth.denied)return auth.denied;try{
 const form=await boundedFormData(request);
 if([...form.keys()].some(k=>!['file','consent'].includes(k))||form.getAll('file').length!==1||form.getAll('consent').length!==1)throw new FileError('FORM_INVALID',400);
 const file=form.get('file');if(!(file instanceof File)||form.get('consent')!=='true')throw new FileError('FORM_INVALID',400);
 return Response.json(await extractPolicy(file,auth.actor),{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return apiError(e);}}
