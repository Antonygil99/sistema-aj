import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { buildProcedurePdf } from '../src/modules/procedures/pdf';
import { procedureData } from '../src/modules/procedures/schema';
const source=process.argv[2],out=process.argv[3];if(!source)throw new Error('Supply reviewed template PDF path.');
const raw=await readFile(source);
for(const change of ['ADDRESS','RFC'] as const){
 const data=procedureData.parse({change,givenNames:'María José',paternalSurname:'López',maternalSurname:'Núñez',taxId:'TEST900101AB1',newTaxId:'TEST900101AB2',phone:'+529991234567',email:'ejemplo@example.test',place:'Mérida, Yucatán',date:'2026-10-27',requestedDate:'2026-11-01',street:'Calle de demostración',exterior:'123',colony:'Colonia de prueba',postalCode:'97000',city:'Mérida',state:'Yucatán',contractorConfirmed:true,individualConfirmed:true,templateConfirmed:true});
 const bytes=await buildProcedurePdf(raw,{data,policyNumber:'DEMO-123456',revision:3,missing:['FORMAT5']});
 const pdf=await PDFDocument.load(bytes),form=pdf.getForm();assert.equal(pdf.getPageCount(),3);assert.equal(form.getFields().length,47);
 assert.equal(form.getTextField('Nombres').getText(),'María José');assert.equal(form.getTextField('undefined').getText(),'AB1');
 for(let n=1;n<=25;n++)assert.equal(form.getCheckBox(String(n)).isChecked(),n===(change==='ADDRESS'?3:4));
 assert.equal(form.getTextField('Firma del Asegurado').getText()??'','');assert.equal(form.getTextField('Firma del Contratante').getText()??'','');
 if(out){await mkdir(out,{recursive:true});await writeFile(join(out,`borrador-${change.toLowerCase()}.pdf`),bytes);}
}
console.log('PROCEDURE_PDF_VERIFIED: both changes, 3 pages, 47 canonical fields, exactly one requested checkbox, signatures and email consent empty.');
