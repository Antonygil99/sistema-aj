import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarMonth,moneySeries,percentage } from '../src/modules/metrics/module-types';
import { monthRange } from '../src/modules/metrics/period';
test('los radares incluyen recibos del primer día y excluyen el siguiente mes sin desplazar fechas a CDMX',()=>{
 const period=monthRange(new Date('2026-11-01T02:00:00Z'));const range=calendarMonth(period.start,period.end);
 assert.equal(range.gte.toISOString(),'2026-10-01T00:00:00.000Z');assert.equal(range.lt.toISOString(),'2026-11-01T00:00:00.000Z');
 assert.equal(new Date('2026-10-01T00:00:00Z')>=range.gte,true);assert.equal(new Date('2026-11-01T00:00:00Z')<range.lt,false);
});
test('los importes no mezclan monedas y una serie vacía no certifica cero deuda',()=>{
 const value=moneySeries([{currency:'MXN',_sum:{amount:'1250.25'}},{currency:'USD',_sum:{amount:'10.00'}}],'amount');
 assert.equal(value,'1,250.25 MXN · 10.00 USD');assert.equal(moneySeries([],'amount'),'Sin registros');
});
test('una tasa sin población no se reporta como conversión o retención cero',()=>{assert.equal(percentage(0,0),'—');assert.equal(percentage(1,4),'25 %');});
