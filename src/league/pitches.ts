import { k as __i18n_k } from '../i18n/index';
/* Pitch repertoire and velocity (V0.5.1). A pitcher's 변화구 tool stays the single number the engine
   reads; the repertoire splits it into pitches whose weighted grades average back to it (best pitch
   60%, second 30%, the rest 10%; a two-pitch pitcher's one breaking ball is the tool itself), so a report can say
   "slider 65, changeup 50" without changing how good he is. The mix is fixed per player (seeded by id). What the
   pitches change is the platoon split: sliders and sweepers eat same-side hitters, changeups and forkballs travel
   to the other side.

   1.1.0 (the 1.0 feedback): more two-pitch pitchers (a third of relievers throw a fastball and one breaking ball),
   a signature pitch that goes with his type (a curveballer's curve, a forkball reliever's forkball), and how often he
   throws his secondaries varies from pitcher to pitcher — a power arm leans on the fastball, a breaking-ball
   specialist throws it half the time or more.

   Velocity is public (a radar gun), so it follows the hidden 구위 as it grows or fades. */
import { pitcherLift } from './battedball';
import { hashUnit, rng } from '../draftroom';
import type { Player } from '../model/types';
import { isForeign } from './players';
import { PITCH_MIX as M } from './tuning';
import { slotPlatoon, slotVelocity } from './tracking';

/** 1.9.3 (the 1.9 plan's 5th edition): 싱커 (SNK), 서클체인지업 (CIR), 스플리터 (SPL), 슬러브 (SLV), 너클볼 (KN), and the old
    pitches 스크류볼 (SCR), 팜볼 (PLM) and 슈트 (SH), thrown more by pitchers born long ago. The codes are the user's
    abbreviations (4SFB, the four-seamer, is the fastball itself); 1.9.3 renamed FO, CT and SI (the two-seamer) to FRK, CUT and 2SFB, and added the sinker (SNK). */
export type PitchType = 'SL' | 'SW' | 'CB' | 'CH' | 'FRK' | 'CUT' | '2SFB' | 'SNK' | 'CIR' | 'SPL' | 'SLV' | 'KN' | 'SCR' | 'PLM' | 'SH';

export const PITCH_LABELS: Record<PitchType, string> = {
  SL: __i18n_k("league.pitches.pITCH_LABELS.sL.18bc88bf"),
  SW: __i18n_k("league.pitches.pITCH_LABELS.sW.6b7ff52a"),
  CB: __i18n_k("league.pitches.pITCH_LABELS.cB.2ab848c1"),
  CH: __i18n_k("league.pitches.pITCH_LABELS.cH.49e1dacd"),
  FRK: __i18n_k("league.pitches.pITCH_LABELS.fO.a8a41ff9"),
  CUT: __i18n_k("league.pitches.pITCH_LABELS.cT.d348e61c"),
  '2SFB': __i18n_k("league.pitches.pITCH_LABELS.sI.c2a8d278"),
  SNK: __i18n_k("league.pitches.text.7390f5bb"),
  CIR: __i18n_k("league.pitches.text.55a5617c"),
  SPL: __i18n_k("league.pitches.text.6fc08d14"),
  SLV: __i18n_k("league.pitches.text.8939f3cc"),
  KN: __i18n_k("league.pitches.text.c91a5e12"),
  SCR: __i18n_k("league.pitches.text.716cb4e9"),
  PLM: __i18n_k("league.pitches.text.7dd88eb5"),
  SH: __i18n_k("league.pitches.text.93c47996"),
};

/** Same-side platoon advantage by best pitch: >1 a wider split, <1 a pitcher who handles both sides. */
const PLATOON: Record<PitchType, number> = { SL: 1.25, SW: 1.45, CB: 1.05, CH: 0.65, FRK: 0.7, CUT: 0.9, '2SFB': 1.1, SNK: 1.1, CIR: 0.6, SPL: 0.7, SLV: 1.3, KN: 0.85, SCR: 0.55, PLM: 0.75, SH: 1.15 };

/** 1.9.3 (from the 1.9 feedback): the fastball he leans on — a four-seamer (most), a two-seamer that runs to his arm
    side and sinks, or a cutter. A two-seam or cutter pitcher does not carry the same pitch again as a secondary. */
