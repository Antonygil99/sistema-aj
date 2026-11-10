import 'server-only';
import {cache} from 'react';
import {headers} from 'next/headers';
import {getDb} from '@/lib/db';
import {ResourceError} from '@/modules/resources/rules';
import {areaWhere,unrestrictedAreas,type AreaActor} from './policy';
const modelModules:Record<string,string>={prospect:'prospectos',policy:'polizas',quote:'cotizaciones',payment:'pagos',renewal:'renovaciones',claim:'siniestros',activity:'actividades',document:'documentos',product:'productos',insuranceProcedure:'procedimientos',renewalPreparation:'preparacion',clientNotice:'avisos',emailMessage:'correos',crmEvent:'eventos'};
const relations:Record<string,Record<string,string>>={client:{policies:'policy',quotes:'quote',activities:'activity',documents:'document',referrals:'prospect',opportunities:'prospect',convertedFrom:'prospect',procedures:'insuranceProcedure',notices:'clientNotice'},policy:{payments:'payment',renewals:'renewal',claims:'claim',documents:'document',activities:'activity',procedures:'insuranceProcedure'},prospect:{quotes:'quote',activities:'activity'},documentFolder:{documents:'document'}};
type Args=Record<string,unknown>;
const reads=new Set(['findMany','findFirst','findFirstOrThrow','findUnique','findUniqueOrThrow','count','aggregate','groupBy']);
function modelScope(model:string,actor:AreaActor){
 const resource=modelModules[model];
 if(['procedimientos','preparacion'].includes(resource))return areaWhere('pagos',actor);
 if(resource==='avisos')return {ownerEmail:actor.email??'__no_identity__'};
 if(resource==='correos')return {sentByEmail:actor.email??'__no_identity__'};
 if(resource==='eventos')return {actorEmail:actor.email??'__no_identity__'};
 return areaWhere(resource,actor);
}
// Keep unique IDs at the root of findUnique's extended unique selector.
function constrain(where:unknown,scope:Args){return Object.keys(scope).length?{...(where as Args??{}),AND:[where??{},scope]}:where;}
function relationFilters(model:string,where:unknown,actor:AreaActor):unknown{
 if(!where||typeof where!=='object'||Array.isArray(where))return where;
 const result={...(where as Args)};
 for(const key of ['AND','OR','NOT'])if(result[key])result[key]=Array.isArray(result[key])?(result[key] as unknown[]).map(value=>relationFilters(model,value,actor)):relationFilters(model,result[key],actor);
 for(const [relation,target] of Object.entries(relations[model]??{})){
  const filter=result[relation];if(!filter||typeof filter!=='object')continue;
  const nested={...(filter as Args)},scope=modelScope(target,actor);
  for(const quantifier of ['some','none','every'])if(nested[quantifier]){
   const criteria=relationFilters(target,nested[quantifier],actor);
   nested[quantifier]=quantifier==='every'&&Object.keys(scope).length?{OR:[{NOT:scope},criteria]}:constrain(criteria,scope);
  }
  result[relation]=nested;
 }
 return result;
}
function readArgs(model:string,input:Args,actor:AreaActor):Args{
 const args:Args={...input,where:constrain(relationFilters(model,input.where,actor),modelScope(model,actor))};
 for(const key of ['include','select']){
  if(!input[key]||typeof input[key]!=='object')continue;
  const selection={...(input[key] as Args)};
  for(const [relation,target] of Object.entries(relations[model]??{})){
   const value=selection[relation];if(value)selection[relation]=readArgs(target,value===true?{}:value as Args,actor);
  }
  const count=selection._count;
  if(count&&typeof count==='object'&&(count as Args).select){const selected={...((count as Args).select as Args)};for(const [relation,target] of Object.entries(relations[model]??{}))if(selected[relation])selected[relation]={where:constrain(typeof selected[relation]==='object'?(selected[relation] as Args).where:undefined,modelScope(target,actor))};selection._count={...(count as Args),select:selected};}
  args[key as 'include']=selection;
 }
 return args;
}
// Explicitly request-scoped read facade. Never cached globally or used for auth lookup.
export function getAreaDb(actor?:AreaActor,base=getDb()):ReturnType<typeof getDb>{
 if(unrestrictedAreas(actor))return base;
 const wrap=(client:object):object=>new Proxy(client,{get(target,key){
  const value=Reflect.get(target,key);
  if(key==='$transaction')return (fn:unknown,...rest:unknown[])=>typeof fn==='function'?value.call(target,(tx:object)=>(fn as (tx:object)=>unknown)(wrap(tx)),...rest):value.call(target,fn,...rest);
  if(typeof key==='string'&&(key in modelModules||key in relations))return new Proxy(value,{get(delegate,method){const fn=Reflect.get(delegate,method);return typeof method==='string'&&reads.has(method)?(args:Args={})=>fn.call(delegate,readArgs(key,args,actor!)):typeof fn==='function'?fn.bind(delegate):fn;}});
  return typeof value==='function'?value.bind(target):value;
 }});
 return wrap(base) as ReturnType<typeof getDb>;
}
export const getRequestDb=cache(async()=>{
 let requestHeaders:Headers;
 try{requestHeaders=await headers();}catch{return getDb();} // Offline tooling/tests, not an HTTP identity.
 const {currentUser}=await import('@/lib/session');
 const actor=await currentUser(requestHeaders);
 if(!actor&&requestHeaders.has('cookie'))throw new ResourceError('UNAUTHORIZED',401);
 // Cookie-less jobs/integrations have their own endpoint authentication.
 return getAreaDb(actor??undefined);
});
export const areaReadArguments=readArgs;
