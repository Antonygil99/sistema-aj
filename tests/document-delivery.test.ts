import {test} from 'node:test';import assert from 'node:assert/strict';import {deliveryInput,deliverableWhere} from '../src/modules/documentos/delivery';
test('external delivery requires explicit review; internal files and filenames never grant delivery',()=>{
 const base={expectedUpdatedAt:'2026-10-29T12:00:00.000Z',deliveryKind:'POLICY_COVER',reviewed:false};
 assert.equal(deliveryInput.safeParse(base).success,false);assert.equal(deliveryInput.safeParse({...base,reviewed:true}).success,true);
 assert.equal(deliveryInput.safeParse({...base,deliveryKind:'MEDICAL',reviewed:true}).success,false);
 assert.equal(deliveryInput.safeParse({...base,deliveryKind:'INTERNAL'}).success,true);
 const where=deliverableWhere('owner');assert.equal(where.policy.clientId,'owner');assert.equal(where.deliveryReviewed,true);assert.equal(where.claimId,null);
});
