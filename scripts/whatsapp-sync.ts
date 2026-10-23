import 'dotenv/config';
import { syncWhatsAppEvents } from '../src/modules/whatsapp/server';
import { getDb } from '../src/lib/db';
// Run with: node --conditions=react-server --import tsx scripts/whatsapp-sync.ts
// Idempotent projection only; no message is sent and no AI service is called.
try {
  let count = 0, more = true;
  while (more && count < 10000) { const result = await syncWhatsAppEvents(); count += result.processed; more = result.more; }
  console.log(JSON.stringify({ processedEvents: count, morePending: more }));
} catch { console.error('WHATSAPP_SYNC_FAILED'); process.exitCode = 1; }
finally { await getDb().$disconnect(); }
