/* 2.0.30 (the user's request): a plate appearance's situation, for records by situation beside the platoon and
   득점권 splits — the leverage (high, medium, low), the score margin (tied, one run … five or more) and the runners
   on (none, first … bases loaded). Read when the plate appearance starts; the engine's draws do not see it.

   The leverage index is the game's own estimate of how much the plate appearance can swing the game, scaled so
   an average one is about 1: the runners and outs (more runners, more at stake), the inning (later counts more) and
   the margin (closer counts more, more so late; a trailing side's runners bring the tying run nearer). The bands
   follow Tom Tango's: low under 0.85, high over 2.0. */
import type { Split } from './types';

/** A Split's counts in the order the situation arrays keep them. */
export const SPLIT_KEYS = ['pa', 'ab', 'h', 'tb', 'hr', 'bb', 'hbp', 'k', 'sf'] as const satisfies readonly (keyof Split)[];

export const SITUATIONS = {
  leverage: ['liH', 'liM', 'liL'],
  margin: ['d0', 'd1', 'd2', 'd3', 'd4', 'd5'],
  bases: ['b0', 'b1', 'b2', 'b3', 'b12', 'b13', 'b23', 'b123'],
} as const;

export const LEVERAGE = {
  low: 0.85,
  high: 2,
  /** Scales the product below so the league's average plate appearance comes out near 1. */
  scale: 1.1,
};

/** By runners (first = 1, second = 2, third = 4) and outs. */
const STATE: Record<number, [number, number, number]> = {
  0: [0.8, 0.75, 0.65],
  1: [1.2, 1.15, 1.0],
  2: [1.1, 1.3, 1.3],
  4: [1.0, 1.3, 1.3],
  3: [1.6, 1.7, 1.5],
  5: [1.4, 1.6, 1.4],
  6: [1.3, 1.7, 1.6],
  7: [1.9, 2.2, 2.1],
};
const BASE_KEY: Record<number, string> = { 0: 'b0', 1: 'b1', 2: 'b2', 4: 'b3', 3: 'b12', 5: 'b13', 6: 'b23', 7: 'b123' };

/** `lead`: the batting side's runs minus the fielding side's. */
export function leverageIndex(inning: number, outs: number, bases: readonly boolean[], lead: number): number {
  const mask = (bases[0] ? 1 : 0) + (bases[1] ? 2 : 0) + (bases[2] ? 4 : 0);
  const runners = (bases[0] ? 1 : 0) + (bases[1] ? 1 : 0) + (bases[2] ? 1 : 0);
  const late = Math.min(inning, 9) - 1;
  const at = Math.min(2.0, 0.75 + 0.14 * late);
  const gap = lead < 0 ? Math.max(0, -lead - 0.5 * runners) : lead;
  const width = Math.max(1.5, 5 - 0.35 * late);
  return LEVERAGE.scale * STATE[mask]![Math.min(outs, 2)]! * at * 1.2 * Math.exp(-gap / width);
}

/** The keys a plate appearance is recorded under: its leverage band, its margin, its runners. */
export function situationKeys(inning: number, outs: number, bases: readonly boolean[], lead: number): string[] {
  const li = leverageIndex(inning, outs, bases, lead);
  const mask = (bases[0] ? 1 : 0) + (bases[1] ? 2 : 0) + (bases[2] ? 4 : 0);
  return [li > LEVERAGE.high ? 'liH' : li < LEVERAGE.low ? 'liL' : 'liM', `d${Math.min(5, Math.abs(lead))}`, BASE_KEY[mask]!];
}

/** Adds situation counts into another's. */
export function addSituations(into: Record<string, number[]>, from: Record<string, number[]>) {
  // After every game for every player in it: plain loops.
  for (const key in from) {
    const xs = from[key]!;
    const to = (into[key] ??= [0, 0, 0, 0, 0, 0, 0, 0, 0]);
    for (let i = 0; i < xs.length; i++) to[i]! += xs[i]!;
  }
}

/** A situation's counts as a Split. */
export const splitOf = (xs: readonly number[] | undefined): Split =>
  Object.fromEntries(SPLIT_KEYS.map((k, i) => [k, xs?.[i] ?? 0])) as unknown as Split;
