import 'server-only';
import type {PrismaClient} from '@/generated/prisma/client';
import {getDb} from '@/lib/db';
import {insurerKey} from './identity';
export async function ensureInsurer(db:Pick<PrismaClient,'insurer'>,name:string){const normalizedName=insurerKey(name);return db.insurer.upsert({where:{normalizedName},update:{},create:{name:name.trim().replace(/\s+/g,' '),normalizedName}});}
export async function insurerCatalog(){return getDb().insurer.findMany({select:{id:true,name:true,description:true,imageType:true,updatedAt:true,products:{where:{archivedAt:null},select:{name:true,line:true,ownerEmail:true}},_count:{select:{products:true}}},orderBy:{name:'asc'}});}
