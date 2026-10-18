/* 2.0.7 (the user's request, after Baseball Savant's Value, Movement Profile and Pitch Usage): run values.

   A pitcher's run value is the runs he kept off the board against an average pitcher over the same outs. It is split
   among his pitches by how much he throws each and how good each is (a pitch graded above his own average takes more
   of the credit, below it more of the blame; the parts add up to the whole), and the pitches are grouped as Savant
   groups them: fastballs (four-seam, two-seam, sinker, cutter, shuuto), breaking balls (slider, sweeper, slurve,
   curve) and offspeed (changeup, circle change, splitter, forkball, screwball, palmball, knuckleball).

   A hitter's: batting (runs above average from his wOBA), baserunning (steals and caught stealing at their run
   values) and fielding (2.0.3's fielding runs).

   His usage against left- and right-handed hitters leans as pitchers lean: more breaking balls to a hitter on his own
   side, more changeups and splitters to one on the other. All of it is read from what the season lines and his
   grades already hold; the engine does not change. */
import type { BatTotals, Player, PitTotals } from '../model/types';
import { fieldingRuns } from './fielding';
import { fastballOf, pitchGrades, type PitchType } from './pitches';
import type { LeagueContext } from './stats';
import { woba } from './stats';

export type PitchGroup = 'fastball' | 'breaking' | 'offspeed';

export const PITCH_GROUP: Record<PitchType | '4SFB', PitchGroup> = {
  '4SFB': 'fastball',
  '2SFB': 'fastball',
  SNK: 'fastball',
  CUT: 'fastball',
  SH: 'fastball',
  SL: 'breaking',
  SW: 'breaking',
  SLV: 'breaking',
  CB: 'breaking',
  CH: 'offspeed',
  CIR: 'offspeed',
  SPL: 'offspeed',
  FRK: 'offspeed',
  SCR: 'offspeed',
  PLM: 'offspeed',
  KN: 'offspeed',
};

/** Runs a grade point above his own average is worth, per hundred batters faced and per share of his pitches. */
const PER_GRADE = 0.15;

/** Runs he kept off the board against an average pitcher over his outs (positive: better). */
export const pitchingRunValue = (q: PitTotals, lg: LeagueContext) => (q.outs ? (lg.ra9 * q.outs) / 27 - q.r : 0);

export interface PitchValue {
  type: PitchType | '4SFB';
  group: PitchGroup;
  /** Share of his pitches (0–1) and the pitch's grade. */
  usage: number;
  grade: number;
  rv: number;
}

/** His pitches with their share of the run value (they add up to the whole). */
export function pitchValues(p: Player, q: PitTotals, lg: LeagueContext): PitchValue[] {
  const second = pitchGrades(p);
  const fbUsage = Math.max(0, 1 - second.reduce((a, x) => a + x.usage, 0));
  const fb = fastballOf(p);
  const rows = [{ type: fb as PitchType | '4SFB', grade: p.scouting.tools.stuff ?? 50, usage: fbUsage }, ...second.map((x) => ({ type: x.type as PitchType | '4SFB', grade: x.grade, usage: x.usage }))];
  const total = rows.reduce((a, x) => a + x.usage, 0) || 1;
  const mean = rows.reduce((a, x) => a + x.usage * x.grade, 0) / total;
  const whole = pitchingRunValue(q, lg);
  return rows.map((x) => ({ ...x, group: PITCH_GROUP[x.type], rv: (whole * x.usage) / total + (PER_GRADE * (x.grade - mean) * x.usage * q.bf) / 100 }));
}

/** The run value of each group of pitches (fastball, breaking, offspeed). */
export function groupValues(rows: PitchValue[]): Record<PitchGroup, number | null> {
  const out: Record<PitchGroup, number | null> = { fastball: null, breaking: null, offspeed: null };
  for (const x of rows) out[x.group] = (out[x.group] ?? 0) + x.rv;
  return out;
}

/** How he leans his mix by the hitter's side: more breaking balls to his own side, more offspeed to the other. */
const SIDE = { same: { breaking: 1.3, offspeed: 0.55 }, opposite: { breaking: 0.75, offspeed: 1.4 } };

/** His usage (percent) against left- and right-handed hitters. */
export function usageBySide(p: Player, rows: Pick<PitchValue, 'type' | 'group' | 'usage'>[]): { vsL: Record<string, number>; vsR: Record<string, number> } {
  const lefty = p.throws === '좌';
  const lean = (side: 'same' | 'opposite') => {
    const w = rows.map((x) => x.usage * (x.group === 'fastball' ? 1 : SIDE[side][x.group]));
    const total = w.reduce((a, b) => a + b, 0) || 1;
    return Object.fromEntries(rows.map((x, i) => [x.type, Math.round((w[i]! / total) * 1000) / 10]));
  };
  return lefty ? { vsL: lean('same'), vsR: lean('opposite') } : { vsL: lean('opposite'), vsR: lean('same') };
}

/** A hitter's run values: batting, baserunning, fielding and the sum. */
export function batterValues(b: BatTotals, lg: LeagueContext) {
  const batting = b.pa ? ((woba(b) - lg.woba) / lg.wobaScale) * b.pa : 0;
  const running = 0.2 * b.sb - 0.41 * b.cs;
  const fielding = fieldingRuns(b.fld);
  return { batting, running, fielding, total: batting + running + fielding };
}
