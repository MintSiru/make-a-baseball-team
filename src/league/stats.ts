/* Rate stats and WAR from counting totals. WAR is this game's estimate (not an official figure):
   batting runs from linear-weight wOBA against the league, a positional adjustment and replacement
   level; pitching from runs allowed per nine against a replacement pitcher. 10 runs = 1 win. */
import type { BatTotals, PitTotals } from '../model/types';
import type { FieldPos } from './engine/types';

export const avg = (b: BatTotals) => (b.ab ? b.h / b.ab : 0);
export const obp = (b: BatTotals) => {
  const d = b.ab + b.bb + b.hbp + b.sf;
  return d ? (b.h + b.bb + b.hbp) / d : 0;
};
export const slg = (b: BatTotals) => (b.ab ? (b.h + b.d + 2 * b.t + 3 * b.hr) / b.ab : 0);
export const ops = (b: BatTotals) => obp(b) + slg(b);
export const era = (p: PitTotals) => (p.outs ? (27 * p.er) / p.outs : 0);
export const whip = (p: PitTotals) => (p.outs ? (3 * (p.h + p.bb)) / p.outs : 0);
export const ip = (outs: number) => `${Math.floor(outs / 3)}${outs % 3 ? `.${outs % 3}` : ''}`;

const W = { bb: 0.69, hbp: 0.72, single: 0.89, double: 1.27, triple: 1.62, hr: 2.1 };
export function woba(b: BatTotals) {
  const d = b.ab + b.bb + b.sf + b.hbp;
  if (!d) return 0;
  const singles = b.h - b.d - b.t - b.hr;
  return (W.bb * b.bb + W.hbp * b.hbp + W.single * singles + W.double * b.d + W.triple * b.t + W.hr * b.hr) / d;
}

export interface LeagueContext {
  woba: number;
  ra9: number;
  wobaScale: number;
}

export function leagueContext(bat: BatTotals, pit: PitTotals): LeagueContext {
  const lw = woba(bat);
  const ra9 = pit.outs ? (27 * pit.r) / pit.outs : 4.7;
  return { woba: lw || 0.33, ra9, wobaScale: 1.2 };
}

const POS_RUNS: Record<FieldPos, number> = { C: 12, SS: 7, '2B': 3, CF: 2.5, '3B': 2, RF: -7, LF: -7, '1B': -12, DH: -17 };
const RUNS_PER_WIN = 10;

/** Hitter WAR for a season (share of 144 games sets the positional and replacement credit). */
export function batterWar(b: BatTotals, pos: FieldPos, lg: LeagueContext): number {
  if (!b.pa) return 0;
  const batting = ((woba(b) - lg.woba) / lg.wobaScale) * b.pa;
  const running = b.sb * 0.2 - b.cs * 0.4;
  const positional = (POS_RUNS[pos] * b.pa) / 600;
  const replacement = (20 * b.pa) / 600;
  return Math.round(((batting + running + positional + replacement) / RUNS_PER_WIN) * 10) / 10;
}

/** Pitcher WAR: runs saved against replacement (starters 1.1 R/9 worse than average, relievers 0.6). */
export function pitcherWar(p: PitTotals, lg: LeagueContext): number {
  if (!p.outs) return 0;
  const starter = p.gs >= p.g / 2;
  const replacement = lg.ra9 + (starter ? 1.1 : 0.6);
  const ra9 = (27 * p.r) / p.outs;
  return Math.round((((replacement - ra9) * p.outs) / 27 / RUNS_PER_WIN) * 10) / 10;
}
