/* Everyday positions. Draft Room scouts only C / IF / OF; the league needs the exact spot. Clubs place a
   hitter from his public future grades, so the choice uses no hidden ability. */
import type { Role, Tools } from '../draftroom';
import type { FieldPos } from '../league/engine/types';

export type Position = Exclude<FieldPos, 'DH'>;

const g = (t: Tools, k: keyof Tools) => t[k] ?? 40;

export function assignPosition(role: Role, future: Tools, tieBreak: number): Position | null {
  if (role === 'SP' || role === 'RP') return null;
  if (role === 'C') return 'C';
  // Scores on z-scores so an average player could go anywhere; the glove pulls toward the middle of
  // the diamond, the bat toward the corners. Offsets keep the four infield and three outfield spots
  // roughly equally filled across a draft class.
  const z = (k: keyof Tools) => (g(future, k) - 50) / 10;
  const def = z('defense'),
    spd = z('speed'),
    pow = z('power'),
    con = z('contact');
  const options: [Position, number][] =
    role === 'IF'
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
  // A per-player nudge spreads near-ties across positions.
  options.forEach((o, i) => (o[1] += (((tieBreak * (i + 3) * 7.13) % 1) - 0.5) * 1.2));
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
