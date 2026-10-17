import { k as __i18n_k } from '../i18n/index';
/* 2.0.2 (the 2.0 plan's third stage, the user's request): ballpark layouts — each park's fence distance and height to
   left, left-centre, centre, right-centre and right field, and what they do to home runs.

   A ball clears the fence where it goes when it carries past the distance there, plus a little more for a high wall
   (a ball coming down at about 40° needs some 1.2 m more for every metre of wall). A park's home-run effect follows
   from how far its fences are, zone by zone, from the league's own parks on average, weighted by where home runs go;
   it is centred on today's KBO parks so the league's totals hold. A park with more room in the outfield gives up a
   few more hits in the gaps.

   The real parks are researched (RULES.md §13, S121); the old parks of a league that plays history, and a park
   whose fences were moved before 2.0.2, take the neutral layout moved in or out by their run factor. Our club can
   change its own park in the layout editor (ballpark.ts): it costs by the metre and opens the next season. */
import type { Team } from '../model/types';
import { parkFactor } from './clubs';

/** Fence distances (m) and heights (m) at evenly spaced points from the left-field line to the right-field line: five
    (left, left-centre, centre, right-centre, right) or, from the editor's fine mode, nineteen (every 5°). */
export interface ParkLayout {
  dist: number[];
  wall: number[];
}

/** The fine grid: every 5° from the left-field line (−45°) to the right (45°). */
export const FINE = Array.from({ length: 19 }, (_, i) => -45 + i * 5);
/** Home runs per metre of fence (log share): ten metres farther, about 45% fewer. */
const PER_METRE = 0.06;
/** Extra carry a metre of wall asks for. */
const WALL_CARRY = 1.2;
/** Where home runs go (a game estimate): pulled toward the corners more than hit to centre. */
const HR_WEIGHT = FINE.map((a) => 1 + (0.8 * Math.abs(a)) / 45);
const HR_TOTAL = HR_WEIGHT.reduce((a, b) => a + b, 0);

const lay = (dist: number[], wall: number | number[]): ParkLayout => ({ dist, wall: typeof wall === 'number' ? dist.map(() => wall) : wall });
const ft = (x: number) => Math.round(x * 0.3048 * 10) / 10;

/** Today's parks by club (S121: club and press figures; the alleys of 고척 and 라이온즈파크 are estimates). */
export const LAYOUTS: Record<string, ParkLayout> = {
  lg: lay([100, 120, 125, 120, 100], 2.6),
  doosan: lay([100, 120, 125, 120, 100], 2.6),
  kiwoom: lay([99, 113, 122, 113, 99], 4),
  ssg: lay([95, 115, 120, 115, 95], 2.8),
  kt: lay([98, 115, 120, 115, 98], 4),
  lotte: lay([95.8, 113, 120.5, 113, 95.8], 4.8),
  samsung: lay([99.5, 107, 122.5, 107, 99.5], 3.6),
  kia: lay([99, 117, 121, 117, 99], 3.4),
  nc: lay([101, 123, 122, 123, 101], 3.3),
  // The 8 m "monster wall" runs along right field only (fine grid: the last four points).
  hanwha: lay([99, 104, 108, 111, 113, 115, 117, 119, 121, 122, 120, 118, 116, 114, 112, 106, 101, 97, 95], [2.4, 2.4, 2.4, 2.4, 2.4, 2.4, 2.4, 2.4, 2.4, 2.4, 2.4, 2.4, 2.4, 2.4, 2.4, 8, 8, 8, 8]),
};

