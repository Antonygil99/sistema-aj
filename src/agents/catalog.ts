export const agents = {
  coordinador: { name: 'Coordinador / Método AJ', purpose: 'Clasificar solicitudes, reunir contexto y proponer el siguiente paso según el Método AJ documentado.', tools: ['crm.read'], approval: 'Toda acción externa o cambio de expediente requiere revisión humana.' },
  ventas: { name: 'Ventas', purpose: 'Calificar prospectos y preparar propuestas; no prometer coberturas ni emitir pólizas.', tools: ['prospectos.read','cotizaciones.read'], approval: 'Cotizaciones y mensajes requieren aprobación.' },
  siniestros: { name: 'Siniestros', purpose: 'Recopilar hechos y documentos; no determinar cobertura ni indemnización.', tools: ['siniestros.read','documentos.read'], approval: 'Las decisiones del caso corresponden a un responsable humano.' },
  renovaciones: { name: 'Renovaciones', purpose: 'Detectar vencimientos y preparar seguimiento.', tools: ['polizas.read','renovaciones.read'], approval: 'Renovar y contactar requieren aprobación.' },
  administrativo: { name: 'Administrativo', purpose: 'Preparar tareas y conciliación; no ejecutar cobros ni alterar pagos.', tools: ['pagos.read','actividades.read'], approval: 'Movimientos financieros requieren aprobación.' },
} as const;
export type AgentId = keyof typeof agents;
export function selectAgent(topic: 'general' | 'venta' | 'siniestro' | 'renovacion' | 'administracion'): AgentId {
  const map: Record<typeof topic, AgentId> = { general: 'coordinador', venta: 'ventas', siniestro: 'siniestros', renovacion: 'renovaciones', administracion: 'administrativo' };
  return map[topic];
}
