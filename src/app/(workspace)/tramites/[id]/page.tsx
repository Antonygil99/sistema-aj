import { requireUser } from '@/lib/session';
import { clientProcedures, procedureAccess } from '@/modules/procedures/server';
import { ProcedureDetail, type ProcedureView } from '@/components/procedure-detail';
import { notFound } from 'next/navigation';
export default async function ProcedurePage({params}:{params:Promise<{id:string}>}){
 const actor=await requireUser('ADMIN');
 let row;try{row=await procedureAccess((await params).id,actor);}catch(error){if((error as {status?:number}).status===404)notFound();throw error;}
 const client=await clientProcedures(row.clientId,actor);
 return <ProcedureDetail initial={JSON.parse(JSON.stringify(row)) as ProcedureView} documents={client.documents}/>;
}
