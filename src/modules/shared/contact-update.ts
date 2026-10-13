import { z } from 'zod';
import { createSchema as prospectSchema } from '../prospectos/schema';
import { createSchema as clientSchema } from '../clientes/schema';
export class ContactError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}
const version = { expectedUpdatedAt: z.iso.datetime({ offset: true }) };
export const updateProspectSchema = prospectSchema.extend(version);
export const updateClientSchema = clientSchema.extend(version);
export function prospectUpdate(input: unknown) {
  const { expectedUpdatedAt, ...data } = updateProspectSchema.parse(input);
  return { expectedUpdatedAt: new Date(expectedUpdatedAt), data: { ...data, email: data.email ?? null, phone: data.phone ?? null, notes: data.notes ?? null } };
}
export function clientUpdate(input: unknown) {
  const { expectedUpdatedAt, ...data } = updateClientSchema.parse(input);
  return { expectedUpdatedAt: new Date(expectedUpdatedAt), data: { ...data, email: data.email ?? null, phone: data.phone ?? null, taxId: data.taxId ?? null } };
}
