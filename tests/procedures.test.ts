import { test } from 'node:test';
import assert from 'node:assert/strict';
import { procedureData, reviewIssues, requiredAttachments, changeDetail, transitionProcedure } from '../src/modules/procedures/schema';

test('trámites aceptan solo datos administrativos y no confirman identidad por defecto',()=>{
 const data=procedureData.parse({change:'ADDRESS'});
 assert.equal(data.contractorConfirmed,false);assert.equal(data.individualConfirmed,false);assert.equal(data.templateConfirmed,false);
 assert.ok(reviewIssues(data).length>=6);
 for(const forbidden of ['diagnosis','bankAccount','signature','coverageDecision'])assert.equal(procedureData.safeParse({change:'RFC',[forbidden]:'x'}).success,false);
 assert.equal(procedureData.safeParse({change:'AUTO'}).success,false);
});
test('domicilio y RFC tienen anexos y detalles separados',()=>{
 assert.deepEqual(requiredAttachments('RFC'),['IDENTITY','FORMAT5']);
 assert.ok(requiredAttachments('ADDRESS').includes('ADDRESS_PROOF'));
 const rfc=procedureData.parse({change:'RFC',taxId:'TEST900101AB1',newTaxId:'TEST900101AB1'});
 assert.ok(reviewIssues(rfc).some(i=>i.includes('distinto')));
 assert.match(changeDetail({...rfc,newTaxId:'TEST900101AB2'}),/TEST900101AB2/);
 assert.equal(transitionProcedure.safeParse({expectedRevision:1,status:'SUBMITTED',confirmed:false}).success,false);
});
