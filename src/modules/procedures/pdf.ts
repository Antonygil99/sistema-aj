import { createHash } from 'node:crypto';
import { PDFDocument, PDFTextField, PDFCheckBox, StandardFonts, rgb } from 'pdf-lib';
import { changeDetail, requiredAttachments, attachmentLabels, reviewIssues, template, type ProcedureData, type AttachmentKind } from './schema';

export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
// Mapped by visual inspection of both pages and the 47 canonical fields of this exact template hash.
// Numeric boxes 3/4 are respectively address/RFC. Box 12 is email consent: never infer it.
export async function buildProcedurePdf(bytes: Uint8Array, input: { data: ProcedureData; policyNumber: string; revision: number; missing: AttachmentKind[] }) {
  if(sha256(bytes)!==template.hash)throw new Error('PROCEDURE_TEMPLATE_CHANGED');
  if(reviewIssues(input.data).length)throw new Error('PROCEDURE_REVIEW_INCOMPLETE');
  const pdf=await PDFDocument.load(bytes), form=pdf.getForm(), font=await pdf.embedFont(StandardFonts.Helvetica);
  if(pdf.getPageCount()!==2 || form.getFields().length!==47)throw new Error('PROCEDURE_TEMPLATE_CHANGED');
  for(const field of form.getFields()) {
    if(field instanceof PDFTextField)field.setText('');
    if(field instanceof PDFCheckBox)field.uncheck();
  }
  const fill=(name:string,value:string,comb?:number)=>{
    const field=form.getTextField(name),rect=field.acroField.getWidgets()[0].getRectangle();
    try{font.encodeText(value);}catch{throw new Error('PROCEDURE_PDF_CHARACTERS');}
    let size=10;
    if(comb){field.setMaxLength(comb);field.enableCombing();}
    else while(size>=7&&font.widthOfTextAtSize(value,size)>rect.width-5)size-=0.25;
    if(size<7)throw new Error('PROCEDURE_PDF_OVERFLOW');
    field.setFontSize(size);field.setText(value);
  };
  const d=input.data;
  fill('Lugar y fecha',`${d.place}, ${d.date.split('-').reverse().join('/')}`);
  fill('Número de póliza',input.policyNumber);
  fill('Registro Federal de Contribuyentes',d.taxId.slice(0,10),10);fill('undefined',d.taxId.slice(10),3);
  fill('Apellido paterno',d.paternalSurname);fill('Apellido materno',d.maternalSurname);fill('Nombres',d.givenNames);fill('Teléfono',d.phone);
  if(d.email){const [local,domain]=d.email.split('@');fill('MAIL1',local);fill('MAIL2',domain);}
  form.getCheckBox(d.change==='ADDRESS'?'3':'4').check();
  // Fit each line before inserting a multiline field. Never silently truncate a requested change.
  const detail=form.getTextField('anexar'), width=detail.acroField.getWidgets()[0].getRectangle().width-12, words=changeDetail(d).split(' '), lines:string[]=[];let line='';
  for(const word of words){if(font.widthOfTextAtSize(word,10)>width)throw new Error('PROCEDURE_PDF_OVERFLOW');const next=line?line+' '+word:word;if(font.widthOfTextAtSize(next,10)>width){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);
  if(lines.length>6)throw new Error('PROCEDURE_PDF_OVERFLOW');
  detail.enableMultiline();detail.setFontSize(10);detail.setText(lines.join('\n'));
  const [year,month,day]=d.requestedDate.split('-');fill('de',day);fill('del',month);fill('Todas las  condiciones de',year);
  fill('Correo electrónico del Asegurado yo del Contratante',d.email);
  form.updateFieldAppearances(font);
  const cover=pdf.insertPage(0,[612,792]);
  cover.drawRectangle({x:0,y:734,width:612,height:58,color:rgb(.12,.19,.15)});
  cover.drawText('Sistema AJ | BORRADOR PARA REVISION',{x:35,y:755,size:17,font,color:rgb(1,1,1)});
  const notes=[`Solicitud administrativa GMM - revision ${input.revision}`,`Plantilla: ${template.code}`,`Poliza: ${input.policyNumber}`,'','Las siguientes dos paginas conservan el formato original de la aseguradora.','Solo se han prellenado datos administrativos revisados por el asesor.','El contratante y asegurado deben revisar y firmar donde corresponda.','Las autorizaciones y firmas no han sido aceptadas por el CRM.','La fecha solicitada no confirma aceptacion ni modifica la poliza.','','Pendientes antes de presentar:',...input.missing.map(k=>'- '+attachmentLabels[k]),'- Solicitud revisada y firmada por quienes corresponda.','- Confirmar los anexos, version y canal aplicables con la aseguradora.','','Este archivo no demuestra presentacion, cobertura o endoso aprobado.'];
  let y=700;for(const note of notes){try{font.encodeText(note);}catch{throw new Error('PROCEDURE_PDF_CHARACTERS');}if(font.widthOfTextAtSize(note,10)>540)throw new Error('PROCEDURE_PDF_OVERFLOW');cover.drawText(note,{x:35,y,size:10,font,color:rgb(.13,.18,.15)});y-=22;}
  cover.drawText('Integridad plantilla: '+template.hash.slice(0,24)+'...',{x:35,y:55,size:9,font});
  pdf.setTitle('Borrador administrativo GMM - Sistema AJ');pdf.setAuthor('Sistema AJ');pdf.setSubject('Solicitud pendiente de firma y presentacion');
  return pdf.save();
}
export function missingForExport(data: ProcedureData, kinds: string[]): AttachmentKind[] { return requiredAttachments(data.change).filter(kind=>!kinds.includes(kind)); }
