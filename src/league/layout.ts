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

/** Fence distances (m) and heights (m) to left, left-centre, centre, right-centre and right field. */
export interface ParkLayout {
  dist: [number, number, number, number, number];
  wall: [number, number, number, number, number];
}

/** The zones' directions, degrees off the centre-field line (left field negative). */
const ZONES = [-45, -22.5, 0, 22.5, 45] as const;
/** Where home runs go, by zone (a game estimate: pulled to the corners more than to centre). */
const HR_SHARE = [0.25, 0.2, 0.1, 0.2, 0.25] as const;
/** Home runs per metre of fence (log share): ten metres farther, about 45% fewer. */
const PER_METRE = 0.06;
/** Extra carry a metre of wall asks for. */
const WALL_CARRY = 1.2;

const lay = (dist: ParkLayout['dist'], wall: number | ParkLayout['wall']): ParkLayout => ({ dist, wall: typeof wall === 'number' ? [wall, wall, wall, wall, wall] : wall });

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
  hanwha: lay([99, 115, 122, 112, 95], [2.4, 2.4, 2.4, 2.4, 8]),
};

/** A park built to the KBO's recommended size (98 m down the lines, 122 m to centre). */
export const NEUTRAL: ParkLayout = lay([98, 117, 122, 117, 98], 3.4);

/** Bounds the editor allows, per zone (lines, alleys, centre) and for the wall. */
export const LAYOUT_BOUNDS = { lines: [90, 106], alleys: [104, 130], centre: [114, 132], wall: [2.4, 10] } as const;

const effective = (l: ParkLayout, i: number) => l.dist[i]! + WALL_CARRY * l.wall[i]!;

/** The league's parks on average (each club's park once): the line the effects are drawn from. */
const REFERENCE = ZONES.map((_, i) => {
  const xs = Object.values(LAYOUTS).map((l) => effective(l, i));
  return xs.reduce((a, b) => a + b, 0) / xs.length;
});
const meanDist = (l: ParkLayout) => l.dist.reduce((a, b) => a + b, 0) / 5;
const REF_DIST = Object.values(LAYOUTS).reduce((a, l) => a + meanDist(l), 0) / Object.keys(LAYOUTS).length;

const rawHr = (l: ParkLayout) => Math.log(HR_SHARE.reduce((a: number, w, i) => a + w * Math.exp(-PER_METRE * (effective(l, i) - REFERENCE[i]!)), 0));
/** Centred so the league's parks average to nothing. */
const CENTRE = Object.values(LAYOUTS).reduce((a, l) => a + rawHr(l), 0) / Object.keys(LAYOUTS).length;

/** What a layout does: the home-run log-odds and the in-play hit log-odds (more room, more hits in the gaps). */
export function layoutEffects(l: ParkLayout): { hr: number; babip: number } {
  return { hr: Math.round((rawHr(l) - CENTRE) * 1000) / 1000, babip: Math.round(0.004 * (meanDist(l) - REF_DIST) * 1000) / 1000 };
}

/** The home-run factor a screen shows (1 = the league's average park). */
export const homeRunFactor = (l: ParkLayout) => Math.round(Math.exp(layoutEffects(l).hr) * 100) / 100;

/** The layout moved in or out evenly by a run factor of before 2.0.2 (1.4 home-run log-odds per log run factor). */
export function shifted(base: ParkLayout, factor: number): ParkLayout {
  const m = (Math.log(factor) * 1.4) / PER_METRE;
  return { dist: base.dist.map((d) => Math.round((d - m) * 10) / 10) as ParkLayout['dist'], wall: [...base.wall] };
}

/** A club's park as it plays today: its own layout (the editor's), else its real park's (moved by an old run factor). */
export function layoutOf(team: Pick<Team, 'id' | 'stadium'>): ParkLayout {
  if (team.stadium.layout) return team.stadium.layout;
  const base = LAYOUTS[team.id];
  const park = team.stadium.park;
  if (base) return park === undefined ? base : shifted(base, park / parkFactor(team.id));
  return park === undefined ? NEUTRAL : shifted(NEUTRAL, park);
}

/** The fence where a ball goes (degrees off the centre-field line, left negative): distance and height, between zones. */
export function fenceAt(l: ParkLayout, dir: number): { dist: number; wall: number } {
  const d = Math.max(-45, Math.min(45, dir));
  const i = Math.min(3, Math.floor((d + 45) / 22.5));
  const t = (d - ZONES[i]!) / 22.5;
  return { dist: l.dist[i]! + (l.dist[i + 1]! - l.dist[i]!) * t, wall: l.wall[i]! + (l.wall[i + 1]! - l.wall[i]!) * t };
}

/** How far a ball must carry to clear the fence there. */
export const clearance = (l: ParkLayout, dir: number) => {
  const f = fenceAt(l, dir);
  return f.dist + WALL_CARRY * f.wall;
};

/** What a change from one layout to another costs (만 원): a base for the works, by the metre moved and of wall. */
export function layoutCost(from: ParkLayout, to: ParkLayout): number {
  let metres = 0,
    wall = 0;
  for (let i = 0; i < 5; i++) {
    metres += Math.abs(to.dist[i]! - from.dist[i]!);
    wall += Math.abs(to.wall[i]! - from.wall[i]!);
  }
  if (metres + wall === 0) return 0;
  return Math.round(50_000 + metres * 12_000 + wall * 15_000);
}

/** Whether a layout stays within what the editor allows (null) or why not. */
export function checkLayout(l: ParkLayout): string | null {
  const [lines, alleys, centre, wall] = [LAYOUT_BOUNDS.lines, LAYOUT_BOUNDS.alleys, LAYOUT_BOUNDS.centre, LAYOUT_BOUNDS.wall];
  const ok = (x: number, [a, b]: readonly [number, number]) => Number.isFinite(x) && x >= a && x <= b;
  const zoneOk = [lines, alleys, centre, alleys, lines].every((b, i) => ok(l.dist[i]!, b));
  if (!zoneOk || !l.wall.every((w) => ok(w, wall))) return __i18n_k("league.layout.text.2bdb66a1", { a: lines[0], b: lines[1], c: alleys[0], d: alleys[1], e: centre[0], f: centre[1], g: wall[0], h: wall[1] });
  return null;
}
