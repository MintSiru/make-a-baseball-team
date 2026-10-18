/* 2.0.3 (the 2.0 plan's fourth stage, the user's request): fielding in parts, the running and fielding data a tracking
   system reads, and the fielding runs that go into WAR.

   The one 수비 grade splits into 레인지 (how much ground he covers — moved by his speed, as the user asked: half of
   his 주력 above or below 50), 판단 (sure hands and reads: errors), 송구 (his arm: runners held, a catcher's pop time) and, for a catcher,
   리드 (calling a game). Each is his 수비 grade moved by an offset of his own (seeded by id), so the grade stays their
   rough average and nothing old needs moving (plan decision D); 리드 is a catcher's own.

   In a game every ball in play has a fielder whose play it is: chosen by where it went, his range and hands bear on
   whether it falls in or is fumbled, an outfielder's arm on how far the runners go. What he makes of his chances
   against a fielder of average range — outs above average (OAA) — together with his arm, a catcher's throwing out
   runners and his game-calling, are his fielding runs; WAR takes them in beside the position adjustment. */
import { hashUnit } from '../draftroom';
import type { FieldPos } from './engine/types';
import type { Player } from '../model/types';

export interface FieldingRatings {
  range: number;
  hands: number;
  arm: number;
  /** A catcher's game-calling; null for one who does not catch. */
  lead: number | null;
  /** 2.0.17: a catcher's framing (the pitches the umpire calls strikes); null for one who does not catch. */
  frame: number | null;
}

/** A season's (or a game's) fielding, summed. OAA, arm runs and caught-stealing above average are kept in
    thousandths, lead runs in hundred-thousandths (half a thousandth of a run a plate appearance per z of 리드). */
export interface FieldTotals {
  /** Balls in play that were his to field, the outs he made of them, his errors. */
  ch: number;
  po: number;
  e: number;
  oaa: number;
  /** Outfielders: runs his arm saved holding runners. */
  arm: number;
  /** Catchers: steal attempts against him, runners thrown out, thrown out above average, plate appearances caught
      and the runs his game-calling saved. */
  sba: number;
  cs: number;
  csaa: number;
  cpa: number;
  lead: number;
  /** 2.0.17: the runs his framing saved (hundred-thousandths), while the umpires call the pitches. */
  frame?: number;
}

export const emptyField = (): FieldTotals => ({ ch: 0, po: 0, e: 0, oaa: 0, arm: 0, sba: 0, cs: 0, csaa: 0, cpa: 0, lead: 0, frame: 0 });

export function addField(into: FieldTotals, f: Partial<FieldTotals>) {
  for (const k of new Set([...Object.keys(into), ...Object.keys(f)]) as Set<keyof FieldTotals>) into[k] = (into[k] ?? 0) + (f[k] ?? 0);
  return into;
}

const clamp = (x: number) => Math.max(20, Math.min(80, Math.round(x)));
/** A rough normal draw, the same every time for the same key. */
const normalOf = (key: string) => (hashUnit(`${key}|a`) + hashUnit(`${key}|b`) + hashUnit(`${key}|c`) - 1.5) * 2;

/** His fielding in parts from a 수비 grade and a 주력 grade (hidden or scouted: the same offsets either way). */
export function fieldingFrom(id: string, defense: number, speed: number, catcher: boolean): FieldingRatings {
  return {
    range: clamp(defense + 0.5 * (speed - 50) + 5 * normalOf(`range|${id}`)),
    hands: clamp(defense + 6 * normalOf(`hands|${id}`)),
    arm: clamp(defense + 8 * normalOf(`arm|${id}`)),
    lead: catcher ? clamp(44 + 0.3 * (defense - 50) + 9 * normalOf(`lead|${id}`)) : null,
    frame: catcher ? clamp(45 + 0.35 * (defense - 50) + 10 * normalOf(`frame|${id}`)) : null,
  };
}

const catches = (p: Pick<Player, 'position' | 'alt'>) => p.position === 'C' || (p.alt ?? []).includes('C');

/** The true parts (the engine's). */
export function fieldingOf(p: Pick<Player, 'id' | 'hidden' | 'position' | 'alt'>): FieldingRatings {
  const h = p.hidden.current as unknown as Record<string, number>;
  return fieldingFrom(p.id, h.defense ?? 30, h.speed ?? 30, catches(p));
}

/** What the scouts see (the screens'). */
export function scoutedFielding(p: Pick<Player, 'id' | 'scouting' | 'position' | 'alt'>): FieldingRatings {
  const t = p.scouting.tools as unknown as Record<string, number>;
  return fieldingFrom(p.id, t.defense ?? 30, t.speed ?? 30, catches(p));
}

/** Sprint speed (m/s, his fastest second on a competitive run): 6.9 at 20 of 주력 to 9.3 at 80 (Statcast's 27 ft/s
    average about 8.2). */
export const sprintSpeed = (p: Pick<Player, 'id' | 'hidden'>) => Math.round((6.9 + (((p.hidden.current as unknown as Record<string, number>).speed ?? 40) - 20) * 0.04 + 0.08 * normalOf(`sprint|${p.id}`)) * 100) / 100;

/** A catcher's pop time (s, mitt to the second baseman's glove on a steal): 2.15 at an arm of 20 to 1.85 at 80. */
export const popTime = (p: Pick<Player, 'id' | 'hidden' | 'position' | 'alt'>) => Math.round((2.15 - (fieldingOf(p).arm - 20) * 0.005 + 0.02 * normalOf(`pop|${p.id}`)) * 100) / 100;

/** Runs a fielding line is worth: OAA at 0.8 a play, the arm and catching runs as kept. */
export function fieldingRuns(f: FieldTotals | undefined): number {
  if (!f) return 0;
  return (f.oaa * 0.8 + f.arm + f.csaa * 0.6 + f.lead / 100 + (f.frame ?? 0) / 100) / 1000;
}

/** Whose ball it is: the share of balls in play each fielder takes, infield and outfield, by a right-handed hitter's
    pull (a left-handed hitter's mirrored). */
const INFIELD: [FieldPos, number][] = [
  ['3B', 0.27],
  ['SS', 0.33],
  ['2B', 0.25],
  ['1B', 0.15],
];
const OUTFIELD: [FieldPos, number][] = [
  ['LF', 0.38],
  ['CF', 0.36],
  ['RF', 0.26],
];

/** The fielder whose ball it is: on the ground (an infielder) with the share `ground`, else in the air; his pull side
    the more as he pulls (`pull` −2 … 2, negative pulling), `lefty` mirrors. */
export function fielderFor(r: () => number, ground: number, pull: number, lefty: boolean): FieldPos {
  const set = r() < ground ? INFIELD : OUTFIELD;
  // The first of each list is a right-handed hitter's pull side: a left-handed hitter's shares the other way round,
  // and more to the pull side the more he pulls.
  const tilt = -pull * 0.12;
  const n = set.length;
  const share = (i: number) => set[lefty ? n - 1 - i : i]![1];
  const w = set.map((_, i) => share(i) * (1 + tilt * (1 - (2 * i) / (n - 1)) * (lefty ? -1 : 1)));
  const total = w.reduce((a, b) => a + b, 0);
  let u = r() * total;
  for (let i = 0; i < n; i++) if ((u -= w[i]!) < 0) return set[i]![0];
  return set[n - 1]![0];
}

/** The direction (degrees, left field negative) a fielder's ball goes, for its flight. */
export const FIELDER_DIR: Partial<Record<FieldPos, number>> = { '3B': -32, SS: -12, '2B': 12, '1B': 32, LF: -28, CF: 0, RF: 28 };
