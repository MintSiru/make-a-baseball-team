/* Display locales (en, ja) for the UI.

   The simulation, the saves and every stored text stay in canonical Korean (k()). This module only changes what is
   shown, and only in the page: the worker never loads it.

   - t() keys use the locale's own text (src/i18n/locales/{en,ja}.json); a key the locale lacks falls back to Korean.
   - Korean that reaches the screen any other way (stored news and reports, labels made with k(), names) is
     translated at the last step, when Preact makes the text node (options.vnode): an exact match on a Korean
     resource, an amount of money, a person's name from the name tables, or a resource pattern with {params} whose
     captured values are translated the same way. Text it cannot place is shown as it is.
   - Amounts: ko patterns write units after the number ({value}억, {value}만 원, {value}만 달러). English shows the
     amount as ₩350M / $1.2M; Japanese keeps 億・万 with ウォン/ドル in its own text.
   - The choice of language is a browser preference (localStorage), never part of a save. */
import { options, type VNode } from 'preact';
import { IntlMessageFormat } from 'intl-messageformat';
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { getLocale, LOCALE_STORAGE_KEY, LOCALES, setLocale, type Locale, type MessageKey, type Translator, type Values } from './index';
import { koSource } from './ko-types';
import en from './locales/en.json';
import ja from './locales/ja.json';
import koreanNames from './names/korean-name-labels.json';
import foreignNames from './names/foreign-name-labels.json';
import paramHints from './param-hints.json';

/** From the code that fills each param (scripts/i18n-hints.mjs): the particle it ends with, or its only values. */
const HINTS = paramHints as Record<string, Record<string, { ends?: string[]; one?: string[] }>>;

type Target = Exclude<Locale, 'ko'>;
const RESOURCES: Record<Target, Record<string, string>> = { en, ja };
const KO = koSource as Record<string, string>;
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
const LEGACY = /\{([A-Za-z_]\w*)\|[^{}]*\}/g;
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── Amounts ─────────────────────────────────────────────────────────────────────────────────────────

/** How a ko pattern counts a param: 억 / 만 (원) / 원 / 만 달러 / 달러 of money, or 만 of people. */
type Unit = 'eok' | 'man' | 'won' | 'usdMan' | 'usd' | 'manCount';
const UNIT_RE = /\{([A-Za-z_]\w*)\}\s?(억|만\s?원|만\s?달러|만|원|달러)(?![가-힣])|\{([A-Za-z_]\w*)\}\s?(억|만)(?=\s|[,.)·]|$)/g;
const unitCache = new Map<string, { units: Record<string, Unit>; combos: [string, string][] }>();
function unitsOf(key: string) {
  let u = unitCache.get(key);
  if (u) return u;
  const ko = KO[key] ?? '';
  const units: Record<string, Unit> = {};
  for (const m of ko.matchAll(UNIT_RE)) {
    const name = m[1] ?? m[3]!,
      word = (m[2] ?? m[4]!).replace(/\s/g, '');
    const before = ko.slice(0, m.index);
    units[name] = word === '억' ? 'eok' : word === '만원' ? 'man' : word === '만달러' ? 'usdMan' : word === '원' ? 'won' : word === '달러' ? 'usd' : /인구|관중|명/.test(before.slice(-6)) ? 'manCount' : 'man';
  }
  // "{a}억 {b}만": one amount in two params.
  const combos = [...ko.matchAll(/\{(\w+)\}억\s?\{(\w+)\}만/g)].map((m) => [m[1]!, m[2]!] as [string, string]);
  u = { units, combos };
  unitCache.set(key, u);
  return u;
}
const numberOf = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v ?? '').replace(/[,\s]/g, '').replace(/^−/, '-');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
};
/** 350000000 → "₩350M"; the sign before the symbol. */
export function compactAmount(n: number, symbol: string): string {
  const a = Math.abs(n),
    sign = n < 0 ? '-' : '';
  const f = (x: number, suffix: string) => `${sign}${symbol}${x.toLocaleString('en-US', { maximumFractionDigits: x >= 100 ? 1 : 2 })}${suffix}`;
  if (a >= 1e12) return f(a / 1e12, 'T');
  if (a >= 1e9) return f(a / 1e9, 'B');
  if (a >= 1e6) return f(a / 1e6, 'M');
  if (a >= 1e4) return f(a / 1e3, 'K');
  return `${sign}${symbol}${a.toLocaleString('en-US')}`;
}
const UNIT_SCALE: Record<Unit, number> = { eok: 1e8, man: 1e4, won: 1, usdMan: 1e4, usd: 1, manCount: 1e4 };
const UNIT_SYMBOL: Record<Unit, string> = { eok: '₩', man: '₩', won: '₩', usdMan: '$', usd: '$', manCount: '' };

