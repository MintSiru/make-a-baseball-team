import { k as __i18n_k } from '../i18n/index';
/* League-side player helpers: ages, the values clubs judge players by (public scouting only), yearly
   draft pools, and foreign players. */
import { generateDraftPool, hashUnit, isPitcherRole, overall, rng, toGrade, type DraftProspect, type Role, type Tools } from '../draftroom';
import { ageOn, fromDraftProspect, placeClass } from '../model/player';
import { altPositions, type Position } from '../model/position';
import { background, careerText, foreignAsk, foreignName, LEVEL_LABELS, veteranCareer } from './foreign';
import type { Player } from '../model/types';
import { FOREIGN } from './tuning';
import { rollPersonality, rollTraits } from './traits';
import { makeNorthern } from './north';
import { playsHistory } from './era';
import { eraName } from './eranames';
import { rulesFor } from '../rules/history';

export const ageIn = (p: Player, year: number) => ageOn(p.birthday, `${year}-04-01`);
export const isPitcher = (p: Pick<Player, 'role'>) => isPitcherRole(p.role);

/** Hitting value from public tools (defense handled by position). */
export const batValue = (t: Tools) => 0.3 * (t.contact ?? 30) + 0.3 * (t.power ?? 30) + 0.22 * (t.eye ?? 30) + 0.1 * (t.speed ?? 30) + 0.08 * (t.defense ?? 30);

// How much the glove counts at each position. Draft Room's overall weighs a catcher's defense at 48%,
// which, used for roster decisions, slowly pushes sluggers out of the league.
const GLOVE: Record<string, number> = { C: 0.3, SS: 0.28, '2B': 0.2, CF: 0.2, '3B': 0.14, RF: 0.1, LF: 0.06, '1B': 0.04 };
const hitterScore = (t: Tools, position: string | null) => {
  const w = GLOVE[position ?? '1B'] ?? 0.1;
  return batValue(t) * (1 - w) + (t.defense ?? 30) * w;
};

/** A club's view of a player now: overall grade for pitchers, bat plus positional glove for hitters. */
export const currentValue = (p: Player) => (isPitcherRole(p.role) ? p.scouting.current : hitterScore(p.scouting.tools, p.position));
/** The same view of what he will become. */
export const futureValue = (p: Player) => (isPitcherRole(p.role) ? p.scouting.futureValue : Math.max(currentValue(p), hitterScore(p.scouting.futureTools, p.position)));

/** What a club weighs when keeping or cutting: current value, blended with future value for young players. */
export function keepValue(p: Player, year: number): number {
  const age = ageIn(p, year);
  const w = age <= 23 ? 0.5 : age <= 26 ? 0.3 : age <= 28 ? 0.12 : 0;
  return currentValue(p) * (1 - w) + futureValue(p) * w;
}
export const pitchValue = (t: Tools, role: Role) => overall(t, role === 'SP' ? 'SP' : 'RP');
export const starterValue = (t: Tools) => overall(t, 'SP') + ((t.stamina ?? 40) - 45) * 0.25;

export const DRAFT_ROOM_YEAR = 2026;

function shiftDate<T extends string | null>(date: T, years: number): T {
  if (!date) return date;
  const [y, rest] = [Number(date.slice(0, 4)), date.slice(4)];
  // Keep Feb 29 valid in non-leap years.
  const shifted = `${y + years}${rest}`;
  return (rest === '-02-29' && !isLeap(y + years) ? `${y + years}-02-28` : shifted) as T;
}
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** A Draft Room prospect moved to another draft year: every date shifts, ability is unchanged. */
export function shiftProspect(p: DraftProspect, years: number): DraftProspect {
  if (!years) return p;
  return {
    ...p,
    birthday: shiftDate(p.birthday, years),
    history: p.history.map((h) => ({ ...h, start: shiftDate(h.start, years), end: shiftDate(h.end, years) })),
  };
}

export const poolSeed = (seed: string, draftYear: number) => (draftYear === DRAFT_ROOM_YEAR ? seed : `${seed}|draft|${draftYear}`);

/** The prospects of the draft held in September of `draftYear`, as league amateurs. 1.9.2: a unified league
    (`north`, 통일 한국) adds the north's amateurs (north.ts). */
export function draftClass(seed: string, draftYear: number, north?: { since: number } | null): Player[] {
  const ps = poolSeed(seed, draftYear);
  const pool = generateDraftPool(ps);
  const south = placeClass(
    pool.players.map((p) => fromDraftProspect(shiftProspect(p, draftYear - DRAFT_ROOM_YEAR), draftYear, ps)),
    ps,
  );
  return withEra(north && draftYear >= north.since ? withNorth(seed, draftYear, north.since, south) : south, ps);
}

