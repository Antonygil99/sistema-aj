import {test} from 'node:test';import assert from 'node:assert/strict';import {renderRichText,safeEmailLink} from '../src/modules/email/rich-text';import {noticeCandidates} from '../src/modules/email/notices';import {readPreferences} from '../src/modules/preferences';
test('rich email renders a limited safe format without accepting HTML or unsafe links',()=>{
 const html=renderRichText('**Hola** _equipo_\n- Uno\n- Dos\n<img src=x onerror=alert(1)> [Portal](https://example.com/pago) [No](javascript:alert)');
 assert.ok(html.includes('<strong>Hola</strong>'));assert.ok(html.includes('<em>equipo</em>'));assert.ok(html.includes('<ul>'));assert.ok(html.includes('&lt;img'));assert.equal(html.includes('<img'),false);assert.equal(html.includes('href="javascript:'),false);assert.ok(html.includes('rel="noopener noreferrer"'));
 assert.equal(safeEmailLink('https://user:secret@example.com'),null);assert.equal(safeEmailLink('data:text/html,test'),null);
 const chip=renderRichText('Hola {cliente}',true);assert.ok(chip.includes('data-variable="cliente"'));assert.ok(chip.includes('contenteditable="false"'));assert.equal(renderRichText('Hola {cliente}').includes('data-variable'),false);assert.ok(renderRichText('**Hola {cliente}**',true).includes('data-variable="cliente"'));assert.ok(renderRichText('**_Hola_**').includes('<strong><em>Hola</em></strong>'));
});
test('notice timing follows the policy owner and changing cadence has a separate claim key',()=>{
 const base={today:'2026-10-29',policies:[{id:'p1',clientId:'c',ownerEmail:'ale@example.invalid',endDate:new Date('2026-12-01'),renewed:false},{id:'p2',clientId:'c',ownerEmail:'joel@example.invalid',endDate:new Date('2026-12-01'),renewed:false}],payments:[],claims:[{id:'claim',policyId:'p1',clientId:'c',ownerEmail:'ale@example.invalid',createdAt:new Date('2026-10-20T18:00:00Z')}]};
 const result=noticeCandidates({...base,timingForOwner:owner=>owner==='ale@example.invalid'?{renewal:[45,15],payment:[5,0],claimEveryDays:3}:{renewal:[30,10],payment:[10,0],claimEveryDays:7}});
 assert.equal(result.filter(r=>r.kind==='RENOVACION').length,1);assert.equal(result[0].policyId,'p1');assert.equal(result[0].milestone,45);assert.ok(result.find(r=>r.kind==='SINIESTRO')?.dedupeKey.includes('interval:3'));
 assert.deepEqual(readPreferences({noticeSchedule:{renewal:[0],payment:[0],claimEveryDays:0}}).noticeSchedule,{renewal:[30,20,10],payment:[20,10,0],claimEveryDays:7});
});
