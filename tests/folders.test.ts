import { test } from 'node:test';
import assert from 'node:assert/strict';
import { folderColorIds, folderColorOf, folderColors, folderPath, isFolderColor, reachableFolders } from '../src/modules/documentos/folder-view';

const folder = (id: string, parentId: string | null = null, name = id) => ({ id, name, parentId });

test('los colores de carpeta solo aceptan los del catálogo', () => {
  assert.deepEqual(folderColorIds, folderColors.map(color => color.id));
  assert.equal(isFolderColor('menta'), true);
  assert.equal(isFolderColor('MENTA'), false);
  assert.equal(isFolderColor('#ff0000'), false);
  assert.equal(isFolderColor(null), false);
});

test('una carpeta sin color toma un tono original estable y respeta el color elegido', () => {
  const ids = ['cm1a', 'cm1b', 'cm1c', 'cm1d', 'cm1e', 'cm1f'];
  const tones = ids.map(id => folderColorOf({ id, color: null }));
  assert.ok(tones.every(tone => ['lavanda', 'cielo', 'arena'].includes(tone)));
  assert.ok(new Set(tones).size > 1, 'las carpetas no deben verse todas iguales');
  assert.deepEqual(ids.map(id => folderColorOf({ id, color: null })), tones);
  assert.equal(folderColorOf({ id: 'cm1a', color: 'rosa' }), 'rosa');
  assert.ok(['lavanda', 'cielo', 'arena'].includes(folderColorOf({ id: 'cm1a', color: 'neon' })));
});

test('las subcarpetas de una carpeta archivada quedan fuera de alcance', () => {
  // "b" está archivada (no viene en el listado): "c" y "d", dentro de ella, no deben ofrecerse como destino.
  const folders = [folder('a'), folder('c', 'b'), folder('d', 'c'), folder('e', 'a')];
  assert.deepEqual(reachableFolders(folders).map(item => item.id), ['a', 'e']);
});

test('un ciclo en el árbol no bloquea ni se ofrece', () => {
  assert.deepEqual(reachableFolders([folder('x', 'y'), folder('y', 'x'), folder('z')]).map(item => item.id), ['z']);
});

test('la ruta de una carpeta muestra sus antecesoras', () => {
  const folders = [folder('a', null, 'Pólizas'), folder('b', 'a', '2026'), folder('c', 'b', 'Autos')];
  assert.equal(folderPath(folders[2], folders), 'Pólizas / 2026 / Autos');
  assert.equal(folderPath(folder('h', 'perdida', 'Huérfana'), folders), 'Huérfana');
});
