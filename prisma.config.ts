import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { migrationUrl } from './scripts/migration-url.mjs';
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: migrationUrl(process.env) ?? 'postgresql://aj:aj_local_only@localhost:5432/sistema_aj' },
});
