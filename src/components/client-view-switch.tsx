import { Folder2, RowVertical } from '@/components/icons';
import { ViewLink } from './ui/view-link';
// Clients open as dossiers or as the editable list; the same switch sits in both toolbars and remembers the choice.
export function ClientViewSwitch({ current }: { current: 'dossiers' | 'list' }) {
  return <div className="segmented" role="group" aria-label="Forma de ver">
    <ViewLink href="/crm/clientes?view=dossiers" remember={{ clientes: 'dossiers' }} aria-current={current === 'dossiers' ? 'page' : undefined}><Folder2 aria-hidden="true"/>Expedientes</ViewLink>
    <ViewLink href="/crm/clientes?view=list" remember={{ clientes: 'list' }} aria-current={current === 'list' ? 'page' : undefined} title="Lista para editar contactos y archivar"><RowVertical aria-hidden="true"/>Lista</ViewLink>
  </div>;
}
