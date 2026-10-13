export type Kpi = { label: string; value: string; detail: string; tone?: 'normal' | 'attention'; definition: string; action?: 'renewals' | 'payments' };
export type ModuleMetrics = { scope: string; asOf: string; cards: Kpi[]; note?: string };
export function percentage(part:number,total:number){return total>0?`${Math.round(part/total*100)} %`:'—';}
export function countKpi(label:string,value:number,definition:string,detail='Registros no archivados',attention=false):Kpi{return {label,value:new Intl.NumberFormat('es-MX').format(value),detail,definition,tone:attention&&value>0?'attention':'normal'};}
// Monetary series keep their currencies separate. Missing records never certify that collection is complete.
export function moneySeries(rows:{currency:string;_sum:Record<string,unknown>}[],field:string){return rows.length?rows.map(row=>`${new Intl.NumberFormat('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(row._sum[field]??0))} ${row.currency}`).join(' · '):'Sin registros';}
export function calendarMonth(monthStart:Date,monthEnd:Date){return {gte:new Date(Date.UTC(monthStart.getUTCFullYear(),monthStart.getUTCMonth(),1)),lt:new Date(Date.UTC(monthEnd.getUTCFullYear(),monthEnd.getUTCMonth(),1))};}
