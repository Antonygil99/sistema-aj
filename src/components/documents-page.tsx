import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { hasRole } from '@/lib/access-policy';
import { storageStatus } from '@/integrations/r2/server';
import { notFound } from 'next/navigation';
import { documentSelect, scopeWhere } from '@/modules/documentos/folders';
import { DocumentLibrary, type DocumentOption } from './document-library';
export async function DocumentsPage({clientId=null}:{clientId?:string|null}) {
 const user=await requireUser();const db=getDb();const canUpload=hasRole(user.role,'ADMIN');const storage=storageStatus();
 const client=clientId?await db.client.findUnique({where:{id:clientId},select:{name:true}}):null;if(clientId&&!client)notFound();
 const where={folderId:null,...scopeWhere(clientId)};
 const [documents,total,folders,clients,policies,claims]=await Promise.all([
 db.document.findMany({where,take:20,orderBy:[{createdAt:'desc'},{id:'desc'}],select:documentSelect}),db.document.count({where}),db.documentFolder.findMany({where:{clientId},orderBy:{name:'asc'}}),
 db.client.findMany({take:100,orderBy:{name:'asc'},select:{id:true,name:true}}),canUpload?db.policy.findMany({take:100,orderBy:{createdAt:'desc'},select:{id:true,number:true}}):[],canUpload?db.claim.findMany({take:100,orderBy:{createdAt:'desc'},select:{id:true,reference:true}}):[]]);
 const options:DocumentOption[]=[...clients.map(c=>({id:c.id,label:c.name,kind:'clientId' as const})),...policies.map(p=>({id:p.id,label:`Póliza · ${p.number}`,kind:'policyId' as const})),...claims.map(c=>({id:c.id,label:`Siniestro · ${c.reference}`,kind:'claimId' as const}))];
 return <DocumentLibrary key={clientId||'team'} clientId={clientId} clientName={client?.name} initial={documents.map(d=>({...d,createdAt:d.createdAt.toISOString(),updatedAt:d.updatedAt.toISOString()}))} initialTotal={total} initialFolders={folders.map(f=>({...f,updatedAt:f.updatedAt.toISOString()}))} options={options} canUpload={canUpload} configured={storage.configured} configurationMessage={canUpload?storage.message:undefined}/>;
}
