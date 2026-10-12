import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
if (!process.env.DATABASE_URL) throw new Error('Configurar DATABASE_URL');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  await db.$transaction(async tx => {
    await tx.client.upsert({ where: { id: 'demo-client-aj' }, update: {}, create: { id: 'demo-client-aj', name: 'Cliente de ejemplo AJ', email: 'demo@example.com' } });
    await tx.prospect.upsert({ where: { id: 'demo-prospect-aj' }, update: {}, create: { id: 'demo-prospect-aj', name: 'Prospecto de ejemplo', source: 'demo' } });
    await tx.policy.upsert({ where: { number: 'DEMO-AJ-001' }, update: {}, create: { number: 'DEMO-AJ-001', clientId: 'demo-client-aj', insurer: 'Aseguradora de ejemplo', product: 'Auto demo', premium: '12500.00', startDate: new Date('2026-01-01T00:00:00Z'), endDate: new Date('2027-01-01T00:00:00Z') } });
  });
  console.log('Datos de demostración creados. No se modificaron registros existentes.');
} finally { await db.$disconnect(); }