/** Famous major-league parks to start the editor from (S122: the parks' published distances, rounded from feet). */
export const MLB_PRESETS: Record<string, ParkLayout> = {
  // 펜웨이: the Green Monster in left (11.3 m), the Pesky Pole 92 m down the right-field line, the deep triangle in
  // right-centre.
  fenway: lay(
    [ft(310), ft(312), ft(320), ft(335), ft(350), ft(379), ft(385), ft(390), ft(395), ft(400), ft(410), ft(420), ft(400), ft(380), ft(370), ft(360), ft(350), ft(330), ft(302)],
    [11.3, 11.3, 11.3, 11.3, 11.3, 11.3, 5.2, 5.2, 5.2, 5.2, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.2, 1.2, 1.2],
  ),
  yankee: lay([ft(318), ft(399), ft(408), ft(385), ft(314)], 2.4),
  // 오라클: a short right field behind a 7.6 m brick wall and the deep "Triples Alley".
  oracle: lay(
    [ft(339), ft(345), ft(350), ft(358), ft(364), ft(375), ft(385), ft(391), ft(395), ft(399), ft(405), ft(415), ft(421), ft(410), ft(390), ft(365), ft(345), ft(325), ft(309)],
    [2.4, 2.4, 2.4, 2.4, 2.4, 2.4, 2.4, 2.4, 2.4, 2.4, 2.4, 2.4, 7.6, 7.6, 7.6, 7.6, 7.6, 7.6, 7.6],
  ),
  wrigley: lay([ft(355), ft(368), ft(400), ft(368), ft(353)], 3.5),
  // 휴스턴: the short left field under the high wall of the Crawford Boxes.
  houston: lay(
    [ft(315), ft(318), ft(325), ft(335), ft(350), ft(362), ft(380), ft(395), ft(404), ft(409), ft(400), ft(390), ft(380), ft(373), ft(365), ft(355), ft(345), ft(335), ft(326)],
    [5.8, 5.8, 5.8, 5.8, 5.8, 5.8, 3, 3, 3, 3, 2.1, 2.1, 2.1, 2.1, 2.1, 2.1, 2.1, 2.1, 2.1],
  ),
  coors: lay([ft(347), ft(390), ft(415), ft(375), ft(350)], [2.4, 2.4, 2.4, 4.3, 4.3]),
  dodger: lay([ft(330), ft(375), ft(395), ft(375), ft(330)], 2.4),
};

/** A park built to the KBO's recommended size (98 m down the lines, 122 m to centre). */
export const NEUTRAL: ParkLayout = lay([98, 117, 122, 117, 98], 3.4);

/** Bounds the editor allows: a point on (or next to) a foul line, any other point, and the wall. */
export const LAYOUT_BOUNDS = { lines: [85, 112], field: [95, 140], wall: [1, 15] } as const;

/** The direction of a layout's `i`th point. */
export const angleOf = (l: ParkLayout, i: number) => -45 + (90 * i) / (l.dist.length - 1);

/** The fence where a ball goes (degrees off the centre-field line, left negative): distance and height, between points. */
export function fenceAt(l: ParkLayout, dir: number): { dist: number; wall: number } {
  const n = l.dist.length - 1;
  const x = ((Math.max(-45, Math.min(45, dir)) + 45) / 90) * n;
  const i = Math.min(n - 1, Math.floor(x));
  const t = x - i;
  return { dist: l.dist[i]! + (l.dist[i + 1]! - l.dist[i]!) * t, wall: l.wall[i]! + (l.wall[i + 1]! - l.wall[i]!) * t };
}

/** How far a ball must carry to clear the fence there. */
export const clearance = (l: ParkLayout, dir: number) => {
  const f = fenceAt(l, dir);
  return f.dist + WALL_CARRY * f.wall;
};

/** The layout on the fine grid (every 5°), for the editor's fine mode. */
export const refine = (l: ParkLayout): ParkLayout => ({ dist: FINE.map((a) => Math.round(fenceAt(l, a).dist * 10) / 10), wall: FINE.map((a) => Math.round(fenceAt(l, a).wall * 10) / 10) });

