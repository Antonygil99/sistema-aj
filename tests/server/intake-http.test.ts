import { test } from 'node:test';
import assert from 'node:assert/strict';
import { intakeBody, publicOrigin } from '../../src/modules/intake/http';
test('public intake requires exact configured origin and bounds JSON before parsing',async()=>{
  const old=process.env.BETTER_AUTH_URL;process.env.BETTER_AUTH_URL='https://example.test';
  try{
    assert.doesNotThrow(()=>publicOrigin(new Request('https://example.test/api/intake/profile',{method:'POST',headers:{origin:'https://example.test'}})));
    assert.throws(()=>publicOrigin(new Request('https://example.test/api/intake/profile',{method:'POST',headers:{origin:'https://attacker.test'}})),{code:'INVALID_ORIGIN'});
    assert.throws(()=>publicOrigin(new Request('https://example.test/api/intake/profile',{method:'POST'})),{code:'INVALID_ORIGIN'});
    await assert.rejects(intakeBody(new Request('https://example.test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({value:'x'.repeat(17000)})})),{code:'INTAKE_BODY_TOO_LARGE'});
    await assert.rejects(intakeBody(new Request('https://example.test',{method:'POST',body:'{}'})),{code:'INVALID_INPUT'});
    assert.deepEqual(await intakeBody(new Request('https://example.test',{method:'POST',headers:{'content-type':'application/json'},body:'{"ok":true}'})),{ok:true});
  }finally{if(old===undefined)delete process.env.BETTER_AUTH_URL;else process.env.BETTER_AUTH_URL=old;}
});
