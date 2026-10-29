import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import {PDFDocument} from 'pdf-lib';
import {getDb} from '@/lib/db';
import type {Actor} from '@/lib/api';
import {getPreferences} from '@/modules/preferences-server';
import {assistantModels} from '@/modules/preferences';
import {ResourceError} from '@/modules/resources/rules';
import {validateFile} from '@/modules/documentos/file-policy';
import {extractedPolicySchema,extractionPrompt} from './extraction';
import {z} from 'zod';
export async function extractPolicy(file:File,actor:Actor){
  if(!actor.id||actor.role==='USER')throw new ResourceError('FORBIDDEN',403);
  if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type))throw new ResourceError('FILE_TYPE_INVALID',415);
  const bytes=new Uint8Array(await file.arrayBuffer());validateFile(file.name,file.type,bytes);
  if(file.type==='application/pdf'){
    let pages:number;try{pages=(await PDFDocument.load(bytes)).getPageCount();}catch{throw new ResourceError('POLICY_PDF_UNREADABLE',422);}
    if(pages<1||pages>10)throw new ResourceError('POLICY_PDF_PAGE_LIMIT',422);
  }
  const preferences=await getPreferences(actor.email??''),model=preferences.assistantModel;
  const provider=assistantModels.find(m=>m.id===model)!.provider;
  if(!(provider==='anthropic'?process.env.ANTHROPIC_API_KEY:process.env.OPENAI_API_KEY)?.trim())throw new ResourceError('AI_NOT_CONFIGURED',503);
  const now=BigInt(Date.now()),cutoff=now-3600000n,key='policy-extract:'+actor.id;
  const rows=await getDb().$queryRaw<{count:number}[]>`INSERT INTO "AuthRateLimit" (id,key,count,"lastRequest") VALUES (${key},${key},1,${now}) ON CONFLICT (key) DO UPDATE SET count=CASE WHEN "AuthRateLimit"."lastRequest"<${cutoff} THEN 1 ELSE "AuthRateLimit".count+1 END,"lastRequest"=CASE WHEN "AuthRateLimit"."lastRequest"<${cutoff} THEN ${now} ELSE "AuthRateLimit"."lastRequest" END RETURNING count`;
  if(rows[0].count>10)throw new ResourceError('AI_RATE_LIMITED',429);
  const base64=Buffer.from(bytes).toString('base64'),jsonSchema=z.toJSONSchema(extractedPolicySchema),signal=AbortSignal.timeout(45000);
  try{
    let result:unknown;
    if(provider==='anthropic'){
      const client=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY,maxRetries:0});
      const document=file.type==='application/pdf'?{type:'document' as const,source:{type:'base64' as const,media_type:'application/pdf' as const,data:base64}}:{type:'image' as const,source:{type:'base64' as const,media_type:file.type as 'image/png'|'image/jpeg'|'image/webp',data:base64}};
      const response=await client.messages.create({model,max_tokens:2200,system:extractionPrompt,tools:[{name:'extract_policy',description:'Datos administrativos con evidencia; no modifica registros.',input_schema:jsonSchema as Anthropic.Tool.InputSchema}],tool_choice:{type:'tool',name:'extract_policy'},messages:[{role:'user',content:[document,{type:'text',text:'Extrae la carátula usando extract_policy.'}]}]},{signal});
      const call=response.content.find(c=>c.type==='tool_use');if(call?.type!=='tool_use'||response.stop_reason==='max_tokens')throw new Error('INCOMPLETE');result=call.input;
    }else{
      const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0});
      const document=file.type==='application/pdf'?{type:'input_file' as const,filename:'caratula.pdf',file_data:`data:application/pdf;base64,${base64}`}:{type:'input_image' as const,image_url:`data:${file.type};base64,${base64}`,detail:'high' as const};
      const response=await client.responses.create({model,store:false,max_output_tokens:2600,instructions:extractionPrompt,input:[{role:'user',content:[document,{type:'input_text',text:'Extrae la carátula con el esquema indicado.'}]}],text:{format:{type:'json_schema',name:'caratula',strict:true,schema:jsonSchema}}},{signal});
      if(response.status!=='completed')throw new Error('INCOMPLETE');result=JSON.parse(response.output_text);
    }
    const data=extractedPolicySchema.parse(result);
    return {data,source:{name:file.name,model,provider},saved:false};
  }catch{throw new ResourceError('POLICY_EXTRACTION_UNAVAILABLE',502);}
}
