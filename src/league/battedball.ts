/* 2.0.1 (the 2.0 plan's second stage, the user's request): batted-ball data — each ball in play's exit velocity,
   launch angle, direction and (for a home run) distance, and the batter's tendencies: where he hits it (극단적
   당겨치기 … 스프레이 … 극단적 밀어치기) and how high (극단적 땅볼 … 극단적 뜬공).

   The engine still decides what happened (a ground-ball out, a double, a home run) the way it always has; the ball's
   flight is drawn afterwards to fit it, from its own random stream, so the plays themselves do not move with it. A
   batter's tendencies move them a little: a ground-ball hitter's outs are more often on the ground (and into double
   plays), a fly-ball hitter's more often in the air and his home runs a little more often; the steps are centred on
   the league so its averages hold. Where he pulls the ball tells only where it goes (until the parks' fences, 2.0.2).

   Season lines keep integer sums (and two maxima) the screens turn into averages and rates: exit velocity (in
   tenths of a km/h), launch angle, hard-hit balls (95 mph, 153 km/h, and up), barrels, the sweet spot (8–32°),
   ground ball / line drive / fly ball / pop-up, pull / centre / opposite field, the expected average, slugging and
   wOBA on contact (in thousandths), and home-run distance. */
import { hashUnit } from '../draftroom';
import type { Player } from '../model/types';

/** −2 … 2: extreme pull … extreme opposite field; extreme ground ball … extreme fly ball. */
export interface BattingProfile {
  pull: number;
  lift: number;
  /** How far his lift is from what his bat would make of it: the part the engine reads (his power already makes his
      home runs, so a slugger's fly balls do not count twice and the league's totals hold). */
  edge: number;
}

/** What one ball in play did in the air. */
export interface BattedBall {
  /** Exit velocity (km/h, to a tenth) and launch angle (degrees). */
  ev: number;
  la: number;
  /** Degrees off the centre-field line as seen from home plate, left field negative. */
  dir: number;
  /** Home runs: how far it went (m). */
  dist?: number;
}

/** A season's batted balls, summed. */
export interface BattedTotals {
  n: number;
  /** Exit velocity, tenths of a km/h: the sum and the hardest. */
  ev: number;
  evMax: number;
  la: number;
  hard: number;
  barrel: number;
  sweet: number;
  gb: number;
  ld: number;
  fb: number;
  pu: number;
  pull: number;
  cent: number;
  oppo: number;
  /** Expected average, slugging and wOBA on contact, thousandths, summed over the balls. */
  xba: number;
  xslg: number;
  xw: number;
  hrN: number;
  hrDist: number;
  hrMax: number;
}

export const emptyBatted = (): BattedTotals => ({ n: 0, ev: 0, evMax: 0, la: 0, hard: 0, barrel: 0, sweet: 0, gb: 0, ld: 0, fb: 0, pu: 0, pull: 0, cent: 0, oppo: 0, xba: 0, xslg: 0, xw: 0, hrN: 0, hrDist: 0, hrMax: 0 });

const MAXIMA = new Set<keyof BattedTotals>(['evMax', 'hrMax']);

export function addBatted(into: BattedTotals, b: Partial<BattedTotals>) {
  for (const k of Object.keys(into) as (keyof BattedTotals)[]) {
    if (MAXIMA.has(k)) into[k] = Math.max(into[k], b[k] ?? 0);
    else into[k] += b[k] ?? 0;
  }
  return into;
}

/** A step of five from a share: most hitters in the middle, one in fourteen at each end. */
const STEPS = [0.07, 0.27, 0.73, 0.93];
function five(u: number): number {
  return u < STEPS[0]! ? -2 : u < STEPS[1]! ? -1 : u < STEPS[2]! ? 0 : u < STEPS[3]! ? 1 : 2;
}
/** The step `five` gives on average when its share is a uniform draw moved by `t`. */
function meanFive(t: number): number {
  const below = (a: number) => Math.max(0, Math.min(1, a - t));
  const [a, b, c, d] = STEPS.map(below) as [number, number, number, number];
  return -2 * a - (b - a) + (d - c) + 2 * (1 - d);
}

