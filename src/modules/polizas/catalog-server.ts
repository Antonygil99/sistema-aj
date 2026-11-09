import 'server-only';
import type {Prisma} from '@/generated/prisma/client';
import {ResourceError} from '@/modules/resources/rules';
type Db=Pick<Prisma.TransactionClient,'product'|'accessGrant'>;
// Contract snapshots already saved on a policy are preserved unless its catalog binding/text is edited.
export async function resolvePolicyCatalog<T extends Record<string,unknown>>(db:Db,data:T,previous?:{productId:string|null;insurer:string;product:string;ownerEmail?:string|null}):Promise<T>{
 if(!data.productId)return data;
 if(previous&&data.productId===previous.productId&&data.insurer===previous.insurer&&data.product===previous.product)return data;
 const product=await db.product.findUnique({where:{id:String(data.productId)},select:{name:true,insurer:true,ownerEmail:true,archivedAt:true,insurerProfile:{select:{name:true}}}});
 if(!product||product.archivedAt)throw new ResourceError('POLICY_PRODUCT_UNAVAILABLE',422);
 const retainedOldOwner=previous&&data.productId!==previous.productId&&data.ownerEmail===previous.ownerEmail;
 const owner=!retainedOldOwner&&typeof data.ownerEmail==='string'&&data.ownerEmail?data.ownerEmail:product.ownerEmail;
 if(!owner||!await db.accessGrant.findFirst({where:{email:owner,enabled:true,role:{in:['ADMIN','SUPERADMIN']}}}))throw new ResourceError('PRODUCT_OWNER_INVALID',422);
 return {...data,insurer:product.insurerProfile?.name??product.insurer,product:product.name,ownerEmail:owner};
}
