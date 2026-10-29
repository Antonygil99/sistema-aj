import {test} from 'node:test';import assert from 'node:assert/strict';
import {proposalState} from '../src/modules/mcp/proposal-state';
test('MCP: una propuesta pendiente, cancelada o vencida nunca se presenta como cambio guardado',()=>{
 const now=new Date('2026-10-29T12:00:00Z'),future=new Date('2026-10-29T12:01:00Z');
 assert.equal(proposalState('PENDING',future,now).saved,false);
 assert.equal(proposalState('PENDING',now,now).status,'EXPIRED');
 assert.equal(proposalState('CANCELLED',future,now).saved,false);
 assert.equal(proposalState('APPLIED',now,now).saved,true,'el vencimiento posterior no deshace una aplicación confirmada');
 assert.equal(proposalState('APPLIED',now,now).nextAction,'VERIFY_RECORD');
});
