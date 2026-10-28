// Development helper: derive the installed, pinned OAuth plugin's persistence schema.
import { readFileSync, writeFileSync } from 'node:fs';
import { mcp } from '@better-auth/mcp';
import { jwt } from 'better-auth/plugins';
const path = 'prisma/schema.prisma';
let source = readFileSync(path, 'utf8');
if (source.includes('model OauthClient {')) throw new Error('MCP_SCHEMA_ALREADY_PRESENT');
const schemas = { ...jwt().schema, ...mcp({loginPage:'/mcp/connect',consentPage:'/mcp/consent',resource:'https://crm.segurosaleyjoel.com/mcp'}).schema };
const modelName = n => ({user:'AuthUser',session:'AuthSession'}[n] ?? n[0].toUpperCase()+n.slice(1));
const backs = {};
let added = '';
for (const [name, schema] of Object.entries(schemas)) {
  const model = modelName(name);
  let text = `\nmodel ${model} {\n  id String @id\n`;
  const relations=[];
  for(const [field,f] of Object.entries(schema.fields)) {
    const type = {string:'String',date:'DateTime',number:'Int',boolean:'Boolean',json:'Json','string[]':'String[]'}[f.type];
    if (!type) throw new Error('UNKNOWN_TYPE');
    const required = f.required !== false;
    text += `  ${field} ${type}${!required && !type.endsWith('[]') ? '?' : ''}${f.unique?' @unique':''}${type.endsWith('[]')?' @default([])':f.defaultValue!==undefined?' @default('+JSON.stringify(f.defaultValue)+')':''}\n`;
    if(f.references) {
      const target=modelName(f.references.model),relation=`${model}_${field}`;
      relations.push(`  ${field}Relation ${target}${required?'':'?'} @relation("${relation}", fields: [${field}], references: [${f.references.field}], onDelete: ${f.references.onDelete==='cascade'?'Cascade':f.references.onDelete==='set null'?'SetNull':'Restrict'})`);
      (backs[target]??=[]).push(`  ${relation} ${model}[] @relation("${relation}")`);
    }
    if(f.index) relations.push(`  @@index([${field}])`);
  }
  for(const index of schema.indexes??[])relations.push(`  @@${index.unique?'unique':'index'}([${index.fields.join(', ')}])`);
  text+=relations.join('\n')+'\n}\n'; added+=text;
}
source+=added;
for(const [model,fields]of Object.entries(backs))source=source.replace(`model ${model} {`,`model ${model} {\n${fields.join('\n')}\n`);
source+=`
// Proposed MCP changes are immutable, short-lived, owned by one person and OAuth client.
model McpChange {
  id String @id @default(cuid())
  userId String
  clientId String
  module String
  operation String
  recordId String?
  expectedUpdatedAt DateTime?
  data Json
  fileBytes Bytes?
  status String @default("PENDING")
  resultId String?
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([userId, status, expiresAt])
}
model McpRevocation {
  id String @id @default(cuid())
  userId String
  clientId String
  revokedBefore DateTime
  @@unique([userId, clientId])
}
`;
writeFileSync(path,source);