const parks = Object.values(LAYOUTS);
/** The league's parks on average, every 5°: the line the effects are drawn from. */
const REFERENCE = FINE.map((a) => parks.reduce((t, l) => t + clearance(l, a), 0) / parks.length);
const meanDist = (l: ParkLayout) => FINE.reduce((t, a) => t + fenceAt(l, a).dist, 0) / FINE.length;
const REF_DIST = parks.reduce((t, l) => t + meanDist(l), 0) / parks.length;

const rawHr = (l: ParkLayout) => Math.log(FINE.reduce((t, a, j) => t + (HR_WEIGHT[j]! / HR_TOTAL) * Math.exp(-PER_METRE * (clearance(l, a) - REFERENCE[j]!)), 0));
/** Centred so the league's parks average to nothing. */
const CENTRE = parks.reduce((t, l) => t + rawHr(l), 0) / parks.length;

/** What a layout does: the home-run log-odds and the in-play hit log-odds (more room, more hits in the gaps). */
export function layoutEffects(l: ParkLayout): { hr: number; babip: number } {
  return { hr: Math.round((rawHr(l) - CENTRE) * 1000) / 1000, babip: Math.round(0.004 * (meanDist(l) - REF_DIST) * 1000) / 1000 };
}

/** The home-run factor a screen shows (1 = the league's average park). */
export const homeRunFactor = (l: ParkLayout) => Math.round(Math.exp(layoutEffects(l).hr) * 100) / 100;

/** The layout moved in or out evenly by a run factor of before 2.0.2 (1.4 home-run log-odds per log run factor). */
export function shifted(base: ParkLayout, factor: number): ParkLayout {
  const m = (Math.log(factor) * 1.4) / PER_METRE;
  return { dist: base.dist.map((d) => Math.round((d - m) * 10) / 10), wall: [...base.wall] };
}

/** A club's park as it plays today: its own layout (the editor's), else its real park's (moved by an old run factor). */
export function layoutOf(team: Pick<Team, 'id' | 'stadium'>): ParkLayout {
  if (team.stadium.layout) return team.stadium.layout;
  const base = LAYOUTS[team.id];
  const park = team.stadium.park;
  if (base) return park === undefined ? base : shifted(base, park / parkFactor(team.id));
  return park === undefined ? NEUTRAL : shifted(NEUTRAL, park);
}

/** What a change from one layout to another costs (만 원): a base for the works, then by the metre of fence moved and
    of wall changed, every 5° counted as a fifth of a 22.5° zone or so (the same works however finely it is drawn). */
export function layoutCost(from: ParkLayout, to: ParkLayout): number {
  let metres = 0,
    wall = 0;
  for (const a of FINE) {
    const x = fenceAt(from, a),
      y = fenceAt(to, a);
    // Less than a few centimetres is the same fence drawn another way (five points or nineteen).
    if (Math.abs(y.dist - x.dist) >= 0.05) metres += Math.abs(y.dist - x.dist);
    if (Math.abs(y.wall - x.wall) >= 0.05) wall += Math.abs(y.wall - x.wall);
  }
  const span = 5 / 22.5;
  metres = Math.round(metres * span * 10) / 10;
  wall = Math.round(wall * span * 10) / 10;
  if (metres + wall === 0) return 0;
  return Math.round(50_000 + metres * 12_000 + wall * 15_000);
}

/** Whether a layout stays within what the editor allows (null) or why not. */
export function checkLayout(l: ParkLayout): string | null {
  const { lines, field, wall } = LAYOUT_BOUNDS;
  const ok = (x: number, [a, b]: readonly [number, number]) => Number.isFinite(x) && x >= a && x <= b;
  const shape = l.dist.length >= 2 && l.dist.length <= 37 && l.wall.length === l.dist.length;
  const distOk = shape && l.dist.every((d, i) => ok(d, Math.abs(angleOf(l, i)) >= 40 ? lines : field));
  if (!distOk || !l.wall.every((w) => ok(w, wall))) return __i18n_k("league.layout.text.356b3a1f", { a: lines[0], b: lines[1], c: field[0], d: field[1], e: wall[0], f: wall[1] });
  return null;
}
