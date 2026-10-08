#!/usr/bin/env node
/* Localization checks (npm run i18n:check).

   Resources: JSON validity, key parity, empty/untranslated values, Hangul left in en/ja, placeholders against ko,
   line breaks and tags, English plurals, length against ko, Japanese notation and the glossary (src/i18n/glossary.json).
   Code: every key the code asks for exists, keys nothing asks for, Hangul literals still in code, Korean logic strings
   (comparisons, switch cases, object keys) and display calls (t/rich) in places where the canonical Korean is needed.

   Severity: critical (breaks the game or a language: fails the run), major (wrong or missing text a player sees),
   minor (worth a look), info (for the record). Options: --json <file> writes the full report, --list <n> prints
   up to n items per check (default 8), --strict fails on major too. */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseIcu } from '@formatjs/icu-messageformat-parser';
import ts from 'typescript';

const ROOT = join(fileURLToPath(import.meta.url), '../..');
const I18N = join(ROOT, 'src/i18n');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const LIST = Number(opt('--list', 8));
const JSON_OUT = opt('--json', null);
const STRICT = args.includes('--strict');

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
const LEGACY = /\{([A-Za-z_]\w*)\|([^{}]*)\}/g;
const SIMPLE = /\{([A-Za-z_]\w*)\}/g;

/** check id → { title, severity, items[] } */
const results = new Map();
function report(id, title, severity, item) {
  if (!results.has(id)) results.set(id, { id, title, severity, items: [] });
  if (item !== undefined) results.get(id).items.push(item);
}
const declare = (id, title, severity) => report(id, title, severity);

// ---------------------------------------------------------------- resources

function loadJson(path, check) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    report(check, 'JSON validity', 'critical', { file: relative(ROOT, path), error: String(e.message ?? e) });
    return null;
  }
}

declare('json', 'JSON validity', 'critical');
const LOCALES = ['ko', 'en', 'ja'];
const res = Object.fromEntries(LOCALES.map((l) => [l, loadJson(join(I18N, 'locales', `${l}.json`), 'json')]));
const names = {
  korean: loadJson(join(I18N, 'names/korean-name-labels.json'), 'json'),
  foreign: loadJson(join(I18N, 'names/foreign-name-labels.json'), 'json'),
};
const glossary = loadJson(join(I18N, 'glossary.json'), 'json');
const metadata = loadJson(join(I18N, 'metadata.json'), 'json') ?? {};
for (const l of LOCALES)
  if (res[l]) for (const [key, v] of Object.entries(res[l])) if (typeof v !== 'string') report('json', 'JSON validity', 'critical', { locale: l, key, error: `value is ${typeof v}` });

const ko = res.ko ?? {};

declare('parity', 'Key parity with ko', 'critical');
for (const l of ['en', 'ja']) {
  const t = res[l];
  if (!t) continue;
  for (const key of Object.keys(ko)) if (!(key in t)) report('parity', 'Key parity with ko', 'critical', { locale: l, key, problem: 'missing' });
  for (const key of Object.keys(t)) if (!(key in ko)) report('parity', 'Key parity with ko', 'critical', { locale: l, key, problem: 'extra (not in ko)' });
}

/** The arguments a message uses: simple ones and plural/select ones, with the legacy particle tokens counted as their base. */
function icuArgs(text) {
  const legacy = [...text.matchAll(LEGACY)].map((m) => m[0]);
  const plain = text.replace(LEGACY, (_, name) => `{${name}}`);
  const ast = parseIcu(plain, { ignoreTag: true });
  const out = [];
  const plurals = [];
  const walk = (nodes) => {
    for (const n of nodes) {
      if (n.type === 1 || n.type === 2 || n.type === 3 || n.type === 4) out.push(n.value);
      if (n.type === 5 || n.type === 6) {
        out.push(n.value);
        if (n.type === 6) plurals.push({ name: n.value, options: Object.keys(n.options), ordinal: n.pluralType === 'ordinal' });
        for (const o of Object.values(n.options)) walk(o.value);
      }
    }
  };
  walk(ast);
  return { args: out, legacy, plurals };
}
const koArgs = (text) => ({ args: [...text.replace(LEGACY, '{$1}').matchAll(SIMPLE)].map((m) => m[1]), legacy: [...text.matchAll(LEGACY)].map((m) => m[0]) });
const count = (xs) => xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map());
const tags = (s) => [...s.matchAll(/<\/?([A-Za-z][\w-]*)[^>]*>/g)].map((m) => m[0].replace(/\s.*>$/, '>'));
const breaks = (s) => (s.match(/\n/g) ?? []).length;
const width = (s) => [...s].reduce((a, c) => a + (/[ᄀ-ᇿ⺀-꓏가-힯豈-﫿︰-﹏＀-｠￠-￦]/.test(c) ? 2 : 1), 0);

