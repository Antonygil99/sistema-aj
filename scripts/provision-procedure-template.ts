import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { getDb } from '../src/lib/db';
import { template } from '../src/modules/procedures/schema';
import { sha256 } from '../src/modules/procedures/pdf';
const source=process.argv[2];if(!source)throw new Error('Specify the reviewed MetLife GMM source PDF path.');
const bytes=await readFile(source);if(sha256(bytes)!==template.hash)throw new Error('TEMPLATE_HASH_MISMATCH');
const db=getDb();try{
 const row=await db.insuranceTemplate.upsert({where:{id:template.id},create:{id:template.id,code:template.code,sha256:template.hash,pdfBytes:bytes},update:{}});
 if(row.sha256!==template.hash||sha256(row.pdfBytes)!==template.hash)throw new Error('EXISTING_TEMPLATE_MISMATCH_REVIEW_REQUIRED');
 console.log('PROCEDURE_TEMPLATE_VERIFIED: pinned original stored privately; no customer data changed.');
}finally{await db.$disconnect();}
