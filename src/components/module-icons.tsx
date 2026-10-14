import type { Icon as IconType } from '@/components/icons';
import { Box, Calculator, CalendarTick, Card, ClipboardTick, FolderOpen, Refresh2, ShieldTick, Warning2, UserAdd, People } from '@/components/icons';
import type { ModuleSlug } from '@/modules/catalog';
export const moduleIcons: Record<ModuleSlug, IconType> = {
  prospectos: UserAdd,
  clientes: People,
  productos: Box,
  polizas: ShieldTick,
  entregas: ClipboardTick,
  cotizaciones: Calculator,
  pagos: Card,
  renovaciones: Refresh2,
  siniestros: Warning2,
  documentos: FolderOpen,
  actividades: CalendarTick,
};