declare('empty', 'Empty values', 'critical');
declare('fragments', 'Korean particle fragments left empty on purpose', 'info');
const PARTICLES = new Set('으로 로 이 가 을 를 과 와 은 는 다 의 도 에 에서 만 이다 였다 이었다'.split(' '));
declare('untranslated', 'Copied from ko / Hangul left in the translation', 'major');
declare('icu', 'Message syntax (ICU)', 'critical');
declare('placeholders', 'Placeholders against ko (names, legacy particle tokens)', 'critical');
declare('placeholderCount', 'Placeholder used a different number of times than in ko', 'minor');
declare('tags', 'Line breaks and tags against ko', 'major');
declare('plural', 'English plurals', 'major');
declare('pluralForms', 'ICU plural forms', 'critical');
declare('length', 'Short UI labels longer than ko (en > 1.5x, ja > 1.3x display width)', 'minor');
declare('jaPunct', 'Japanese: half-width punctuation next to Japanese text', 'minor');
declare('jaKana', 'Japanese: half-width katakana or a hyphen for the long vowel', 'major');
declare('jaVariants', 'Japanese: katakana spelled more than one way', 'minor');
declare('glossary', 'Glossary', 'major');
declare('logicValues', 'Identifier-like ko values (seeds, ids) kept as display resources', 'critical');

/** Count nouns that need a plural when a number comes before them. */
const COUNT_NOUNS = 'game|season|year|player|day|win|loss|run|hit|homer|home run|inning|pick|week|month|point|start|out|strikeout|walk|save|hold|error|slot|round|team|club|time|place|spot|rookie|pitcher|hitter|batter|appearance|at-bat|plate appearance|stolen base|base|double|triple|seat|fan|ticket|scout|coach|man|men|position|step|level|grade|vote|award|title|championship|pennant|league|series|match|series win|percent'.split('|');
const PLURAL_RE = new RegExp(`\\{(\\w+)\\}(?:\\s|-)(?:more |fewer |straight |consecutive |total |extra |of )?(${COUNT_NOUNS.join('|')})s?\\b`, 'gi');
/** Params that hold a count. Years, dates and names are not; numbers already formatted as text (toLocaleString,
    toFixed: seat and fan counts, ages) cannot drive a plural and are never 1 in practice. */