export type FastballType = '4SFB' | '2SFB' | 'CUT';
export const FASTBALL_LABELS: Record<FastballType, string> = { '4SFB': __i18n_k("league.pitches.text.cccce3d7"), '2SFB': __i18n_k("league.pitches.pITCH_LABELS.sI.c2a8d278"), CUT: __i18n_k("league.pitches.pITCH_LABELS.cT.d348e61c") };
/** Same-side platoon split by fastball, and how much slower than a four-seamer it comes (km/h, on the average). */
const FASTBALL_PLATOON: Record<FastballType, number> = { '4SFB': 1, '2SFB': 1.05, CUT: 0.95 };
const FASTBALL_SLOWER: Record<FastballType, number> = { '4SFB': 0, '2SFB': 1, CUT: 3 };

/** His main fastball, fixed per player (seeded by id): two-seamers for ground-ball arms and foreign pitchers more. */
/** 2.0.3: where his pitches send the ball — a two-seamer, a sinker, a splitter or a forkball on the ground, a lively
    four-seamer or a big curve in the air — as a step from 극단적 땅볼 투수 (−2) to 극단적 뜬공 투수 (2) (battedball.ts). */
export function pitchingLift(p: Player): number {
  if (p.hidden.current.breaking == null) return 0;
  const fb = fastballOf(p);
  let up = fb === '2SFB' ? -0.2 : fb === 'CUT' ? -0.05 : ((p.hidden.current.stuff ?? 50) - 50) * 0.004;
  if (p.archetype === '땅볼 유도형 선발') up -= 0.15;
  for (const x of repertoire(p)) {
    if (x.type === 'SNK' || x.type === 'SPL' || x.type === 'FRK' || x.type === 'SH' || x.type === '2SFB') up -= 0.8 * x.usage;
    else if (x.type === 'CB' || x.type === 'SW' || x.type === 'KN') up += 0.3 * x.usage;
  }
  // Centred on the league's arms (the sinkers and splitters would otherwise tip it to the ground).
  return pitcherLift(p.id, up + 0.11);
}

export function fastballOf(p: Player): FastballType {
  if (p.hidden.current.breaking == null) return '4SFB';
  const ground = p.archetype === '땅볼 유도형 선발';
  const w: [FastballType, number][] = [
    ['4SFB', 72],
    ['2SFB', (isForeign(p) ? 20 : 12) + (ground ? 45 : 0)],
    ['CUT', isForeign(p) ? 10 : 6],
  ];
  let x = hashUnit(`fastball-${p.id}`) * w.reduce((a, [, v]) => a + v, 0);
  for (const [t, v] of w) if ((x -= v) < 0) return t;
  return '4SFB';
}

/** Pitches an arm rarely carries together: one slider-type, one changeup-type, one splitter-type, one sinker-type. */
export const FAMILY: Partial<Record<PitchType, string>> = { SL: 'slider', SW: 'slider', SLV: 'slider', CH: 'change', CIR: 'change', FRK: 'split', SPL: 'split', '2SFB': 'sink', SNK: 'sink' };

const WEIGHTS = [0.6, 0.3, 0.1];

/** 2.0.8: the share of his pitches a learned pitch takes. */
export const LEARNED_USAGE = 0.08;

export interface Pitch {
  type: PitchType;
  /** Grade relative to the pitcher's 변화구 tool. */
  offset: number;
  usage: number;
}

type Mix = [PitchType, number][];

function mixFor(p: Player, first: boolean): Mix {
  const lefty = p.throws === '좌';
  const japan = p.origin.nationality === '일본';
  const born = Number(p.birthday.slice(0, 4));
  const young = born >= 1998;
  // 1.9.3: the old pitches belong to pitchers born long ago (the 1980s and 90s game); the new ones to the young.
  const old = born < 1975 ? 1 : born < 1985 ? 0.4 : 0.1;
  // His signature pitch is likelier to be the best one.
  const sig = first ? M.signature[p.archetype] : undefined;
  const add = (t: PitchType) => (sig?.pitch === t ? sig.weight : 0);
  return [
    ['SL', 40 + add('SL')],
    ['SW', (young || isForeign(p) ? 8 : 2) + add('SW')],
    ['CB', 16 + add('CB')],
    ['CH', (lefty ? 30 : 13) + add('CH')],
    ['FRK', (japan ? 34 : lefty ? 7 : 15) + add('FRK')],
    ['CUT', (isForeign(p) ? 12 : 6) + add('CUT')],
    ['2SFB', (isForeign(p) ? 12 : 5) + add('2SFB')],
    ['SNK', (isForeign(p) ? 9 : 5) * (1 - old * 0.5) + add('SNK')],
    ['CIR', (lefty ? 7 : 3) * (1 - old * 0.6) + add('CIR')],
    ['SPL', (japan ? 10 : isForeign(p) ? 7 : young ? 6 : 3) * (1 - old * 0.6) + add('SPL')],
    ['SLV', 3 + old * 2 + add('SLV')],
    ['KN', 0.4 + old * 0.6 + add('KN')],
    ['SCR', (lefty ? 1 : 0.3) + old * 4 + add('SCR')],
    ['PLM', 0.3 + old * 4 + add('PLM')],
    ['SH', (japan ? 5 : 1) + old * 8 + add('SH')],
  ];
}

