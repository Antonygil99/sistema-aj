import type { Icon as IconType } from 'iconsax-reactjs';
import { Calculator, CalendarTick, Card, FolderOpen, Refresh2, ShieldTick, Warning2, UserAdd, People } from 'iconsax-reactjs';
import type { ModuleSlug } from '@/modules/catalog';
export const moduleIcons: Record<ModuleSlug, IconType> = {
  prospectos: UserAdd,
  clientes: People,
  polizas: ShieldTick,
  cotizaciones: Calculator,
  pagos: Card,
  renovaciones: Refresh2,
  siniestros: Warning2,
  documentos: FolderOpen,
  actividades: CalendarTick,
};
