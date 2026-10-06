/* Hidden traits (1.1.0, from the 1.0 feedback). Besides his abilities and injury risk, every player has a growth type
   and six traits, all hidden like abilities (the club learns them from its scouts and coaches, reports.ts):

   성장 타입  초조숙 · 조숙 · 보통 · 만성 · 초만성: when growth starts in earnest, how long it runs, when it stops and
             when he declines (tuning GROWTH.types). Draft Room's early and late developers split into two kinds each.
   천재성     how fast he learns: growth speed, and a breakout winter now and then.
   성실성     work ethic: growth, and how long he holds off the late-career decline.
   멘탈       composure on the big stage: a little better (or worse) in the postseason.
   리더십     a senior voice in the clubhouse.
   충성심     what his own club's offer is worth to him in free agency.
   논란성     trouble off the field (scandals.ts: who it happens to, and how often at his club).

   Draft Room's eight personalities lean the traits (a 성실형 works harder, a 대담형 loves the big stage and makes
   more headlines); the rest is chance. The leanings are centred, so the league's average stays where it was. Traits
   are drawn once, on a stream of their own, so nothing else about a player moves. */
import { DRAFT_GROWTH, PERSONALITIES, rng, type ToolKey, type Tools } from '../draftroom';
import type { GrowthType, Player, Traits } from '../model/types';
import { GROWTH } from './tuning';

export const GROWTH_ORDER: GrowthType[] = ['veryEarly', 'early', 'normal', 'late', 'veryLate'];
export const GROWTH_LABELS: Record<GrowthType, string> = { veryEarly: '초조숙형', early: '조숙형', normal: '보통', late: '만성형', veryLate: '초만성형' };
/** What each growth type means, for the profile and the manual. */
export const GROWTH_NOTES: Record<GrowthType, string> = {
  veryEarly: '입단하자마자 빠르게 커서 20대 초반에 거의 완성되고, 25세 무렵 성장이 멈춥니다. 29세 무렵부터 기량이 꺾입니다.',
  early: '어릴 때 빨리 크고 27세 무렵 성장이 멈춥니다. 30세 무렵부터 기량이 꺾입니다.',
  normal: '22세 무렵까지 꾸준히 크고 28세 무렵 완성됩니다. 31세 무렵부터 기량이 꺾입니다.',
  late: '22세까지는 더디다가 그 뒤에 크고 29세 무렵 완성됩니다. 32세 무렵까지 기량을 지킵니다.',
  veryLate: '24세까지는 더디고 20대 중반에야 본격적으로 커서 30세 무렵 완성됩니다. 33세 무렵까지 기량을 지킵니다.',
};

export type TraitKey = Exclude<keyof Traits, 'growth'>;
export const TRAIT_KEYS: TraitKey[] = ['genius', 'work', 'mental', 'leadership', 'loyalty', 'controversy'];
export const TRAIT_LABELS: Record<TraitKey, string> = { genius: '천재성', work: '성실성', mental: '멘탈', leadership: '리더십', loyalty: '충성심', controversy: '논란성' };

/** Each trait's spread: base, standard deviation, and a rare jump (a genius, a troublemaker). */
const ROLL: Record<TraitKey, { base: number; sd: number; tail?: [number, number] }> = {
  genius: { base: 48, sd: 12, tail: [0.04, 30] },
  work: { base: 50, sd: 15 },
  mental: { base: 50, sd: 15 },
  leadership: { base: 45, sd: 15 },
  loyalty: { base: 50, sd: 16 },
  controversy: { base: 28, sd: 12, tail: [0.06, 30] },
};

// prettier-ignore
const LEAN_RAW: Record<string, Partial<Record<TraitKey, number>>> = {
  '차분한 노력파': { work: 14, mental: 6, controversy: -10 },
  '승부욕 강한 도전자': { mental: 10, work: 4, controversy: 6, loyalty: -6 },
  '밝은 분위기 메이커': { leadership: 8, loyalty: 6, mental: 4, controversy: 4 },
  '분석을 즐기는 연구형': { genius: 10, work: 6, mental: -4 },
  '책임감 강한 리더': { leadership: 24, work: 6, loyalty: 10, controversy: -10 },
  '말보다 행동하는 실천형': { work: 10, mental: 4, leadership: 4 },
  '꾸준함을 믿는 성실형': { work: 20, loyalty: 6, controversy: -12 },
  '큰 무대를 즐기는 대담형': { mental: 22, genius: 4, loyalty: -10, controversy: 10 },
};
/** The leanings less their average over the eight, so the population keeps each trait's base. */
const LEAN: Record<string, Partial<Record<TraitKey, number>>> = Object.fromEntries(
  Object.entries(LEAN_RAW).map(([who, lean]) => [
    who,
    Object.fromEntries(TRAIT_KEYS.map((k) => [k, (lean[k] ?? 0) - Object.values(LEAN_RAW).reduce((a, x) => a + (x[k] ?? 0), 0) / Object.keys(LEAN_RAW).length])),
  ]),
);

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
/** Roughly standard normal (four uniforms). */
const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * Math.sqrt(3);
const normal = (r: () => number) => (r() + r() + r() - 1.5) / 1.5;
const round3 = (n: number) => {
  const v = Math.round(n * 1000) / 1000;
  return Object.is(v, -0) ? 0 : v;
};

