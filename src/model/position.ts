/* Everyday positions. Draft Room scouts only C / IF / OF; the league needs the exact spot. Clubs place a
   hitter from his public future grades, so the choice uses no hidden ability. Since V0.11 a hitter also has
   up to three other positions he can handle (`altPositions`); anywhere else costs him more. */
import type { Role, Tools } from '../draftroom';
import type { FieldPos } from '../league/engine/types';

export type Position = Exclude<FieldPos, 'DH'>;

const g = (t: Tools, k: keyof Tools) => t[k] ?? 40;

/** How well a player of `role` suits each spot of his group, from public future grades (no tie-break). */
export function positionScores(role: Role, future: Tools): [Position, number][] {
  // Scores on z-scores so an average player could go anywhere; the glove pulls toward the middle of
  // the diamond, the bat toward the corners.
  const z = (k: keyof Tools) => (g(future, k) - 50) / 10;
  const def = z('defense'),
    spd = z('speed'),
    pow = z('power'),
    con = z('contact');
  return role === 'IF'
    ? [
        ['SS', def + 0.4 * spd],
        ['2B', 0.6 * def + 0.3 * spd + 0.3 * con + 0.1],
        ['3B', 0.3 * def + 0.6 * pow + 0.3],
        ['1B', 0.6 * pow + 0.4 * con - 0.6 * def - 0.25],
      ]
    : [
        ['CF', 0.6 * spd + 0.6 * def],
        ['RF', 0.3 * def + 0.5 * pow + 0.35],
        ['LF', 0.5 * pow + 0.4 * con - 0.4 * def - 0.1],
      ];
}

export function assignPosition(role: Role, future: Tools, tieBreak: number): Position | null {
  if (role === 'SP' || role === 'RP') return null;
  if (role === 'C') return 'C';
  const options = positionScores(role, future);
  // A per-player nudge spreads near-ties across positions.
  options.forEach((o, i) => (o[1] += (((tieBreak * (i + 3) * 7.13) % 1) - 0.5) * 1.2));
  options.sort((a, b) => b[1] - a[1]);
  return options[0]![0];
}

/**
 * Spots for a whole class of amateurs (V0.12): each group (infield, outfield) is shared out in KBO-like numbers,
 * the hardest spot first to the players who suit it best (short to the best glove and legs, centre to the
 * fastest outfielders), the corners last. A player's own `assignPosition` read ignores the rest of the class
 * and sent far too many to centre field and the middle infield.
 */
export const POSITION_SHARES: Record<'IF' | 'OF', [Position, number][]> = {
  IF: [
    ['SS', 0.27],
    ['2B', 0.26],
    ['3B', 0.25],
    ['1B', 0.22],
  ],
  OF: [
    ['CF', 0.3],
    ['RF', 0.37],
    ['LF', 0.33],
  ],
};

export function balancePositions<P extends { role: Role; position: Position | null; scouting: { futureTools: Tools } }>(players: P[], set: (p: P, pos: Position) => void) {
  for (const role of ['IF', 'OF'] as const) {
    const group = players.filter((p) => p.role === role);
    const left = [...group];
    const shares = POSITION_SHARES[role];
    shares.forEach(([pos, share], i) => {
      const n = i === shares.length - 1 ? left.length : Math.round(group.length * share);
      const score = (p: P) => positionScores(role, p.scouting.futureTools).find(([x]) => x === pos)![1];
      left.sort((a, b) => score(b) - score(a));
      for (const p of left.splice(0, n)) set(p, pos);
    });
  }
}

/** Defense penalty (grade points) for playing `at` when his position is `home`. */
export function outOfPosition(home: Position | null, at: FieldPos): number {
  if (at === 'DH' || home === at) return 0;
  if (home === null) return 25;
  const infield = ['1B', '2B', '3B', 'SS'],
    outfield = ['LF', 'CF', 'RF'];
  if (at === 'C') return 25;
  if (home === 'C') return at === '1B' ? 4 : 14;
  if (infield.includes(home) && infield.includes(at)) {
    if (at === '1B') return 2;
    if (at === 'SS') return 7;
    if (at === '2B') return home === 'SS' ? 1 : 5;
    return home === 'SS' || home === '2B' ? 2 : 4; // 3B
  }
  if (outfield.includes(home) && outfield.includes(at)) return at === 'CF' ? 6 : home === 'CF' ? 0 : 2;
  if (infield.includes(home) && outfield.includes(at)) return at === 'CF' ? 9 : 4;
  return at === '1B' ? 4 : 12; // outfielder in the infield
}

/** Where a player at `home` may also be able to play, by how often (V0.11): the spots next to his on the diamond. */
const NEIGHBOURS: Record<Position, [Position, number][]> = {
  C: [
    ['1B', 3],
    ['3B', 1],
    ['LF', 0.5],
  ],
  '1B': [
    ['LF', 2],
    ['RF', 1.5],
    ['3B', 1.5],
  ],
  '2B': [
    ['SS', 2.5],
    ['3B', 2],
    ['1B', 1],
    ['LF', 0.5],
    ['CF', 0.5],
  ],
  SS: [
    ['2B', 3],
    ['3B', 2.5],
    ['1B', 0.5],
    ['CF', 0.5],
  ],
  '3B': [
    ['1B', 3],
    ['2B', 1],
    ['SS', 0.6],
    ['LF', 1],
    ['RF', 1],
  ],
  LF: [
    ['RF', 3],
    ['1B', 2],
    ['CF', 1],
  ],
  CF: [
    ['LF', 3],
    ['RF', 3],
  ],
  RF: [
    ['LF', 3],
    ['1B', 1.5],
    ['CF', 1],
    ['3B', 0.5],
  ],
};

/** How many other positions a hitter handles: most one or two, a true utility man (three) about one in nine. */
const ALT_COUNT: [number, number][] = [
  [0, 0.2],
  [1, 0.42],
  [2, 0.27],
  [3, 0.11],
];

/**
 * The other positions (up to three) a hitter at `home` can play without much loss (V0.11). Short and centre need
 * the glove or the legs, second base a decent glove; a catcher seldom has more than first base. `r` is the
 * player's own stream so the choice does not shift any other draw.
 */
export function altPositions(home: Position | null, tools: Tools, r: () => number, min = 0): Position[] {
  if (!home) return [];
  let x = r();
  const n = Math.max(min, home === 'C' ? (x < 0.6 ? 0 : 1) : (ALT_COUNT.find(([, w]) => (x -= w) < 0)?.[0] ?? 0));
  const def = g(tools, 'defense'),
    spd = g(tools, 'speed');
  const fit = (pos: Position) => (pos === 'SS' ? (def >= 50 ? 1 : 0.15) : pos === 'CF' ? (spd >= 50 ? 1 : 0.15) : pos === '2B' ? (def >= 45 ? 1 : 0.3) : 1);
  const pool = NEIGHBOURS[home].map(([pos, w]) => [pos, w * fit(pos)] as [Position, number]);
  const out: Position[] = [];
  while (out.length < n && pool.length) {
    let y = r() * pool.reduce((a, [, w]) => a + w, 0);
    const i = pool.findIndex(([, w]) => (y -= w) < 0);
    out.push(pool.splice(i < 0 ? pool.length - 1 : i, 1)[0]![0]);
  }
  return out;
}
