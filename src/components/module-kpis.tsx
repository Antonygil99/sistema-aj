import { requireUser } from '@/lib/session';
import type { ModuleSlug } from '@/modules/catalog';
import { moduleMetrics } from '@/modules/metrics/module-server';
import { ModuleKpiCards } from './module-kpi-cards';
export async function ModuleKpis({slug,clientId=null}:{slug:ModuleSlug;clientId?:string|null}){await requireUser();let initial=null;try{initial=await moduleMetrics(slug,clientId);}catch{console.error('MODULE_METRICS_UNAVAILABLE');}return <ModuleKpiCards key={`${slug}:${clientId||'team'}`} slug={slug} clientId={clientId} initial={initial}/>;}