/** How many secondary pitches: a share for one, two, three and four. */
function countOf(p: Player, r: () => number): number {
  let x = r();
  const shares = p.role === 'SP' ? M.count.SP : M.count.RP;
  const i = shares.findIndex((w) => (x -= w) < 0);
  return 1 + (i < 0 ? shares.length - 1 : i);
}

/** Share of all his pitches that are secondaries (the fastball takes the rest). */
function secondaryShare(p: Player, n: number): number {
  const u = hashUnit(`mix-${p.id}`);
  const base = (p.role === 'SP' ? M.share.SP : M.share.RP) + (M.share.byCount[n - 1] ?? 0) + (M.share.byType[p.archetype] ?? 0);
  return Math.max(M.share.min, Math.min(M.share.max, base + (u * 2 - 1) * M.share.spread));
}

function pick(mix: Mix, r: () => number): PitchType {
  const total = mix.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  for (const [t, w] of mix) if ((x -= w) < 0) return t;
  return mix[mix.length - 1]![0];
}

/** 2.0.1: kept on the player object itself — ids repeat from one league to the next (two games in one session read
    each other's pitch mixes when this was keyed by id). */
const cache = new WeakMap<Player, { key: string; out: Pitch[] }>();

/** The secondary pitches, best first. Hitters and players without a 변화구 tool have none. */
export function repertoire(p: Player): Pitch[] {
  if (p.hidden.current.breaking == null) return [];
  const key = `${p.id}|${p.role}|${p.throws}|${p.archetype}|${(p.learned ?? []).map((x) => `${x.type}${x.offset}`).join(',')}`;
  const hit = cache.get(p);
  if (hit && hit.key === key) return hit.out;
  const r = rng(`pitches-${p.id}`);
  const count = countOf(p, r);
  // His fastball's family is taken (1.9.3).
  const fb = fastballOf(p);
  const taken = (x: PitchType) => fb !== '4SFB' && (x === fb || (FAMILY[x] && FAMILY[x] === FAMILY[fb]));
  let mix = mixFor(p, true).filter(([x]) => !taken(x));
  const types: PitchType[] = [];
  while (types.length < count && mix.length) {
    const t = pick(mix, r);
    types.push(t);
    // One slider-type pitch at most: a sweeper and a slider rarely share an arm (1.9.3: one of each family).
    if (types.length === 1) mix = mixFor(p, false).filter(([x]) => !taken(x));
    mix = mix.filter(([x]) => !types.includes(x) && !(FAMILY[x] && types.some((y) => FAMILY[y] === FAMILY[x])));
  }
  const raw = types.map((_, i) => (i === 0 ? 5 + r() * 5 : i === 1 ? -1 - r() * 5 : -7 - r() * 7));
  // Shift so the weighted grade equals the tool: 0.6·best + 0.3·second + 0.1·(mean of the rest; the second
  // again for a pitcher with two). A pitcher with one breaking ball throws it at the tool's grade.
  const rest = raw.slice(2);
  const restMean = rest.length ? rest.reduce((a, b) => a + b, 0) / rest.length : raw[1];
  const mean = raw.length === 1 ? raw[0]! : WEIGHTS[0]! * raw[0]! + WEIGHTS[1]! * raw[1]! + WEIGHTS[2]! * restMean!;
  // How often each is thrown: his share of secondaries, split best first with some say of his own.
  const share = secondaryShare(p, types.length);
  const w = types.map((_, i) => M.decay ** i * (1 - M.jitter + 2 * M.jitter * r()));
  const total = w.reduce((a, b) => a + b, 0);
  const out = types.map((type, i) => ({ type, offset: raw[i]! - mean, usage: (share * w[i]!) / total }));
  // 2.0.8 (newpitch.ts): pitches he learned over a winter, after his own, at a small share.
  for (const x of p.learned ?? []) if (!out.some((y) => y.type === x.type)) out.push({ type: x.type, offset: x.offset, usage: LEARNED_USAGE });
  cache.set(p, { key, out });
  return out;
}

