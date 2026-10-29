import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resourceLinkSchema} from '../src/modules/resource-links/rules';
test('recursos: HTTPS sin credenciales y publicación solo con revisión expresa',()=>{
 const r={title:'Portal',description:'',category:'PAYMENT',insurer:'',url:'https://example.invalid/pagos',audience:'INTERNAL',active:true,publicReviewed:false};
 assert.equal(resourceLinkSchema.safeParse(r).success,true);
 for(const url of ['javascript:alert(1)','http://example.invalid','https://user:secret@example.invalid'])assert.equal(resourceLinkSchema.safeParse({...r,url}).success,false);
 assert.equal(resourceLinkSchema.safeParse({...r,audience:'PUBLIC'}).success,false);
 assert.equal(resourceLinkSchema.safeParse({...r,audience:'PUBLIC',publicReviewed:true}).success,true);
});