const NOT_COUNTS = /^(year\d*|season\d*|opens|until\d*|next|date|md\d*|me|opp|body|level|school|draft|prev|name\d*|label\d*|short\w*|club\d*|team\d*)$/;
const numericParam = (key, name) => {
  if (NOT_COUNTS.test(name)) return false;
  const e = metadata[key]?.params?.[name]?.expression ?? '';
  return !/toLocaleString|toFixed|name|label|short|join\(|\?.*['"]/i.test(e);
};
const katakanaWords = new Map(); // normalized → Map(spelling → [keys])

for (const l of ['en', 'ja']) {
  const t = res[l];
  if (!t) continue;
  for (const [key, src] of Object.entries(ko)) {
    const tr = t[key];
    if (typeof tr !== 'string' || typeof src !== 'string') continue;
    if (!tr.trim() && src.trim()) {
      // Korean particles and endings have no counterpart (josa fragments, a sentence-final 다): empty on purpose.
      if (PARTICLES.has(src.trim()) && !/name/i.test(key)) report('fragments', '', 'info', { locale: l, key, ko: src });
      else report('empty', 'Empty values', 'critical', { locale: l, key, ko: src });
      continue;
    }
    const bare = tr.replace(LEGACY, '');
    if (HANGUL.test(bare)) report('untranslated', '', 'major', { locale: l, key, ko: src, value: tr, problem: tr === src ? 'same as ko' : 'Hangul in translation' });

    // Placeholders.
    let parsed;
    try {
      parsed = icuArgs(tr);
    } catch (e) {
      report('icu', '', 'critical', { locale: l, key, value: tr, error: e.message ?? String(e) });
      continue;
    }
    const want = koArgs(src);
    const a = new Set(want.args),
      b = new Set(parsed.args);
    const missing = [...a].filter((x) => !b.has(x)),
      extra = [...b].filter((x) => !a.has(x));
    if (missing.length || extra.length) report('placeholders', '', 'critical', { locale: l, key, ko: src, value: tr, missing, extra });
    const legacyMissing = want.legacy.filter((x) => !parsed.legacy.includes(x));
    const legacyExtra = parsed.legacy.filter((x) => !want.legacy.includes(x));
    if (legacyMissing.length || legacyExtra.length) report('placeholders', '', 'critical', { locale: l, key, ko: src, value: tr, legacyMissing, legacyExtra });
    if (!missing.length && !extra.length) {
      const ca = count(want.args),
        cb = count(parsed.args.filter((x) => !parsed.plurals.some((p) => p.name === x)));
      const diff = [...ca].filter(([n, c]) => !parsed.plurals.some((p) => p.name === n) && (cb.get(n) ?? 0) !== c).map(([n, c]) => `${n}: ko ${c}, ${l} ${cb.get(n) ?? 0}`);
      if (diff.length) report('placeholderCount', '', 'minor', { locale: l, key, ko: src, value: tr, diff });
    }

    // Line breaks and tags.
    if (breaks(src) !== breaks(tr)) report('tags', '', 'major', { locale: l, key, problem: `line breaks: ko ${breaks(src)}, ${l} ${breaks(tr)}`, ko: src, value: tr });
    const ta = tags(src).join(' '),
      tb = tags(tr).join(' ');
    if (ta !== tb) report('tags', '', 'major', { locale: l, key, problem: `tags: ko [${ta}], ${l} [${tb}]`, ko: src, value: tr });

    // Plurals.
    for (const p of parsed.plurals) {
      if (!p.options.includes('other')) report('pluralForms', '', 'critical', { locale: l, key, value: tr, problem: `${p.name}: no "other" form` });
      if (l === 'en' && !p.ordinal && !p.options.includes('one') && !p.options.includes('=1')) report('pluralForms', '', 'critical', { locale: l, key, value: tr, problem: `${p.name}: no "one" form` });
    }
    if (l === 'en')
      for (const m of tr.matchAll(PLURAL_RE)) {
        if (!numericParam(key, m[1])) continue;
        // "a {n}-game streak" is singular in English; "Round {r} pick", "No. {n} spot" are ordinals.
        if (m[0].includes('-') || /(Round|No\.|#|Level|Tier|Game|Pick)\s*$/i.test(tr.slice(0, m.index))) continue;
        if (/^(season|rookie|awards?)$/i.test(m[2])) continue;
        report('plural', '', 'major', { locale: l, key, value: tr, problem: `"${m[0]}" needs {${m[1]}, plural, one {…} other {…}}` });
      }

    // Length: short UI labels (buttons, tabs, headers: up to 8 Hangul) by display width. Sentences wrap.
    if (key.startsWith('ui.')) {
      const flat = (s) => s.replace(LEGACY, '{$1}').replace(/\{[^{}]*\{[^{}]*\}[^{}]*\}/g, 'xxxx').replace(SIMPLE, 'xxxx');
      const wk = width(flat(src)),
        wt = width(flat(tr));
      const limit = l === 'en' ? 1.5 : 1.3;
      if (wk >= 4 && wk <= 16 && wt > wk * limit && wt - wk >= 4) report('length', '', 'minor', { locale: l, key, ratio: Math.round((wt / wk) * 100) / 100, ko: src, value: tr });
    }

    // Japanese notation.
    if (l === 'ja') {
      const text = tr.replace(LEGACY, '').replace(/\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, ' ');
      const jp = '[\\u3040-\\u30FF\\u4E00-\\u9FFF]';
      const half = new RegExp(`${jp}[!?]|${jp},|,${jp}|[!?]${jp}`, 'u');
      if (half.test(text)) report('jaPunct', '', 'minor', { locale: l, key, value: tr });
      if (/[･-ﾟ]/.test(text) || (/[゠-ヺ][-‐-―－]/.test(text) && !/[゠-ヺ]-[゠-ヺ]/.test(text)))
        report('jaKana', '', 'major', { locale: l, key, value: tr });
      // Words: katakana runs split at the middle dot; compared without long vowels (ロスター/ロースター, ウェイバー/ウェーバー).
      for (const w of (text.match(/[ァ-ヺー・]+/g) ?? []).flatMap((x) => x.split('・')).filter((x) => x.length >= 3)) {
        const norm = w.replace(/ー/g, '').replace(/ェイ/g, 'ェ').replace(/ェ$/, '');
        if (!katakanaWords.has(norm)) katakanaWords.set(norm, new Map());
        const m = katakanaWords.get(norm);
        if (!m.has(w)) m.set(w, []);
        m.get(w).push(key);
      }
    }
  }
}
// The same katakana word spelled with and without a long vowel.
for (const [, spellings] of katakanaWords) {
  if (spellings.size < 2) continue;
  const list = [...spellings].map(([w, keys]) => ({ w, n: keys.length, keys: keys.slice(0, 3) }));
  report('jaVariants', '', 'minor', { spellings: list });
}

// Glossary.
for (const term of glossary?.terms ?? []) {
  for (const l of ['en', 'ja']) {
    const t = res[l];
    if (!t) continue;
    const accept = term[l] ?? [];
    for (const [key, src] of Object.entries(ko)) {
      if (!(term.koRe ? new RegExp(term.koRe).test(src) : src.includes(term.ko)) || (term.skipIf ?? []).some((s) => src.includes(s))) continue;
      const tr = t[key];
      if (typeof tr !== 'string') continue;
      const lower = tr.toLowerCase();
      const ok = accept.some((w) => (l === 'en' ? new RegExp(`(^|[^A-Za-z])${w.toLowerCase().replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}`).test(lower) : tr.includes(w)));
      if (!ok) report('glossary', '', 'major', { locale: l, key, term: term.ko, expected: accept.join(' | '), ko: src, value: tr });
    }
  }
}

// Identifier-like values: a key whose ko text is an id (no spaces before a placeholder-dash run) is logic, not text.
for (const [key, src] of Object.entries(ko)) if (/^\{\w+\}-[\w-]+-/.test(src) || /^[a-z]+(-[a-z0-9]+)+-?\{/.test(src)) report('logicValues', '', 'critical', { key, ko: src });

// Name tables: same Korean spelling with two renderings, and empty renderings.
declare('names', 'Name tables (duplicates with different renderings, empty cells)', 'major');
function nameRows(table, path = []) {
  if (Array.isArray(table) && table.every((x) => Array.isArray(x))) return [[path.join('.'), table]];
  if (table && typeof table === 'object') return Object.entries(table).flatMap(([k, v]) => nameRows(v, [...path, k]));
  return [];
}
for (const [file, table] of Object.entries(names)) {
  if (!table) continue;
  for (const [path, rows] of nameRows(table)) {
    const seen = new Map();
    for (const row of rows) {
      const [k, en, ja] = row;
      if (!en || !ja) report('names', '', 'major', { file, path, row, problem: 'empty rendering' });
      if (seen.has(k)) {
        const [en0, ja0] = seen.get(k);
        if (en0 !== en || ja0 !== ja) report('names', '', 'major', { file, path, ko: k, problem: `two renderings: ${en0}/${ja0} and ${en}/${ja}` });
      } else seen.set(k, [en, ja]);
    }
  }
}

// ---------------------------------------------------------------- code

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|mjs)$/.test(name) && !/\.test\.[jt]sx?$/.test(name)) files.push(p);
  }
})(join(ROOT, 'src'));

