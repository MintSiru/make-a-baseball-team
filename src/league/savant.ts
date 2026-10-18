/* 2.0.4 (the 2.0 plan's fifth stage, the user's request): the detail numbers of the records room and a player's
   Savant-style page — where he stands among the league's regulars in each measure (percentile bars), where his hits
   came down this season (the spray chart) and a pitcher's mix and velocity by season.

   Everything here reads what the season lines and careers already hold (battedball.ts, fielding.ts); nothing new is
   drawn, so the plays do not move. */
import { hashUnit } from '../draftroom';
import type { FieldPos } from './engine/types';
import type { BatTotals, Player, PitTotals, SeasonRecord } from '../model/types';
import { battedRates } from './battedball';
import { fieldingRuns, sprintSpeed } from './fielding';
import { averageVelocity, fastballOf, repertoire } from './pitches';
import { isPitcher } from './players';
import { batterValues, groupValues, pitchingRunValue, pitchValues, usageBySide, type PitchValue } from './runvalue';
import { addInto, emptyBat, emptyPit, type LeagueState } from './state';
import { defensiveWar, leagueContext, woba } from './stats';

const share = (n: number, d: number) => (d ? (n / d) * 100 : 0);

/** Expected wOBA: the balls in play's expected value with the walks and hit batters (strikeouts are worth nothing). */
export function xwobaOf(b: BatTotals): number | null {
  if (!b.bip?.n) return null;
  const d = b.ab + b.bb + b.sf + b.hbp;
  return d ? (b.bip.xw / 1000 + 0.69 * b.bb + 0.72 * b.hbp) / d : null;
}

/** The same against a pitcher (his batters faced stand in for the denominator). */
export function xwobaAgainst(q: PitTotals): number | null {
  if (!q.bip?.n || !q.bf) return null;
  return (q.bip.xw / 1000 + 0.69 * q.bb + 0.72 * q.hbp) / q.bf;
}

/** A hitter's detail line: plate discipline, power, contact quality and fielding. */
export function batDetail(b: BatTotals, pos: FieldPos) {
  const r = battedRates(b.bip);
  const h = b.ab ? b.h / b.ab : 0;
  const slg = b.ab ? (b.h + b.d + 2 * b.t + 3 * b.hr) / b.ab : 0;
  return {
    bbPct: share(b.bb, b.pa),
    kPct: share(b.k, b.pa),
    iso: slg - h,
    woba: woba(b),
    xwoba: xwobaOf(b),
    xba: r?.xba ?? null,
    xslg: r?.xslg ?? null,
    ev: r?.ev ?? null,
    evMax: r?.evMax ?? null,
    la: r?.la ?? null,
    hard: r?.hard ?? null,
    barrel: r?.barrel ?? null,
    sweet: r?.sweet ?? null,
    gb: r?.gb ?? null,
    fb: r?.fb ?? null,
    pull: r?.pull ?? null,
    oaa: b.fld ? b.fld.oaa / 1000 : null,
    fldRuns: b.fld ? fieldingRuns(b.fld) : null,
    dwar: pos === 'DH' && !b.fld ? null : defensiveWar(b, pos),
  };
}

/** A pitcher's detail line: strikeouts and walks, home runs and the contact against him. */
export function pitDetail(q: PitTotals) {
  const r = battedRates(q.bip);
  return {
    kPct: share(q.k, q.bf),
    bbPct: share(q.bb, q.bf),
    kbb: share(q.k - q.bb, q.bf),
    hr9: q.outs ? (27 * q.hr) / q.outs : 0,
    xwoba: xwobaAgainst(q),
    xba: r?.xba ?? null,
    ev: r?.ev ?? null,
    la: r?.la ?? null,
    hard: r?.hard ?? null,
    barrel: r?.barrel ?? null,
    gb: r?.gb ?? null,
    fb: r?.fb ?? null,
  };
}

/** The most games a first-team club has played this season (the regulars' bar moves with it). */
function teamGames(s: LeagueState) {
  const n: Record<string, number> = {};
  for (const g of s.scores) {
    n[g.home] = (n[g.home] ?? 0) + 1;
    n[g.away] = (n[g.away] ?? 0) + 1;
  }
  return Math.max(1, ...Object.values(n));
}

export type PercentileKey =
  | 'xwoba'
  | 'xba'
  | 'xslg'
  | 'ev'
  | 'barrel'
  | 'hard'
  | 'kPct'
  | 'bbPct'
  | 'sprint'
  | 'oaa'
  | 'velo'
  | 'gb';

export interface Percentile {
  key: PercentileKey;
  /** The value as shown (already formatted). */
  value: string;
  /** 1 … 100: the share of the league's regulars he is better than (100 the best). */
  pct: number;
}

interface Metric<T> {
  key: PercentileKey;
  of: (x: T) => number | null;
  /** Lower is better (strikeouts for a hitter, contact against a pitcher). */
  low?: boolean;
  fmt: (v: number) => string;
}

const three = (v: number) => v.toFixed(3).replace(/^0/, '');
const one = (v: number) => v.toFixed(1);

