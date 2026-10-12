import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
const globalDb = globalThis as unknown as { ajDb?: PrismaClient };
export function getDb() {
  // Accept the legacy Vercel variable without exposing or replacing its secret.
  const connectionString = process.env.DATABASE_URL || process.env.DATA_URL;
  if (!connectionString) throw new Error('DATABASE_NOT_CONFIGURED');
  if (!globalDb.ajDb) {
    globalDb.ajDb = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }
  return globalDb.ajDb;
}
