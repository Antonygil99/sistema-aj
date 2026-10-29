import {test} from 'node:test';import assert from 'node:assert/strict';
import {extractedPolicySchema,extractionToDraft} from '../src/modules/polizas/extraction';
test('carátulas: los identificadores son texto completo; moneda y fechas se validan sin inferir datos',()=>{
 const d={number:'000-3403/2026-09',insurer:'Ejemplo',product:null,clientName:null,premium:'12345.67',currency:'MXN',startDate:'2026-10-01',endDate:'2027-10-01',paymentFrequency:null,evidence:[],warnings:[]};
 assert.equal(extractedPolicySchema.parse(d).number,d.number);
 assert.equal(extractionToDraft(extractedPolicySchema.parse(d)).number,d.number);
 assert.equal(extractionToDraft(extractedPolicySchema.parse({...d,currency:null,premium:null})).currency,'');
 assert.equal(extractionToDraft(extractedPolicySchema.parse({...d,currency:null,premium:null})).premium,'');
 for(const patch of [{number:3403},{premium:12345.67},{currency:'PESOS'},{startDate:'01/02/26'},{unexpected:'sql'}])assert.equal(extractedPolicySchema.safeParse({...d,...patch}).success,false);
 assert.equal(extractedPolicySchema.parse({...d,currency:'UDI'}).currency,'UDI');
});
