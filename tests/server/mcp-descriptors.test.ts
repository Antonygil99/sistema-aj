import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createCrmMcp } from '../../src/modules/mcp/server';
import type { McpActor } from '../../src/modules/mcp/actor';

test('MCP protocol advertises OAuth scopes at both descriptor locations and hides administrator tools from read-only users',async()=>{
  const toolsFor=async(role:McpActor['role'])=>{
    const actor:McpActor={id:'fixture',clientId:'fixture',name:'Fixture',email:'fixture@example.invalid',role,scopes:['crm:read'],issuedAt:Math.floor(Date.now()/1000)};
    const handler=createMcpHandler(()=>createCrmMcp(actor),{legacy:'stateless',responseMode:'json'});
    const response=await handler.fetch(new Request('https://example.invalid/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})}));
    assert.equal(response.status,200);
    const text=await response.text(),line=text.split('\n').find(value=>value.startsWith('data:'));
    return JSON.parse(line?line.slice(5):text).result.tools as {name:string;securitySchemes:unknown;_meta:{securitySchemes:unknown}}[];
  };
  const admin=await toolsFor('ADMIN'),reader=await toolsFor('USER');
  const access=admin.find(tool=>tool.name==='aj_request_change_access')!;
  assert.deepEqual(access.securitySchemes,[{type:'oauth2',scopes:['crm:read','crm:write','crm:files']}]);
  assert.deepEqual(access._meta.securitySchemes,access.securitySchemes);
  assert.ok(reader.some(tool=>tool.name==='aj_list'));
  assert.ok(!reader.some(tool=>['aj_request_change_access','aj_prepare_upload','aj_propose_change','aj_prepare_intake','aj_prepare_import'].includes(tool.name)));
});
