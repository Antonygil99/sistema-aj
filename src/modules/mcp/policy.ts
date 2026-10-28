import { z } from 'zod';
import type { AccessRole } from '@/lib/access-policy';
export const scopeLabels = { 'crm:read': 'Consultar registros y archivos', 'crm:write': 'Proponer altas y cambios', 'crm:delete': 'Proponer eliminación permanente', 'crm:files': 'Proponer cargas y organizar archivos', offline_access: 'Mantener la conexión hasta que la revoques' } as const;
export const mcpScopes = Object.keys(scopeLabels);
export const mcpResource = () => new URL('/mcp', process.env.BETTER_AUTH_URL || 'http://localhost:3000').href;
export class McpError extends Error { constructor(public code: string, public status = 400) { super(code); } }
export const moduleSchema = z.enum(['prospectos','clientes','polizas','cotizaciones','pagos','renovaciones','siniestros','actividades','productos','documentos','carpetas']);
export type McpModule = z.infer<typeof moduleSchema>;
export const operationSchema = z.enum(['create','update','archive','restore','delete','upload','intake_link','intake_draft']);
export type McpOperation = z.infer<typeof operationSchema>;
export const moduleLabels:Record<McpModule,string>={prospectos:'Prospectos',clientes:'Clientes',polizas:'Pólizas',cotizaciones:'Cotizaciones',pagos:'Pagos',renovaciones:'Renovaciones',siniestros:'Siniestros',actividades:'Actividades',productos:'Productos',documentos:'Documentos',carpetas:'Carpetas'};
export const fieldLabels:Record<string,string>={name:'Nombre',email:'Correo',phone:'Teléfono',taxId:'RFC',number:'Número de póliza',clientId:'Cliente',policyId:'Póliza',claimId:'Siniestro',prospectId:'Prospecto',productId:'Producto del catálogo',folderId:'Carpeta de destino',parentId:'Carpeta superior',insurer:'Aseguradora',product:'Producto',status:'Estado',startDate:'Inicio de vigencia',endDate:'Fin de vigencia',premium:'Prima',currency:'Moneda',paymentFrequency:'Periodicidad de pago',ownerEmail:'Responsable',reference:'Referencia',amount:'Importe',validUntil:'Válida hasta',dueDate:'Vencimiento',occurredAt:'Fecha del suceso',title:'Actividad',line:'Ramo',mimeType:'Tipo de archivo',color:'Color de carpeta',source:'Origen'};
Object.assign(fieldLabels,{nombre:'Nombre',correo:'Correo',telefono:'Teléfono'});
// Explicit administrative projections; no free-text diagnoses, claim narratives, bank details, tokens or file contents.
export const fields: Record<McpModule, readonly string[]> = {
  prospectos:['name','email','phone','source','status','ownerEmail'],
  clientes:['name','email','phone','taxId'],
  polizas:['number','clientId','insurer','product','productId','status','startDate','endDate','premium','currency','paymentFrequency','ownerEmail'],
  cotizaciones:['reference','prospectId','clientId','product','amount','currency','status','validUntil'],
  pagos:['policyId','amount','currency','dueDate','status'],
  renovaciones:['policyId','dueDate','status'],
  siniestros:['reference','policyId','status','occurredAt'],
  actividades:['title','status','dueDate','prospectId','clientId','policyId','claimId','ownerEmail'],
  productos:['name','insurer','ownerEmail','line'],
  documentos:['name','mimeType','folderId','clientId','policyId','claimId'],
  carpetas:['name','color','parentId','clientId'],
};
export const models: Record<McpModule,string> = {prospectos:'Prospect',clientes:'Client',polizas:'Policy',cotizaciones:'Quote',pagos:'Payment',renovaciones:'Renewal',siniestros:'Claim',actividades:'Activity',productos:'Product',documentos:'Document',carpetas:'DocumentFolder'};
export function project(module:McpModule,row:Record<string,unknown>) {
  return Object.fromEntries(['id',...fields[module],'archivedAt','createdAt','updatedAt'].filter(key=>key in row).map(key=>[key,row[key]]));
}
export function allowedScopes(role:AccessRole) { return mcpScopes.filter(scope => role==='SUPERADMIN' || (scope!=='crm:delete' && (role==='ADMIN' || !['crm:write','crm:files'].includes(scope)))); }
export function checkPermission(role:AccessRole,scopes:readonly string[],operation:'read'|McpOperation,module:McpModule='clientes') {
  const required=operation==='read'?'crm:read':operation==='delete'?'crm:delete':operation==='upload'||['documentos','carpetas'].includes(module)?'crm:files':'crm:write';
  if(!scopes.includes(required) || !allowedScopes(role).includes(required))throw new McpError('PERMISSION_DENIED',403);
}
export function safePatch(module:McpModule,data:Record<string,unknown>) {
  if(Object.keys(data).length>24 || Object.keys(data).some(key=>!fields[module].includes(key)))throw new McpError('FIELD_NOT_AVAILABLE');
  if(JSON.stringify(data).length>12000)throw new McpError('INPUT_TOO_LARGE',413);
  return data;
}
export function resourceHref(module:McpModule,id?:string) { return module==='documentos'||module==='carpetas'?'/crm/documentos':module==='clientes'&&id?`/crm/clientes/${encodeURIComponent(id)}`:`/crm/${module}${id?'?q='+encodeURIComponent(id):''}`; }
export function jsonData(value:unknown) { return JSON.parse(JSON.stringify(value)); }
