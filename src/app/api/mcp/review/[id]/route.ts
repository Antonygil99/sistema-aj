import { z } from 'zod';
import { apiError } from '@/lib/api';
import { getDb } from '@/lib/db';
import { human } from '@/modules/mcp/human';
import { liveProposalActor, applyProposal } from '@/modules/mcp/data';
import { boundedFormData, validateFile } from '@/modules/documentos/file-policy';
import { McpError } from '@/modules/mcp/policy';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const user=await human(request),{id}=await params;
    const proposal=await getDb().mcpChange.findFirst({where:{id,userId:user.id},select:{clientId:true}});
    if(!proposal)throw new McpError('PROPOSAL_NOT_FOUND',404);
    const actor=await liveProposalActor(user.id,proposal.clientId,user.role,user.name,user.email);
    let options:Parameters<typeof applyProposal>[2]={};
    if(request.headers.get('content-type')?.startsWith('multipart/form-data;')) {
      const form=await boundedFormData(request),file=form.get('file');
      if(!(file instanceof File))throw new McpError('FILE_REQUIRED');
      const body=new Uint8Array(await file.arrayBuffer());validateFile(file.name,file.type,body);
      options={file:{name:file.name,mimeType:file.type,body}};
    } else options=z.object({cancel:z.boolean().optional(),confirm:z.literal(true).optional()}).strict().refine(v=>v.cancel===true||v.confirm===true).parse(await request.json());
    return Response.json(await applyProposal(actor,id,options),{headers:{'Cache-Control':'no-store'}});
  }catch(error){return apiError(error);}
}
