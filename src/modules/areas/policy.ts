// Shared product-line vocabulary; no personal email addresses or server dependencies.
export const businessLines = ['AUTO', 'MEDICAL', 'LIFE', 'ACCIDENT', 'HOME', 'TRAVEL', 'OTHER'] as const;
export type BusinessLine = typeof businessLines[number];
export const businessLineLabels: Record<BusinessLine, string> = { AUTO:'Autos', MEDICAL:'Gastos médicos mayores', LIFE:'Vida', ACCIDENT:'Accidentes personales', HOME:'Casa', TRAVEL:'Viaje', OTHER:'Otro' };
export type AreaActor = { role:string; email:string|null; id?:string|null; productLines?:readonly string[] };
export function unrestrictedAreas(actor?:AreaActor) { return !actor || actor.role==='SUPERADMIN' || (actor.id===null && actor.email===null); }
export function actorLines(actor?:AreaActor):BusinessLine[] { return unrestrictedAreas(actor)?[...businessLines]:businessLines.filter(line=>actor?.productLines?.includes(line)); }
export function canOperateLine(actor:AreaActor|undefined,line:unknown) { return unrestrictedAreas(actor) || actorLines(actor).includes(line as BusinessLine); }
// The first configured area is the preferred one; enabling more areas must not change it.
export function defaultLine(actor?:AreaActor):BusinessLine {
 if(unrestrictedAreas(actor))return 'MEDICAL';
 return actor?.productLines?.find((line):line is BusinessLine=>businessLines.includes(line as BusinessLine))??'MEDICAL';
}
// Catalog and basic customer contacts are shared. Operational records are not.
export function areaWhere(module:string,actor?:AreaActor):Record<string,unknown> {
  if(unrestrictedAreas(actor))return {};
  const line={in:actorLines(actor)};
  if(['prospectos','polizas','cotizaciones'].includes(module))return {line};
  if(['pagos','renovaciones','siniestros'].includes(module))return {policy:{line}};
  if(module==='actividades')return {OR:[{policy:{line}},{prospect:{line}},{claim:{policy:{line}}},{policyId:null,prospectId:null,claimId:null,ownerEmail:actor?.email??'__no_identity__'}]};
  if(module==='documentos')return {OR:[{policy:{line}},{claim:{policy:{line}}},{policyId:null,claimId:null}]};
  return {};
}
export function scopedWhere(module:string,where:object,actor?:AreaActor) { const area=areaWhere(module,actor);return Object.keys(area).length?{AND:[where,area]}:where; }