const clampGrade = (x: number) => Math.max(20, Math.min(80, Math.round(x / 5) * 5));

/** Public grades of each pitch (scouting 변화구 plus the pitch's offset and, from 2.0.6, its own course). */
export function pitchGrades(p: Player, future = false): { type: PitchType; label: string; grade: number; usage: number }[] {
  const base = (future ? p.scouting.futureTools : p.scouting.tools).breaking;
  if (base == null) return [];
  return repertoire(p).map((x) => ({ type: x.type, label: PITCH_LABELS[x.type], grade: clampGrade(base + x.offset + (p.pitchDev?.[x.type] ?? 0)), usage: x.usage }));
}

/** The grades a pitcher's pitches stood at (the fastball as "FB", his 구위), for the change shown next season. */
export const pitchSnapshot = (p: Player): Record<string, number> => ({
  ...(p.scouting.tools.stuff != null ? { FB: p.scouting.tools.stuff } : {}),
  ...Object.fromEntries(pitchGrades(p).map((x) => [x.type, x.grade])),
});

const PITCH_DEV = { step: 2, catchUp: 0.15, fade: 0.12, max: 10 };
const normalOf = (key: string) => (hashUnit(`${key}|a`) + hashUnit(`${key}|b`) + hashUnit(`${key}|c`) - 1.5) * 2;

/** 2.0.6 (the user's request): each secondary pitch on a course of its own, a winter at a time. A step either way (his
    own, seeded by the year); a young arm's weaker pitches catch up, an old arm's best one fades first. The steps are
    centred on his mix (weighted by use), so together they still make his 변화구 grade — what the engine reads — and the
    grade's own growth and decline move them all. */
export function developPitches(p: Player, year: number, age: number) {
  const rep = repertoire(p);
  if (rep.length < 2) return;
  const dev = p.pitchDev ?? {};
  const steps = rep.map((x) => {
    const now = x.offset + (dev[x.type] ?? 0);
    return normalOf(`pitch-dev|${p.id}|${year}|${x.type}`) * PITCH_DEV.step + (age <= 27 ? -now * PITCH_DEV.catchUp : 0) - (age >= 33 ? Math.max(0, now) * PITCH_DEV.fade : 0);
  });
  const total = rep.reduce((a, x) => a + x.usage, 0) || 1;
  const next = rep.map((x, i) => (dev[x.type] ?? 0) + steps[i]!);
  // Centred (twice: the bounds can pull it off), and only his pitches of today kept (a new role brings a new mix).
  for (let pass = 0; pass < 3; pass++) {
    const mean = rep.reduce((a, x, i) => a + x.usage * next[i]!, 0) / total;
    for (let i = 0; i < next.length; i++) next[i] = Math.max(-PITCH_DEV.max, Math.min(PITCH_DEV.max, next[i]! - mean));
  }
  p.pitchDev = Object.fromEntries(rep.map((x, i) => [x.type, Math.round(next[i]! * 10) / 10]));
}

/** Platoon multiplier the engine applies to the same-side advantage. */
export function platoonFactor(p: Player): number {
  const best = repertoire(p)[0];
  // 2.0.0: a low arm slot widens the split (tracking.ts).
  return (best ? PLATOON[best.type] : 1) * FASTBALL_PLATOON[fastballOf(p)] * slotPlatoon(p);
}

const VELO_PER_STUFF = 0.35;

/** Top velocity today: the draft-day reading moved by how much his 구위 has changed since. */
export function topVelocity(p: Player): number | null {
  if (p.velocity == null) return null;
  // 2.0.0: his arm slot (tracking.ts): a sidearmer a few km/h under, a submariner well under.
  const slot = slotVelocity(p);
  const now = p.hidden.current.stuff;
  const base = now == null || p.velocityStuff == null ? p.velocity : p.velocity + (now - p.velocityStuff) * VELO_PER_STUFF;
  return Math.round(Math.max(110, Math.min(163, base + slot)));
}

/** Average fastball: a few km/h under the top, less of a gap for relievers. */
export const averageVelocity = (p: Player) => {
  const top = topVelocity(p);
  return top == null ? null : Math.round(top - (p.role === 'RP' ? 3 : 4) - hashUnit(p.id) * 1.5 - FASTBALL_SLOWER[fastballOf(p)]);
};
