import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HEX, buildTheme, contrast, darkColor, stylesheets, themeFile } from '../scripts/theme-tokens.mjs';

test('el tema generado está al día con las hojas del espacio de trabajo', () => {
  // Windows checkouts may turn LF into CRLF; compare the text, not the line endings.
  const text = value => value.replace(/\r\n/g, '\n');
  for (const [file, content] of Object.entries(buildTheme())) assert.equal(text(readFileSync(file, 'utf8')), text(content), `${file} desactualizado: corre npm run theme`);
  for (const file of stylesheets) assert.equal((readFileSync(file, 'utf8').match(HEX) ?? []).length, 0, `${file} tiene colores sin token`);
  const theme = readFileSync(themeFile, 'utf8');
  assert.match(theme, /:root\[data-theme=dark\],\.workspace\[data-theme=dark\]\{/);
  assert.match(theme, /prefers-color-scheme:dark/);
});

test('el tema oscuro invierte superficies y texto, y conserva las sombras', () => {
  const card = darkColor('#ffffff');
  assert.ok(contrast(darkColor('#1f2a25'), card) >= 7, 'texto principal');
  assert.ok(contrast(darkColor('#5d6a63'), card) >= 4.5, 'texto gris');
  assert.ok(contrast(darkColor('#3f6b54'), card) >= 4.5, 'verde de acento');
  assert.ok(contrast(darkColor('#9b3b2a'), card) >= 4.5, 'rojo de alerta');
  assert.ok(contrast(darkColor('#5d6a63'), darkColor('#fafbfc')) >= 4.5, 'texto gris sobre el panel principal');
  assert.match(darkColor('#10201914'), /^#102019[0-9a-f]{2}$/, 'una sombra sigue siendo oscura');
});
