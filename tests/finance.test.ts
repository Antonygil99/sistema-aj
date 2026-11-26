import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleIssues, confirmationInput, renewalInput, makeSchedule } from '../src/modules/polizas/finance';
test('calendar preserves cents and end-of-month dates; a mismatched sum or date is rejected',()=>{
  const rows=makeSchedule(1000,3,'2026-01-31','MONTHLY');
  assert.deepEqual(rows.map(r=>r.dueDate),['2026-01-31','2026-02-28','2026-03-31']);
  assert.equal(rows.reduce((s,r)=>s+Math.round(r.amount*100),0),100000);
  const policy={premium:1000,startDate:'2026-01-01',endDate:'2027-01-01'};
  assert.equal(scheduleIssues(policy,rows,'MONTHLY'),null);
  assert.ok(scheduleIssues(policy,[...rows,{amount:1,dueDate:'2026-04-30'}],'MONTHLY'));
  assert.ok(scheduleIssues(policy,[{amount:1000,dueDate:'2027-02-01'}],'ONCE'));
  assert.ok(scheduleIssues(policy,[{amount:500,dueDate:'2026-01-01'},{amount:500,dueDate:'2026-01-01'}],'MONTHLY'));
});
test('payment confirmation accepts an optional reference and document but requires a date and explicit review',()=>{
  const payment={expectedUpdatedAt:'2026-10-26T12:00:00Z',paidAt:'2026-10-26',reviewed:true};
  assert.equal(confirmationInput.safeParse(payment).success,true);
  assert.equal(confirmationInput.safeParse({...payment,reference:'TRANSFER-TEST',evidenceDocumentId:'doc-test'}).success,true);
  assert.equal(confirmationInput.safeParse({...payment,reference:'',evidenceDocumentId:'drive:linked-test'}).success,true);
  assert.equal(confirmationInput.safeParse({...payment,evidenceDocumentId:' '}).success,false);
  assert.equal(confirmationInput.safeParse({...payment,paidAt:''}).success,false);
  assert.equal(confirmationInput.safeParse({...payment,reviewed:false}).success,false);
});
test('renewal requires valid new dates',()=>{
  assert.equal(renewalInput.safeParse({expectedUpdatedAt:'2026-10-26T12:00:00Z',number:'SAME-NUMBER',premium:1000,startDate:'2027-01-01',endDate:'2026-01-01',reviewed:true}).success,false);
});
