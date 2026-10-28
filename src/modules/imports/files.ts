import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { zipSync } from 'fflate';
import readExcelFile from 'read-excel-file/node';
import { ImportError, MAX_IMPORT_ROWS, type ImportField, type ContactInput } from './rules';
const MAX_BYTES=4*1024*1024,MAX_EXPANDED=12*1024*1024;
export type ImportTable={sheet:string;headers:string[];rows:string[][];sourceRows:number[];suggested:Partial<Record<ImportField,number>>};
const headerKey=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases:Record<ImportField,string[]>={name:['name','nombre','nombrecompleto','cliente','asegurado','contratante','nombredelcliente','nombredelasegurado','razonsocial'],email:['email','correo','correoelectronico','mail'],phone:['phone','telefono','telefonocelular','celular','movil','whatsapp'],taxId:['taxid','rfc','rfccliente','rfccontratante'],source:['source','origen','fuente']};
export function tableFromRows(sheet:string,input:unknown[][]):ImportTable{
  let total=0;const rows=input.map((row,index)=>({number:index+1,values:row.map(value=>{const text=value===null||value===undefined?'':value instanceof Date?value.toISOString():String(value);total+=text.length;if(text.length>1000||total>250000)throw new ImportError('IMPORT_TABLE_TOO_LARGE',413);return text;})})).filter(row=>row.values.some(value=>value.trim()));
  if(rows.length<2)throw new ImportError('IMPORT_EMPTY');
  const first=rows.shift()!;if(first.values.length>60||rows.length>MAX_IMPORT_ROWS)throw new ImportError('IMPORT_ROW_LIMIT',413);
  const width=Math.max(first.values.length,...rows.map(row=>row.values.length));if(width>60)throw new ImportError('IMPORT_COLUMN_LIMIT',413);
  const headers=Array.from({length:width},(_,i)=>first.values[i]?.trim()||'Columna '+(i+1));
  const suggested:Partial<Record<ImportField,number>>={};
  for(const[field,names]of Object.entries(aliases)){const found=headers.findIndex(h=>names.includes(headerKey(h)));if(found>=0)suggested[field as ImportField]=found;}
  return {sheet,headers,rows:rows.map(row=>Array.from({length:width},(_,i)=>row.values[i]??'')),sourceRows:rows.map(row=>row.number),suggested};
}
export function parseCsv(text:string):string[][]{
  if(text.includes('\0'))throw new ImportError('IMPORT_FILE_INVALID');
  const delimiters=['\t',';',','],counts=new Map(delimiters.map(d=>[d,0]));let inHeaderQuote=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(inHeaderQuote&&text[i+1]==='"'){i++;continue;}inHeaderQuote=!inHeaderQuote;}else if(!inHeaderQuote){if(c==='\r'||c==='\n')break;if(counts.has(c))counts.set(c,counts.get(c)!+1);}}
  const delimiter=delimiters.sort((a,b)=>counts.get(b)!-counts.get(a)!)[0];
  const rows:string[][]=[];let row:string[]=[],value='',quoted=false,closed=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=c;}
    else if(c==='"'&&!value&&!closed)quoted=true;
    else if(c===delimiter){row.push(value);value='';closed=false;}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);rows.push(row);row=[];value='';closed=false;}
    else{if(closed&&c.trim())throw new ImportError('IMPORT_CSV_INVALID');if(!closed)value+=c;}
    if(value.length>1000||row.length>60||rows.length>MAX_IMPORT_ROWS+50)throw new ImportError('IMPORT_TABLE_TOO_LARGE',413);
  }
  if(quoted)throw new ImportError('IMPORT_CSV_INVALID');if(value||row.length){row.push(value);rows.push(row);}return rows;
}
// Rebuild a bounded ZIP from verified entries so the reader never sees hidden/local-only entries or ZIP64.
export function boundedWorkbook(input:Uint8Array){
  const body=Buffer.from(input);if(body.length<22||body.readUInt32LE(0)!==0x04034b50)throw new ImportError('IMPORT_XLSX_INVALID');
  let end=-1;for(let i=body.length-22;i>=Math.max(0,body.length-65557);i--)if(body.readUInt32LE(i)===0x06054b50){end=i;break;}
  if(end<0||body.readUInt16LE(end+4)||body.readUInt16LE(end+6))throw new ImportError('IMPORT_XLSX_INVALID');
  const count=body.readUInt16LE(end+10),offset=body.readUInt32LE(end+16);if(count>300||count===65535)throw new ImportError('IMPORT_XLSX_TOO_COMPLEX',413);
  const entries:Record<string,Uint8Array>=Object.create(null);let cursor=offset,total=0,hasFormulas=false;
  try{
    for(let i=0;i<count;i++){
      if(body.readUInt32LE(cursor)!==0x02014b50)throw Error();
      const flags=body.readUInt16LE(cursor+8),method=body.readUInt16LE(cursor+10),compressed=body.readUInt32LE(cursor+20),size=body.readUInt32LE(cursor+24),length=body.readUInt16LE(cursor+28),extra=body.readUInt16LE(cursor+30),comment=body.readUInt16LE(cursor+32),local=body.readUInt32LE(cursor+42),name=body.subarray(cursor+46,cursor+46+length).toString('utf8');
      total+=size;if(flags&1||![0,8].includes(method)||size>6*1024*1024||total>MAX_EXPANDED||size===0xffffffff||local===0xffffffff)throw new ImportError('IMPORT_XLSX_TOO_COMPLEX',413);
      if(name.includes('..')||name.includes('\\')||name.startsWith('/')||Object.hasOwn(entries,name))throw Error();
      if(body.readUInt32LE(local)!==0x04034b50)throw Error();
      const start=local+30+body.readUInt16LE(local+26)+body.readUInt16LE(local+28);if(start+compressed>body.length)throw Error();
      const bytes=method===0?body.subarray(start,start+compressed):inflateRawSync(body.subarray(start,start+compressed),{maxOutputLength:size+1});
      if(bytes.length!==size)throw Error();
      if(/\.xml$|\.rels$/i.test(name)){
        const xml=bytes.toString('utf8');if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error();
        if(/^xl\/worksheets\//.test(name)){
          let cells=0;
          for(const cell of xml.matchAll(/<(?:[\w.-]+:)?c\b([^>]*)>/g)){
            const ref=/\br\s*=\s*(["'])(.*?)\1/.exec(cell[1])?.[2],position=ref&&/^([A-Z]{1,3})([1-9]\d{0,3})$/.exec(ref);
            if(!position)throw new ImportError('IMPORT_XLSX_TOO_COMPLEX',413);
            let col=0;for(const letter of position[1])col=col*26+letter.charCodeAt(0)-64;
            if(col>100||+position[2]>2000||++cells>50000)throw new ImportError('IMPORT_XLSX_TOO_COMPLEX',413);
          }
          let rowCount=0;for(const row of xml.matchAll(/<(?:[\w.-]+:)?row\b([^>]*)>/g)){const ref=/\br\s*=\s*(["'])(.*?)\1/.exec(row[1])?.[2];if(++rowCount>2000||ref&&(!/^[1-9]\d{0,3}$/.test(ref)||Number(ref)>2000))throw new ImportError('IMPORT_XLSX_TOO_COMPLEX',413);}
          if(/<f[\s>]/.test(xml))hasFormulas=true;
        }
      }
      if(!name.endsWith('/'))entries[name]=bytes;
      cursor+=46+length+extra+comment;
    }
  }catch(error){if(error instanceof ImportError)throw error;throw new ImportError('IMPORT_XLSX_INVALID');}
  if(!entries['xl/workbook.xml']||!entries['[Content_Types].xml']||entries['xl/vbaProject.bin'])throw new ImportError('IMPORT_XLSX_INVALID');
  return {bytes:zipSync(entries,{level:0}),hasFormulas};
}
export async function readContactFile(name:string,bytes:Uint8Array){
  if(!bytes.length||bytes.length>MAX_BYTES)throw new ImportError('IMPORT_FILE_SIZE',413);
  const sourceName=name.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f]/g,'').slice(0,180),ext=sourceName.split('.').at(-1)?.toLowerCase();let tables:ImportTable[],warnings:string[]=[];
  if(ext==='csv'||ext==='tsv'){
    let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{text=new TextDecoder('windows-1252').decode(bytes);warnings=['Se leyó el archivo con codificación Windows. Revisa acentos y nombres.'];}
    tables=[tableFromRows('Datos',parseCsv(text.replace(/^\uFEFF/,'')))];
  }else if(ext==='xlsx'){
    const workbook=boundedWorkbook(bytes);if(workbook.hasFormulas)warnings.push('El archivo contiene fórmulas. Solo se leen sus valores guardados; revisa que estén actualizados.');
    try{const sheets=await readExcelFile(Buffer.from(workbook.bytes));if(sheets.length>20)throw new ImportError('IMPORT_SHEET_LIMIT',413);tables=sheets.filter(s=>s.data.length>1).map(s=>tableFromRows(s.sheet,s.data));}catch(error){if(error instanceof ImportError)throw error;throw new ImportError('IMPORT_XLSX_INVALID');}
  }else throw new ImportError('IMPORT_FILE_TYPE',415);
  if(!tables.length)throw new ImportError('IMPORT_EMPTY');
  return {sourceName,sourceKind:ext==='xlsx'?'EXCEL' as const:'CSV' as const,sourceSha256:createHash('sha256').update(bytes).digest('hex'),tables,warnings};
}
export function mapContacts(table:ImportTable,mapping:Partial<Record<ImportField,number>>):ContactInput[]{
  if(mapping.name===undefined)throw new ImportError('IMPORT_NAME_COLUMN_REQUIRED');
  const columns=Object.values(mapping);if(new Set(columns).size!==columns.length||columns.some(n=>n<0||n>=table.headers.length||!Number.isInteger(n)))throw new ImportError('IMPORT_MAPPING_INVALID');
  return table.rows.map((row,index)=>({...Object.fromEntries(Object.entries(mapping).map(([field,col])=>[field,row[col!]])),sourceRef:table.sheet+' · fila '+table.sourceRows[index]}));
}