/**
 * 1.9.6, a league that plays history (the 1982 legacy start): amateurs as they were in their time. Names by birth
 * decade (eranames.ts), and velocity by birth year: a pitcher born in the 1950s threw some ten km/h slower than
 * today's, one born in the 1990s as hard (a 1992 column called 140 km/h a hard thrower; the four-seamer averaged
 * 141.3 in 2015, 144.2 in 2023: RULES.md S106). One in fourteen keeps most of today's arm anyway (the 150s of the 1980s). And no one
 * says he would rather go abroad before clubs abroad watched the draft (1998). Any other game keeps its players as
 * they are.
 */
export function withEra(players: Player[], key: string): Player[] {
  if (!playsHistory()) return players;
  const used = new Set(players.map((p) => p.name));
  return players.map((p) => {
    const born = Number(p.birthday.slice(0, 4));
    const name = p.origin.kind === 'foreign' ? p.name : eraName(p.name, born, `${key}|${p.id}`, used);
    const velocity = p.velocity == null ? null : p.velocity - eraVelocity(born, `${key}|${p.id}`);
    // No club abroad scouted the KBO's draft before the late 1990s (rules/history.ts overseasDraftInterest).
    const abroad = p.amateur.intent === 'abroad' && p.origin.draftYear != null && !rulesFor(p.origin.draftYear).overseasDraftInterest;
    if (name === p.name && velocity === p.velocity && !abroad) return p;
    return { ...p, name, velocity, ...(abroad ? { amateur: { ...p.amateur, intent: null } } : {}) };
  });
}

/** How much slower than today's a pitcher born in `year` throws (km/h); a third of it for the outliers. */
export function eraVelocity(year: number, key: string): number {
  const pts = ERA_VELOCITY.points;
  let v = 0;
  if (year <= pts[0]![0]) v = pts[0]![1];
  else
    for (let i = 1; i < pts.length; i++) {
      const [y1, v1] = pts[i]!,
        [y0, v0] = pts[i - 1]!;
      if (year <= y1) {
        v = v0 + ((v1 - v0) * (year - y0)) / (y1 - y0);
        break;
      }
    }
  return Math.round(hashUnit(`${key}|era-velo`) < ERA_VELOCITY.outlier ? v / 3 : v);
}
export const ERA_VELOCITY = { outlier: 1 / 14, points: [[1950, 11], [1960, 9], [1970, 6], [1980, 3], [1990, 1], [1995, 0]] as [number, number][] };

/**
 * 1.9.2: the north's amateurs join the class (60% as many again, so sixteen clubs draft from a class as deep as ten
 * did). Baseball there starts small: in the first drafts the north's best are held back (its top 60 prospects the
 * first year, twelve fewer each year after), so its players are weaker at first and as good as the south's within
 * five years. The draft ranks are drawn again over the whole class.
 */
function withNorth(seed: string, draftYear: number, since: number, south: Player[]): Player[] {
  const ps = `${poolSeed(seed, draftYear)}|north`;
  const used = new Set(south.map((p) => p.name));
  const held = Math.max(0, NORTH_CLASS.heldBack - NORTH_CLASS.heldBackStep * (draftYear - since));
  const pool = generateDraftPool(ps)
    .players.map((p) => ({ ...p, id: `N${p.id}` }))
    .sort((a, b) => a.rank - b.rank)
    .slice(held, held + NORTH_CLASS.size);
  const north = placeClass(
    pool.map((p) => makeNorthern(fromDraftProspect(shiftProspect(p, draftYear - DRAFT_ROOM_YEAR), draftYear, ps), ps, used)),
    ps,
  );
  const all = [...south, ...north].sort((a, b) => futureValue(b) - futureValue(a) || a.amateur.draftRank - b.amateur.draftRank);
  all.forEach((p, i) => (p.amateur = { ...p.amateur, draftRank: i + 1 }));
  return all;
}

export const NORTH_CLASS = { size: 240, heldBack: 60, heldBackStep: 12 } as const;

// ── Foreign players (names and backgrounds in foreign.ts) ───────────────────────────────────────

const pickFrom = <T>(xs: T[], r: () => number) => xs[Math.floor(r() * xs.length)]!;
const normal = (r: () => number) => (r() + r() + r() - 1.5) / 1.5;
const clampGrade = (n: number) => Math.max(20, Math.min(80, n));
const INFIELD: Position[] = ['1B', '2B', '3B', 'SS'];

function pickWeighted(weights: Record<string, number>, r: () => number): string {
  const list = Object.entries(weights);
  let x = r() * list.reduce((a, [, w]) => a + w, 0);
  return (list.find(([, w]) => (x -= w) < 0) ?? list.at(-1)!)[0];
}

