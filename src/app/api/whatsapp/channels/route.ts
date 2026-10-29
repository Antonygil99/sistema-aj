import {authenticate,apiError} from '@/lib/api';
import {getDb} from '@/lib/db';
import {saveChannel,channelCredentials} from '@/modules/whatsapp/channels';
export async function GET(request:Request){
  const auth=await authenticate(request,'SUPERADMIN');if(auth.denied)return auth.denied;
  try{const [rows,owners]=await Promise.all([getDb().whatsAppChannel.findMany({orderBy:{name:'asc'}}),getDb().accessGrant.findMany({where:{enabled:true,role:{in:['ADMIN','SUPERADMIN']}},select:{email:true}})]);
    return Response.json({rows:rows.map(c=>({...c,configured:Boolean(channelCredentials(c))})),owners},{headers:{'Cache-Control':'private, no-store'}});
  }catch(e){return apiError(e);}
}
export async function POST(request:Request){const auth=await authenticate(request,'SUPERADMIN');if(auth.denied)return auth.denied;try{return Response.json(await saveChannel(auth.actor,await request.json()));}catch(e){return apiError(e);}}
