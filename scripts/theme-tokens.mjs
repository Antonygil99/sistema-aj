// Keeps the workspace themes in sync. Every hex color written in the workspace stylesheets becomes a token
// `--c-<hex>` whose light value is the original color and whose dark and gradient values are derived here (OKLab:
// lightness inverted, hue kept, shadows kept dark). Page backgrounds and the shared variables have hand-picked
// values. Run `npm run theme` after adding colors; `tests/theme.test.mjs` fails while anything is stale.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const stylesheets = ['src/app/(workspace)/workspace.css', 'src/app/(workspace)/help.css', 'src/app/(workspace)/novedades/releases.css'];
export const themeFile = 'src/app/(workspace)/theme.css';
// Surfaces whose role an automatic inversion cannot infer (the page sits below the panels, not above them).
const overrides = {
  e6efed: '#0a0f0d', f3f3f1: '#0c110f', f5f5f8: '#0d1013', // page gradient behind the main panel
  fafbfc: '#111714', ffffffb0: '#111714d9', // main panel and its translucent top bar
  f6f7f8: '#0c110f', // --bg
};
// globals.css rules with fixed colors that also render inside the workspace (the login keeps its own look).
const globalRules = [
  ['.notice', 'border-color:#efd3a6;background:#fbefd9;color:#6b4a1c'],
  [':is(.contact-form,.access-form) :is(input,select,textarea)', 'background:#ffffff'],
];
// Funnel stages (dataviz ordinal ramp): light → dark on white; on dark surfaces the ramp is re-stepped so later
// stages read brighter (validated with the dataviz palette script against the cards #161c19 and #231725).
const funnel = {
  light: ['#8cbf9f', '#67a37f', '#4a8764', '#336b4c', '#225137'],
  dark: ['#2f5c43', '#3f7a58', '#58996f', '#7bb892', '#a6d6b8'],
  gradient: ['#7b2c87', '#9a3eab', '#b650c8', '#d464e6', '#f491fa'],
};
// Gradient theme: base color #FC66FF (OKLCH hue ≈ 328°), dark plum cards over a grainy gradient canvas.
export const GRADIENT_BASE = '#fc66ff';
export const GRADIENT_INK = '#2a0830'; // text on the base color (buttons)
export const GRADIENT_CANVAS = ['#140a17', '#3a1046', '#8a1c9e']; // top → bottom of the main panel
const BASE_HUE = 5.73;
const gradientOverrides = {
  e6efed: '#120914', f3f3f1: '#140a17', f5f5f8: '#150b18', // shell around the main panel
  fafbfc: '#1a0e1d', ffffffb0: '#1a0e1d8c', // main panel (painted with the canvas) and its top bar
  f6f7f8: '#120914', ffffff: '#231725', // --bg and cards (the surface the funnel ramp was validated on)
};
// Positive statuses keep their dark-theme green so "Activa" or "Pagado" still read as good news.
const keepGreen = [
  [':is(.status-pill,.reminder).tone-green', 'background:#e5f2eb;color:#2f6a49'],
  ['.toast-success .toast-icon', 'background:#e5f2eb;color:#2f6a49'],
];
export const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
const NAMED = /(:|\s|,)(white|black)(?=[;}\s,)!])/g;
export function normalizeHex(hex) {
  let value = hex.replace('#', '').toLowerCase();
  if (value.length === 3 || value.length === 4) value = [...value].map(char => char + char).join('');
  return value;
}
const toLinear = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const toSrgb = c => c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function linearRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
const channels = hex => [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
const toHex = (rgb, alpha) => '#' + rgb.map(value => Math.round(Math.min(1, Math.max(0, value)) * 255).toString(16).padStart(2, '0')).join('') + (alpha < 1 ? Math.round(alpha * 255).toString(16).padStart(2, '0') : '');
export function luminance(hex) { const [r, g, b] = channels(normalizeHex(hex)).map(toLinear); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
export function contrast(a, b) { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
function fitGamut(L, chroma, hue) {
  for (; ; chroma *= 0.92) {
    const linear = linearRgb([L, chroma * Math.cos(hue), chroma * Math.sin(hue)]);
    if (chroma < 0.002 || linear.every(value => value >= -0.0005 && value <= 1.0005)) return toHex(linear.map(toSrgb), 1);
  }
}
// Gradient theme: like the dark theme, but grays take the base hue, the workspace greens become the base color and
// text stays light enough (L ≥ 0.8) to read over the brightest part of the canvas, not only over cards.
export function gradientColor(input) {
  const hex = normalizeHex(input);
  if (gradientOverrides[hex]) return gradientOverrides[hex];
  const rgb = channels(hex), alpha = hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1;
  const [L, a, b] = oklab(rgb.map(toLinear));
  if (alpha < 1) return L < 0.6 ? toHex(rgb, Math.min(0.9, alpha * 1.8)) : toHex(rgb, Math.max(0.04, alpha * 0.18));
  const chroma = Math.hypot(a, b), hue = Math.atan2(b, a);
  // Greenish grays are neutrals here; only saturated greens are workspace accents. Other tints keep their hue.
  const greenHue = hue > 1.9 && hue < 3.5;
  const neutral = chroma < 0.012 || (greenHue && chroma < 0.035), green = greenHue && chroma >= 0.035;
  if (green && L < 0.6) return fitGamut(0.74, 0.2, BASE_HUE);
  const L2 = L < 0.6 ? 0.82 + (0.6 - L) * 0.25 : Math.min(0.95, Math.max(0.12, 1.04 - 0.82 * L));
  if (neutral) return fitGamut(L2, L2 < 0.5 ? 0.02 : 0.012, BASE_HUE);
  return fitGamut(L2, green ? Math.max(chroma, 0.03) : chroma, green ? BASE_HUE : hue);
}
export function darkColor(input) {
  const hex = normalizeHex(input);
  if (overrides[hex]) return overrides[hex];
  const rgb = channels(hex), alpha = hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1;
  const [L, a, b] = oklab(rgb.map(toLinear));
  if (alpha < 1) {
    // Shadows and scrims stay dark (a little stronger to read on dark surfaces); light washes become faint.
    if (L < 0.6) return toHex(rgb, Math.min(0.9, alpha * 1.8));
    return toHex(rgb, Math.max(0.04, alpha * 0.18));
  }
  const L2 = Math.min(0.95, Math.max(0.12, 1.04 - 0.82 * L));
  // Grays pick up the workspace green so the dark theme keeps its identity instead of turning neutral black.
  const neutral = Math.hypot(a, b) < 0.012;
  const hue = neutral ? 2.75 : Math.atan2(b, a);
  // Keep the hue; reduce chroma until the color fits in sRGB.
  for (let chroma = neutral ? (L2 < 0.5 ? 0.011 : 0.007) : Math.hypot(a, b); ; chroma *= 0.92) {
    const linear = linearRgb([L2, chroma * Math.cos(hue), chroma * Math.sin(hue)]);
    if (chroma < 0.002 || linear.every(value => value >= -0.0005 && value <= 1.0005)) return toHex(linear.map(toSrgb), 1);
  }
}
// Replaces hex literals (and the named colors white/black) with tokens; returns the new CSS and the tokens used.
export function tokenize(css) {
  const used = new Set();
  const named = css.replace(NAMED, (_, before, name) => `${before}${name === 'white' ? '#ffffff' : '#000000'}`);
  const output = named.replace(HEX, match => { const hex = normalizeHex(match); used.add(hex); return `var(--c-${hex})`; });
  for (const [, hex] of output.matchAll(/var\(--c-([0-9a-f]{6,8})\)/g)) used.add(hex);
  return { css: output, used };
}
export function renderTheme(tokens) {
  const sorted = [...tokens].sort();
  const light = sorted.map(hex => `--c-${hex}:#${hex}`).join(';');
  const dark = sorted.map(hex => `--c-${hex}:${darkColor(hex)}`).join(';');
  const funnelVars = palette => palette.map((color, index) => `--funnel-${index + 1}:${color}`).join(';');
  const darkBlock = `${dark};${funnelVars(funnel.dark)};color-scheme:dark`;
  const gradientTokens = sorted.map(hex => `--c-${hex}:${gradientColor(hex)}`).join(';');
  const gradientBlock = `${gradientTokens};${funnelVars(funnel.gradient)};--accent:${GRADIENT_BASE};--accent-ink:${GRADIENT_INK};--canvas-top:${GRADIENT_CANVAS[0]};--canvas-mid:${GRADIENT_CANVAS[1]};--canvas-bottom:${GRADIENT_CANVAS[2]};--glow:${GRADIENT_BASE};color-scheme:dark`;
  const gradientScope = '.workspace[data-theme=gradient]';
  const gradientRules = `${gradientScope}{color:var(--text)}${gradientScope} .button:not(.button-soft){color:${GRADIENT_INK}}`
    + globalRules.map(([selector, declarations]) => `${gradientScope} ${selector}{${declarations.replace(HEX, color => gradientColor(color))}}`).join('')
    + keepGreen.map(([selector, declarations]) => `${gradientScope} ${selector}{${declarations.replace(HEX, color => darkColor(color))}}`).join('');
  // body keeps the light text color from globals.css; inside the workspace text must follow the theme.
  const darkRules = scope => `${scope}{color:var(--text)}` + globalRules.map(([selector, declarations]) => `${scope} ${selector}{${declarations.replace(HEX, color => darkColor(color))}}`).join('');
  return `/* Generado por scripts/theme-tokens.mjs (npm run theme). No editar a mano: cambia los colores en workspace.css
   o help.css y vuelve a generarlo. Cada token --c-<hex> conserva el color claro y define sus versiones oscura y gradiente. */
:root,.workspace{${light};${funnelVars(funnel.light)}}
:root[data-theme=dark],.workspace[data-theme=dark]{${darkBlock}}
@media(prefers-color-scheme:dark){:root[data-theme=system],.workspace[data-theme=system]{${darkBlock}}}
:root[data-theme=dark] body{background:${overrides.f6f7f8}}${darkRules('.workspace[data-theme=dark]')}
@media(prefers-color-scheme:dark){:root[data-theme=system] body{background:${overrides.f6f7f8}}${darkRules('.workspace[data-theme=system]')}}
:root[data-theme=gradient],.workspace[data-theme=gradient]{${gradientBlock}}
:root[data-theme=gradient] body{background:${gradientOverrides.f6f7f8}}${gradientRules}
`;
}
// Reads the stylesheets, tokenizes them and renders theme.css. Returns what would be written.
export function buildTheme(root = '.') {
  const files = {}, tokens = new Set();
  for (const file of stylesheets) {
    const { css, used } = tokenize(readFileSync(`${root}/${file}`, 'utf8'));
    files[file] = css;
    for (const hex of used) tokens.add(hex);
  }
  files[themeFile] = renderTheme(tokens);
  return files;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = buildTheme();
  for (const [file, content] of Object.entries(files)) writeFileSync(file, content);
  console.log(`Tema actualizado: ${Object.keys(files).length} archivos.`);
}