/** His tendencies from his own seed and his bat: power hitters pull and lift the ball more, contact hitters spray it,
    fast ones keep it on the ground. Pull is negative (toward 극단적 당겨치기), lift positive (toward 극단적 뜬공). */
export function battingProfile(p: Pick<Player, 'id' | 'hidden' | 'custom'>): BattingProfile {
  const h = p.hidden.current as unknown as Record<string, number>;
  const power = h.power ?? 50,
    speed = h.speed ?? 50,
    contact = h.contact ?? 50;
  const tilt = (x: number) => Math.max(0.01, Math.min(0.99, x));
  const up = (power - 50) * 0.007 - (speed - 50) * 0.004;
  // 2.0.35 (abilityedit.ts): what the editor set, in place of his own draws.
  const lift = p.custom?.lift ?? five(tilt(hashUnit(`lift|${p.id}`) + up));
  return {
    pull: p.custom?.pull ?? five(tilt(hashUnit(`pull|${p.id}`) - (power - 50) * 0.006 + (contact - 50) * 0.003)),
    lift,
    edge: Math.round((lift - meanFive(up)) * 100) / 100,
  };
}

/** 2.0.3 (the user's request): a pitcher's tendency on the same five steps, 극단적 땅볼 투수 (−2) … 극단적 뜬공
    투수 (2), from his own seed moved by `up` (what his pitches do: a sinker or splitter down, a riding fastball up). */
export function pitcherLift(id: string, up: number): number {
  return five(Math.max(0.01, Math.min(0.99, hashUnit(`pitcher-lift|${id}`) + up)));
}

/** How a tendency moves the engine (by its edge): the share of outs on the ground, and the home-run log-odds. */
export const groundShift = (edge: number) => -0.06 * edge;
export const homeRunShift = (edge: number) => 0.12 * edge;

