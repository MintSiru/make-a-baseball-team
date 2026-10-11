#!/usr/bin/env node
/* Turns new Korean text in code into resource keys (the way the extraction made them).
   Write new text as  L('한국어 {name}', { name })  (league/model code) or  L('…')  in JSX (UI code); then run
     node scripts/i18n-add.mjs translations.json src/ui/X.tsx src/league/y.ts …
   Each L(…) becomes __i18n_k("<group>.<context>.<sha1:8>", …) in league/model code and __i18n_t(…) in UI code,
   the key is added to ko/en/ja.json, ko-types.ts and metadata.json, and the import is added when missing.
   translations.json: { "<the Korean text>": { "en": "…", "ja": "…" } } — every new text needs both.
   Options: --context name (default: the file's own context word, "text"). Without translations for a text it stops
   and lists what is missing (nothing is written). */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let context = 'text';
const ci = args.indexOf('--context');
if (ci >= 0) context = args.splice(ci, 2)[1];
const [trFile, ...files] = args;
if (!trFile || !files.length) {
  console.error('usage: node scripts/i18n-add.mjs translations.json file…');
  process.exit(2);
}
const translations = JSON.parse(readFileSync(trFile, 'utf8'));
const loc = (l) => join(root, 'src', 'i18n', 'locales', `${l}.json`);
const res = Object.fromEntries(['ko', 'en', 'ja'].map((l) => [l, JSON.parse(readFileSync(loc(l), 'utf8'))]));
const metaPath = join(root, 'src', 'i18n', 'metadata.json');
const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
const typesPath = join(root, 'src', 'i18n', 'ko-types.ts');
let types = readFileSync(typesPath, 'utf8');

/** A JS string literal at `at` ('…', "…" or `…` without ${}): its value and where it ends. */
function literal(src, at) {
  const q = src[at];
  if (!`'"\``.includes(q)) return null;
  let out = '';
  for (let i = at + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') {
      const n = src[++i];
      out += n === 'n' ? '\n' : n === 't' ? '\t' : n;
      continue;
    }
    if (q === '`' && c === '$' && src[i + 1] === '{') return null;
    if (c === q) return { value: out, end: i + 1 };
    out += c;
  }
  return null;
}

/** The values object after the text (`, { a: iga(x), b }`): each param's expression, read at the top level. */
function valuesAfter(src, at) {
  let i = at;
  while (/\s/.test(src[i])) i++;
  if (src[i] !== ',') return {};
  i++;
  while (/\s/.test(src[i])) i++;
  if (src[i] !== '{') return {};
  let depth = 0;
  let start = i + 1;
  const parts = [];
  for (; i < src.length; i++) {
    const c = src[i];
    if (`'"\``.includes(c)) {
      const q = c;
      for (i++; i < src.length && src[i] !== q; i++) if (src[i] === '\\') i++;
      continue;
    }
    if ('({['.includes(c)) depth++;
    else if (')}]'.includes(c)) {
      depth--;
      if (depth === 0) {
        parts.push(src.slice(start, i));
        break;
      }
    } else if (c === ',' && depth === 1) {
      parts.push(src.slice(start, i));
      start = i + 1;
    }
  }
  const out = {};
  for (const part of parts) {
    const t = part.trim();
    if (!t) continue;
    const m = /^([A-Za-z_]\w*)\s*(?::\s*([\s\S]*))?$/.exec(t);
    if (m) out[m[1]] = (m[2] ?? m[1]).trim();
  }
  return out;
}
const PARTICLE = { iga: '이/가', eulreul: '을/를', eunneun: '은/는', wagwa: '과/와', ro: '으로/로' };

const groupOf = (file) => {
  const rel = relative(join(root, 'src'), file).replace(/\.(tsx?|mjs|js)$/, '');
  const parts = rel.split('/');
  const name = parts.pop();
  return [...parts, name[0].toLowerCase() + name.slice(1)].join('.');
};

const missing = new Set();
const plans = [];
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const ui = /\/ui\//.test(file);
  const fn = ui ? '__i18n_t' : '__i18n_k';
  const group = groupOf(file);
  let out = '';
  let last = 0;
  const re = /(?<![\w$.])L\(/g;
  let m;
  let count = 0;
  while ((m = re.exec(src))) {
    let at = m.index + 2;
    while (/\s/.test(src[at])) at++;
    const lit = literal(src, at);
    if (!lit) throw new Error(`${file}: L( without a plain string literal at ${src.slice(m.index, m.index + 60)}`);
    const ko = lit.value;
    const key = `${group}.${context}.${createHash('sha1').update(ko).digest('hex').slice(0, 8)}`;
    if (!res.ko[key] && !translations[ko]) missing.add(ko);
    if (res.ko[key] && res.ko[key] !== ko) throw new Error(`${key} already holds other text`);
    plans.push({ key, ko, file, line: src.slice(0, m.index).split('\n').length, exprs: valuesAfter(src, lit.end) });
    out += src.slice(last, m.index) + `${fn}(${JSON.stringify(key)}`;
    last = lit.end;
    count++;
  }
  out += src.slice(last);
  if (!count) continue;
  // The import.
  const names = new Set([fn]);
  const imp = /^import \{([^}]*)\} from '((?:\.\.\/)+i18n\/index)';\n/m.exec(out);
  if (imp) {
    const have = imp[1].split(',').map((x) => x.trim()).filter(Boolean);
    const all = [...new Set([...have, ...[...names].filter((n) => !have.some((h) => h.endsWith(` ${n}`))).map((n) => `${n.slice(7)} as ${n}`)])].sort((a, b) => a.localeCompare(b));
    out = out.replace(imp[0], `import { ${all.join(', ')} } from '${imp[2]}';\n`);
  } else {
    const depth = relative(dirname(file), join(root, 'src', 'i18n', 'index'));
    const spec = depth.startsWith('.') ? depth : `./${depth}`;
    out = `import { ${[...names].map((n) => `${n.slice(7)} as ${n}`).join(', ')} } from '${spec}';\n` + out;
  }
  plans.push({ file, out });
}
if (missing.size) {
  console.error(`No translation for ${missing.size} text(s):`);
  for (const x of missing) console.error(JSON.stringify(x));
  process.exit(1);
}
let added = 0;
for (const p of plans) {
  if (p.out != null) {
    writeFileSync(p.file, p.out);
    continue;
  }
  if (res.ko[p.key]) continue;
  const t = translations[p.ko];
  res.ko[p.key] = p.ko;
  res.en[p.key] = t.en;
  res.ja[p.key] = t.ja;
  meta[p.key] = { source: relative(root, p.file), line: p.line, params: Object.fromEntries(
      [...p.ko.matchAll(/\{(\w+)/g)].map((x) => {
        const e = p.exprs[x[1]] ?? x[1];
        const fn = /^(\w+)\(/.exec(e)?.[1];
        return [x[1], PARTICLE[fn] ? { expression: e, particle: PARTICLE[fn] } : { expression: e }];
      }),
    ), locations: [] };
  types = types.replace('\n} as const;', `,\n  ${JSON.stringify(p.key)}: ${JSON.stringify(p.ko)}\n} as const;`);
  added++;
}
for (const l of ['ko', 'en', 'ja']) writeFileSync(loc(l), JSON.stringify(res[l], null, 2) + '\n');
writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
writeFileSync(typesPath, types);
console.log(`${added} key(s) added from ${files.map((f) => basename(f)).join(', ')}`);
