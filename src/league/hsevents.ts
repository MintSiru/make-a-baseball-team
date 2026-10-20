import { k as __i18n_k } from '../i18n/index';
/* 2.0.28 (the user's request): a high-school senior year in four parts, the way the KBO's school game runs.

   - The regional weekend league (권역 주말리그): every school, in its region (Draft Room's own ranking).
   - A national tournament open to every school (전국고교야구선수권대회): one draw of all of them.
   - The national tournament through the regional leagues (Draft Room's 다이아몬드 데일리배): the top four of each region.
   - The champions' tournament (고교야구 왕중왕전): the top four of the two national tournaments, eight schools.

   For a draft class the regional league and the qualified national are Draft Room's own results (its awards name
   them); the open national and the champions' tournament are drawn here, from the same seed. A senior year further
   back (a college player's high-school days) is drawn whole. His year's record is shared out over the four by the
   games each school played (league/amateur.ts) — for the screen only. */
import Catalog from '../draftroom/catalog.js';
import Prospects from '../draftroom/prospects.js';
import { hashUnit, rng, type AmateurRecord } from '../draftroom';

interface Institution {
  id: string;
  kind: string;
  region: string | null;
  tier: string;
}
interface Honor {
  event: string;
  result: string;
  national: { event: string; result: string } | null;
}
const P = Prospects as unknown as { schoolHonors(seed: string): Record<string, Honor>; bio: { TIERS: Record<string, { team: number }> } };
const SCHOOLS = (Catalog as unknown as { institutions: Institution[] }).institutions.filter((x) => x.kind === 'high-school' || x.kind === 'hs-club');
const team = (s: Institution) => P.bio.TIERS[s.tier]?.team ?? 0.5;

export const HS_EVENTS = {
  /** Weekend-league games a school plays (give or take one). */
  leagueGames: 9,
  qualifiers: 4,
  champions: 4,
};

export type HsEventKind = 'league' | 'open' | 'qualified' | 'champions';

export interface HsEvent {
  kind: HsEventKind;
  label: string;
  result: string;
  games: number;
}

/** Placing by how far a school got: 1 the winner, 2 the final, 4 the semi-finals…; the early rounds of a big draw by
    their number (1회전, 2회전), as the schools' tournaments call them. */
const roundName = (reached: number, size = 32) =>
  reached === 1
    ? __i18n_k("league.hsevents.text.894badc3")
    : reached === 2
      ? __i18n_k("league.hsevents.text.3660fdbb")
      : reached === 4
        ? __i18n_k("league.hsevents.text.82c2c27f")
        : reached > 32
          ? __i18n_k("league.hsevents.text.d96f4b7d", { n: Math.round(Math.log2(size / reached)) + 1 })
          : __i18n_k("league.hsevents.text.0e854629", { n: reached });
const placeName = (i: number) => (i === 0 ? __i18n_k("league.hsevents.text.74e19661") : __i18n_k("league.hsevents.text.42a7b82f", { n: i + 1 }));

/** A knockout draw, the stronger seeds kept apart: how far each school got and how many games it played. */
function knockout(entrants: Institution[], r: () => number): Map<string, { reached: number; games: number; size: number }> {
  let size = 1;
  while (size < entrants.length) size *= 2;
  const seeded = [...entrants].sort((a, b) => team(b) - team(a) || a.id.localeCompare(b.id));
  let order = [0];
  while (order.length < size) order = order.flatMap((i) => [i, order.length * 2 - 1 - i]);
  const out = new Map(seeded.map((s) => [s.id, { reached: size, games: 0, size }]));
  let round: (Institution | null)[] = order.map((i) => seeded[i] ?? null);
  let left = size;
  while (round.length > 1) {
    const next: (Institution | null)[] = [];
    for (let i = 0; i < round.length; i += 2) {
      const a = round[i]!,
        b = round[i + 1]!;
      if (!a || !b) {
        next.push(a ?? b);
        continue;
      }
      out.get(a.id)!.games++;
      out.get(b.id)!.games++;
      const ta = team(a) + 0.15,
        tb = team(b) + 0.15;
      const [win, lose] = r() < ta / (ta + tb) ? [a, b] : [b, a];
      out.get(lose.id)!.reached = left;
      next.push(win);
    }
    round = next;
    left /= 2;
  }
  if (round[0]) out.get(round[0].id)!.reached = 1;
  return out;
}