/** "1억 7,500만 원", "64.6억", "3,000만", "16,600원", "40만 달러" → the locale's amount, or null. */
const MONEY_RE = /^([-−+])?\s*(?:([\d,]+(?:\.\d+)?)억)?\s*(?:([\d,]+(?:\.\d+)?)만)?\s*(원|달러)?$/;
function moneyText(s: string, lc: Target): string | null {
  const m = MONEY_RE.exec(s);
  if (!m || (!m[2] && !m[3] && !(m[4] && /\d/.test(s)))) return null;
  if (!m[2] && !m[3]) {
    const plain = /^([-−])?\s*([\d,]+)\s?(원|달러)$/.exec(s);
    if (!plain) return null;
    const n = numberOf(plain[2])! * (plain[1] ? -1 : 1);
    return lc === 'en' ? compactAmount(n, plain[3] === '달러' ? '$' : '₩') : `${plain[1] ? '-' : ''}${plain[2]}${plain[3] === '달러' ? 'ドル' : 'ウォン'}`;
  }
  const usd = m[4] === '달러';
  if (lc === 'ja') return `${m[1] === '+' ? '+' : m[1] ? '-' : ''}${m[2] ? `${m[2]}億` : ''}${m[3] ? `${m[3]}万` : ''}${m[4] ? (usd ? 'ドル' : 'ウォン') : ''}`;
  const n = ((numberOf(m[2]) ?? 0) * 1e8 + (numberOf(m[3]) ?? 0) * 1e4) * (m[1] && m[1] !== '+' ? -1 : 1);
  return (m[1] === '+' ? '+' : '') + compactAmount(n, usd ? '$' : '₩');
}

// ── Names ───────────────────────────────────────────────────────────────────────────────────────────

type Row = [string, string, string];
const surnames = new Map<string, Row>((koreanNames.surnames as Row[]).map((r) => [r[0], r]));
const givens = new Map<string, Row>((koreanNames.givenNames as Row[]).map((r) => [r[0], r]));
const foreignPools = Object.values(foreignNames as unknown as Record<string, { given: Row[]; family: Row[] }>).map((p) => ({
  given: new Map(p.given.map((r) => [r[0], r])),
  family: new Map(p.family.map((r) => [r[0], r])),
}));
const taiwan = foreignPools[Object.keys(foreignNames).indexOf('taiwan')]!;
const SUFFIX: Record<string, Row> = { 주니어: ['주니어', 'Jr.', 'ジュニア'] };
const col = (lc: Target) => (lc === 'en' ? 1 : 2);

/* Revised Romanization and a katakana reading, for Korean given names the tables do not list (staff, owners). */
const INITIAL = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const MEDIAL = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const FINAL = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];
const KANA_ROW: Record<string, string> = { g: 'k', kk: 'k', k: 'k', n: 'n', d: 't', tt: 't', t: 't', r: 'r', m: 'm', b: 'p', pp: 'p', p: 'p', s: 's', ss: 's', '': '', j: 'ch', jj: 'ch', ch: 'ch', h: 'h' };
const VOWEL_KANA: Record<string, string> = { a: 'a', ae: 'e', ya: 'ya', yae: 'ye', eo: 'o', e: 'e', yeo: 'yo', ye: 'ye', o: 'o', wa: 'wa', wae: 'we', oe: 'we', yo: 'yo', u: 'u', wo: 'wo', we: 'we', wi: 'wi', yu: 'yu', eu: 'u', ui: 'ui', i: 'i' };
const KANA: Record<string, string> = {
  a: 'ア', i: 'イ', u: 'ウ', e: 'エ', o: 'オ', ya: 'ヤ', yu: 'ユ', ye: 'イェ', yo: 'ヨ', wa: 'ワ', wi: 'ウィ', we: 'ウェ', wo: 'ウォ', ui: 'ウィ',
  ka: 'カ', ki: 'キ', ku: 'ク', ke: 'ケ', ko: 'コ', kya: 'キャ', kyu: 'キュ', kye: 'ケ', kyo: 'キョ', kwa: 'クァ', kwi: 'クィ', kwe: 'クェ', kwo: 'クォ', kui: 'キ',
  na: 'ナ', ni: 'ニ', nu: 'ヌ', ne: 'ネ', no: 'ノ', nya: 'ニャ', nyu: 'ニュ', nye: 'ニェ', nyo: 'ニョ', nwa: 'ヌァ', nwi: 'ヌィ', nwe: 'ヌェ', nwo: 'ヌォ', nui: 'ニ',
  ta: 'タ', ti: 'ティ', tu: 'トゥ', te: 'テ', to: 'ト', tya: 'テャ', tyu: 'テュ', tye: 'テ', tyo: 'ティョ', twa: 'トァ', twi: 'トゥィ', twe: 'トェ', two: 'トォ', tui: 'ティ',
  ra: 'ラ', ri: 'リ', ru: 'ル', re: 'レ', ro: 'ロ', rya: 'リャ', ryu: 'リュ', rye: 'リェ', ryo: 'リョ', rwa: 'ルァ', rwi: 'ルィ', rwe: 'ルェ', rwo: 'ルォ', rui: 'リ',
  ma: 'マ', mi: 'ミ', mu: 'ム', me: 'メ', mo: 'モ', mya: 'ミャ', myu: 'ミュ', mye: 'ミェ', myo: 'ミョ', mwa: 'ムァ', mwi: 'ムィ', mwe: 'ムェ', mwo: 'ムォ', mui: 'ミ',
  pa: 'パ', pi: 'ピ', pu: 'プ', pe: 'ペ', po: 'ポ', pya: 'ピャ', pyu: 'ピュ', pye: 'ピェ', pyo: 'ピョ', pwa: 'プァ', pwi: 'プィ', pwe: 'プェ', pwo: 'プォ', pui: 'ピ',
  sa: 'サ', si: 'シ', su: 'ス', se: 'セ', so: 'ソ', sya: 'シャ', syu: 'シュ', sye: 'シェ', syo: 'ショ', swa: 'スァ', swi: 'スィ', swe: 'スェ', swo: 'スォ', sui: 'シ',
  cha: 'チャ', chi: 'チ', chu: 'チュ', che: 'チェ', cho: 'チョ', chya: 'チャ', chyu: 'チュ', chye: 'チェ', chyo: 'チョ', chwa: 'チュァ', chwi: 'チュィ', chwe: 'チュェ', chwo: 'チュォ', chui: 'チ',
  ha: 'ハ', hi: 'ヒ', hu: 'フ', he: 'ヘ', ho: 'ホ', hya: 'ヒャ', hyu: 'ヒュ', hye: 'ヘ', hyo: 'ヒョ', hwa: 'ファ', hwi: 'フィ', hwe: 'フェ', hwo: 'フォ', hui: 'ヒ',
};
const FINAL_KANA: Record<string, string> = { '': '', k: 'ク', n: 'ン', t: 'ッ', l: 'ル', m: 'ム', p: 'プ', ng: 'ン' };
function syllables(s: string) {
  return [...s].map((c) => {
    const x = c.charCodeAt(0) - 0xac00;
    return { i: INITIAL[Math.floor(x / 588)]!, m: MEDIAL[Math.floor((x % 588) / 28)]!, f: FINAL[x % 28]! };
  });
}
function romanize(s: string, lc: Target): string {
  const parts = syllables(s);
  if (lc === 'en') {
    const w = parts.map((p) => p.i + p.m + p.f).join('-');
    return w[0]!.toUpperCase() + w.slice(1);
  }
  return parts.map((p) => (KANA[(KANA_ROW[p.i] ?? '') + (VOWEL_KANA[p.m] ?? '')] ?? '') + FINAL_KANA[p.f]).join('');
}

