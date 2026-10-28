import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { getBatch } from '@/modules/imports/server';
import { ImportReview } from '@/components/imports/import-review';
import '../../conexiones/connections.css';
import '../imports.css';
export default async function ReviewImport({params}:{params:Promise<{id:string}>}){const user=await requireUser('ADMIN');let data;try{data=await getBatch(user,(await params).id);}catch{notFound();}return <ImportReview initial={data}/>;}
