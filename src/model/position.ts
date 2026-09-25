/* Everyday positions. Draft Room scouts only C / IF / OF; the league needs the exact spot. Clubs place a
   hitter from his public future grades, so the choice uses no hidden ability. */
import type { Role, Tools } from '../draftroom';
import type { FieldPos } from '../league/engine/types';

export type Position = Exclude<FieldPos, 'DH'>;

const g = (t: Tools, k: keyof Tools) => t[k] ?? 40;

export function assignPosition(role: Role, future: Tools, tieBreak: number): Position | null {
  if (role === 'SP' || role === 'RP') return null;
  if (role === 'C') return 'C';
  const def = g(future, 'defense'),
    spd = g(future, 'speed'),
    pow = g(future, 'power'),
    con = g(future, 'contact');
  const options: [Position, number][] =
    role === 'IF'
      ? [
          ['SS', def + 0.35 * spd - 2],
          ['2B', 0.85 * def + 0.2 * spd + 0.15 * con - 4],
          ['3B', 0.7 * def + 0.35 * pow - 3],
          ['1B', 0.7 * pow + 0.35 * con - 0.25 * def + 6],
        ]
      : [
          ['CF', 0.6 * spd + 0.65 * def - 2],
          ['RF', 0.55 * def + 0.45 * pow + 0.1 * spd],
          ['LF', 0.6 * pow + 0.45 * con - 0.1 * def],
        ];
  // A small per-player nudge spreads near-ties across positions.
  options.forEach((o, i) => (o[1] += ((tieBreak * (i + 3)) % 1) * 3));
  options.sort((a, b) => b[1] - a[1]);
  return options[0]![0];
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
