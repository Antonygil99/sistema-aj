export function proposalState(status:string,expiresAt:Date,now=new Date()){
 const state=status==='PENDING'&&expiresAt<=now?'EXPIRED':status;
 const messages:Record<string,string>={PENDING:'Pendiente de tu revisión. Todavía no se guardaron cambios en el registro. Abre la propuesta y confirma para aplicarla.',APPLIED:'Cambio aplicado en el CRM. Abre el registro para verificar el resultado.',CANCELLED:'Propuesta cancelada. No se aplicaron sus cambios.',EXPIRED:'La propuesta venció sin aplicarse. Pide una propuesta nueva con los datos actuales.'};
 return {status:state,summary:messages[state]??'Consulta el estado de la propuesta en el CRM.',saved:state==='APPLIED',nextAction:state==='PENDING'?'REVIEW':state==='APPLIED'?'VERIFY_RECORD':'NEW_PROPOSAL'};
}