/** Names in the game (players, staff): only these are read as people when the tables do not list every part. */
const known = new Set<string>();
/** Text the player typed (our club's name): shown as typed, and not counted as untranslated in a sentence. */
const kept = new Set<string>();
/** Words of the game's own names that the tables cannot render (a foreign part missing): shown as they are. */
const opaque = new Set<string>();
/** Family names of the game's foreign players, which the page also shows alone. */
const knownFamily = new Set<string>();

const korean = (sur: Row, given: string, g: Row | undefined, lc: Target) => {
  const c = col(lc);
  const first = g ? g[c] : romanize(given, lc);
  return lc === 'en' ? `${sur[c]} ${first}` : `${sur[c]}・${first}`;
};
/** A person's name in the locale: Korean (surname + given) or foreign (each part from the generator's tables). */
function personName(s: string, lc: Target): string | null {
  const c = col(lc);
  const isKnown = known.has(s);
  if (/^[가-힣]{2,4}$/.test(s)) {
    for (const len of [2, 1]) {
      const sur = surnames.get(s.slice(0, len));
      const given = s.slice(len);
      if (!sur || !given) continue;
      const g = givens.get(given);
      // A three-letter word made of a surname and a listed given name is a name; shorter ones only when the game has
      // such a person (정원, 조건 are words).
      if (g && (given.length >= 2 || isKnown)) return korean(sur, given, g, lc);
      if (!g && isKnown && given.length <= 2) return korean(sur, given, undefined, lc);
    }
    // Taiwanese names run together ("린자웨이"): family name, then the given name (romanized when not listed, for
    // the game's own people only; both parts listed is a name wherever it shows, as on the foreign market).
    for (const len of [1, 2]) {
      const f = taiwan.family.get(s.slice(0, len));
      if (!f || s.length === len) continue;
      const g = taiwan.given.get(s.slice(len));
      if (!g && !isKnown) continue;
      const given = g ? g[c] : romanize(s.slice(len), lc);
      return lc === 'en' ? `${f[c]} ${given}` : `${f[c]}・${given}`;
    }
  }
  // A foreign player's family name alone (the lineup card), when the game has such a player.
  if (knownFamily.has(s))
    for (const pool of foreignPools) {
      const f = pool.family.get(s);
      if (f) return f[c];
    }
  const words = s.split(' ');
  if (words.length >= 2 && words.length <= 4 && words.every((w) => /^[가-힣]+$/.test(w))) {
    const tail = SUFFIX[words.at(-1)!];
    const core = tail ? words.slice(0, -1) : words;
    const join = (rows: (Row | undefined)[]) => [...rows.map((r) => r![c]), ...(tail ? [tail[c]] : [])].join(lc === 'en' ? ' ' : '・');
    for (const pool of foreignPools) {
      const out = core.map((w) => pool.given.get(w) ?? pool.family.get(w));
      if (out.every(Boolean)) return join(out);
    }
    if (isKnown) {
      const out = core.map((w) => foreignPools.map((p) => p.given.get(w) ?? p.family.get(w)).find(Boolean));
      if (out.every(Boolean)) return join(out);
    }
  }
  return null;
}

