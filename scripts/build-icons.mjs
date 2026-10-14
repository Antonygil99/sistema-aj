// Generates src/components/icons.tsx: static SVG components for the iconsax icons the CRM imports, keeping only the
// variants in use (Linear everywhere, Bold where a file passes `variant`). Each iconsax component ships all six
// variants, so importing the package directly made the browser download ~380 KB of icons.
// Usage: npm run icons (after importing a new icon from '@/components/icons'). tests/icons.test.mjs checks it.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as iconsax from 'iconsax-reactjs';
export const iconsFile = 'src/components/icons.tsx';
const IMPORT = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+'(?:iconsax-reactjs|@\/components\/icons)'/g;
function sources(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'generated' ? [] : sources(path);
    return /\.(tsx?|mjs)$/.test(name) && path.replace(/\\/g, '/') !== iconsFile ? [path] : [];
  });
}
// Icon names imported anywhere in src, and the ones that also need the Bold variant.
export function usedIcons(root = '.') {
  const linear = new Set(), bold = new Set();
  for (const file of sources(join(root, 'src'))) {
    const text = readFileSync(file, 'utf8');
    for (const [, list] of text.matchAll(IMPORT)) for (const raw of list.split(',')) {
      const name = raw.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, '');
      if (!name || name === 'Icon' || name === 'IconProps') continue;
      linear.add(name);
      if (/variant=\{/.test(text)) bold.add(name);
    }
  }
  return { linear: [...linear].sort(), bold };
}
function inner(name, variant) {
  const component = iconsax[name];
  if (!component) throw new Error(`Ícono desconocido: ${name}`);
  const markup = renderToStaticMarkup(createElement(component, { variant, size: 24, color: 'currentColor' }));
  return markup.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
}
export function renderIcons(root = '.') {
  const { linear, bold } = usedIcons(root);
  const entries = linear.map(name => `  ${name}: { Linear: ${JSON.stringify(inner(name, 'Linear'))}${bold.has(name) ? `, Bold: ${JSON.stringify(inner(name, 'Bold'))}` : ''} },`).join('\n');
  return `// Generado por scripts/build-icons.mjs (npm run icons) a partir de iconsax-reactjs (licencia MIT). No editar a mano.
// Solo incluye las variantes que usa el CRM, para no descargar las seis variantes de cada ícono.
import type { CSSProperties, JSX, SVGProps } from 'react';
export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children' | 'color'> & { size?: number | string; color?: string; variant?: 'Linear' | 'Bold' };
export type Icon = (props: IconProps) => JSX.Element;
const paths: Record<string, { Linear: string; Bold?: string }> = {
${entries}
};
function create(name: string): Icon {
  const variants = paths[name];
  function IconComponent({ size = 24, color, variant = 'Linear', style, ...rest }: IconProps) {
    const css: CSSProperties | undefined = color ? { color, ...style } : style;
    return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" style={css} {...rest} dangerouslySetInnerHTML={{ __html: variant === 'Bold' && variants.Bold ? variants.Bold : variants.Linear }}/>;
  }
  IconComponent.displayName = name;
  return IconComponent;
}
${linear.map(name => `export const ${name} = create('${name}');`).join('\n')}
`;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(iconsFile, renderIcons());
  console.log(`Íconos generados: ${usedIcons().linear.length}.`);
}
