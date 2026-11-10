import {getAreaDb} from '@/modules/areas/db';
import 'server-only';
import { smartSearchWhere } from './smart-search-server';
import { conversationScope } from './whatsapp/channels';
import { hasRole, normalizeEmail } from '@/lib/access-policy';
import { getDb } from '@/lib/db';
import { noticeKindLabels, type NoticeKind } from './email/notices';
import { documentResult, folderResult, userResult, type SearchResult } from './search';

// Independent lookups start together. Private sources retain the same owner/role checks as their modules.
export async function searchSupplement(q: string, actor: import('@/lib/api').Actor): Promise<SearchResult[]> {
  const db = getAreaDb(actor);
  const [documents, folders, users, extra] = await Promise.all([
    (async () => db.document.findMany({ where: { archivedAt: null, ...await smartSearchWhere('documentos', q) }, take: 6, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, mimeType: true, client: { select: { name: true } }, policy: { select: { number: true } } } }))(),
    (async () => db.documentFolder.findMany({ where: { ...await smartSearchWhere('carpetas', q), archivedAt: null }, take: 4, orderBy: { name: 'asc' }, select: { id: true, name: true, clientId: true, client: { select: { name: true } } } }))(),
    actor.role === 'SUPERADMIN' ? searchUsers(q) : Promise.resolve([]),
    extraResults(q, actor),
  ]);
  return [...documents.map(documentResult), ...folders.map(folderResult), ...users.map(userResult), ...extra];
}

async function searchUsers(q: string) {
  const db = getDb();
  const grants = await db.accessGrant.findMany({where:await smartSearchWhere('usuarios',q),take:5,select:{id:true,email:true,role:true,enabled:true}});
  const profiles = await db.authUser.findMany({ where: { email: { in: grants.map(grant => grant.email) } }, select: { email: true, name: true } });
  return grants.map(grant => ({ ...grant, name: profiles.find(profile => normalizeEmail(profile.email) === grant.email)?.name ?? null }));
}

export async function extraResults(q:string,actor:import('@/lib/api').Actor):Promise<SearchResult[]>{
 const db=getAreaDb(actor),admin=hasRole(actor.role,'ADMIN');
 const [insurers,meetings,conversations,procedures,notices,deliveries,links,templates]=await Promise.all([
 (async()=>db.insurer.findMany({where:await smartSearchWhere('aseguradoras',q),take:5,select:{id:true,name:true}}))(),
 actor.id?(async()=>db.calendarMeeting.findMany({where:{...await smartSearchWhere('agenda',q),userId:actor.id!,status:{not:'CANCELLED'}},take:5,select:{id:true,title:true},orderBy:{startAt:'desc'}}))():Promise.resolve([]),
 (async()=>db.whatsAppConversation.findMany({where:{...await smartSearchWhere('whatsapp',q),...await conversationScope(actor)},take:5,select:{id:true,displayName:true}}))(),
 admin?(async()=>db.insuranceProcedure.findMany({where:{...await smartSearchWhere('tramites',q),client:{archivedAt:null},policy:{archivedAt:null},...(actor.role==='SUPERADMIN'?{}:{OR:[{createdById:actor.id??''},{policy:{ownerEmail:{equals:actor.email??'',mode:'insensitive'}}}]})},take:5,select:{id:true,policy:{select:{number:true}},client:{select:{name:true}}}}))():Promise.resolve([]),
 admin?(async()=>db.clientNotice.findMany({where:{...await smartSearchWhere('avisos',q),status:'PENDING',client:{archivedAt:null},OR:[{ownerEmail:null},{ownerEmail:actor.email}]},take:5,select:{id:true,kind:true,client:{select:{name:true}}}}))():Promise.resolve([]),
 (async()=>db.policy.findMany({where:{...await smartSearchWhere('polizas',q),archivedAt:null,status:'ACTIVE'},take:4,select:{id:true,number:true,client:{select:{name:true}}}}))(),
 (async()=>db.crmResourceLink.findMany({where:{...await smartSearchWhere('recursos',q),active:true},take:4,select:{id:true,title:true,insurer:true}}))(),
 admin&&actor.email&&actor.id?(async()=>db.brokerEmailTemplate.findMany({where:{...await smartSearchWhere('plantillas',q),ownerEmail:actor.email!},take:4,select:{id:true,name:true},orderBy:{name:'asc'}}))():Promise.resolve([]),
 ]);
 return [...insurers.map(row=>({kind:'aseguradoras' as const,id:row.id,title:row.name,subtitle:'Productos de esta aseguradora',href:'/crm/productos?insurer='+encodeURIComponent(row.id)})),
 ...meetings.map(row=>({kind:'agenda' as const,id:row.id,title:row.title,subtitle:'Evento de tu calendario',href:'/agenda'})),
 ...conversations.map(row=>({kind:'whatsapp' as const,id:row.id,title:row.displayName,subtitle:'Conversación de tu bandeja',href:'/whatsapp?conversation='+encodeURIComponent(row.id)})),
 ...procedures.map(row=>({kind:'tramites' as const,id:row.id,title:'Trámite · '+row.policy.number,subtitle:row.client.name,href:'/tramites/'+encodeURIComponent(row.id)})),
 ...notices.map(row=>({kind:'avisos' as const,id:row.id,title:(noticeKindLabels[row.kind as NoticeKind]??row.kind)+' · '+row.client.name,subtitle:'Aviso pendiente',href:'/avisos'})),
 ...deliveries.map(row=>({kind:'entregas' as const,id:row.id,title:row.number,subtitle:row.client.name,href:'/crm/entregas?open='+encodeURIComponent(row.id)})),
 ...links.map(row=>({kind:'recursos' as const,id:row.id,title:row.title,subtitle:row.insurer??'Recurso del equipo',href:'/recursos?q='+encodeURIComponent(row.title)})),
 ...templates.map(row=>({kind:'plantillas' as const,id:row.id,title:row.name,subtitle:'Tu plantilla de correo',href:'/avisos?tab=plantillas'}))];
}
