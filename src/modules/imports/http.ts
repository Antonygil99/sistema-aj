import { ImportError } from './rules';
export async function importJson(request:Request){
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ImportError('INVALID_INPUT',415);
  if(!request.body)throw new ImportError('INVALID_INPUT');
  const reader=request.body.getReader(),parts:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>350000){await reader.cancel();throw new ImportError('IMPORT_TABLE_TOO_LARGE',413);}parts.push(value);}}finally{reader.releaseLock();}
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
