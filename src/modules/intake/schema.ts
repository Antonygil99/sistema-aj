import { z } from 'zod';
export const privacyVersion = 'aj-client-intake-2026-10-27';
const short = z.string().trim().max(120).default('');
const date = z.union([z.literal(''), z.iso.date()]).default('');
export const profileSchema = z.object({
  personType: z.enum(['PERSON','COMPANY']).default('PERSON'),
  fullName: z.string().trim().min(2).max(120),
  givenNames: short, paternalSurname: short, maternalSurname: short,
  email: z.union([z.literal(''), z.email().max(254)]).default(''),
  phone: z.string().trim().max(16).refine(v => !v || /^\+?[1-9]\d{7,14}$/.test(v), 'Usa teléfono internacional, solo dígitos y +.').default(''),
  taxId: z.string().trim().toUpperCase().max(13).refine(v => !v || /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(v), 'Revisa el RFC.').default(''),
  birthDate: date, occupation: short,
  street: short, exterior: z.string().trim().max(30).default(''), interior: z.string().trim().max(30).default(''),
  postalCode: z.string().trim().regex(/^(\d{5})?$/).default(''), colony: short, city: short, state: short,
  country: z.string().trim().max(60).default('México'),
  interests: z.array(z.enum(['MEDICAL','LIFE','AUTO'])).max(3).default([]),
  respondent: z.enum(['SELF','REPRESENTATIVE']).default('SELF'), representativeName: short, representativeRelation: short,
  vehicleBrand: z.string().trim().max(60).default(''), vehicleModel: z.string().trim().max(60).default(''),
  vehicleYear: z.union([z.literal(''),z.string().regex(/^\d{4}$/)]).default(''), plates: z.string().trim().max(20).default(''),
  privacyAccepted: z.literal(true), informationConfirmed: z.literal(true),
}).strict().superRefine((data,ctx) => {
  if(!data.email&&!data.phone)ctx.addIssue({code:'custom',path:['phone'],message:'Registra al menos un correo electrónico o teléfono de contacto.'});
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(data.birthDate && data.birthDate>today)ctx.addIssue({code:'custom',path:['birthDate'],message:'La fecha de nacimiento no puede ser futura.'});
  if(data.respondent==='REPRESENTATIVE' && (!data.representativeName || !data.representativeRelation))ctx.addIssue({code:'custom',path:['representativeName'],message:'Indica quién captura y su relación con el cliente.'});
  if(data.personType==='COMPANY' && data.birthDate)ctx.addIssue({code:'custom',path:['birthDate'],message:'La fecha de nacimiento es solo para personas físicas.'});
});
export type IntakeProfile = z.infer<typeof profileSchema>;
export const submissionSchema = z.object({expectedRevision:z.number().int().nonnegative(), answers:profileSchema}).strict();
export const approvalSchema = z.object({expectedRevision:z.number().int().positive(), expectedClientUpdatedAt:z.iso.datetime({offset:true}),fields:z.array(z.enum(['name','email','phone','taxId'])).max(4),reviewed:z.literal(true)}).strict();
export const agentProfileSchema = z.object({cliente_id:z.string().min(1).max(100),expectedRevision:z.number().int().nonnegative(),nombre:z.string().trim().min(2).max(120),correo:z.email().max(254).optional(),telefono:z.string().regex(/^\+?[1-9]\d{7,14}$/).optional()}).strict();
