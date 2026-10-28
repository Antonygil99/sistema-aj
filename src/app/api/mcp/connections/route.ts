import { z } from 'zod';
import { apiError } from '@/lib/api';
import { human } from '@/modules/mcp/human';
import { revokeConnection } from '@/modules/mcp/actor';
import { recordEvent } from '@/modules/events';
export async function POST(request:Request) {
  try {const user=await human(request);const {clientId}=z.object({clientId:z.string().min(1).max(2048)}).strict().parse(await request.json());await revokeConnection(user.id,clientId);await recordEvent(user,'access_changed','conexiones',clientId,'Conexión MCP revocada');return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}
}