declare('missingKeys', 'Keys the code uses that ko does not have', 'critical');
declare('unusedKeys', 'Keys no code uses and no text matches (dead)', 'minor');
declare('displayOnlyKeys', 'Keys no code names, kept to translate the same Korean text at display', 'info');
declare('hangulCode', 'Hangul string literals still in code (outside src/i18n)', 'info');
declare('logicStrings', 'Korean logic strings in code (comparisons, switch cases, object keys, includes)', 'info');
declare('missedText', 'Korean text in code with no resource (missed by the extraction)', 'major');
declare('keptUncovered', 'Kept Korean strings with no resource to show them in en/ja', 'minor');
declare('nameCoverage', 'Name parts the generators use with no en/ja rendering', 'major');
declare('displayInLogic', 'Display text (t/rich) used where the canonical Korean is compared or stored', 'critical');

const used = new Set();
const CALLS = new Set(['__i18n_t', '__i18n_k', '__i18n_rich', 't', 'k', 'rich']);
const hangulSites = [];
const logicSites = [];
const isI18n = (f) => f.startsWith(I18N);

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : file.endsWith('js') ? ts.ScriptKind.JS : ts.ScriptKind.TS);
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && CALLS.has(node.expression.text)) {
      const a = node.arguments[0];
      if (a && ts.isStringLiteralLike(a) && /^[a-z]\w*\.[\w.]+$/i.test(a.text) && (node.expression.text.startsWith('__i18n') || a.text in ko)) {
        used.add(a.text);
        if (!(a.text in ko)) report('missingKeys', '', 'critical', { file: rel, line: line(a), key: a.text });
        // t()/rich() is the display locale: never compare it or use it as an id.
        if (/(^|_)(t|rich)$/.test(node.expression.text)) {
          const p = node.parent;
          const compared = ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(p.operatorToken.kind);
          if (compared || ts.isCaseClause(p) || ts.isComputedPropertyName(p) || (ts.isTemplateSpan(p) && /id|seed|key/i.test(p.parent.head?.text ?? ''))) report('displayInLogic', '', 'critical', { file: rel, line: line(node), code: node.getText(sf).slice(0, 120) });
        }
      }
    }
    if (!isI18n(file) && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) && HANGUL.test(node.text)) {
      const p = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node) ? node.parent : node.parent.parent;
      let kind = 'text';
      if (ts.isBinaryExpression(p) && /Equals/.test(ts.SyntaxKind[p.operatorToken.kind])) kind = 'comparison';
      else if (ts.isCaseClause(p)) kind = 'switch case';
      else if ((ts.isPropertyAssignment(p) && p.name === node) || ts.isComputedPropertyName(p)) kind = 'object key';
      else if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && ['includes', 'has', 'indexOf', 'startsWith', 'endsWith', 'get'].includes(p.expression.name.text)) kind = `.${p.expression.name.text}()`;
      else if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && ts.isIdentifier(p.expression.expression) && p.expression.expression.text === 'console') kind = 'log';
      else if (ts.isLiteralTypeNode(p)) kind = 'type';
      else if (ts.isArrayLiteralExpression(p) && ts.isCallExpression(p.parent) && ts.isPropertyAccessExpression(p.parent.expression) && p.parent.expression.name.text === 'includes') kind = '.includes()';
      else if (ts.isArrayLiteralExpression(p) && ts.isPropertyAccessExpression(p.parent) && p.parent.name.text === 'includes') kind = '.includes()';
      const site = { file: rel, line: line(node), kind, text: node.text.trim().slice(0, 60), full: node.text };
      if (kind === 'text') hangulSites.push(site);
      else if (kind !== 'log' && kind !== 'type') logicSites.push(site);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
