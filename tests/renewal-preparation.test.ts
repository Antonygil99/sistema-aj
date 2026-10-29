import {test} from 'node:test';
import assert from 'node:assert/strict';
import {premiumComparison,preparationSchema,canTransitionPreparation} from '../src/modules/renovaciones/preparation';
test('renovación: compara primas totales sin mezclar monedas, UDI, cero o mensualidades inferidas',()=>{
 assert.deepEqual(premiumComparison('10000.00','12000.00','MXN','MXN'),{difference:'2000.00',percent:'20.00',reason:null});
 assert.equal(premiumComparison('100.00','90.00','USD','USD').percent,'-10.00');
 for(const [a,b,c,d] of [['0','100','MXN','MXN'],['100','120','MXN','USD'],['100','120','UDI','UDI'],['','120','MXN','MXN']])assert.equal(premiumComparison(a,b,c,d).percent,null);
});
test('renovación lista exige dos documentos distintos, revisión y datos completos',()=>{
 const data={expectedUpdatedAt:null,expectedPolicyUpdatedAt:'2026-10-29T12:00:00.000Z',status:'READY',number:'000-3403-12',premium:'12000.00',currency:'MXN',startDate:'2027-01-01',endDate:'2028-01-01',paymentNotes:'',summary:'',oldDocumentId:'a',newDocumentId:'b',channel:'',communicationNote:'',reviewed:true};
 assert.equal(preparationSchema.safeParse(data).success,true);
 for(const patch of [{reviewed:false},{newDocumentId:'a'},{number:''},{premium:'0'},{endDate:'2026-01-01'}])assert.equal(preparationSchema.safeParse({...data,...patch}).success,false);
 assert.equal(preparationSchema.safeParse({...data,status:'COMMUNICATED'}).success,false);
});

test('etapas: no saltar revisión/comunicación ni registrar renovación sin nueva vigencia',()=>{
 assert.equal(canTransitionPreparation('PREPARING','COMMUNICATED'),false);
 assert.equal(canTransitionPreparation('READY','COMMUNICATED'),true);
 assert.equal(canTransitionPreparation('COMMUNICATED','FOLLOW_UP'),true);
 assert.equal(canTransitionPreparation('PREPARING','RENEWED'),false);
 assert.equal(canTransitionPreparation('RENEWED','PREPARING'),false);
 assert.equal(canTransitionPreparation('NOT_RENEWED','PREPARING'),true);
 const base={expectedUpdatedAt:null,expectedPolicyUpdatedAt:'2026-10-29T12:00:00.000Z',status:'REQUESTED',number:'',premium:'',currency:'MXN',startDate:'',endDate:'',paymentNotes:'',summary:'',oldDocumentId:'',newDocumentId:'',channel:'',communicationNote:'',reviewed:false};
 assert.equal(preparationSchema.safeParse(base).success,false);
 assert.equal(preparationSchema.safeParse({...base,requestReference:'Solicitud por portal folio 123',followUpDate:'2026-11-01'}).success,true);
 assert.equal(preparationSchema.safeParse({...base,status:'RECEIVED'}).success,false);
 assert.equal(preparationSchema.safeParse({...base,status:'NOT_RENEWED',outcomeNote:'Cliente elige no renovar'}).success,true);
});