/** The type of a foreign player signed before 1.1.0, read from what he is best at against the usual import. */
export function foreignTypeOf(p: Player): string {
  const t = p.hidden.current;
  const F = FOREIGN;
  const best = (devs: [string, number][]) => devs.sort((a, b) => b[1] - a[1])[0]![0];
  if (isPitcherRole(p.role))
    return best([
      [__i18n_k("league.players.foreignTypeOf.1d5e776c"), (t.stuff ?? 0) - F.pitcher.stuff],
      [__i18n_k("league.players.foreignTypeOf.00299346"), (t.command ?? 0) - F.pitcher.command],
      [__i18n_k("league.players.foreignTypeOf.fb64a2ea"), (t.breaking ?? 0) - F.pitcher.breaking],
      ...(p.role === 'SP' ? ([[__i18n_k("league.players.foreignTypeOf.52c36099"), (t.stamina ?? 0) - F.pitcher.stamina - 2]] as [string, number][]) : []),
    ]);
  const spot = F.hitterPositions.find((x) => x.pos === p.position) ?? F.hitterPositions[0]!;
  return best([
    [__i18n_k("league.players.foreignTypeOf.9921c020"), (t.power ?? 0) - F.hitter.power - spot.power],
    [__i18n_k("league.players.foreignTypeOf.29d3479d"), (t.contact ?? 0) - F.hitter.contact - spot.contact],
    [__i18n_k("league.players.foreignTypeOf.d3747fd4"), (t.eye ?? 0) - F.hitter.eye],
    [__i18n_k("league.players.foreignTypeOf.e4d28238"), (t.speed ?? 0) - spot.speed - 1],
    [__i18n_k("league.players.foreignTypeOf.93758abe"), (t.defense ?? 0) - spot.defense],
    ['유틸리티', (p.alt?.length ?? 0) >= 2 ? 1 : -99],
  ]);
}

/** 1.7.0: whether an old big-league name is on this market (keyed by the market), and whether he pitches. */
export function veteranOnMarket(key: string): { kind: 'pitcher' | 'hitter' } | null {
  if (hashUnit(`${key}|veteran`) >= FOREIGN.veteran.chance) return null;
  return { kind: hashUnit(`${key}|veteran-kind`) < 0.65 ? 'pitcher' : 'hitter' };
}

/** Foreign types (1.1.0); anything else is a domestic player's Draft Room archetype. */
export const FOREIGN_TYPES = new Set(Object.keys(FOREIGN.types.shift));

export interface ForeignSpec {
  kind: 'pitcher' | 'hitter';
  asiaQuota: boolean;
  /** 1.7.0: an old big-league name (never an Asia-quota player). */
  veteran?: boolean;
}

