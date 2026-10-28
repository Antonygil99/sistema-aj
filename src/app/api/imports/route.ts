import { z } from 'zod';
import { human } from '@/modules/mcp/human';
import { prepareBatch, requireImportActor } from '@/modules/imports/server';
import { readContactFile, mapContacts } from '@/modules/imports/files';
import { targetSchema, importFields, ImportError } from '@/modules/imports/rules';
import { importJson } from '@/modules/imports/http';
import { boundedFormData } from '@/modules/documentos/file-policy';
import { apiError } from '@/lib/api';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){
  try{
    const actor=await human(request);requireImportActor(actor);
    if(request.headers.get('content-type')?.startsWith('multipart/form-data;')){
      const form=await boundedFormData(request),file=form.get('file');if(!(file instanceof File))throw new ImportError('FILE_REQUIRED');
      const source=await readContactFile(file.name,new Uint8Array(await file.arrayBuffer()));
      const sheet=z.string().min(1).max(180).parse(form.get('sheet')),table=source.tables.find(t=>t.sheet===sheet);if(!table)throw new ImportError('IMPORT_SHEET_REQUIRED');
      const mapping=z.partialRecord(z.enum(importFields),z.number().int().min(0).max(59)).parse(JSON.parse(String(form.get('mapping')??'{}')));
      const countryCode=z.enum(['52']).optional().parse(form.get('countryCode')||undefined);
      const result=await prepareBatch(actor,{target:targetSchema.parse(form.get('target')),sourceName:source.sourceName,sourceKind:source.sourceKind,countryCode,rows:mapContacts(table,mapping)},{sourceSha256:source.sourceSha256});
      return Response.json(result,{status:201,headers:{'Cache-Control':'private, no-store'}});
    }
    return Response.json(await prepareBatch(actor,await importJson(request)),{status:201,headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return apiError(error);}
}