/** A personality for a player who came without one (foreign signings). */
export const rollPersonality = (seed: string, id: string) => {
  const r = rng(`${seed}|personality|${id}`);
  return PERSONALITIES[Math.floor(r() * PERSONALITIES.length)]!;
};

/**
 * A player's traits, drawn once. `curve` is Draft Room's growth curve; a player without one (a foreign signing) draws
 * it here, as often early or late as a draftee.
 */
export function rollTraits(seed: string, id: string, personality: string, curve?: 'early' | 'normal' | 'late'): Traits {
  const r = rng(`${seed}|traits|${id}`);
  const c = r();
  const kind = curve ?? (c < 0.2 ? 'early' : c < 0.78 ? 'normal' : 'late');
  const extreme = r() < GROWTH.extreme;
  const growth: GrowthType = kind === 'early' ? (extreme ? 'veryEarly' : 'early') : kind === 'late' ? (extreme ? 'veryLate' : 'late') : 'normal';
  const lean = LEAN[personality] ?? {};
  const out = { growth } as Traits;
  for (const k of TRAIT_KEYS) {
    const a = ROLL[k];
    const jump = a.tail && r() < a.tail[0] ? a.tail[1] : 0;
    out[k] = clamp(Math.round(a.base + (lean[k] ?? 0) + gauss(r) * a.sd + jump), 1, 99);
  }
  return out;
}

/** His traits (a player from before 1.1.0 that the migration has not reached draws them from his id). */
export const traitsOf = (p: Pick<Player, 'id' | 'personality' | 'hidden'>): Traits => p.hidden.traits ?? rollTraits('', p.id, p.personality, p.hidden.growthCurve);

export const growthOf = (p: Pick<Player, 'id' | 'personality' | 'hidden'>) => GROWTH.types[traitsOf(p).growth];

// ── Growth ───────────────────────────────────────────────────────────────────────────────────────

const D = DRAFT_GROWTH;
const focusFactor = (focus: string, key: string) => (!focus || focus === 'balanced' ? 1 : key === focus ? D.focus.chosen : D.focus.others);

/**
 * One year of growth toward his ceiling, less aging, by his growth type. Draft Room's growth with the type's ages in
 * place of its three curves; 보통 at 천재성 and 성실성 50 grows exactly as before 1.1.0.
 */
export function growTools(p: Player, age: number, lostDays: number, r: () => number, focus = 'balanced', scale = 1): Tools {
  const t = traitsOf(p);
  const T = GROWTH.types[t.growth];
  const h = p.hidden;
  const G = D.growth,
    H = D.health;
  const rate = T.rate * (age < T.start ? GROWTH.before : 1) * (1 + ((t.genius - 50) / 100) * GROWTH.genius) * (1 + ((t.work - 50) / 100) * GROWTH.work);
  const taper = clamp(1 - (age - T.fullUntil) / (T.zeroAt - T.fullUntil), G.ageTaper.floor, 1);
  const after: Tools = {};
  for (const [key, v] of Object.entries(h.current) as [ToolKey, number][]) {
    const speed = key === 'speed';
    const pot = h.potential[key] ?? v;
    const aging = Math.max(0, age - (T.aging - (speed ? 3 : 0))) * G.agingPerYear[speed ? 'speed' : 'other'];
    const gain =
      (pot - v) * rate * taper * scale * focusFactor(focus, key) * h.developmentRate * (speed ? G.speedShare : 1) * (1 - lostDays / H.growthDays) +
      normal(r) * G.noise -
      aging -
      (lostDays > H.heavyInjuryDays ? H.heavyInjuryGrowthPenalty : 0);
    after[key] = round3(clamp(v + clamp(gain, G.minGain, T.cap), 20, pot));
  }
  return after;
}

/** The late-career decline this year (grade points before each tool's weight): from his type's age, eased by work. */
export function declineOf(p: Player, age: number, perYear: number, steepPerYear: number): number {
  const t = traitsOf(p);
  const from = GROWTH.types[t.growth].decline;
  const base = Math.max(0, age - from) * perYear + Math.max(0, age - from - 3) * steepPerYear;
  return base * clamp(1 - ((t.work - 50) / 100) * GROWTH.workDecline, 0.5, 1.5);
}

/** The age to which scouts project growth (the public future grade). */
export const matureAge = (p: Pick<Player, 'id' | 'personality' | 'hidden'>) => growthOf(p).zeroAt;

// ── Other effects ────────────────────────────────────────────────────────────────────────────────

/** How much likelier than usual he is to get into trouble off the field. */
export const troubleFactor = (p: Pick<Player, 'id' | 'personality' | 'hidden'>) => 2 ** ((traitsOf(p).controversy - GROWTH.controversy.pivot) / GROWTH.controversy.doubling);

/** Grade points on his main tools in a postseason game. */
export const bigGameEdge = (p: Pick<Player, 'id' | 'personality' | 'hidden'>) => (traitsOf(p).mental - 50) * GROWTH.mental;

/** A breakout winter's chance, × this. */
export const breakoutFactor = (p: Pick<Player, 'id' | 'personality' | 'hidden'>) => 1 + (Math.max(0, traitsOf(p).genius - 60) / 40) * GROWTH.geniusBreakout;
