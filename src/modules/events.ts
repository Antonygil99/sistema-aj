import 'server-only';
import { getDb } from '@/lib/db';
import type { Actor } from '@/lib/api';
export type EventAction = 'created' | 'updated' | 'archived' | 'restored' | 'deleted' | 'uploaded' | 'moved' | 'renamed';
// Best effort: the business change already happened, so a failed audit write is logged, never surfaced.
export async function recordEvent(actor: Actor, action: EventAction, module: string, recordId: string, label: string) {
  try {
    await getDb().crmEvent.create({ data: { action, module, recordId, label: label.slice(0, 250) || 'Registro', actorId: actor.id, actorName: actor.name.slice(0, 120) } });
  } catch { console.error('CRM_EVENT_NOT_RECORDED'); }
}