/** Tells the translator who the people in the game are (call when a league loads or changes). */
export function registerNames(names: Iterable<string>) {
  const fresh: string[] = [];
  for (const n of names) if (n && !known.has(n)) known.add(n), fresh.push(n);
  for (const n of fresh) {
    const w = n.split(' ').filter((x) => x !== '주니어');
    if (w.length >= 2) knownFamily.add(w.at(-1)!);
  }
  for (const n of fresh) if (personName(n, 'en') == null) for (const w of n.split(/[^가-힣]+/)) if (w) opaque.add(w);
  if (fresh.length) clearCaches();
}
/** Text to show exactly as written (our club's typed name and short name). */
export function registerKept(texts: Iterable<string>) {
  let added = false;
  for (const t of texts) if (t && HANGUL.test(t) && !kept.has(t)) kept.add(t), (added = true);
  if (added) clearCaches();
}
/** Korean left in a translation once the kept texts and the game's own unlisted names are taken out. */
function untranslated(s: string): boolean {
  if (!HANGUL.test(s)) return false;
  let rest = s;
  for (const k of kept) if (rest.includes(k)) rest = rest.split(k).join(' ');
  if (!HANGUL.test(rest)) return false;
  // A name of the game's own that the tables cannot render (a foreign part missing) may stay as it is; any other
  // Korean word is untranslated.
  return rest.split(/[^가-힣]+/).some((w) => w && !kept.has(w) && !opaque.has(w));
}

// ── Patterns ────────────────────────────────────────────────────────────────────────────────────────

/** A ko pattern as literals and params: "{name} {ageIn}세 {posOf}{value}." */
type Token = { lit: RegExp } | { param: string; after?: RegExp };
interface Pattern {
  /** The key (with "#line" for one line of a key with several). */
  id: string;
  key: string;
  /** The Korean it reads (the key's text, or one line or sentence of it) and the text in the locale for it. */
  source: string;
  target: string;
  hints?: Record<string, { ends?: string[]; one?: string[] }>;
  /** Quick test: can the text match at all (lazy captures)? */
  re: RegExp;
  tokens: Token[];
  params: string[];
  weight: number;
  /** Literal characters of its own, Hangul or not (spaces aside). */
  anchored: number;
}
const PARTICLES = ['으로', '에서', '에게', '까지', '부터', '이다', '로', '이', '가', '을', '를', '은', '는', '과', '와', '의', '도', '에', '만', '다'];
/** Keys whose Korean is a grammar fragment (josa tables): never an exact translation of a word on its own. */
const FRAGMENT = /\.josa\./;

