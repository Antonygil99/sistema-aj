import { requireUser } from '@/lib/session';
import { hasRole } from '@/lib/access-policy';
import { DossierWizard } from '@/components/dossier-wizard';
export default async function NewDossier(){const user=await requireUser();return <><div className="eyebrow">CLIENTES / ALTA</div><h1>Nuevo expediente</h1>{hasRole(user.role,'ADMIN')?<DossierWizard/>:<p>Solo los administradores pueden dar de alta expedientes.</p>}</>;}
