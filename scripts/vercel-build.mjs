import {spawnSync} from 'node:child_process';

// Production must receive additive schema changes before publishing a new client.
// Previews must never migrate a database shared with production.
const commands = process.env.VERCEL_ENV === 'production'
  ? [['node_modules/prisma/build/index.js', 'migrate', 'deploy'], ['node_modules/prisma/build/index.js', 'generate'], ['node_modules/next/dist/bin/next', 'build']]
  : [['node_modules/prisma/build/index.js', 'generate'], ['node_modules/next/dist/bin/next', 'build']];
for (const args of commands) {
  const result = spawnSync(process.execPath, args, {stdio:'inherit', env:process.env});
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
