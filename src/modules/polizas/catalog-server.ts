import 'server-only';
import type {Prisma} from '@/generated/prisma/client';
import {ResourceError} from '@/modules/resources/rules';
import {assertLine} from '@/modules/areas/server';
import {defaultLine,type AreaActor} from '@/modules/areas/policy';
type Db=Pick<Prisma.TransactionClient,'product'|'accessGrant'>;
// Contract snapshots already saved on a policy are preserved unless its catalog binding/text is edited.
export async function resolvePolicyCatalog<T extends Record<string,unknown>>(db:Db,data:T,previous?:{productId:string|null;insurer:string;product:string;ownerEmail?:string|null;line?:string|null},actor?:AreaActor):Promise<T>{
 if(!data.productId){const line=data.line??previous?.line??defaultLine(actor);assertLine(actor,line);return {...data,line};}
 if(previous&&previous.line&&data.productId===previous.productId&&data.insurer===previous.insurer&&data.product===previous.product)return {...data,line:previous.line};
 const product=await db.product.findUnique({where:{id:String(data.productId)},select:{name:true,insurer:true,line:true,ownerEmail:true,archivedAt:true,insurerProfile:{select:{name:true}}}});
 if(!product||product.archivedAt)throw new ResourceError('POLICY_PRODUCT_UNAVAILABLE',422);
 const owner=typeof data.ownerEmail==='string'&&data.ownerEmail?data.ownerEmail:product.ownerEmail;
 if(!owner||!await db.accessGrant.findFirst({where:{email:owner,enabled:true,role:{in:['ADMIN','SUPERADMIN']}}}))throw new ResourceError('PRODUCT_OWNER_INVALID',422);
 assertLine(actor,product.line);
 return {...data,line:product.line,insurer:product.insurerProfile?.name??product.insurer,product:product.name,ownerEmail:owner};
}
