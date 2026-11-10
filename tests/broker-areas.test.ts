import {test} from 'node:test';
import assert from 'node:assert/strict';
import {actorLines,areaWhere,businessLines,canOperateLine,defaultLine,scopedWhere} from '../src/modules/areas/policy';
import {createSchema} from '../src/modules/prospectos/schema';
import {applyProspectRules,diagnosisProgress,nextStage} from '../src/modules/prospectos/pipeline';
import {formToBody,resources,rowToForm,type Row} from '../src/modules/resources/config';
const joel={role:'ADMIN',email:'auto@example.invalid',productLines:['AUTO']};
const ale={role:'ADMIN',email:'vida@example.invalid',productLines:['MEDICAL','LIFE']};
test('shared areas permit referrals in both directions and keep each broker preferred line',()=>{
 const sharedJoel={...joel,productLines:['AUTO','HOME','OTHER','MEDICAL','LIFE','ACCIDENT','TRAVEL']};
 const sharedAle={...ale,productLines:['MEDICAL','LIFE','ACCIDENT','AUTO','HOME','TRAVEL','OTHER']};
 assert.equal(defaultLine(sharedJoel),'AUTO');assert.equal(defaultLine(sharedAle),'MEDICAL');
 for(const line of businessLines){assert.equal(canOperateLine(sharedJoel,line),true);assert.equal(canOperateLine(sharedAle,line),true);}
 assert.equal(canOperateLine({...joel,productLines:['NOT_A_LINE']},'AUTO'),false);
});
test('areas restrict operations but share catalog and basic contact records',()=>{
 assert.equal(defaultLine(joel),'AUTO');assert.equal(defaultLine(ale),'MEDICAL');
 assert.equal(canOperateLine(joel,'MEDICAL'),false);assert.equal(canOperateLine(ale,'AUTO'),false);
 assert.equal(canOperateLine(ale,'LIFE'),true);assert.equal(canOperateLine(joel,null),false);
 assert.deepEqual(areaWhere('clientes',joel),{});assert.deepEqual(areaWhere('productos',joel),{});
 assert.deepEqual(areaWhere('pagos',joel),{policy:{line:{in:['AUTO']}}});
 assert.deepEqual(actorLines({role:'ADMIN',email:'new@example.invalid'}),[],'unconfigured access fails closed');
 assert.equal(canOperateLine({role:'SUPERADMIN',email:'root@example.invalid'},null),true);
 assert.deepEqual(scopedWhere('polizas',{OR:[{number:'1'},{number:'2'}]},joel),{AND:[{OR:[{number:'1'},{number:'2'}]},{line:{in:['AUTO']}}]});
});
test('Auto prospect keeps separate periodicity and method; medical answers never advance it',()=>{
 const row=createSchema.parse({name:'Persona',line:'AUTO',sex:'MASCULINO',age:'0',postalCode:'01000',vehicle:'Sedán 2024',paymentFrequency:'MONTHLY',paymentMethod:'TRANSFERENCIA'});
 assert.equal(row.age,0);assert.equal(row.postalCode,'01000');assert.equal(diagnosisProgress(row),6);
 assert.equal(applyProspectRules(row).status,'CURIOSO');
 assert.equal(applyProspectRules({...row,diagProtect:'No corresponde a Autos'}).diagProtect,null);
 for(const age of ['',true,-1,121,1.5])assert.equal(createSchema.safeParse({...row,age}).success,false);
 assert.equal(createSchema.safeParse({...row,postalCode:'1000'}).success,false);
});
test('full form round trip preserves linked client, zero age and payment fields',()=>{
 const row={id:'p',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',name:'Persona',line:'AUTO',clientId:'existing',age:0,postalCode:'01000',paymentFrequency:'ANNUAL',paymentMethod:'TARJETA',status:'CURIOSO'} as Row;
 const body=formToBody(resources.prospectos,rowToForm(resources.prospectos,row));
 const parsed=createSchema.parse(body);
 assert.equal(parsed.clientId,'existing');assert.equal(parsed.age,0);assert.equal(parsed.paymentMethod,'TARJETA');assert.equal(parsed.paymentFrequency,'ANNUAL');
 assert.equal('diagProtect' in body,false);
});
test('new stages preserve historical comparativo and never advance emission into loss',()=>{
 const sequence=['CURIOSO','INFORMACION_RECIBIDA','DIAGNOSTICADO','PROPUESTA_ENVIADA','DOCUMENTACION','EMISION'];
 sequence.slice(0,-1).forEach((stage,index)=>assert.equal(nextStage(stage),sequence[index+1]));
 assert.equal(nextStage('EMISION'),null);assert.equal(nextStage('PERDIDO'),null);assert.equal(nextStage('COMPARATIVO'),'DOCUMENTACION');
});
