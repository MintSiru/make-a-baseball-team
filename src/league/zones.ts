/* 2.0.25 (the user's request): hot and cold zones (핫·콜드 존) — the strike zone in nine, from the catcher's view, with
   a hitter's batting average in each, or what hitters bat against a pitcher there. The engine does not throw to
   zones, so the map is a scouting estimate: each hitter's own leanings (a high-ball or a low-ball hitter, one who
   wants it inside or out — his own, seeded by id, a power hitter more often a pull hitter who wants it in), the middle
   hotter than the corners, scaled so the nine average his season's batting average (his grades' estimate before 50
   plate appearances). A pitcher's map follows his pitches: a sinkerballer or a splitter's low zones are cold, a
   riding four-seamer's high ones, a slider's glove-side corner; scaled to what hitters bat against him.

   2.0.30 (the user's request): and the four corners outside the zone, as broadcasts show them — what a hitter bats
   when he chases there, well under his zone's: a good eye chases better pitches and less; the same leanings up or
   in. For a pitcher, the hitters who chase his pitches: the better his breaking ball, the colder; a sinker or a
   splitter colder low, a slider colder low on his glove side. */
import { hashUnit } from '../draftroom';
import type { Player } from '../model/types';
import { isPitcher } from './players';
import { fastballOf, pitchingLift, repertoire } from './pitches';
import type { LeagueState } from './state';

/** Rows top to bottom, columns from the catcher's view left (third-base side) to right. */
export type ZoneGrid = number[][];

export const ZONES = { leagueAvg: 0.265, middle: 0.035, corner: -0.025, lean: 0.03, minPa: 50, outside: 0.62, eye: 0.0018, breaking: 0.0015 };

/** 2.0.30: the four corners outside the zone, in the order upper left, upper right, lower left, lower right. */
export type OuterZones = [number, number, number, number];
const CORNERS: [number, number][] = [
  [0, 0],
  [0, 2],
  [2, 0],
  [2, 2],
];
const clampOut = (x: number) => Math.max(0.04, Math.min(0.4, x));
const meanOf = (grid: ZoneGrid) => grid.flat().reduce((a, b) => a + b, 0) / 9;

const normalOf = (key: string) => (hashUnit(`${key}|a`) + hashUnit(`${key}|b`) + hashUnit(`${key}|c`) - 1.5) * 2;
const shape = (row: number, col: number) => (row === 1 && col === 1 ? ZONES.middle : row !== 1 && col !== 1 ? ZONES.corner : 0);

/** Scales a grid so its plain average is `mean`. */
function scaled(grid: ZoneGrid, mean: number): ZoneGrid {
  const avg = grid.flat().reduce((a, b) => a + b, 0) / 9;
  return grid.map((r) => r.map((x) => Math.max(0.08, Math.min(0.5, x + mean - avg))));
}

/** A hitter's batting average in each zone. */
export function hitterZones(s: LeagueState, p: Player): ZoneGrid {
  const power = p.scouting.tools.power ?? 50;
  const contact = p.scouting.tools.contact ?? 50;
  const high = normalOf(`zone-high|${p.id}`) * ZONES.lean;
  // A pull hitter wants it inside; power hitters pull more.
  const inside = (normalOf(`zone-in|${p.id}`) + (power - 50) * 0.02) * ZONES.lean;
  // Inside is the third-base side for a right-handed batter (from the catcher's view), first-base side for a lefty.
  const insideCol = p.bats === '좌' ? 2 : 0;
  const grid = [0, 1, 2].map((row) => [0, 1, 2].map((col) => ZONES.leagueAvg + shape(row, col) + (row === 0 ? high : row === 2 ? -high : 0) + (col === insideCol ? inside : col === 2 - insideCol ? -inside : 0)));
  const b = s.lines[p.id]?.bat;
  const avg = b && b.ab >= ZONES.minPa ? b.h / b.ab : ZONES.leagueAvg + (contact - 50) * 0.003;
  return scaled(grid, avg);
}

/** 2.0.30: a hitter's average where he chases, outside the zone: the corner beside each of his zone's corners. */
export function hitterOuterZones(s: LeagueState, p: Player): OuterZones {
  const grid = hitterZones(s, p);
  const eye = p.scouting.tools.eye ?? 50;
  const base = meanOf(grid) * ZONES.outside + (eye - 50) * ZONES.eye;
  // His leanings carry outside too: the neighbouring corner of the zone, less the zone's own middle-ness.
  return CORNERS.map(([r, c]) => clampOut(base + (grid[r]![c]! - meanOf(grid)) * 0.8)) as OuterZones;
}

/** What hitters bat against a pitcher when they chase, outside the zone. */
export function pitcherOuterZones(s: LeagueState, p: Player): OuterZones {
  const grid = pitcherZones(s, p);
  const breaking = p.scouting.tools.breaking ?? 50;
  const base = meanOf(grid) * ZONES.outside - (breaking - 50) * ZONES.breaking;
  return CORNERS.map(([r, c]) => clampOut(base + (grid[r]![c]! - meanOf(grid)) * 0.8)) as OuterZones;
}

/** What hitters bat against a pitcher in each zone. */
export function pitcherZones(s: LeagueState, p: Player): ZoneGrid {
  const lift = pitchingLift(p); // −2 ground … 2 fly
  const stuff = p.scouting.tools.stuff ?? 50;
  const fb = fastballOf(p);
  // A riding four-seamer beats hitters up; a ground-ball pitcher lives low.
  const up = (fb === '4SFB' ? (stuff - 50) * 0.0015 : -0.01) + lift * 0.008;
  const rep = repertoire(p);
  const slider = rep.filter((x) => x.type === 'SL' || x.type === 'SW' || x.type === 'SLV' || x.type === 'CUT').reduce((a, x) => a + x.usage, 0);
  // A slider breaks to his glove side: the first-base side (the catcher's right) for a right-hander.
  const gloveCol = p.throws === '좌' ? 0 : 2;
  const grid = [0, 1, 2].map((row) => [0, 1, 2].map((col) => ZONES.leagueAvg + shape(row, col) - (row === 0 ? up : row === 2 ? -up : 0) - (row === 2 && col === gloveCol ? slider * 0.08 : 0)));
  const q = s.lines[p.id]?.pit;
  const baa = q && q.bf >= ZONES.minPa ? q.h / Math.max(1, q.bf - q.bb - q.hbp) : ZONES.leagueAvg - (stuff - 50) * 0.002;
  return scaled(grid, baa);
}

export const zonesOf = (s: LeagueState, p: Player) => (isPitcher(p) && !p.twoWay ? pitcherZones(s, p) : hitterZones(s, p));