const KMH_HARD = 153;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Home-run distance (m) from exit velocity and launch angle (a fit to the major leagues' carry). */
export const distanceOf = (ev: number, la: number) =>
  Math.round(0.38 * Math.max(0, ev - 60) ** 1.25 * Math.max(0.2, Math.sin((2 * Math.max(5, Math.min(60, la)) * Math.PI) / 180)) ** 0.6);

/** Expected average and slugging from exit velocity and launch angle (a coarse table after Statcast's), and wOBA
    from them (a single's weight on every hit, a third of a home run's extra on each extra base). */
export function expectedOf(ev: number, la: number): { ba: number; slg: number; woba: number } {
  let ba: number, slg: number;
  if (la < 10) {
    ba = 0.09 + clamp01((ev - 110) / 60) * 0.31;
    slg = ba * 1.08;
  } else if (la < 25) {
    ba = 0.45 + clamp01((ev - 110) / 60) * 0.36;
    slg = ba * 1.25;
  } else if (la < 50) {
    const c = clamp01((ev - 135) / 35);
    ba = 0.04 + c ** 1.6 * 0.8;
    slg = 0.05 + c ** 2.2 * 2.75;
  } else {
    ba = 0.02;
    slg = 0.02;
  }
  slg = Math.max(slg, ba);
  return { ba, slg, woba: 0.9 * ba + 0.367 * (slg - ba) };
}

/** A barrel: hard enough, at an angle that turns hits into extra bases (Statcast's widening window, in km/h). */
export const isBarrel = (ev: number, la: number) => ev >= 158 && la >= 26 - (ev - 158) * 0.62 && la <= 30 + (ev - 158) * 0.69;

export type BipResult = 'HR' | '3B' | '2B' | '1B' | 'GO' | 'FO' | 'E';

/** Draws the flight of a ball in play to fit what the engine decided. `r` is the batted-ball stream; `power` the
    batter's z-score, `prof` his tendencies, `lefty` whether he hit from the left side; `aim` (2.0.3, degrees, left
    field negative), the direction of the fielder whose ball it was. */
export function drawBall(result: BipResult, power: number, prof: BattingProfile, lefty: boolean, r: () => number, aim?: number): BattedBall {
  const n = () => (r() + r() + r() - 1.5) * 2;
  const p = power * 3;
  let ev: number, la: number;
  switch (result) {
    case 'HR':
      ev = 167 + p + n() * 4;
      la = 28 + n() * 4;
      break;
    case '3B':
      ev = 158 + p + n() * 5;
      la = 17 + n() * 6;
      break;
    case '2B':
      ev = 157 + p + n() * 6;
      la = 18 + n() * 8;
      break;
    case '1B': {
      const kind = r() + prof.lift * 0.08;
      if (kind < 0.45) {
        ev = 146 + p + n() * 10;
        la = 2 + n() * 5;
      } else if (kind < 0.88) {
        ev = 152 + p + n() * 8;
        la = 15 + n() * 4;
      } else {
        ev = 118 + n() * 8;
        la = 33 + n() * 6;
      }
      break;
    }
    case 'GO':
      ev = 136 + p + n() * 14;
      la = -5 + prof.lift * 2 + n() * 7;
      break;
    case 'FO': {
      const pop = r() < 0.18 + prof.lift * 0.02;
      ev = pop ? 112 + n() * 10 : 143 + p + n() * 12;
      la = pop ? 58 + n() * 8 : 31 + prof.lift * 2 + n() * 8;
      break;
    }
    case 'E':
      ev = 132 + n() * 12;
      la = -2 + n() * 8;
      break;
  }
  ev = Math.round(Math.max(60, Math.min(190, ev)) * 10) / 10;
  la = Math.round(Math.max(-60, Math.min(80, la)));
  // Pulled more on the ground and over the fence; his tendency moves the middle of it.
  const centre = -4 + prof.pull * 7 - (la < 10 ? 4 : 0) - (result === 'HR' ? 8 : 0);
  const pullSide = Math.round(Math.max(-45, Math.min(45, centre + n() * 26)));
  const dir = aim === undefined ? (lefty ? -pullSide : pullSide) : Math.round(Math.max(-45, Math.min(45, aim + n() * 7)));
  return { ev, la, dir, ...(result === 'HR' ? { dist: distanceOf(ev, la) } : {}) };
}

/** Adds one ball to a season's totals (`lefty`: he hit from the left side, so his pull side is right field). */
export function countBall(t: BattedTotals, b: BattedBall, lefty: boolean) {
  const ev10 = Math.round(b.ev * 10);
  t.n++;
  t.ev += ev10;
  t.evMax = Math.max(t.evMax, ev10);
  t.la += b.la;
  if (b.ev >= KMH_HARD) t.hard++;
  if (isBarrel(b.ev, b.la)) t.barrel++;
  if (b.la >= 8 && b.la <= 32) t.sweet++;
  if (b.la < 10) t.gb++;
  else if (b.la < 25) t.ld++;
  else if (b.la < 50) t.fb++;
  else t.pu++;
  const side = lefty ? -b.dir : b.dir;
  if (side < -15) t.pull++;
  else if (side > 15) t.oppo++;
  else t.cent++;
  const x = expectedOf(b.ev, b.la);
  t.xba += Math.round(x.ba * 1000);
  t.xslg += Math.round(x.slg * 1000);
  t.xw += Math.round(x.woba * 1000);
  if (b.dist) {
    t.hrN++;
    t.hrDist += b.dist;
    t.hrMax = Math.max(t.hrMax, b.dist);
  }
}

/** The rates a screen shows from a season's (or a career's) totals; null with no balls in play. */
export function battedRates(t: BattedTotals | undefined) {
  if (!t || !t.n) return null;
  const pct = (x: number) => Math.round((x / t.n) * 1000) / 10;
  return {
    n: t.n,
    ev: Math.round(t.ev / t.n) / 10,
    evMax: t.evMax / 10,
    la: Math.round((t.la / t.n) * 10) / 10,
    hard: pct(t.hard),
    barrel: pct(t.barrel),
    sweet: pct(t.sweet),
    gb: pct(t.gb),
    ld: pct(t.ld),
    fb: pct(t.fb),
    pu: pct(t.pu),
    pull: pct(t.pull),
    cent: pct(t.cent),
    oppo: pct(t.oppo),
    xba: t.xba / t.n / 1000,
    xslg: t.xslg / t.n / 1000,
    xwcon: t.xw / t.n / 1000,
    hrDist: t.hrN ? Math.round(t.hrDist / t.hrN) : null,
    hrMax: t.hrN ? t.hrMax : null,
  };
}
