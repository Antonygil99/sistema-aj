import type { AgentId } from './catalog';
// Contrato para un futuro adaptador eve. No hay ejecución ni llamadas LLM aún.
export interface AgentRuntime {
  run(input: { agent: AgentId; message: string; correlationId: string }): Promise<{ draft: string; requiresApproval: true }>;
}