interface Index {
  exact: Map<string, string>;
  patterns: Pattern[];
  /** Patterns by the first two letters (or the one letter) of their longest Korean literal. */
  buckets: Map<string, Pattern[]>;
}
const indexes = new Map<Target, Index>();
function buildIndex(lc: Target): Index {
  const res = RESOURCES[lc];
  const votes = new Map<string, Map<string, number>>();
  const patterns: Pattern[] = [];
  const buckets = new Map<string, Pattern[]>();
  // Each key, and each line of a key whose text has several (the page shows them as separate paragraphs) when the
  // translation has as many lines.
  const units: [string, string, string, string][] = [];
  for (const [key, ko] of Object.entries(KO)) {
    const tr = res[key];
    if (tr == null || FRAGMENT.test(key)) continue;
    units.push([key, key, ko, tr]);
    // Lines, and sentences, when the translation has the same number: stored text is shown a line at a time, and a
    // sentence may come to the translator on its own (the rest of the text made from other resources).
    for (const [mark, split] of [['#', /\n/], ['§', /(?<=[.!?])\s+(?=\S)/]] as const) {
      const a = ko.split(split),
        b = tr.split(split);
      if (a.length > 1 && a.length === b.length) a.forEach((x, i) => x.trim() && /[가-힣]/.test(x) && units.push([`${key}${mark}${i}`, key, x, b[i]!]));
    }
  }
  for (const [id, key, ko, tr] of units) {
    if (!/\{[A-Za-z_]/.test(ko)) {
      if (!tr || !HANGUL.test(ko)) continue;
      // Appended pieces (" · 우리 평가는 …") also as the text after the joiner, which is how they reach the page.
      for (const [a, b] of [[ko, tr], [ko.replace(/^\s*[,·:;]\s*/, ''), tr.replace(/^\s*[,、·:;：]\s*/, '')]]) {
        const n = norm(a!);
        const v = votes.get(n) ?? new Map<string, number>();
        v.set(b!.trim(), (v.get(b!.trim()) ?? 0) + 1);
        votes.set(n, v);
      }
      continue;
    }
    // Pieces meant to be appended (", 관중 {value}명", " · {hld}홀드") also match on their own: the joining
    // punctuation is left out here and from the output.
    const parts = ko.trim().replace(/^[,·:;]\s*/, '').split(/(\{[A-Za-z_]\w*(?:\|[^{}]*)?\})/);
    let re = '^';
    const params: string[] = [];
    const tokens: Token[] = [];
    const literals: string[] = [];
    for (const part of parts) {
      const tok = /^\{([A-Za-z_]\w*)(?:\|([^{}]*))?\}$/.exec(part);
      if (tok) {
        params.push(tok[1]!);
        const alts = tok[2] ? `(?:${tok[2].split('/').map(escape).join('|')})` : '';
        tokens.push(alts ? { param: tok[1]!, after: new RegExp(alts, 'y') } : { param: tok[1]! });
        re += '([\\s\\S]*?)' + alts;
      } else if (part) {
        const lit = part.split(/(\s+)/).map((x) => (/^\s+$/.test(x) ? '\\s+' : escape(x))).join('');
        tokens.push({ lit: new RegExp(lit, 'y') });
        re += lit;
        literals.push(...part.split(/\s+/).filter((x) => HANGUL.test(x)));
      }
    }
    if (!literals.length) continue;
    const anchor = literals.reduce((a, b) => (b.length > a.length ? b : a));
    const p: Pattern = { id, key, source: ko, target: tr, hints: HINTS[key], re: new RegExp(re + '$'), tokens, params, weight: literals.join('').length, anchored: parts.filter((x) => !/^\{/.test(x)).join('').replace(/\s/g, '').length };
    patterns.push(p);
    const bucket = anchor.slice(0, 2);
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(p);
  }
  // A shape several keys share with different translations ("{n}개": HR, H, SB…) cannot be read back unless one
  // translation clearly leads; short appended pieces (" {sv}세") only make sense inside their own text.
  // Every top-level {…} (nested plural forms included) as {}.
  const shape = (x: string) => {
    let out = '',
      depth = 0;
    for (const ch of x.trim()) {
      if (ch === '{') {
        if (depth++ === 0) out += '{}';
      } else if (ch === '}') depth = Math.max(0, depth - 1);
      else if (depth === 0) out += ch;
    }
    return out.replace(/\s+/g, ' ');
  };
  const variants = new Map<string, Map<string, number>>();
  for (const p of patterns) {
    const v = variants.get(shape(p.source)) ?? new Map<string, number>();
    const t = shape(p.target);
    v.set(t, (v.get(t) ?? 0) + 1);
    variants.set(shape(p.source), v);
  }
  // One reading per shape: the translation most keys give it (the first on a tie).
  const chosen = new Map<string, string>();
  for (const [src, v] of variants) chosen.set(src, [...v].sort((a, b) => b[1] - a[1])[0]![0]);
  const usable = (p: Pattern) => !(/^\s/.test(p.source) && p.anchored <= 1) && chosen.get(shape(p.source)) === shape(p.target);
  for (const [b, list] of buckets) buckets.set(b, list.filter(usable));
  for (const list of buckets.values()) list.sort((a, b) => b.weight - a.weight);
  const exact = new Map<string, string>();
  for (const [ko, v] of votes) exact.set(ko, [...v].sort((a, b) => b[1] - a[1])[0]![0]);
  return { exact, patterns, buckets };
}
const indexOf = (lc: Target) => {
  let ix = indexes.get(lc);
  if (!ix) indexes.set(lc, (ix = buildIndex(lc)));
  return ix;
};

// ── Formatting a key ────────────────────────────────────────────────────────────────────────────────

type Compiled = { ast: MessageFormatElement[]; fmt: IntlMessageFormat; counts: Set<string>; choices: Map<string, Set<string>>; variants: Map<string, IntlMessageFormat> };
const formats = new Map<string, Compiled>();
function compiled(lc: Target, key: string, pattern: string): Compiled {
  const id = `${lc}:${key}`;
  let f = formats.get(id);
  if (!f) {
    const ast = parse(pattern.replace(LEGACY, '{$1}'), { ignoreTag: true });
    const counts = new Set<string>();
    /** Selects over numbers ({month, select, 1{January} …}): a value outside them is not a match. */
    const choices = new Map<string, Set<string>>();
    const walk = (els: MessageFormatElement[]) => {
      for (const el of els)
        if (el.type === TYPE.plural) {
          counts.add(el.value);
          for (const o of Object.values(el.options)) walk(o.value);
        } else if (el.type === TYPE.select) {
          const keys = Object.keys(el.options).filter((k) => k !== 'other');
          if (keys.length && keys.every((k) => /^\d+$/.test(k))) choices.set(el.value, new Set(keys));
          for (const o of Object.values(el.options)) walk(o.value);
        }
    };
    walk(ast);
    f = { ast, fmt: new IntlMessageFormat(ast, lc, undefined, { ignoreTag: true }), counts, choices, variants: new Map() };
    formats.set(id, f);
  }
  return f;
}
/** A count that is not a plain number ("5 2/3" innings, "1위"): its plural takes the "other" form and shows the
    value as it is instead of "#". */
function withoutCounts(els: MessageFormatElement[], names: Set<string>): MessageFormatElement[] {
  return els.flatMap((el): MessageFormatElement[] => {
    if (el.type === TYPE.plural && names.has(el.value)) {
      const other = el.options.other?.value ?? [];
      const swap = (xs: MessageFormatElement[]): MessageFormatElement[] => xs.map((x) => (x.type === TYPE.pound ? { type: TYPE.argument, value: el.value, location: x.location } : x.type === TYPE.plural || x.type === TYPE.select ? { ...x, options: Object.fromEntries(Object.entries(x.options).map(([k, o]) => [k, { ...o, value: swap(o.value) }])) } : x)) as MessageFormatElement[];
      return withoutCounts(swap(other), names);
    }
    if (el.type === TYPE.plural || el.type === TYPE.select) return [{ ...el, options: Object.fromEntries(Object.entries(el.options).map(([k, o]) => [k, { ...o, value: withoutCounts(o.value, names) }])) } as MessageFormatElement];
    return [el];
  });
}

/** The key in the locale with `values` (raw Korean data or already translated); null when it has no text. */
function formatKey(lc: Target, key: string, values: Values | undefined, translated: boolean, pattern: string | undefined = RESOURCES[lc][key], id = key): string | null {
  if (pattern == null) return null;
  if (!pattern.includes('{')) return pattern;
  const vs: Record<string, unknown> = {};
  for (const [name, v] of Object.entries(values ?? {})) vs[name] = !translated && typeof v === 'string' ? translateText(v, lc, 1, name) : v;
  // Read back from stored text, an amount param holds a number; anything else means the wrong pattern.
  // (만 alone may be the particle "only", so only the unmistakable units count.)
  if (translated)
    for (const [name, unit] of Object.entries(unitsOf(key).units))
      if (unit !== 'man' && unit !== 'manCount' && vs[name] != null && vs[name] !== '' && numberOf(vs[name]) == null) return null;
  if (lc === 'en') {
    const { units, combos } = unitsOf(key);
    for (const [a, b] of combos) {
      const x = numberOf(vs[a]),
        y = numberOf(vs[b]);
      if (x != null) {
        vs[a] = compactAmount(x * 1e8 + (y ?? 0) * 1e4, '₩');
        vs[b] = '';
      }
    }
    for (const [name, unit] of Object.entries(units)) {
      if (combos.some((c) => c.includes(name))) continue;
      const x = numberOf(vs[name]);
      if (x != null) vs[name] = compactAmount(x * UNIT_SCALE[unit], UNIT_SYMBOL[unit]);
    }
  }
  try {
    const c = compiled(lc, id, pattern);
    for (const [name, keys] of c.choices) if (!keys.has(String(numberOf(vs[name]) ?? vs[name]))) return null;
    const loose = new Set<string>();
    for (const name of c.counts) {
      const x = numberOf(vs[name]);
      if (x != null) vs[name] = x;
      else loose.add(name);
    }
    for (const [name, v] of Object.entries(vs)) if (v == null) vs[name] = '';
    let fmt = c.fmt;
    if (loose.size) {
      const id = [...loose].sort().join(',');
      let variant = c.variants.get(id);
      if (!variant) c.variants.set(id, (variant = new IntlMessageFormat(withoutCounts(c.ast, loose), lc, undefined, { ignoreTag: true })));
      fmt = variant;
    }
    return String(fmt.format(vs as Record<string, string | number>));
  } catch {
    return null;
  }
}

// ── Translating Korean text ─────────────────────────────────────────────────────────────────────────

const cache: Record<Target, Map<string, string>> = { en: new Map(), ja: new Map() };
function clearCaches() {
  cache.en.clear();
  cache.ja.clear();
  qualities.en.clear();
  qualities.ja.clear();
}
const SEPARATORS = /( · |·| \/ |, | ?→ ?| ↔ | \+ |: |\n|(?<=[.!?])\s+)/;

/** Each language by its own name, never translated (the language picker). */
export const LOCALE_NAMES: Record<Locale, string> = { ko: '한국어', en: 'English', ja: '日本語' };
export const LANGUAGE_LABEL = 'Language · 言語 · 언어';
const NEVER = new Set([LOCALE_NAMES.ko, LANGUAGE_LABEL]);

/** Korean → the locale. Anything it cannot translate completely is returned as it was (never half-translated). */
function translateText(s: string, lc: Target, depth = 0, hint = ''): string {
  if (!HANGUL.test(s) || NEVER.has(s) || kept.has(s)) return s;
  const memo = cache[lc];
  const hit = memo.get(s);
  if (hit !== undefined) return hit;
  // Leading joiners (" · 1승 1패", ", 관중 …", "— 질문") stay as they are, like spaces.
  const [, lead, core, trail] = /^(\s*(?:[,·:;—–]\s*)?)([\s\S]*?)(\s*)$/.exec(s)!;
  // Every step works on a strictly shorter piece of the text (a param, a piece between separators, one side of a
  // split), so the recursion ends; results, failures included, are cached.
  const tr = translateCore(core!, lc, depth);
  const out = lead! + (tr ?? core) + trail!;
  if (memo.size > 60000) memo.clear(), qualities[lc].clear();
  memo.set(s, out);
  qualities[lc].set(s, tr == null ? 9 : lastQuality);
  return out;
}
/** How a translation was found: 0 a resource, a name or an amount; 1 a pattern; 2 pieces between separators or
    brackets; 3 two halves of a text put together. Lower is surer; a pattern prefers the surest split. */
const qualities: Record<Target, Map<string, number>> = { en: new Map(), ja: new Map() };
let lastQuality = 0;
const qualityOf = (s: string, lc: Target) => (HANGUL.test(s) && !kept.has(s) ? (qualities[lc].get(s) ?? 0) : 0);
const full = (x: string | null) => (x != null && !untranslated(x) ? x : null);

/** A bare count with a Korean counter ("198개", "12,059명"): the counter depends on what is counted, which the text
    no longer says, so only the number is shown (Japanese keeps 人 for people). */
function countText(s: string, lc: Target): string | null {
  const m = /^([\d,]+(?:\.\d+)?)\s?(개|명)$/.exec(s);
  if (!m) return null;
  return lc === 'ja' && m[2] === '명' ? `${m[1]}人` : m[1]!;
}

/** Exact resource text; a quoted sentence often drops its final period ("할 말은 별로 없습니다"). */
function exact(s: string, lc: Target): string | null {
  const ix = indexOf(lc).exact;
  const n = norm(s);
  const hit = ix.get(n);
  if (hit != null) return hit;
  if (/[가-힣]$/.test(n)) {
    const withStop = ix.get(n + '.');
    if (withStop != null) return withStop.replace(/[.。]$/, '');
  }
  return null;
}

function exactOrName(s: string, lc: Target): string | null {
  return exact(s, lc) ?? moneyText(s, lc) ?? countText(s, lc) ?? personName(s, lc);
}

function translateCore(s: string, lc: Target, depth: number): string | null {
  lastQuality = 0;
  const direct = exactOrName(s, lc);
  if (direct != null) return direct;
  if (PARTICLES.includes(s)) return '';
  // A word or phrase with a particle stuck to it ("김민준은", "두산이", "어깨 관절와순 수술로"): the particle has no
  // counterpart. 만 after a number is the amount (3,000만), not the particle.
  for (const p of PARTICLES)
    if (s.length > p.length && s.endsWith(p) && !(p === '만' && /\d$/.test(s.slice(0, -p.length)))) {
      const rest = s.slice(0, -p.length);
      if (kept.has(rest) || !HANGUL.test(rest)) return (lastQuality = 0), rest;
      const tr = rest.includes(' ') ? full(translateText(rest, lc, depth + 1)) : exactOrName(rest, lc);
      if (tr != null) return (lastQuality = rest.includes(' ') ? qualityOf(rest, lc) : 0), tr;
    }
  // A label before a colon ("김민준: 좌전 안타" split at its space): the label, then the colon.
  const colon = /^(.+?)\s?([:：])$/.exec(s);
  if (colon && HANGUL.test(colon[1]!)) {
    const tr = full(translateText(colon[1]!, lc, depth + 1));
    if (tr != null) return (lastQuality = qualityOf(colon[1]!, lc)), tr + colon[2];
  }
  if (depth > 40) return null;
  const viaPattern = matchPattern(s, lc, depth);
  if (viaPattern != null) return (lastQuality = 1), viaPattern;
  // Labels and stat lines put together from several resources ("스카우트 팀장 김연준", "7회초 투수 교체: …",
  // "363경기 59승 65패"): split at a space where both sides are complete. Not for sentences, where the words depend
  // on each other.
  const words = s.split(' ');
  if (words.length > 1 && words.length <= 24 && !/[.!?다요]$/.test(s)) {
    for (let i = 1; i < words.length; i++) {
      const left = translateText(words.slice(0, i).join(' '), lc, depth + 1);
      if (untranslated(left)) continue;
      const right = translateText(words.slice(i).join(' '), lc, depth + 1);
      if (!untranslated(right)) return (lastQuality = 3), `${left} ${right}`.replace(/ {2,}/g, ' ');
    }
  }
  // "이름(구단)", "포수 (40)": the part before the brackets and the part inside, each complete.
  const paren = /^(.+?)\s?\(([^()]+)\)(\S*)$/.exec(s);
  if (paren) {
    const a = translateText(paren[1]!, lc, depth + 1),
      b = translateText(paren[2]!, lc, depth + 1);
    if (!untranslated(a) && !untranslated(b)) return (lastQuality = 2), lc === 'ja' ? `${a}（${b}）${paren[3]}` : `${a} (${b})${paren[3]}`;
  }
  // Lists and sentences: the pieces one by one (each either translated or left as it was).
  const pieces = s.split(SEPARATORS);
  if (pieces.length > 1) {
    const out = pieces.map((x, i) => (i % 2 ? x : translateText(x, lc, depth + 1))).join('');
    if (out !== s) return (lastQuality = 2), out;
  }
  return null;
}

function matchPattern(s: string, lc: Target, depth: number): string | null {
  const ix = indexOf(lc);
  const seen = new Set<Pattern>();
  const candidates: Pattern[] = [];
  for (let i = 0; i < s.length; i++)
    for (const len of [2, 1]) {
      const list = ix.buckets.get(s.slice(i, i + len));
      if (list) for (const p of list) if (!seen.has(p)) seen.add(p), candidates.push(p);
    }
  candidates.sort((a, b) => b.weight - a.weight);
  for (const p of candidates) {
    if (!p.re.test(s)) continue;
    const values = assign(p, s, lc, depth);
    if (!values) continue;
    const out = full(formatKey(lc, p.key, values, true, p.target, p.id));
    if (out != null) return out.trim().replace(/^[,、·:;：]\s*/, '').replace(/ {2,}/g, ' ');
  }
  return null;
}

/** A phrase that is a resource of its own (an injury, a label), with or without a particle after it. */
const phrase = (s: string, lc: Target) => exactOrName(s, lc) != null || PARTICLES.some((p) => s.endsWith(p) && exactOrName(s.slice(0, -p.length), lc) != null);

const sticky = (re: RegExp, s: string, at: number) => {
  re.lastIndex = at;
  const m = re.exec(s);
  return m ? m[0].length : -1;
};
/** Fits the text to a pattern: each param takes a piece that translates completely (backtracking over where the
    pieces end; a param before a literal takes the shortest piece that works, two params side by side try the
    longer first piece first, as "{posOf}{value}" over "투수다"). Null when no split works. */
function assign(p: Pattern, s: string, lc: Target, depth: number): Values | null {
  const toks = p.tokens;
  const values: Values = {};
  let budget = 400;
  let best: { cost: number; values: Values } | null = null;
  const small = p.anchored <= 2;
  const rec = (ti: number, pos: number, cost: number): void => {
    if (--budget < 0 || (best && cost >= best.cost)) return;
    if (ti === toks.length) {
      if (pos === s.length) best = { cost, values: { ...values } };
      return;
    }
    const t = toks[ti]!;
    if ('lit' in t) {
      const n = sticky(t.lit, s, pos);
      if (n >= 0) rec(ti + 1, pos + n, cost);
      return;
    }
    const next = toks[ti + 1];
    const ends: number[] = [];
    if (!next) ends.push(s.length);
    else if ('lit' in next || t.after) for (let e = pos; e <= s.length; e++) ends.push(e);
    else for (let e = s.length; e >= pos; e--) ends.push(e);
    for (const e of ends) {
      let after = e;
      if (t.after) {
        const n = sticky(t.after, s, e);
        if (n < 0) continue;
        after = e + n;
      }
      if (next && 'lit' in next && !t.after && sticky(next.lit, s, e) < 0) continue;
      const cap = s.slice(pos, e);
      const hint = p.hints?.[t.param];
      if (hint?.one && !hint.one.includes(cap)) continue;
      if (hint?.ends && cap && !hint.ends.some((x) => cap.endsWith(x))) continue;
      // A pattern with only a letter or two of its own ("{i}회{value}", "{value}위") is for short tokens: it may
      // not swallow words of a longer text.
      if (small && (/[:→]|[,.](?!\d)/.test(cap) || (/[가-힣]\s|\s[가-힣]/.test(cap) && !phrase(cap, lc)))) continue;
      // Only the generic optional pieces ({value}, {value2}…) may be empty; a name or a part never is.
      if (!cap.trim() && !/^value\d*$/.test(t.param)) continue;
      const v = translateText(cap, lc, depth + 1, t.param);
      if (untranslated(v)) continue;
      values[t.param] = v;
      rec(ti + 1, after, cost + qualityOf(cap, lc));
      if ((best && best.cost === 0) || budget < 0) return;
    }
  };
  rec(0, 0, 0);
  return best ? (best as { values: Values }).values : null;
}

// ── The translator, the page hook and the preference ────────────────────────────────────────────────

const translatorFor = (lc: Target): Translator => ({
  message: (key: MessageKey, values?: Values) => formatKey(lc, key, values, false),
  pattern: (key: MessageKey) => RESOURCES[lc][key] ?? null,
  text: (value: string) => translateText(value, lc),
});
const translators: Record<Target, Translator> = { en: translatorFor('en'), ja: translatorFor('ja') };

/** Korean → the display locale for one string (tests and tools). */
export const translateFor = (lc: Locale, value: string) => (lc === 'ko' ? value : translateText(value, lc));
/** A key in a locale (tests and tools). */
export const messageFor = (lc: Locale, key: MessageKey, values?: Values) => (lc === 'ko' ? null : formatKey(lc, key, values, false));

const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'] as const;
let hooked = false;
function hook() {
  if (hooked) return;
  hooked = true;
  const previous = options.vnode;
  options.vnode = (vnode: VNode) => {
    const lc = getLocale();
    if (lc !== 'ko') {
      const v = vnode as unknown as { type: unknown; props: unknown };
      if (v.type === null && typeof v.props === 'string') v.props = translateText(v.props, lc);
      else if (typeof v.type === 'string' && v.props && typeof v.props === 'object')
        for (const a of ATTRS) {
          const x = (v.props as Record<string, unknown>)[a];
          if (typeof x === 'string') (v.props as Record<string, unknown>)[a] = translateText(x, lc);
        }
    }
    previous?.(vnode);
  };
}

export function storedLocale(): Locale {
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY);
    return LOCALES.includes(v as Locale) ? (v as Locale) : 'ko';
  } catch {
    return 'ko';
  }
}

/** Shows the page in `lc` (and remembers it in this browser). */
export function applyLocale(lc: Locale, remember = true) {
  hook();
  setLocale(lc, lc === 'ko' ? null : translators[lc]);
  if (typeof document !== 'undefined') document.documentElement.lang = lc;
  if (remember)
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, lc);
    } catch {
      // Private mode: the choice lasts for this visit.
    }
}


