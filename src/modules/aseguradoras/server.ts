import 'server-only';
import {randomUUID} from 'node:crypto';
import {GetObjectCommand} from '@aws-sdk/client-s3';
import {getR2} from '@/integrations/r2/server';
import type {Prisma,PrismaClient} from '@/generated/prisma/client';
import {getDb} from '@/lib/db';
import {IMAGE_TYPES,isInsurerImageKey,isProductImageKey,validateFile} from '@/modules/documentos/file-policy';
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

// Safe relation metadata reused by product cards and policy delivery previews.
export const insurerImageMetadata={select:{id:true,imageType:true,useProductImage:true,updatedAt:true,_count:{select:{products:{where:{archivedAt:null,imageKey:{not:null},imageType:{in:[...IMAGE_TYPES]}}}}}}} satisfies Prisma.InsurerDefaultArgs;
export async function productImageSource(db:Pick<PrismaClient,'insurer'|'product'>,id:string){
 const row=await db.product.findUnique({where:{id},select:{name:true,imageKey:true,insurerId:true}});if(!row)return null;
 if(row.imageKey&&isProductImageKey(row.imageKey))return {name:row.name,key:row.imageKey,source:'product' as const};
 if(!row.insurerId)return null;
 // Resolves raw stored objects, not the product/insurer image routes: no redirect loop.
 const inherited=await insurerImageSource(db,row.insurerId);return inherited?{name:row.name,key:inherited.key,source:'insurer' as const}:null;
}

export type CompanyImageStorage={read:(key:string)=>Promise<Uint8Array>;put:(key:string,bytes:Uint8Array,mime:string)=>Promise<void>;remove:(key:string)=>Promise<void>};
// Freeze the legacy product-backed logo before an individual override can change or delete its source.
export async function preserveCompanyImage(db:Pick<PrismaClient,'insurer'|'product'>,id:string|null,storage?:CompanyImageStorage){
 if(!id)return;
 const company=await db.insurer.findUnique({where:{id},select:{id:true,imageKey:true,useProductImage:true,updatedAt:true}});
 if(!company||company.imageKey||!company.useProductImage)return;
 const source=await insurerImageSource(db,id);
 if(!source){await db.insurer.updateMany({where:{id,imageKey:null,useProductImage:true,updatedAt:company.updatedAt},data:{useProductImage:false}});return;}
 const real=storage?null:getR2(),io=storage??{read:async(key:string)=>{const object=await real!.client.send(new GetObjectCommand({Bucket:real!.bucket,Key:key}),{abortSignal:AbortSignal.timeout(20000)});if(!object.Body||Number(object.ContentLength)>4*1024*1024)throw Error('INVALID_IMAGE');return object.Body.transformToByteArray();},put:real!.put,remove:real!.remove};
 const ext=source.key.split('.').at(-1)!,mime=ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg',bytes=await io.read(source.key),checked=validateFile('logo.'+ext,mime,bytes),key=`aj/insurers/${randomUUID()}.${checked.extension}`;
 await io.put(key,bytes,checked.mimeType);
 try{const saved=await db.insurer.updateMany({where:{id,imageKey:null,useProductImage:true,updatedAt:company.updatedAt},data:{imageKey:key,imageType:checked.mimeType}});if(!saved.count)await io.remove(key).catch(()=>console.error('R2_ORPHAN_CLEANUP_REQUIRED'));}
 catch(e){await io.remove(key).catch(()=>console.error('R2_ORPHAN_CLEANUP_REQUIRED'));throw e;}
}
