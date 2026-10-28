// For explicit Node integration checks only. Next normally provides the server-only boundary at build time.
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,nextResolve){
  if(specifier==='server-only')return {url:'data:text/javascript,export{}',shortCircuit:true};
  return nextResolve(specifier,context);
}});
