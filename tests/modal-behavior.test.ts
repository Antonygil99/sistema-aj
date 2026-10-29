import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lockBodyScroll} from '../src/components/ui/modal';

test('stacked dialogs and search keep the body locked until the last owner releases it',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document');
 const style={overflow:'clip'};
 Object.defineProperty(globalThis,'document',{value:{body:{style}},configurable:true});
 try{
  const parent=lockBodyScroll(),child=lockBodyScroll();
  assert.equal(style.overflow,'hidden');
  parent();assert.equal(style.overflow,'hidden');
  parent();assert.equal(style.overflow,'hidden','release is idempotent');
  child();assert.equal(style.overflow,'clip','restore the original overflow after both close');
  const next=lockBodyScroll();assert.equal(style.overflow,'hidden');next();assert.equal(style.overflow,'clip');
 }finally{if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else Reflect.deleteProperty(globalThis,'document');}
});
