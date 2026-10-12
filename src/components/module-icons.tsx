import type { IconType } from 'react-icons';
import { LuCalculator, LuCalendarCheck, LuCreditCard, LuFolderOpen, LuRefreshCw, LuShieldCheck, LuSiren, LuUserPlus, LuUsers } from 'react-icons/lu';
import type { ModuleSlug } from '@/modules/catalog';
export const moduleIcons: Record<ModuleSlug, IconType> = {
  prospectos: LuUserPlus,
  clientes: LuUsers,
  polizas: LuShieldCheck,
  cotizaciones: LuCalculator,
  pagos: LuCreditCard,
  renovaciones: LuRefreshCw,
  siniestros: LuSiren,
  documentos: LuFolderOpen,
  actividades: LuCalendarCheck,
};
