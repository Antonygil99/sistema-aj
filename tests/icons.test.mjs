import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { iconsFile, renderIcons } from '../scripts/build-icons.mjs';

const files = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return name === 'generated' ? [] : files(path);
  return /\.(tsx?|mjs)$/.test(name) ? [path] : [];
});

test('los íconos se importan del módulo generado, no de iconsax completo', () => {
  const direct = files('src').filter(path => path.replace(/\\/g, '/') !== iconsFile && readFileSync(path, 'utf8').includes("from 'iconsax-reactjs'"));
  assert.deepEqual(direct, [], 'importa desde @/components/icons y corre npm run icons');
});

test('el módulo de íconos generado está al día', () => {
  const text = value => value.replace(/\r\n/g, '\n');
  assert.equal(text(readFileSync(iconsFile, 'utf8')), text(renderIcons()), 'corre npm run icons');
});
