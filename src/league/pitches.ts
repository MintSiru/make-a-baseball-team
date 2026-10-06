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
import { hashUnit, rng } from '../draftroom';
import type { Player } from '../model/types';
import { isForeign } from './players';
import { PITCH_MIX as M } from './tuning';

export type PitchType = 'SL' | 'SW' | 'CB' | 'CH' | 'FO' | 'CT' | 'SI';

export const PITCH_LABELS: Record<PitchType, string> = {
  SL: '슬라이더',
  SW: '스위퍼',
  CB: '커브',
  CH: '체인지업',
  FO: '포크볼',
  CT: '커터',
  SI: '투심',
};

/** Same-side platoon advantage by best pitch: >1 a wider split, <1 a pitcher who handles both sides. */
const PLATOON: Record<PitchType, number> = { SL: 1.25, SW: 1.45, CB: 1.05, CH: 0.65, FO: 0.7, CT: 0.9, SI: 1.1 };

const WEIGHTS = [0.6, 0.3, 0.1];

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
  const young = Number(p.birthday.slice(0, 4)) >= 1998;
  // His signature pitch is likelier to be the best one.
  const sig = first ? M.signature[p.archetype] : undefined;
  const add = (t: PitchType) => (sig?.pitch === t ? sig.weight : 0);
  return [
    ['SL', 40 + add('SL')],
    ['SW', (young || isForeign(p) ? 8 : 2) + add('SW')],
    ['CB', 16 + add('CB')],
    ['CH', (lefty ? 30 : 13) + add('CH')],
    ['FO', (japan ? 34 : lefty ? 7 : 15) + add('FO')],
    ['CT', (isForeign(p) ? 12 : 6) + add('CT')],
    ['SI', (isForeign(p) ? 12 : 5) + add('SI')],
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

const cache = new Map<string, Pitch[]>();

/** The secondary pitches, best first. Hitters and players without a 변화구 tool have none. */
export function repertoire(p: Player): Pitch[] {
  if (p.hidden.current.breaking == null) return [];
  const key = `${p.id}|${p.role}|${p.throws}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = rng(`pitches-${p.id}`);
  const count = countOf(p, r);
  let mix = mixFor(p, true);
  const types: PitchType[] = [];
  while (types.length < count && mix.length) {
    const t = pick(mix, r);
    types.push(t);
    // One slider-type pitch at most: a sweeper and a slider rarely share an arm.
    if (types.length === 1) mix = mixFor(p, false);
    mix = mix.filter(([x]) => !types.includes(x) && !(types.includes('SW') && x === 'SL') && !(types.includes('SL') && x === 'SW'));
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
  cache.set(key, out);
  return out;
}

const clampGrade = (x: number) => Math.max(20, Math.min(80, Math.round(x / 5) * 5));

/** Public grades of each pitch (scouting 변화구 plus the pitch's offset). */
export function pitchGrades(p: Player, future = false): { type: PitchType; label: string; grade: number; usage: number }[] {
  const base = (future ? p.scouting.futureTools : p.scouting.tools).breaking;
  if (base == null) return [];
  return repertoire(p).map((x) => ({ type: x.type, label: PITCH_LABELS[x.type], grade: clampGrade(base + x.offset), usage: x.usage }));
}

/** Platoon multiplier the engine applies to the same-side advantage. */
export function platoonFactor(p: Player): number {
  const best = repertoire(p)[0];
  return best ? PLATOON[best.type] : 1;
}

const VELO_PER_STUFF = 0.35;

/** Top velocity today: the draft-day reading moved by how much his 구위 has changed since. */
export function topVelocity(p: Player): number | null {
  if (p.velocity == null) return null;
  const now = p.hidden.current.stuff;
  if (now == null || p.velocityStuff == null) return p.velocity;
  return Math.round(Math.max(128, Math.min(163, p.velocity + (now - p.velocityStuff) * VELO_PER_STUFF)));
}

/** Average fastball: a few km/h under the top, less of a gap for relievers. */
export const averageVelocity = (p: Player) => {
  const top = topVelocity(p);
  return top == null ? null : Math.round(top - (p.role === 'RP' ? 3 : 4) - hashUnit(p.id) * 1.5);
};
