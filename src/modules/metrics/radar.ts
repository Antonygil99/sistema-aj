import 'server-only';
import { getDb } from '@/lib/db';
import { monthRange } from './period';
import { calendarMonth } from './module-types';
export type RadarRow={id:string;client:string;number:string;date:string;amount:string;currency:string;href:string};
export type RadarPage={rows:RadarRow[];total:number;label:string;skip:number};
export async function radar(kind:'renewals'|'payments',skip=0,now=new Date()):Promise<RadarPage>{
 const db=getDb(),p=monthRange(now);
 if(kind==='renewals'){
  const where={archivedAt:null,status:'ACTIVE' as const,endDate:{gte:p.today,lte:new Date(p.today.getTime()+60*86400000)}};
  const [rows,total]=await Promise.all([db.policy.findMany({where,skip,take:20,orderBy:[{endDate:'asc'},{id:'asc'}],select:{id:true,number:true,endDate:true,premium:true,currency:true,client:{select:{id:true,name:true}}}}),db.policy.count({where})]);
  return {skip,total,label:'Renovaciones de los próximos 60 días',rows:rows.map(row=>({id:row.id,number:row.number,client:row.client.name,date:row.endDate.toISOString(),amount:row.premium.toString(),currency:row.currency,href:`/crm/clientes/${row.client.id}`}))};
 }
 const where={archivedAt:null,status:{not:'PAID' as const},dueDate:calendarMonth(p.start,p.end),policy:{archivedAt:null}};
 const [rows,total]=await Promise.all([db.payment.findMany({where,skip,take:20,orderBy:[{dueDate:'asc'},{id:'asc'}],select:{id:true,dueDate:true,amount:true,currency:true,policy:{select:{number:true,client:{select:{name:true}}}}}}),db.payment.count({where})]);
 return {skip,total,label:`Pagos por confirmar en ${p.label}`,rows:rows.map(row=>({id:row.id,number:row.policy.number,client:row.policy.client.name,date:row.dueDate.toISOString(),amount:row.amount.toString(),currency:row.currency,href:`/crm/pagos?open=${row.id}`}))};
}