/** A foreign player signing for `season`. Mature ability: potential equals current. */
export function makeForeign(seed: string, id: string, season: number, spec: ForeignSpec): Player {
  const r = rng(`${seed}|foreign|${id}`);
  const veteran = !!spec.veteran && !spec.asiaQuota;
  const bg0 = background(spec.asiaQuota, r);
  const bg = veteran ? { ...bg0, level: 'mlb' as const, shift: 3, premium: 400_000, spread: FOREIGN.veteran.spread } : bg0;
  const nationality = bg.nationality;
  const name = foreignName(bg.pool, r);
  const age = veteran ? 34 + Math.floor(r() * 5) : spec.asiaQuota ? 24 + Math.floor(r() * 7) : 26 + Math.floor(r() * 7);
  const birthday = `${season - age - 1}-${String(1 + Math.floor(r() * 12)).padStart(2, '0')}-${String(1 + Math.floor(r() * 28)).padStart(2, '0')}`;
  // Asia-quota signings are cheaper and a notch below; the background moves ability a little (and widens it for independent leagues).
  const F = FOREIGN;
  // Now and then a club lands a big-league regular in his prime (V0.11): the KBO's aces and MVP imports.
  const star = !spec.asiaQuota && r() < F.star.chance;
  const q = (spec.asiaQuota ? F.asiaShift : 0) + bg.shift + normal(r) * bg.spread + (star ? F.star.shift : 0) + (veteran ? F.veteran.shift : 0);
  let role: Role, tools: Tools;
  let position: Position | null = null;
  // His type (1.1.0), on a stream of its own.
  const rt = rng(`${seed}|foreign-type|${id}`);
  let type: string;
  if (spec.kind === 'pitcher') {
    const starter = spec.asiaQuota ? r() < 0.35 : r() < 0.92;
    role = starter ? 'SP' : 'RP';
    type = pickWeighted(starter ? F.types.SP : F.types.RP, rt);
    const sh = F.types.shift[type]!;
    tools = {
      stuff: clampGrade(F.pitcher.stuff + q + (sh.stuff ?? 0) + normal(r) * 5),
      command: clampGrade(F.pitcher.command + q + (sh.command ?? 0) + normal(r) * 6),
      breaking: clampGrade(F.pitcher.breaking + q + (sh.breaking ?? 0) + normal(r) * 6),
      stamina: clampGrade((starter ? F.pitcher.stamina : 45) + (sh.stamina ?? 0) + normal(r) * 6),
    };
  } else {
    // The position first, then a glove and legs that fit it (V0.11): first base and the outfield corners most, a
    // centre fielder or third baseman often, a middle infielder now and then (KBO imports, RULES.md S72).
    let x = r();
    const spot = F.hitterPositions.find((row) => (x -= row.share) < 0) ?? F.hitterPositions[0]!;
    position = spot.pos;
    role = INFIELD.includes(spot.pos) ? 'IF' : 'OF';
    type = pickWeighted(F.types.hitter[spot.pos]!, rt);
    const sh = F.types.shift[type]!;
    tools = {
      contact: clampGrade(F.hitter.contact + q + spot.contact + (sh.contact ?? 0) + normal(r) * 6),
      power: clampGrade(F.hitter.power + q + spot.power + (sh.power ?? 0) + normal(r) * 6),
      eye: clampGrade(F.hitter.eye + q + (sh.eye ?? 0) + normal(r) * 6),
      speed: clampGrade(spot.speed + (sh.speed ?? 0) + normal(r) * 7),
      defense: clampGrade(spot.defense + (sh.defense ?? 0) + normal(r) * 6),
    };
  }
  const graded = Object.fromEntries(Object.entries(tools).map(([k, v]) => [k, toGrade(v! + normal(r) * 3)])) as Tools;
  const current = toGrade(overall(graded, role));
  // Left-handed throwers do not play second, short or third.
  const throwsLeft = !['2B', '3B', 'SS'].includes(position ?? '') && r() < 0.3,
    bats = throwsLeft ? (r() < 0.95 ? '좌' : '우') : r() < 0.3 ? '좌' : r() < 0.05 ? '양' : '우';
  const level = LEVEL_LABELS[bg.level];
  const text = veteran ? veteranCareer(spec.kind === 'pitcher', age, r) : careerText(bg.level, spec.kind === 'pitcher', age, current, r);
  const ask = foreignAsk(current, spec.asiaQuota, bg.premium, r);
  const personality = rollPersonality(seed, id);
  return {
    id,
    name,
    birthday,
    birthplace: nationality,
    height: 180 + Math.floor(r() * 16),
    weight: 82 + Math.floor(r() * 22),
    throws: throwsLeft ? '좌' : '우',
    bats,
    role,
    position,
    alt: altPositions(position, graded, rng(`${seed}|alt|${id}`), type === '유틸리티' ? 2 : 0),
    archetype: type,
    personality,
    velocity: spec.kind === 'pitcher' ? Math.round(146 + ((tools.stuff ?? 55) - 55) * 0.4 + normal(r) * 1.5) - (veteran ? 2 : 0) : null,
    twoWay: false,
    origin: { kind: 'foreign', pathway: __i18n_k("league.players.origin.pathway.5bd804b7"), entryCategory: 'foreign', nationality, asiaQuota: spec.asiaQuota, background: { level: bg.level, text, ask, ...(veteran ? { veteran: true } : {}) } },
    education: { qualification: __i18n_k("league.players.education.qualification.8c9f6c12", { level: level }), school: level, schoolTier: '', region: nationality, pathText: `${nationality} · ${text}`, history: [] },
    amateur: { record: { kind: spec.kind, games: 0 }, awards: [], draftRank: 0 },
    status: 'active',
    teamId: null,
    contract: null,
    service: { creditedSeasons: 0, carriedDays: 0, military: 'exempt' },
    hidden: { current: tools, potential: { ...tools }, growthCurve: 'normal', developmentRate: 1, observerBias: normal(r) * 2, injuryRisk: veteran ? F.veteran.injuryRisk : 0.08, traits: rollTraits(seed, id, personality) },
    scouting: {
      season,
      tools: graded,
      futureTools: graded,
      current,
      futureValue: current,
      floor: Math.max(20, current - 5),
      ceiling: current,
      uncertainty: '보통',
      tags: ['즉전감'],
      strength: '',
      weakness: '',
    },
    proSince: season,
    career: [],
  };
}

export const isForeign = (p: Player) => p.origin.kind === 'foreign';
