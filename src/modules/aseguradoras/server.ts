import 'server-only';
import type {PrismaClient} from '@/generated/prisma/client';
import {getDb} from '@/lib/db';
import {IMAGE_TYPES,isInsurerImageKey,isProductImageKey} from '@/modules/documentos/file-policy';
import {insurerKey} from './identity';
export async function ensureInsurer(db:Pick<PrismaClient,'insurer'>,name:string){const normalizedName=insurerKey(name);return db.insurer.upsert({where:{normalizedName},update:{},create:{name:name.trim().replace(/\s+/g,' '),normalizedName}});}
// Raw object keys stay on the server. Only a boolean indicating an available image reaches the card.
export async function insurerCatalog(){const rows=await getDb().insurer.findMany({select:{id:true,name:true,description:true,imageType:true,useProductImage:true,updatedAt:true,products:{where:{archivedAt:null},select:{name:true,line:true,ownerEmail:true,imageType:true,imageKey:true}},_count:{select:{products:true}}},orderBy:{name:'asc'}});return rows.map(({products,...row})=>({...row,hasProductImage:row.useProductImage&&products.some(p=>p.imageKey&&isProductImageKey(p.imageKey)&&p.imageType&&IMAGE_TYPES.has(p.imageType)),products:products.map(({name,line,ownerEmail})=>({name,line,ownerEmail}))}));}
export async function insurerImageSource(db:Pick<PrismaClient,'insurer'|'product'>,id:string){
 const row=await db.insurer.findUnique({where:{id},select:{id:true,name:true,imageKey:true,useProductImage:true}});
 if(!row)return null;
 if(row.imageKey&&isInsurerImageKey(row.imageKey))return {name:row.name,key:row.imageKey,source:'insurer' as const};
 if(!row.useProductImage)return null;
 const products=await db.product.findMany({where:{insurerId:row.id,archivedAt:null,imageKey:{not:null},imageType:{in:[...IMAGE_TYPES]}},select:{imageKey:true},orderBy:[{updatedAt:'desc'},{id:'desc'}],take:100});
 const key=products.find(p=>p.imageKey&&isProductImageKey(p.imageKey))?.imageKey;
 return key?{name:row.name,key,source:'product' as const}:null;
}
