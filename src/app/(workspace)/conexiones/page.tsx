import type { Metadata } from 'next';
import { requireUser } from '@/lib/session';
import { getDb } from '@/lib/db';
import { purgeExpiredUploads } from '@/modules/mcp/actor';
import { mcpResource } from '@/modules/mcp/policy';
import { Connections } from '@/components/mcp/connections';
import './connections.css';
export const metadata:Metadata={title:'Conexiones · Sistema AJ'};
export default async function ConnectionsPage() {
  const user=await requireUser();await purgeExpiredUploads();
  const db=getDb();
  const consents=await db.oauthConsent.findMany({where:{userId:user.id},select:{clientId:true,scopes:true,createdAt:true},orderBy:{createdAt:'desc'}});
  const clients=await db.oauthClient.findMany({where:{clientId:{in:consents.map(c=>c.clientId)}},select:{clientId:true,name:true}});
  const pending=await db.mcpChange.findMany({where:{userId:user.id,status:'PENDING',expiresAt:{gt:new Date()}},select:{id:true,module:true,operation:true,expiresAt:true},orderBy:{createdAt:'desc'},take:30});
  return <Connections endpoint={mcpResource()} role={user.role} connections={consents.map(c=>({...c,name:clients.find(client=>client.clientId===c.clientId)?.name??'Aplicación externa',createdAt:c.createdAt.toISOString()}))} pending={pending.map(p=>({...p,expiresAt:p.expiresAt.toISOString()}))}/>;
}
