import {authenticate,apiError} from '@/lib/api';
import {getDb} from '@/lib/db';
import {deliveryInput} from '@/modules/documentos/delivery';
import {FileError} from '@/modules/documentos/file-policy';
import {recordEvent} from '@/modules/events';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await authenticate(request,'ADMIN');if(auth.denied)return auth.denied;
 try{if(!auth.actor.id)throw new FileError('FORBIDDEN',403);
 const d=deliveryInput.parse(await request.json()),{id}=await params,db=getDb();
 const doc=await db.document.findFirst({where:{id,archivedAt:null},include:{policy:{select:{archivedAt:true,client:{select:{archivedAt:true}}}}}});
 if(!doc)throw new FileError('DOCUMENT_NOT_FOUND',404);
 if(d.deliveryKind!=='INTERNAL'&&(!doc.policy||doc.policy.archivedAt||doc.policy.client.archivedAt||doc.claimId||!['application/pdf','image/jpeg','image/png','image/webp'].includes(doc.mimeType)))throw new FileError('DOCUMENT_DELIVERY_SCOPE',422);
 const saved=await db.document.updateMany({where:{id,updatedAt:new Date(d.expectedUpdatedAt)},data:{deliveryKind:d.deliveryKind,deliveryReviewed:d.deliveryKind!=='INTERNAL'&&d.reviewed,deliveryReviewedBy:auth.actor.id}});
 if(!saved.count)throw new FileError('RECORD_CHANGED',409);
 await recordEvent(auth.actor,'updated','documentos',id,'Clasificación para entrega revisada',{deliveryKind:d.deliveryKind});
 return Response.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return apiError(e);}
}