// Keys referenced some other way (built names) count as used when their exact text appears in code.
const allCode = files.filter((f) => !isI18n(f)).map((f) => readFileSync(f, 'utf8')).join('\n');
// Keys no code names are still needed when their Korean text is what a kept literal or another key produces: the display
// path finds the translation by that text. Only keys whose text appears nowhere else are dead.
{
  const unused = Object.keys(ko).filter((key) => !used.has(key) && !allCode.includes(key));
  const unusedSet = new Set(unused);
  const live = new Set(Object.entries(ko).filter(([key]) => !unusedSet.has(key)).map(([, v]) => v));
  for (const s of [...hangulSites, ...logicSites]) live.add(s.full);
  for (const key of unused) report(live.has(ko[key]) ? 'displayOnlyKeys' : 'unusedKeys', '', live.has(ko[key]) ? 'info' : 'minor', { key, ko: ko[key] });
}
// Hangul still in code. Strings the extraction kept on purpose (docs/localization/preserved-strings.json) are shown
// through display(): they need a ko resource with the same text so the display path can translate them. Name
// generator lists are covered by the name tables (checked below). Anything else is text the extraction missed.
const preserved = new Set((loadJson(join(ROOT, 'docs/localization/preserved-strings.json'), 'json') ?? []).map((p) => `${p.source}\u0000${p.text}`));
const koValues = new Set(Object.values(ko));
const NAME_LISTS = /src\/(draftroom\/names\.js|league\/foreign\.ts)$/;
for (const site of [...hangulSites, ...logicSites]) {
  const kept = preserved.has(`${site.file}\u0000${site.text}`) || preserved.has(`${site.file}\u0000${site.full}`);
  const covered = koValues.has(site.full) || koValues.has(site.full.trim());
  if (NAME_LISTS.test(site.file) && site.full.length > 20) continue;
  if (!kept && !covered) report('missedText', '', site.kind === 'text' ? 'major' : 'minor', { file: site.file, line: site.line, kind: site.kind, text: site.text });
  else if (!covered && site.kind === 'text') report('keptUncovered', '', 'minor', { file: site.file, line: site.line, text: site.text });
}
for (const s of hangulSites) report('hangulCode', '', 'info', s);
for (const s of logicSites) report('logicStrings', '', 'info', s);

