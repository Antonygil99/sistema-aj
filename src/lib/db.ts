import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
const globalDb = globalThis as unknown as { ajDb?: PrismaClient };
export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_NOT_CONFIGURED');
  if (!globalDb.ajDb) {
    globalDb.ajDb = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  }
  return globalDb.ajDb;
}
