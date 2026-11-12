import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextClaimStages,completedClaimStatuses,claimStatuses} from '../src/modules/siniestros/pipeline';
import {createSchema} from '../src/modules/siniestros/schema';
test('auto claims branch between repair and compensation and stop at completion',()=>{
 assert.deepEqual(nextClaimStages('TRANSITO','AUTO'),['TALLER','ASISTENCIA_VIAL']);
 assert.deepEqual(nextClaimStages('VALUACION_AUTORIZADA','AUTO'),['REFACCIONES','PAGO_DANOS']);
 assert.deepEqual(nextClaimStages('REFACCIONES','AUTO'),['REPARACION']);
 assert.deepEqual(nextClaimStages('REPARACION','AUTO'),['ENTREGADO']);
 assert.deepEqual(nextClaimStages('PAGO_DANOS','AUTO'),['DOCUMENTACION_DANOS']);
 assert.deepEqual(nextClaimStages('DOCUMENTACION_DANOS','AUTO'),['PAGADO']);
 for(const status of completedClaimStatuses)assert.deepEqual(nextClaimStages(status,'AUTO'),[]);
 for(const line of ['MEDICAL','LIFE',null])assert.deepEqual(nextClaimStages('OPEN',line),['IN_REVIEW']);
});
test('claims accept all workflow stages and reject unknown states',()=>{
 const base={reference:'TEST',policyId:'policy1',description:'Test',occurredAt:'2026-11-12T00:00:00.000Z'};
 for(const status of claimStatuses)assert.equal(createSchema.safeParse({...base,status}).success,true,status);
 assert.equal(createSchema.safeParse({...base,status:'UNRECOGNIZED'}).success,false);
});
