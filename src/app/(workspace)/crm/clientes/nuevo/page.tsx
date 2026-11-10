import {getRequestDb} from '@/modules/areas/db';
import { redirect,notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { hasRole } from '@/lib/access-policy';

import { DossierWizard } from '@/components/dossier-wizard';
// ?prospect=<id> converts that prospect: the wizard starts with its contact data.
export default async function NewDossier({ searchParams }: { searchParams: Promise<{ prospect?: string }> }) {
  const user = await requireUser();
  const prospectId = (await searchParams).prospect?.slice(0, 100);
  const prospect = prospectId && hasRole(user.role, 'ADMIN') ? await (await getRequestDb()).prospect.findUnique({ where: { id: prospectId }, select: { id: true, name: true, email: true, phone: true, convertedClientId: true, clientId:true, line:true, vehicle:true, paymentFrequency:true } }) : null;
  if(prospectId&&!prospect)notFound();
  if (prospect?.convertedClientId) redirect(`/crm/clientes/${prospect.convertedClientId}`);
  return <><div className="eyebrow">CLIENTES / ALTA</div><h1>{prospect ? `Convertir a ${prospect.name}` : 'Nuevo expediente'}</h1>{prospect ? <p className="lead">Sus datos de contacto ya están capturados. Registra su póliza y quedará lista para la entrega activa.</p> : null}{hasRole(user.role, 'ADMIN') ? <DossierWizard clientId={prospect?.clientId??undefined} prospect={prospect ? { id: prospect.id, name: prospect.name, email: prospect.email ?? '', phone: prospect.phone ?? '',line:prospect.line,vehicle:prospect.vehicle??undefined,paymentFrequency:prospect.paymentFrequency??undefined } : undefined}/> : <p>Solo los administradores pueden dar de alta expedientes.</p>}</>;
}