interface BatRow {
  p: Player;
  b: BatTotals;
}
interface PitRow {
  p: Player;
  q: PitTotals;
}

const BAT: Metric<BatRow>[] = [
  { key: 'xwoba', of: (x) => xwobaOf(x.b), fmt: three },
  { key: 'xba', of: (x) => battedRates(x.b.bip)?.xba ?? null, fmt: three },
  { key: 'xslg', of: (x) => battedRates(x.b.bip)?.xslg ?? null, fmt: three },
  { key: 'ev', of: (x) => battedRates(x.b.bip)?.ev ?? null, fmt: one },
  { key: 'barrel', of: (x) => battedRates(x.b.bip)?.barrel ?? null, fmt: one },
  { key: 'hard', of: (x) => battedRates(x.b.bip)?.hard ?? null, fmt: one },
  { key: 'kPct', of: (x) => share(x.b.k, x.b.pa), low: true, fmt: one },
  { key: 'bbPct', of: (x) => share(x.b.bb, x.b.pa), fmt: one },
  { key: 'sprint', of: (x) => sprintSpeed(x.p), fmt: (v) => v.toFixed(2) },
  { key: 'oaa', of: (x) => (x.b.fld ? x.b.fld.oaa / 1000 : null), fmt: (v) => (v > 0 ? `+${Math.round(v)}` : String(Math.round(v))) },
];

const PIT: Metric<PitRow>[] = [
  { key: 'xwoba', of: (x) => xwobaAgainst(x.q), low: true, fmt: three },
  { key: 'xba', of: (x) => battedRates(x.q.bip)?.xba ?? null, low: true, fmt: three },
  { key: 'ev', of: (x) => battedRates(x.q.bip)?.ev ?? null, low: true, fmt: one },
  { key: 'barrel', of: (x) => battedRates(x.q.bip)?.barrel ?? null, low: true, fmt: one },
  { key: 'hard', of: (x) => battedRates(x.q.bip)?.hard ?? null, low: true, fmt: one },
  { key: 'kPct', of: (x) => share(x.q.k, x.q.bf), fmt: one },
  { key: 'bbPct', of: (x) => share(x.q.bb, x.q.bf), low: true, fmt: one },
  { key: 'gb', of: (x) => battedRates(x.q.bip)?.gb ?? null, fmt: one },
  { key: 'velo', of: (x) => averageVelocity(x.p), fmt: (v) => String(Math.round(v)) },
];

function rank<T>(pool: T[], me: T, metrics: Metric<T>[]): Percentile[] {
  const out: Percentile[] = [];
  for (const m of metrics) {
    const v = m.of(me);
    if (v == null) continue;
    const xs = pool.map(m.of).filter((x): x is number => x != null);
    if (!xs.length) continue;
    let below = 0,
      tied = 0;
    for (const x of xs) {
      if (x === v) tied++;
      else if (m.low ? x > v : x < v) below++;
    }
    const pct = Math.max(1, Math.min(100, Math.round(((below + tied / 2) / xs.length) * 100)));
    out.push({ key: m.key, value: m.fmt(v), pct });
  }
  return out;
}

/** His percentiles this season among the first team's regulars (two plate appearances or two outs a club game; a
    player short of that is still ranked against them). Null with nothing to rank. */
export function percentilesOf(s: LeagueState, id: string): { batting: Percentile[] | null; pitching: Percentile[] | null; games: number } {
  const p = s.players[id];
  const line = s.lines[id];
  const games = teamGames(s);
  if (!p || !line) return { batting: null, pitching: null, games };
  const bats: BatRow[] = [],
    pits: PitRow[] = [];
  for (const [pid, l] of Object.entries(s.lines)) {
    const x = s.players[pid];
    if (!x) continue;
    if (l.bat && !isPitcher(x) && l.bat.pa >= games * 2) bats.push({ p: x, b: l.bat });
    if (l.pit && l.pit.outs >= games * 2) pits.push({ p: x, q: l.pit });
  }
  const batting = line.bat && line.bat.pa > 0 && !isPitcher(p) && bats.length ? rank(bats, { p, b: line.bat }, BAT) : null;
  const pitching = line.pit && line.pit.bf > 0 && pits.length ? rank(pits, { p, q: line.pit }, PIT) : null;
  return { batting: batting?.length ? batting : null, pitching: pitching?.length ? pitching : null, games };
}

export interface SprayPoint {
  /** Degrees off the centre-field line, left field negative. */
  dir: number;
  dist: number;
  /** 0 single, 1 double, 2 triple, 3 home run. */
  hit: number;
}

/** Where his hits came down this season (first team). */
export function sprayOf(s: LeagueState, id: string): SprayPoint[] {
  const xs = s.lines[id]?.bat?.spray ?? [];
  const out: SprayPoint[] = [];
  for (let i = 0; i + 2 < xs.length; i += 3) out.push({ dir: xs[i]!, dist: xs[i + 1]!, hit: xs[i + 2]! });
  return out;
}

