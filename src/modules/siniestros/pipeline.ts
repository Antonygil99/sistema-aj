// Administrative progress only: PAGADO never posts a financial transaction.
export const claimStatuses=['OPEN','IN_REVIEW','TRANSITO','TALLER','ASISTENCIA_VIAL','VALUACION_AUTORIZADA','REFACCIONES','REPARACION','ENTREGADO','PAGO_DANOS','DOCUMENTACION_DANOS','PAGADO','CLOSED'] as const;
export const completedClaimStatuses=['CLOSED','ENTREGADO','PAGADO'] satisfies (typeof claimStatuses[number])[];
export const claimLabels:Record<string,string>={OPEN:'Abierto',IN_REVIEW:'En revisión',TRANSITO:'Tránsito',TALLER:'Taller',ASISTENCIA_VIAL:'Asistencia vial',VALUACION_AUTORIZADA:'Valuación autorizada',REFACCIONES:'Refacciones',REPARACION:'Reparación',ENTREGADO:'Entregado',PAGO_DANOS:'Pago de daños',DOCUMENTACION_DANOS:'Documentación de daños',PAGADO:'Pagado',CLOSED:'Cerrado'};
export function nextClaimStages(status:string,line:unknown):string[]{
 if(line!=='AUTO')return status==='OPEN'?['IN_REVIEW']:status==='IN_REVIEW'?['CLOSED']:[];
 const transitions:Record<string,string[]>={OPEN:['TRANSITO','IN_REVIEW'],IN_REVIEW:['TRANSITO','CLOSED'],TRANSITO:['TALLER','ASISTENCIA_VIAL'],TALLER:['VALUACION_AUTORIZADA'],ASISTENCIA_VIAL:['VALUACION_AUTORIZADA'],VALUACION_AUTORIZADA:['REFACCIONES','PAGO_DANOS'],REFACCIONES:['REPARACION'],REPARACION:['ENTREGADO'],PAGO_DANOS:['DOCUMENTACION_DANOS'],DOCUMENTACION_DANOS:['PAGADO']};
 return transitions[status]??[];
}
export function isAutoClaimStage(status:unknown){return typeof status==='string'&&claimStatuses.includes(status as typeof claimStatuses[number])&&!['OPEN','IN_REVIEW','CLOSED'].includes(status);}
