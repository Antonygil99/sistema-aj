import { human } from '@/modules/mcp/human';
import { requireImportActor } from '@/modules/imports/server';
import { readContactFile } from '@/modules/imports/files';
import { boundedFormData } from '@/modules/documentos/file-policy';
import { apiError } from '@/lib/api';
import { ImportError } from '@/modules/imports/rules';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){try{const actor=await human(request);requireImportActor(actor);const form=await boundedFormData(request),file=form.get('file');if(!(file instanceof File))throw new ImportError('FILE_REQUIRED');return Response.json(await readContactFile(file.name,new Uint8Array(await file.arrayBuffer())),{headers:{'Cache-Control':'private, no-store'}});}catch(error){return apiError(error);}}