/** A pitcher's mix that season (percent of his pitches, the fastball first) and average velocity. 2.0.6: the season
    moves it a little — a few points of fastballs either way, each secondary pitch up or down a little (seeded by the
    year), and an arm past 31 leaning a point a year more on his secondary stuff. */
export function seasonMix(p: Player, year: number): Pick<SeasonRecord, 'mix' | 'velo'> {
  const rep = repertoire(p);
  const velo = averageVelocity(p);
  if (!rep.length && velo == null) return {};
  const pct = (x: number) => Math.round(x * 1000) / 10;
  const base = rep.reduce((a, x) => a + x.usage, 0);
  const age = year - Number(p.birthday.slice(0, 4));
  const drift = (hashUnit(`mix|${p.id}|${year}`) - 0.5) * 0.08 + Math.max(0, age - 31) * 0.01;
  const second = rep.length ? Math.max(0.08, Math.min(0.8, base + drift)) : 0;
  const tilt = rep.map((x) => x.usage * (1 + (hashUnit(`mix|${p.id}|${year}|${x.type}`) - 0.5) * 0.3));
  const total = tilt.reduce((a, b) => a + b, 0) || 1;
  return { mix: [[fastballOf(p), pct(1 - second)], ...rep.map((x, i): [string, number] => [x.type, pct((second * tilt[i]!) / total)])], ...(velo != null ? { velo } : {}) };
}

/** His mix by first-team season (kept since 2.0.4), this season's as he throws today. */
export function mixBySeason(s: LeagueState, p: Player): { year: number; current: boolean; mix: [string, number][]; velo: number | null }[] {
  const out = p.career.filter((r) => !r.level && r.pit && r.mix).map((r) => ({ year: r.year, current: false, mix: r.mix!, velo: r.velo ?? null }));
  const line = s.lines[p.id];
  if (line?.pit && !p.career.some((r) => r.year === s.year && !r.level)) {
    const now = seasonMix(p, s.year);
    if (now.mix) out.push({ year: s.year, current: true, mix: now.mix, velo: now.velo ?? null });
  }
  return out;
}

// ── 2.0.7: run values (runvalue.ts) ─────────────────────────────────────────────────────────────────

export type ValueKey = 'pitching' | 'fastball' | 'breaking' | 'offspeed' | 'batting' | 'running' | 'fielding';

export interface ValueRow {
  key: ValueKey;
  /** Runs (one decimal). */
  value: number;
  /** 1 … 100 among the regulars (more runs better). */
  pct: number;
}

/** His run values this season and where they stand among the regulars (the pool of `percentilesOf`). */
export function valuesOf(s: LeagueState, id: string): { rows: ValueRow[]; pitches: PitchValue[] | null; usage: ReturnType<typeof usageBySide> | null } | null {
  const p = s.players[id];
  const line = s.lines[id];
  if (!p || !line) return null;
  const games = teamGames(s);
  const bat = emptyBat(),
    pit = emptyPit();
  for (const l of Object.values(s.lines)) {
    if (l.bat) addInto(bat, l.bat);
    if (l.pit) addInto(pit, l.pit);
  }
  const lg = leagueContext(bat, pit);
  const rank = (v: number, pool: number[]) => {
    if (!pool.length) return 50;
    const below = pool.filter((x) => x < v).length,
      tied = pool.filter((x) => x === v).length;
    return Math.max(1, Math.min(100, Math.round(((below + tied / 2) / pool.length) * 100)));
  };
  const round = (x: number) => Math.round(x * 10) / 10;
  if (isPitcher(p)) {
    if (!line.pit?.bf) return null;
    const mine = pitchValues(p, line.pit, lg);
    const groups = groupValues(mine);
    const pool = Object.entries(s.lines)
      .filter(([pid, l]) => l.pit && l.pit.outs >= games * 2 && s.players[pid])
      .map(([pid, l]) => {
        const rows = pitchValues(s.players[pid]!, l.pit!, lg);
        return { total: pitchingRunValue(l.pit!, lg), ...groupValues(rows) };
      });
    const rows: ValueRow[] = [{ key: 'pitching', value: round(pitchingRunValue(line.pit, lg)), pct: rank(pitchingRunValue(line.pit, lg), pool.map((x) => x.total)) }];
    for (const g of ['fastball', 'breaking', 'offspeed'] as const) {
      const v = groups[g];
      if (v == null) continue;
      rows.push({ key: g, value: round(v), pct: rank(v, pool.map((x) => x[g]).filter((x): x is number => x != null)) });
    }
    return { rows, pitches: mine, usage: usageBySide(p, mine) };
  }
  if (!line.bat?.pa) return null;
  const mine = batterValues(line.bat, lg);
  const pool = Object.entries(s.lines)
    .filter(([pid, l]) => l.bat && l.bat.pa >= games * 2 && s.players[pid] && !isPitcher(s.players[pid]!))
    .map(([, l]) => batterValues(l.bat!, lg));
  return {
    rows: (['batting', 'running', 'fielding'] as const).map((k) => ({ key: k, value: round(mine[k]), pct: rank(mine[k], pool.map((x) => x[k])) })),
    pitches: null,
    usage: null,
  };
}
