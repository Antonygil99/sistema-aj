import 'server-only';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import type { Actor } from '@/lib/api';
import { recordEvent } from '@/modules/events';
export class ChannelError extends Error { constructor(public code:string,public status=404){super(code);} }
export const channelInput=z.object({id:z.string().max(100).optional(),expectedUpdatedAt:z.iso.datetime().optional(),name:z.string().trim().min(2).max(80),ownerEmail:z.email().transform(s=>s.toLowerCase()),phoneNumberId:z.string().trim().regex(/^\d{5,30}$/).nullable(),wabaId:z.string().trim().regex(/^\d{5,30}$/).nullable(),credentialSlot:z.enum(['ALE','JOEL','GENERAL']),enabled:z.boolean()}).strict();
export function channelCredentials(channel:{phoneNumberId:string|null;credentialSlot:string;enabled:boolean}) {
  const version=process.env.WHATSAPP_API_VERSION??'';
  const token=channel.credentialSlot==='GENERAL'?process.env.WHATSAPP_ACCESS_TOKEN:channel.credentialSlot==='ALE'?process.env.WHATSAPP_TOKEN_ALE:channel.credentialSlot==='JOEL'?process.env.WHATSAPP_TOKEN_JOEL:undefined;
  const matching=channel.credentialSlot!=='GENERAL'||channel.phoneNumberId===process.env.WHATSAPP_PHONE_NUMBER_ID;
  return channel.enabled&&matching&&channel.phoneNumberId&&token?.trim()&&/^v\d+\.0$/.test(version)?{phoneNumberId:channel.phoneNumberId,token:token.trim(),version}:null;
}
export async function ownChannels(actor:Actor){
  if(!actor.id||!actor.email)return [];
  return getDb().whatsAppChannel.findMany({where:{ownerEmail:actor.email.toLowerCase(),enabled:true},orderBy:{name:'asc'}});
}
export async function conversationScope(actor:Actor){
  return {phoneNumberId:{in:(await ownChannels(actor)).flatMap(c=>c.phoneNumberId?[c.phoneNumberId]:[])}};
}
export async function ownConversation(id:string,actor:Actor){
  const conversation=await getDb().whatsAppConversation.findFirst({where:{id,...await conversationScope(actor)}});
  if(!conversation)throw new ChannelError('WA_NOT_FOUND');
  return conversation;
}
export async function ownChannel(actor:Actor,phoneNumberId?:string){
  const channels=await ownChannels(actor);
  const channel=phoneNumberId?channels.find(c=>c.phoneNumberId===phoneNumberId):channels.find(c=>!!c.phoneNumberId);
  if(!channel)throw new ChannelError('WA_SEND_NOT_CONFIGURED',503);
  return channel;
}
export async function saveChannel(actor:Actor,input:unknown){
  if(actor.role!=='SUPERADMIN'||!actor.id)throw new ChannelError('FORBIDDEN',403);
  const {id,expectedUpdatedAt,...data}=channelInput.parse(input),db=getDb();
  const owner=await db.accessGrant.findUnique({where:{email:data.ownerEmail}});
  if(!owner?.enabled||!['ADMIN','SUPERADMIN'].includes(owner.role))throw new ChannelError('INVALID_CHANNEL_OWNER',422);
  const saved=await db.$transaction(async tx=>{
    if(id){
      if(!expectedUpdatedAt)throw new ChannelError('RECORD_CHANGED',409);
      const result=await tx.whatsAppChannel.updateMany({where:{id,updatedAt:new Date(expectedUpdatedAt)},data});
      if(!result.count)throw new ChannelError('RECORD_CHANGED',409);
      return tx.whatsAppChannel.findUniqueOrThrow({where:{id}});
    }
    return tx.whatsAppChannel.create({data});
  });
  await recordEvent(actor,id?'updated':'created','canales-whatsapp',saved.id,'Configuración de canal empresarial');
  return {...saved,configured:Boolean(channelCredentials(saved))};
}
