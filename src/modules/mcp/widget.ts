import { App } from '@modelcontextprotocol/ext-apps';
const app=new App({name:'Sistema AJ',version:'1.0.0'},{});
const root=document.getElementById('app')!;
type Data={id?:string;baseUrl?:string;kind?:string;summary?:string;module?:string;rows?:Record<string,unknown>[];policies?:Record<string,unknown>[];total?:number;skip?:number;take?:number;query?:string;link?:string;reviewPath?:string;status?:string;data?:Record<string,unknown>;role?:string;scopes?:string[];canPrepareIntake?:boolean;counts?:Record<string,number>;missing?:string[]};
const labels:Record<string,string>={name:'Nombre',email:'Correo',phone:'Teléfono',taxId:'RFC',number:'Póliza',insurer:'Aseguradora',product:'Producto',status:'Estado',startDate:'Inicio',endDate:'Fin de vigencia',premium:'Prima',currency:'Moneda',paymentFrequency:'Periodicidad',title:'Actividad',dueDate:'Vencimiento',reference:'Referencia',amount:'Importe',createdAt:'Creado',updatedAt:'Versión',ownerEmail:'Responsable',line:'Ramo',mimeType:'Formato',source:'Origen'};
function element(tag:string,text?:string){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
function button(text:string,click:()=>Promise<unknown>){const b=element('button',text) as HTMLButtonElement;b.type='button';b.onclick=async()=>{b.disabled=true;try{await click();}catch{root.append(element('p','No se completó. Abre Sistema AJ o vuelve a intentar.'));}finally{b.disabled=false;}};return b;}
function render(data:Data) {
  if(!data){root.append(element('p','No se completó la consulta. Revisa el resultado de la herramienta o abre el CRM.'));return;}
  root.replaceChildren();root.append(element('small','SISTEMA AJ · ACCESO PERSONAL'),element('h2',data.kind==='proposal'?'Revisar propuesta':data.module??'Tu CRM conectado'));
  if(data.summary)root.append(element('p',data.summary));
  const open=async(path:string)=>{const url=new URL(path,data.baseUrl);if(!['https:','http:'].includes(url.protocol)||url.origin!==new URL(data.baseUrl!).origin)throw Error('URL');return app.openLink({url:url.href});};
  for(const row of data.rows??[]) {
    const card=element('article');const title=String(row.name??row.number??row.reference??row.title??'Registro');card.append(element('h3',title));
    const dl=element('dl');
    for(const [key,value]of Object.entries(row)){if(value===null||!labels[key]||key==='name')continue;dl.append(element('dt',labels[key]),element('dd',String(value)));}
    card.append(dl);
    if(data.module&&row.id)card.append(button('Ver ficha',async()=>{const result=await app.callServerTool({name:'aj_detail',arguments:{module:data.module,id:row.id}});render(result.structuredContent as Data);}));
    if(data.canPrepareIntake&&data.module==='clientes'&&row.id)card.append(button('Preparar formulario',async()=>{const result=await app.callServerTool({name:'aj_prepare_intake',arguments:{clientId:row.id,mode:'share'}});render(result.structuredContent as Data);}));
    root.append(card);
  }
  if(data.policies?.length){root.append(element('h3','Pólizas del expediente'));for(const policy of data.policies)root.append(element('p',`${policy.number} · ${policy.product} · ${String(policy.endDate).slice(0,10)}`));}
  if(data.data){const dl=element('dl');for(const[key,value]of Object.entries(data.data)){dl.append(element('dt',labels[key]??key),element('dd',String(value??'Vacío')));}root.append(dl);}
  if(data.status){const states:Record<string,string>={READY:'Por revisar',PENDING:'Pendiente',APPLIED:'Aplicado',CANCELLED:'Cancelado',EXPIRED:'Vencido',NOT_STARTED:'Sin iniciar',DRAFT:'Borrador',SUBMITTED:'Recibido para revisión',APPROVED:'Aprobado'};root.append(element('p','Estado: '+(states[data.status]??data.status)));}
  if(data.counts){const grid=element('div');grid.className='counts';for(const[key,label]of Object.entries({new:'Nuevos',matches:'Coincidencias',errors:'Por corregir',imported:'Importados'})){const card=element('article');card.append(element('h3',String(data.counts[key]??0)),element('span',label));grid.append(card);}root.append(grid);}
  if(data.missing?.length)root.append(element('p','Campos sin completar: '+data.missing.map(k=>({fullName:'Nombre',email:'Correo',phone:'Teléfono',taxId:'RFC'}[k]??k)).join(', ')));
  if(data.kind==='import'&&data.id)root.append(button('Actualizar estado',async()=>{const result=await app.callServerTool({name:'aj_import_status',arguments:{id:data.id}});render(result.structuredContent as Data);}));
  if(data.role)root.append(element('p','Tu rol: '+data.role));
  if(data.scopes)root.append(element('p','Permisos: '+data.scopes.join(', ')));
  if(data.kind==='list'&&data.total!==undefined&&data.skip!==undefined&&data.take&&data.skip+data.take<data.total)root.append(button('Ver más',async()=>{const result=await app.callServerTool({name:'aj_list',arguments:{module:data.module,query:data.query??'',skip:data.skip!+data.take!,take:data.take}});render(result.structuredContent as Data);}));
  const link=data.reviewPath??data.link;if(link)root.append(button(data.reviewPath?'Revisar en el CRM':data.kind==='file'?'Abrir archivo privado':'Abrir Sistema AJ',()=>open(link)));
}
app.ontoolresult=params=>render(params.structuredContent as Data);
app.onhostcontextchanged=context=>{document.documentElement.dataset.theme=context.theme??'light';};
app.connect().catch(()=>{root.textContent='Abre esta vista desde una herramienta de Sistema AJ compatible con MCP Apps.';});
