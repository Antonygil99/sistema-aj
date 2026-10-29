import 'server-only';
import { getDb } from '@/lib/db';
import type { Actor } from '@/lib/api';
import type { Prisma } from '@/generated/prisma/client';
export type EventAction = 'created' | 'updated' | 'archived' | 'restored' | 'deleted' | 'uploaded' | 'moved' | 'renamed' | 'downloaded' | 'viewed' | 'signed_in' | 'signed_out' | 'access_changed' | 'emailed';
export function eventData(actor: Actor, action: EventAction, module: string, recordId: string, label: string, details?: Prisma.InputJsonObject) {
  return { action, module, recordId, label: label.slice(0, 250) || 'Registro', actorId: actor.id, actorName: actor.name.slice(0, 120), actorEmail: actor.email, actorRole: actor.role, details,
    auditOnly: ['downloaded', 'viewed', 'signed_in', 'signed_out', 'access_changed'].includes(action) || ['preferencias', 'agenda','whatsapp','canales-whatsapp'].includes(module) };
}
// Best effort: the business change already happened, so a failed audit write is logged, never surfaced.
export async function recordEvent(actor: Actor, action: EventAction, module: string, recordId: string, label: string, details?: Prisma.InputJsonObject) {
  try {
    await getDb().crmEvent.create({ data: eventData(actor, action, module, recordId, label, details) });
  } catch { console.error('CRM_EVENT_NOT_RECORDED'); }
}
