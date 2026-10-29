import {requireUser} from '@/lib/session';
import {ResourceLinks} from '@/components/resource-links';
export const dynamic='force-dynamic';
export default async function Page(){const user=await requireUser();return <><p className="eyebrow">HERRAMIENTAS</p><h1>Recursos del equipo</h1><p>Enlaces de pago, calculadoras y comparativas en un solo lugar. Cada recurso indica con quién se comparte.</p><ResourceLinks canEdit={user.role!=='USER'}/></>;}
