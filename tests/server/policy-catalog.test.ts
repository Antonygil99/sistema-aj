import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Prisma} from '../../src/generated/prisma/client';
import {resolvePolicyCatalog} from '../../src/modules/polizas/catalog-server';
test('el catálogo completa aseguradora/producto/responsable y rechaza productos archivados o responsables inactivos',async()=>{
 let archived=false,enabled=true,reads=0;
 const db={product:{findUnique:async()=>{reads++;return {name:'Médica Vital',insurer:'texto antiguo',ownerEmail:'ale@example.invalid',archivedAt:archived?new Date():null,insurerProfile:{name:'HDI'}};}},accessGrant:{findFirst:async()=>enabled?{id:'fixture'}:null}} as unknown as Pick<Prisma.TransactionClient,'product'|'accessGrant'>;
 const input={productId:'p',insurer:'Otra compañía',product:'Texto anterior',ownerEmail:''};
 assert.deepEqual(await resolvePolicyCatalog(db,input),{productId:'p',insurer:'HDI',product:'Médica Vital',ownerEmail:'ale@example.invalid'});
 const reassigned=await resolvePolicyCatalog(db,{...input,ownerEmail:'previous@example.invalid'},{productId:'old',insurer:'Otra',product:'Anterior',ownerEmail:'previous@example.invalid'});
 assert.equal(reassigned.ownerEmail,'previous@example.invalid','una asignación explícita a un administrador activo se conserva; la interfaz propone el responsable del catálogo');
 archived=true;await assert.rejects(resolvePolicyCatalog(db,input),{code:'POLICY_PRODUCT_UNAVAILABLE'});
 archived=false;enabled=false;await assert.rejects(resolvePolicyCatalog(db,input),{code:'PRODUCT_OWNER_INVALID'});
 const before=reads,legacy={productId:'p',insurer:'Texto contractual',product:'Producto contractual'};
 assert.deepEqual(await resolvePolicyCatalog(db,legacy,legacy),legacy);assert.equal(reads,before,'una edición ajena al catálogo conserva el contrato histórico');
 const manual={insurer:'Compañía histórica',product:'Plan manual'};assert.deepEqual(await resolvePolicyCatalog(db,manual),manual);assert.equal(reads,before);
});
