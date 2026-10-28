import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSignature } from 'better-auth/crypto';
import { verifyOAuthQueryParams } from '@better-auth/oauth-provider';
import { oauthQuery } from '../../src/modules/mcp/consent';

test('OAuth preserves repeated provider signature metadata across Next searchParams, including a URL client ID',async()=>{
  const secret='oauth-query-fixture-secret-not-used-in-production';
  const params=new URLSearchParams({response_type:'code',client_id:'https://chatgpt.com/oauth/client.json',redirect_uri:'https://chatgpt.com/connector_platform_oauth_redirect',scope:'crm:read',state:'fixture-state',code_challenge:'a'.repeat(43),code_challenge_method:'S256',resource:'https://example.invalid/mcp',exp:String(Math.floor(Date.now()/1000)+600),ba_iat:String(Date.now()),ui_locales:'es-ES'});
  const names=[...new Set([...params.keys(),'ba_param'])].sort();
  for(const name of names)params.append('ba_param',name);
  const canonical=new URLSearchParams([...params].sort(([a,av],[b,bv])=>a<b?-1:a>b?1:av<bv?-1:av>bv?1:0));
  params.set('sig',await makeSignature(canonical.toString(),secret));
  const searchParams=Object.fromEntries([...new Set(params.keys())].map(key=>[key,params.getAll(key).length>1?params.getAll(key):params.get(key)!]));
  const serialized=oauthQuery({...searchParams,unused:undefined});
  assert.deepEqual(new URLSearchParams(serialized).getAll('ba_param'),names);
  assert.equal(new URLSearchParams(serialized).get('client_id'),'https://chatgpt.com/oauth/client.json');
  assert.equal(await verifyOAuthQueryParams(serialized,secret),true,'original signature survives the page round trip');
  const tampered=new URLSearchParams(serialized);tampered.set('scope','crm:read crm:write');
  assert.equal(await verifyOAuthQueryParams(tampered.toString(),secret),false,'extra permissions cannot be injected');
  const missing=new URLSearchParams(serialized);missing.delete('ba_param');
  assert.equal(await verifyOAuthQueryParams(missing.toString(),secret),false,'signed metadata cannot be dropped');
});

test('OAuth rejects duplicate credentials and redirect fields and bounds query metadata',()=>{
  for(const key of ['client_id','redirect_uri','scope','state','sig','exp','resource'])assert.throws(()=>oauthQuery({[key]:['first','second']}),{code:'INVALID_OAUTH_QUERY'});
  assert.throws(()=>oauthQuery({ba_param:Array.from({length:65},()=> 'scope')}),{code:'INVALID_OAUTH_QUERY'});
  assert.throws(()=>oauthQuery({state:'x'.repeat(16001)}),{code:'INVALID_OAUTH_QUERY'});
});
