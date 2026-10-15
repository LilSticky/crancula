#!/usr/bin/env node
// Checks the @ngx-translate files in src/assets/i18n/:
//   - every key exists in every language (errors),
//   - no translation is empty (errors),
//   - every key used in src/ via `'KEY' | translate` or `.instant('KEY')`/`.get('KEY')`/`.stream('KEY')`
//     exists (errors),
//   - keys that no code mentions as a quoted string (warnings; prefixes in DYNAMIC_PREFIXES are exempt).
// Exit code 1 on errors. Usage: node scripts/check-i18n.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const I18N_DIR = 'src/assets/i18n';
const SOURCE_DIR = 'src';
const KEY_USAGE = [
  /['"]([A-Z0-9_]+(?:\.[A-Z0-9_]+)*)['"]\s*\|\s*translate\b/g,
  /\.(?:instant|get|stream)\(\s*['"]([A-Z0-9_]+(?:\.[A-Z0-9_]+)*)['"]/g,
];
/** Key prefixes whose keys are built at run time, so they never appear as literals. */
/** MENU.* is read by the Electron main process (app/application-menu.ts), which this script doesn't scan. */
const DYNAMIC_PREFIXES = [
  'ORGAN.VIOLATION.',
  'TAPE.VIOLATION.',
  'TAPE.SONG_REJECTION.',
  'CONFIRMATION_DIALOG.',
  'MENU.',
  // Built in organ-editor.component.ts: `ORGAN.EDITOR.${fit/tooWide}${_ONE}`.
  'ORGAN.EDITOR.FIT',
  'ORGAN.EDITOR.TAPE_BED_DRAWING',
];
/** Any quoted string shaped like a key; counts as a use when the key exists (e.g. `label="KEY"`). */
const KEY_LITERAL = /['"`]([A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)*)['"`]/g;

/** @param {unknown} node @param {string} prefix @returns {Map<string, unknown>} flat key → value */
function flatten(node, prefix = '', out = new Map()) {
  if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node)) flatten(value, prefix ? `${prefix}.${key}` : key, out);
  } else {
    out.set(prefix, node);
  }
  return out;
}

/** @param {string} dir @returns {string[]} */
function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'assets' ? [] : sourceFiles(path);
    return /\.(ts|html)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

const languages = readdirSync(I18N_DIR)
  .filter((file) => file.endsWith('.json'))
  .map((file) => ({ file, keys: flatten(JSON.parse(readFileSync(join(I18N_DIR, file), 'utf8'))) }));
const allKeys = new Set(languages.flatMap(({ keys }) => [...keys.keys()]));

const errors = [];
for (const { file, keys } of languages) {
  for (const key of allKeys) if (!keys.has(key)) errors.push(`${file}: missing key ${key}`);
  for (const [key, value] of keys) {
    if (typeof value !== 'string' || value.trim() === '') errors.push(`${file}: empty or non-text value at ${key}`);
  }
}

const used = new Map();
for (const path of sourceFiles(SOURCE_DIR)) {
  const text = readFileSync(path, 'utf8');
  for (const pattern of KEY_USAGE) {
    for (const [, key] of text.matchAll(pattern)) used.set(key, path.replace(/\\/g, '/'));
  }
  for (const [, key] of text.matchAll(KEY_LITERAL)) if (allKeys.has(key)) used.set(key, path);
}
for (const [key, path] of used) if (!allKeys.has(key)) errors.push(`${path}: uses unknown key ${key}`);
const unused = [...allKeys].filter(
  (key) => !used.has(key) && !DYNAMIC_PREFIXES.some((prefix) => key.startsWith(prefix)),
);

for (const key of unused) console.warn(`warning: unused key ${key}`);
for (const error of errors) console.error(`error: ${error}`);
console.log(
  `i18n: ${languages.map(({ file }) => file).join(', ')}; ${allKeys.size} keys, ${errors.length} errors, ${unused.length} unused`,
);
process.exit(errors.length > 0 ? 1 : 0);
