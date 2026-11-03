import {test} from 'node:test';import assert from 'node:assert/strict';import {folderFromUrl,driveLink} from '../src/modules/drive/rules';import {driveGoogle} from '../src/modules/drive/google';
test('Drive URLs restrict host, folders, keys and generated destinations',()=>{
 assert.deepEqual(folderFromUrl('https://drive.google.com/drive/folders/fixture-root?resourcekey=fixture-key'),{folderId:'fixture-root',resourceKey:'fixture-key'});
 for(const u of ['https://evil.invalid/drive/folders/fixture-root','http://drive.google.com/drive/folders/fixture-root','https://user:pass@drive.google.com/drive/folders/fixture-root','https://drive.google.com/file/d/fixture-root/view'])assert.throws(()=>folderFromUrl(u));
 assert.equal(new URL(driveLink('fixture-file','fixture-key')).host,'drive.google.com');
});
test('Drive only reads metadata, checks ancestors and rejects shortcuts, trash and foreign trees',async()=>{
 const records:Record<string,unknown>={'root-123':{id:'root-123',name:'Root',mimeType:'application/vnd.google-apps.folder'},'inside-123':{id:'inside-123',name:'Carátula',mimeType:'application/pdf',parents:['root-123']},'outside-123':{id:'outside-123',name:'Other',mimeType:'application/pdf',parents:['foreign-123']},'foreign-123':{id:'foreign-123',name:'Other root',mimeType:'application/vnd.google-apps.folder'},'shortcut-123':{id:'shortcut-123',name:'Shortcut',mimeType:'application/vnd.google-apps.shortcut',parents:['root-123']},'trash-123':{id:'trash-123',name:'Trash',mimeType:'application/pdf',parents:['root-123'],trashed:true}};
 const fetcher:typeof fetch=async(input,init)=>{const u=new URL(String(input));assert.equal(u.origin,'https://www.googleapis.com');assert.equal(init?.method,undefined);assert.equal(u.searchParams.has('alt'),false);assert.equal(new Headers(init?.headers).get('X-Goog-Drive-Resource-Keys'),'root-123/root-key');const id=u.pathname.split('/').at(-1)!;return Response.json(records[id]);};
 const api=driveGoogle('fixture-token',{folderId:'root-123',resourceKey:'root-key'},fetcher);
 assert.equal((await api.withinRoot('inside-123')).id,'inside-123');
 for(const id of ['outside-123','shortcut-123','trash-123'])await assert.rejects(api.withinRoot(id),{code:'DRIVE_OUTSIDE_FOLDER'});
});

test('Drive thumbnails validate trusted image origin before sending credentials',async()=>{
 for(const target of ['https://lh3.googleusercontent.com/thumbnail','https://evil.invalid/steal','https://googleusercontent.com.evil.invalid/steal']){
  const calls:string[]=[];
  const fetcher:typeof fetch=async(input,init)=>{const u=new URL(String(input));calls.push(u.hostname);if(u.hostname==='www.googleapis.com'){const id=u.pathname.split('/').at(-1);return Response.json(id==='root-123'?{id,name:'Root',mimeType:'application/vnd.google-apps.folder'}:{id,name:'Proof',mimeType:'image/png',parents:['root-123'],thumbnailLink:target});}assert.equal(init?.redirect,'error');return new Response(new Uint8Array([1,2]),{headers:{'Content-Type':'image/png'}});};
  const api=driveGoogle('fixture-token',{folderId:'root-123',resourceKey:null},fetcher);
  if(target.includes('lh3.googleusercontent.com'))assert.equal((await api.thumbnail('proof-123')).type,'image/png');else{await assert.rejects(api.thumbnail('proof-123'),{code:'DRIVE_UNAVAILABLE'});assert.deepEqual(calls,['www.googleapis.com','www.googleapis.com']);}
 }
});
