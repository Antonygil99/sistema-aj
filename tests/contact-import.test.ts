import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { normalizeContact, matchRows, csvCell, prepareImportSchema, type Candidate } from '../src/modules/imports/rules';
import { parseCsv, tableFromRows, mapContacts, readContactFile, boundedWorkbook } from '../src/modules/imports/files';
const candidate=(id:string,data:Candidate['data'],allowNameMatch=false):Candidate=>({id,rowNumber:Number(id)||1,data,issues:[],warnings:[],allowNameMatch,sourceRef:null,resultId:null,status:'PENDING'});
test('contact imports normalize explicit international contacts and require a country decision for local phones',()=>{
  const row=normalizeContact({name:'  María   Pérez ',email:' TEST@EXAMPLE.INVALID ',phone:'999-111-2233',taxId:' xaxx010101000 '},'clientes','52');
  assert.deepEqual(row.data,{name:'María Pérez',email:'test@example.invalid',phone:'+529991112233',taxId:'XAXX010101000'});assert.deepEqual(row.issues,[]);
  assert.ok(normalizeContact({name:'Test',phone:'9991112233'},'prospectos').issues.some(i=>i.includes('país')));
  assert.equal(normalizeContact({name:'Test',phone:'+5219991112233'},'prospectos').data.phone,'+529991112233');
  assert.ok(normalizeContact({name:'Test',phone:'+52abc9991112233'},'prospectos').issues.length);
  assert.ok(normalizeContact({name:'',email:'wrong',taxId:'invalid'},'clientes').issues.length>=3);
  assert.equal(prepareImportSchema.safeParse({target:'clientes',sourceName:'file',rows:[{name:'Test',bankAccount:'hidden'}]}).success,false);
  assert.equal(prepareImportSchema.safeParse({target:'clientes',sourceName:'file',rows:Array.from({length:501},()=>({name:'x'}))}).success,false);
});
test('contact matching includes archived records, cross-module contacts, batch duplicates and explicit homonym review',()=>{
  const existing=[{id:'client',module:'clientes' as const,name:'MARIA PEREZ',email:'old@example.invalid',phone:'+5219991112233',taxId:null,archivedAt:new Date()}];
  const [phone]=matchRows([candidate('1',{name:'New name',phone:'+529991112233'},true)],existing);assert.equal(phone.state,'MATCH');assert.equal(phone.matches[0].archived,true);
  assert.equal(matchRows([candidate('1',{name:'María Pérez'})],existing)[0].state,'MATCH');
  assert.equal(matchRows([candidate('1',{name:'María Pérez'},true)],existing)[0].state,'NEW');
  const batch=matchRows([candidate('1',{name:'A',email:'repeat@example.invalid'}),candidate('2',{name:'B',email:'repeat@example.invalid'})],[]);assert.ok(batch.every(r=>r.state==='MATCH'));
  const error=matchRows([{...candidate('1',{name:'x'}),issues:['invalid']}],[])[0];assert.equal(error.state,'ERROR');
});
test('CSV parsing preserves quoted delimiters and multiline values; column mapping excludes unused data',()=>{
  assert.deepEqual(parseCsv('"Nombre, apellido, completo";Correo\nAna;ana@example.invalid')[1],['Ana','ana@example.invalid']);
  const rows=parseCsv('Nombre;Correo;Teléfono;Secreto\r\n"Pérez, Ana";a@example.invalid;"+529991112233";ignorar\r\n"Dos\nApellidos";;+529991112234;ignorar');
  assert.equal(rows[1][0],'Pérez, Ana');assert.equal(rows[2][0],'Dos\nApellidos');
  const table=tableFromRows('Datos',rows);assert.equal(table.suggested.name,0);
  const mapped=mapContacts(table,{name:0,email:1,phone:2});assert.ok(!JSON.stringify(mapped).includes('ignorar'));assert.equal(mapped[0].sourceRef,'Datos · fila 2');
  assert.throws(()=>mapContacts(table,{name:0,email:0}),{code:'IMPORT_MAPPING_INVALID'});
  assert.throws(()=>parseCsv('Nombre,Correo\n"Unclosed,x'),{code:'IMPORT_CSV_INVALID'});
  assert.equal(csvCell('=WEBSERVICE("https://x.invalid")'),'"\'=WEBSERVICE(""https://x.invalid"")"');
  assert.equal(csvCell('+529991112233'),'"\'+529991112233"');
});
const xml=(value:string)=>strToU8(value);
const workbook=(extra:Record<string,Uint8Array>={})=>zipSync({
  '[Content_Types].xml':xml('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
  'xl/workbook.xml':xml('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Clientes" sheetId="1" r:id="rId1"/></sheets></workbook>'),
  'xl/_rels/workbook.xml.rels':xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
  'xl/worksheets/sheet1.xml':xml('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Nombre</t></is></c><c r="B1" t="inlineStr"><is><t>Correo</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Contacto de prueba</t></is></c><c r="B2" t="inlineStr"><is><t>test@example.invalid</t></is></c></row></sheetData></worksheet>'),...extra,
},{level:6});
test('bounded XLSX reader reads a real workbook without macros, formulas evaluation or external entity expansion',async()=>{
  const result=await readContactFile('contacts.xlsx',workbook());assert.equal(result.tables[0].sheet,'Clientes');assert.equal(result.tables[0].rows[0][0],'Contacto de prueba');assert.match(result.sourceSha256,/^[a-f0-9]{64}$/);
  assert.throws(()=>boundedWorkbook(workbook({'xl/vbaProject.bin':new Uint8Array([1])})),{code:'IMPORT_XLSX_INVALID'});
  assert.throws(()=>boundedWorkbook(workbook({'xx.xml':xml('<!DOCTYPE x [<!ENTITY x "test">]><x/>')})),{code:'IMPORT_XLSX_INVALID'});
  assert.throws(()=>boundedWorkbook(workbook({'xl/worksheets/sheet2.xml':xml('<worksheet><c r="A1048576"/></worksheet>')})),{code:'IMPORT_XLSX_TOO_COMPLEX'});
  assert.throws(()=>boundedWorkbook(workbook({'xl/worksheets/sheet2.xml':xml("<worksheet><c r='A1048576'/></worksheet>")})),{code:'IMPORT_XLSX_TOO_COMPLEX'});
  assert.throws(()=>boundedWorkbook(workbook({'xl/worksheets/sheet2.xml':xml('<worksheet><row r="&#49;048576"/></worksheet>')})),{code:'IMPORT_XLSX_TOO_COMPLEX'});
  assert.throws(()=>boundedWorkbook(workbook({'large.xml':new Uint8Array(7*1024*1024)})),{code:'IMPORT_XLSX_TOO_COMPLEX'});
  await assert.rejects(readContactFile('source.pdf',new Uint8Array([1,2])),{code:'IMPORT_FILE_TYPE'});
});
