import {getRequestDb} from '@/modules/areas/db';
import 'server-only';
import {Prisma} from '@/generated/prisma/client';

import {smartSearchWhere} from '../smart-search-server';
import {z} from 'zod';
import {reviewKinds,type ReviewRow} from './types';
export const reviewQuery=z.object({kind:z.enum(Object.keys(reviewKinds) as [keyof typeof reviewKinds,...(keyof typeof reviewKinds)[]]).default('all'),q:z.string().trim().max(100).default(''),skip:z.coerce.number().int().min(0).max(100000).default(0)}).strict();

export async function reviewQueue(input:unknown){
  const query=reviewQuery.parse(input),db=(await getRequestDb()),take=20;
  const grants=await db.accessGrant.findMany({where:{enabled:true,role:{in:['ADMIN','SUPERADMIN']}},select:{email:true}});
  const badOwner={OR:[{ownerEmail:null},{NOT:{ownerEmail:{in:grants.map(row=>row.email),mode:'insensitive' as const}}}]};
  const active={archivedAt:null,status:'ACTIVE' as const,client:{archivedAt:null}};
  const [calendars,closures]=await Promise.all([
    db.$queryRaw<{id:string}[]>(Prisma.sql`SELECT p.id FROM "Policy" p JOIN "Client" c ON c.id=p."clientId" LEFT JOIN "Payment" r ON r."policyId"=p.id AND r."archivedAt" IS NULL
      WHERE p."archivedAt" IS NULL AND p.status='ACTIVE' AND c."archivedAt" IS NULL GROUP BY p.id
      HAVING count(r.id)=0 OR count(r.id)>120 OR p."paymentFrequency" IS NULL OR coalesce(sum(r.amount),0)<>p.premium OR bool_or(r.currency<>p.currency OR r."dueDate"::date<p."startDate"::date OR r."dueDate"::date>p."endDate"::date)
      OR count(r.id)<>count(DISTINCT r."dueDate"::date) OR (p."paymentFrequency"='ONCE' AND count(r.id)<>1) OR p."sourceData"->>'paymentsNeedReview'='true'`),
    db.renewal.findMany({where:{archivedAt:null,status:'RENEWED',policy:{archivedAt:null,client:{archivedAt:null},nextPolicy:null}},select:{policyId:true},distinct:['policyId']}),
  ]);
  const calendarIds=calendars.map(row=>row.id),closureIds=closures.map(row=>row.policyId);
  const conditions={
    catalog:{...active,OR:[{productId:null},{catalogProduct:{archivedAt:{not:null}}}]},
    policyOwner:{...active,...badOwner},
    schedule:{id:{in:calendarIds}},renewal:{id:{in:closureIds}},
  } satisfies Record<string,Prisma.PolicyWhereInput>;
  const productCondition={archivedAt:null,...badOwner};
  const summaryEntries=await Promise.all([
    ...Object.entries(conditions).map(async([key,where])=>[key,await db.policy.count({where})] as const),
    (async()=>['productOwner',await db.product.count({where:productCondition})] as const)(),
  ]);
  const summary=Object.fromEntries(summaryEntries) as Record<Exclude<keyof typeof reviewKinds,'all'>,number>;
  const policyKind=query.kind!=='productOwner',productKind=query.kind==='all'||query.kind==='productOwner';
  const policyWhere:Prisma.PolicyWhereInput={AND:[query.kind==='all'?{OR:Object.values(conditions)}:conditions[query.kind as keyof typeof conditions]??{id:{in:[]}},await smartSearchWhere('polizas',query.q)]};
  const productWhere={...productCondition,...await smartSearchWhere('productos',query.q)};
  const [policyCount,productCount]=await Promise.all([policyKind?db.policy.count({where:policyWhere}):0,productKind?db.product.count({where:productWhere}):0]);
  const policyTake=policyKind?Math.max(0,Math.min(take,policyCount-query.skip)):0;
  const [policies,products]=await Promise.all([
    policyTake?db.policy.findMany({where:policyWhere,skip:query.skip,take:policyTake,orderBy:[{client:{name:'asc'}},{id:'asc'}],select:{id:true,number:true,productId:true,ownerEmail:true,clientId:true,status:true,client:{select:{name:true}},catalogProduct:{select:{archivedAt:true}}}}):[],
    productKind&&policyTake<take?db.product.findMany({where:productWhere,skip:Math.max(0,query.skip-policyCount),take:take-policyTake,orderBy:[{name:'asc'},{id:'asc'}],select:{id:true,name:true,insurer:true,insurerId:true}}):[],
  ]);
  const valid=new Set(grants.map(row=>row.email.toLowerCase()));
  const rows:ReviewRow[]=[...policies.map(row=>{
    const issues:string[]=[];
    if(row.status==='ACTIVE'&&(!row.productId||row.catalogProduct?.archivedAt))issues.push('Vincular un producto activo');
    if(row.status==='ACTIVE'&&(!row.ownerEmail||!valid.has(row.ownerEmail.toLowerCase())))issues.push('Asignar un administrador activo');
    const calendar=calendarIds.includes(row.id),renewal=closureIds.includes(row.id);
    if(calendar)issues.push('Revisar el calendario contra los recibos');
    if(renewal)issues.push('Renovada sin nueva vigencia vinculada');
    const financial=query.kind==='schedule'||query.kind==='renewal'||(query.kind==='all'&&issues.length===(Number(calendar)+Number(renewal)));
    return {id:row.id,entity:'policy' as const,title:row.number,subtitle:row.client.name,issues,action:financial?'Revisar expediente':'Completar póliza',href:financial?`/crm/clientes/${row.clientId}#pagos-${row.id}`:`/crm/polizas?q=${encodeURIComponent(row.number)}&open=${row.id}`};
  }),...products.map(row=>({id:row.id,entity:'product' as const,title:row.name,subtitle:row.insurer,issues:['Asignar un administrador activo'],action:'Completar producto',href:`/crm/productos?${row.insurerId?'insurer='+encodeURIComponent(row.insurerId)+'&':''}q=${encodeURIComponent(row.name)}&open=${row.id}`}))];
  return {rows,summary,total:policyCount+productCount,skip:query.skip,take,query};
}