const cache = new Map<string, Map<string, HsEvent[]>>();

/** Every school's senior-year events under `key` (Draft Room's honours for a draft class, when given). */
function season(key: string, honors: Record<string, Honor> | null): Map<string, HsEvent[]> {
  const hit = cache.get(key);
  if (hit) return hit;
  const events = new Map<string, HsEvent[]>(SCHOOLS.map((s) => [s.id, []]));
  // The regional weekend leagues.
  const regional = new Map<string, number>();
  for (const region of [...new Set(SCHOOLS.map((s) => s.region ?? ''))]) {
    const r = rng(`${key}|hs-league|${region}`);
    const list = SCHOOLS.filter((s) => (s.region ?? '') === region);
    const ranked = honors ? list : list.map((s) => ({ s, score: team(s) * 60 + r() * 55 })).sort((a, b) => b.score - a.score).map((x) => x.s);
    ranked.forEach((s, i) => regional.set(s.id, i));
    for (const s of list) {
      const h = honors?.[s.id];
      const place = regional.get(s.id)!;
      events.get(s.id)!.push({ kind: 'league', label: h?.event ?? __i18n_k("league.hsevents.text.66d071e5", { region }), result: h?.result ?? placeName(place), games: HS_EVENTS.leagueGames + Math.floor(hashUnit(`${key}|league-games|${s.id}`) * 3) - 1 });
    }
  }
  // The open national: everyone.
  const open = knockout(SCHOOLS, rng(`${key}|hs-open`));
  for (const s of SCHOOLS) {
    const x = open.get(s.id)!;
    events.get(s.id)!.push({ kind: 'open', label: __i18n_k("league.hsevents.text.bebba778"), result: roundName(x.reached, x.size), games: x.games });
  }
  // The national through the regional leagues: Draft Room's result, or drawn among each region's top four.
  const qualifiedEvent = __i18n_k('draftroom.prospects.hS_NATIONAL.5b4476fa');
  const quals = honors ? SCHOOLS.filter((s) => honors[s.id]?.national) : SCHOOLS.filter((s) => regional.get(s.id)! < HS_EVENTS.qualifiers);
  const drawn = honors ? null : knockout(quals, rng(`${key}|hs-qualified`));
  const qualifiedReach = new Map<string, number>();
  for (const s of quals) {
    const h = honors?.[s.id]?.national;
    const x = drawn?.get(s.id);
    const reached = x ? x.reached : reachedOf(h!.result);
    qualifiedReach.set(s.id, reached);
    const games = x ? x.games : Math.max(1, Math.log2(32 / reached) + (reached === 1 ? 0 : 1));
    events.get(s.id)!.push({ kind: 'qualified', label: h?.event ?? qualifiedEvent, result: h?.result ?? roundName(reached), games });
  }
  // The champions: the top four of each national (the next best fill in for a school in both).
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([id]) => id);
  const openOrder = top(new Map([...open.entries()].map(([id, x]) => [id, x.reached])));
  const qualOrder = top(qualifiedReach);
  const picked = new Set<string>(openOrder.slice(0, HS_EVENTS.champions));
  for (const id of qualOrder) if (picked.size < HS_EVENTS.champions * 2) picked.add(id);
  const champs = knockout(
    SCHOOLS.filter((s) => picked.has(s.id)),
    rng(`${key}|hs-champions`),
  );
  for (const [id, x] of champs) events.get(id)!.push({ kind: 'champions', label: __i18n_k("league.hsevents.text.2099f312"), result: roundName(x.reached), games: x.games });
  cache.set(key, events);
  if (cache.size > 40) cache.delete(cache.keys().next().value!);
  return events;
}

