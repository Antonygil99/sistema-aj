import {test} from 'node:test';
import assert from 'node:assert/strict';
import {foldSearch,matchesSearch,searchTerms} from '../src/modules/smart-search';
import {sectionResults} from '../src/modules/search';
test('búsqueda tolera comas, acentos, mayúsculas, orden, espacios y separadores sin inventar equivalencias numéricas',()=>{
 const name='GÓMEZ, ANTONIO ALDAIR GIL';
 for(const q of ['Antonio Aldair Gil Gomez','gomez gil antonio',' GÓMEZ,   ANTONIO ','Aldair, Gómez'])assert.equal(matchesSearch(name,q),true,q);
 for(const q of ['HDI001091519','hdi 001 / 09 - 1519','001091519'])assert.equal(matchesSearch('HDI-001/09.1519',q),true,q);
 assert.equal(matchesSearch('1091519','001091519'),false,'no eliminar ceros ni asumir que dos números son la misma póliza');
 assert.equal(matchesSearch(name,'%_---'),false);assert.equal(foldSearch('José Núñez'),'jose nunez');assert.deepEqual(searchTerms('Ana, Ana Pérez'),['ana','perez']);
});
test('búsqueda de secciones incluye los módulos actuales y respeta mínimos de rol',()=>{
 assert.equal(sectionResults('tramites','ADMIN')[0]?.href,'/tramites');
 assert.equal(sectionResults('tramites','USER').length,0);assert.equal(sectionResults('usuarios','ADMIN').length,0);
 assert.equal(sectionResults('usuarios','SUPERADMIN')[0]?.href,'/usuarios');
 for(const q of ['Google Drive','calendAr','entregas','plantillas','renovaciones','aseguradoras'])assert.ok(sectionResults(q,'SUPERADMIN').length,q);
});