// Every Korean name part the generators can produce has an en/ja rendering.
{
  const tables = { korean: new Set(), foreign: new Set() };
  for (const [, rows] of nameRows(names.korean ?? {})) for (const r of rows) tables.korean.add(r[0]);
  for (const [, rows] of nameRows(names.foreign ?? {})) for (const r of rows) tables.foreign.add(r[0]);
  const kn = readFileSync(join(ROOT, 'src/draftroom/names.js'), 'utf8');
  const korean = [...kn.matchAll(/names:'([^']+)'/g)].flatMap((m) => m[1].split(' ')).concat([...kn.matchAll(/\['([가-힣]+)',[\d.]+\]/g)].map((m) => m[1]));
  for (const n of new Set(korean)) if (!tables.korean.has(n)) report('nameCoverage', '', 'major', { table: 'korean', name: n });
  const fn = readFileSync(join(ROOT, 'src/league/foreign.ts'), 'utf8');
  const foreign = [...fn.matchAll(/split\(([`'])([\s\S]*?)\1\)/g)].flatMap((m) => m[2].trim().split(/\s+/));
  for (const n of new Set(foreign)) if (HANGUL.test(n) && !tables.foreign.has(n)) report('nameCoverage', '', 'major', { table: 'foreign', name: n });
}

// ---------------------------------------------------------------- output

const order = { critical: 0, major: 1, minor: 2, info: 3 };
const all = [...results.values()].sort((a, b) => order[a.severity] - order[b.severity]);
const totals = { critical: 0, major: 0, minor: 0, info: 0 };
for (const r of all) totals[r.severity] += r.items.length;
console.log(`i18n check: ${Object.keys(ko).length} keys × ${LOCALES.join('/')}, ${files.length} source files\n`);
for (const r of all) {
  const mark = r.items.length ? (r.severity === 'critical' ? '✗' : r.severity === 'info' ? '·' : '!') : '✓';
  console.log(`${mark} [${r.severity}] ${r.title}: ${r.items.length}`);
  for (const item of r.items.slice(0, r.items.length ? LIST : 0)) console.log('    ' + JSON.stringify(item, (k, v) => (k === 'full' ? undefined : v)).slice(0, 220));
  if (r.items.length > LIST) console.log(`    … ${r.items.length - LIST} more`);
}
console.log(`\ncritical ${totals.critical}, major ${totals.major}, minor ${totals.minor}, info ${totals.info}`);
if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({ totals, checks: all }, null, 1));
  console.log(`report: ${JSON_OUT}`);
}
process.exit(totals.critical || (STRICT && totals.major) ? 1 : 0);