/** How far a Draft Room result went (우승 1, 준우승 2, 4강 4, 8강 8…). */
function reachedOf(result: string): number {
  if (result === '우승') return 1;
  if (result === '준우승') return 2;
  const n = Number(/\d+/.exec(result)?.[0]);
  return Number.isFinite(n) && n > 0 ? n : 32;
}

/** His school's senior-year events: from a draft class's pool (`poolSeed`), or drawn for that year (`key`). */
export function hsEvents(schoolId: string, at: { poolSeed: string } | { key: string }): HsEvent[] {
  const events = 'poolSeed' in at ? season(`pool|${at.poolSeed}`, P.schoolHonors(at.poolSeed)) : season(at.key, null);
  return events.get(schoolId) ?? [];
}

/** Shares a year's record out over the events by their games (each stat a little up or down, the totals kept). */
export function splitRecord(rec: AmateurRecord, games: number[], key: string): AmateurRecord[] {
  const n = games.length;
  const jitter = (stat: string, i: number) => 0.8 + hashUnit(`${key}|${stat}|${i}`) * 0.4;
  // Largest remainder, each part at most its cap (the rest moves on to a part with room).
  const share = (total: number, weights: number[], caps?: number[]) => {
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    const raw = weights.map((w) => (total * w) / sum);
    const out = raw.map(Math.floor);
    let left = total - out.reduce((a, b) => a + b, 0);
    const order = raw.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
    for (let k = 0; left > 0 && k < order.length * 4; k++) {
      const i = order[k % order.length]![1];
      if (caps && out[i]! >= caps[i]!) continue;
      out[i]!++;
      left--;
    }
    if (caps)
      for (let i = 0; i < n; i++)
        while (out[i]! > caps[i]!) {
          const j = out.findIndex((x, k) => x < caps[k]!);
          if (j < 0) break;
          out[i]!--;
          out[j]!++;
        }
    return out;
  };
  const g = share(Number(rec.games) || n, games.map((x) => Math.max(1, x)));
  const num = (k: string) => (typeof rec[k] === 'number' ? (rec[k] as number) : 0);
  const by = (stat: string, base: number[]) => share(num(stat), base.map((x, i) => x * jitter(stat, i)));
  const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;
  if (rec.kind === 'pitcher') {
    const outs = by('outs', g);
    const er = by('er', outs),
      k = by('k', outs),
      bb = by('bb', outs),
      wins = share(num('wins'), g, g);
    return g.map((games, i) => ({ kind: 'pitcher', games, outs: outs[i]!, er: er[i]!, era: outs[i] ? round((er[i]! * 27) / outs[i]!, 2) : null, k: k[i]!, bb: bb[i]!, wins: wins[i]! }));
  }
  const ab = by('ab', g);
  const hits = share(num('hits'), ab.map((x, i) => x * jitter('hits', i)), ab);
  const hr = share(num('hr'), hits, hits);
  const doubles = share(num('doubles'), hits, hits.map((h, i) => h - hr[i]!));
  const triples = share(num('triples'), hits, hits.map((h, i) => h - hr[i]! - doubles[i]!));
  const bb = by('bb', ab),
    sb = by('sb', g),
    rbi = by('rbi', hits.map((h) => h + 1)),
    runs = by('runs', hits.map((h) => h + 1));
  return g.map((games, i) => {
    const a = ab[i]!,
      h = hits[i]!;
    const tb = h + doubles[i]! + 2 * triples[i]! + 3 * hr[i]!;
    return {
      kind: 'hitter',
      games,
      ab: a,
      pa: a + bb[i]!,
      hits: h,
      bb: bb[i]!,
      hr: hr[i]!,
      doubles: doubles[i]!,
      triples: triples[i]!,
      avg: a ? round(h / a, 3) : null,
      ops: a ? round((h + bb[i]!) / (a + bb[i]!) + tb / a, 3) : null,
      sb: sb[i]!,
      rbi: rbi[i]!,
      runs: runs[i]!,
    };
  });
}
