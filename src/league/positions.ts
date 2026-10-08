import { k as __i18n_k } from '../i18n/index';
/* Positions a player can handle (V0.7, reworked in V0.11). Every hitter has one main position and up to three
   others he handles (`alt`): there he gives up half the usual gap (model/position.ts outOfPosition). Anywhere
   else costs the full gap and more, until 30 first-team games there make him a real option; a season of 40
   games at a new spot adds it to his list. The grade shown for each position is his public fielding grade
   less that cost, with range for the middle of the field. */
import type { FieldPos } from './engine/types';
import type { Player } from '../model/types';
import { POSITION_FIT } from './tuning';
import { outOfPosition, positionScores, type Position } from '../model/position';
import type { LeagueState } from './state';

export const POSITIONS: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

export const POSITION_SHORT: Record<FieldPos, string> = { C: __i18n_k("league.positions.pOSITION_SHORT.c.5f31470d"), '1B': __i18n_k("league.positions.pOSITION_SHORT.46c6f9a9"), '2B': __i18n_k("league.positions.pOSITION_SHORT.8011eb7c"), '3B': __i18n_k("league.positions.pOSITION_SHORT.3b17d1b9"), SS: __i18n_k("league.positions.pOSITION_SHORT.sS.685e1674"), LF: __i18n_k("league.positions.pOSITION_SHORT.lF.cab5a283"), CF: __i18n_k("league.positions.pOSITION_SHORT.cF.545b7e1e"), RF: __i18n_k("league.positions.pOSITION_SHORT.rF.e3d9e0b4"), DH: __i18n_k("league.positions.pOSITION_SHORT.dH.68a26d9d") };

const EXPERIENCED = POSITION_FIT.experienced;

/** First-team games at each position: career plus this season. */
export function positionGames(s: LeagueState | null, p: Player): Partial<Record<FieldPos, number>> {
  // Read for every lineup of every game (V0.14: kept free of throwaway arrays).
  const out: Partial<Record<FieldPos, number>> = {};
  const add = (g?: Partial<Record<FieldPos, number>>) => {
    if (!g) return;
    for (const k in g) out[k as FieldPos] = (out[k as FieldPos] ?? 0) + (g[k as FieldPos] ?? 0);
  };
  for (const c of p.career) if (!c.level) add(c.bat?.posG);
  if (s) add(s.lines[p.id]?.bat?.posG);
  return out;
}

/** Whether `at` is one of his listed other positions. */
export const listed = (p: Pick<Player, 'alt'>, at: FieldPos) => (p.alt ?? []).includes(at as Position);

/** Grade points lost playing `at`: half the position gap at a listed position or once he has played there,
    the gap and `POSITION_FIT.unlisted` more anywhere else. */
export function fitPenalty(p: Player, at: FieldPos, games: Partial<Record<FieldPos, number>>): number {
  const base = outOfPosition(p.position, at);
  if (!base) return 0;
  return listed(p, at) || (games[at] ?? 0) >= EXPERIENCED ? Math.round(base / 2) : base + POSITION_FIT.unlisted;
}

const round5 = (x: number) => Math.max(20, Math.min(80, Math.round(x / 5) * 5));

/** Public grade at each position (main position first, then by grade). */
export function positionGrades(s: LeagueState | null, p: Player): { pos: Position; grade: number; games: number; main: boolean; listed: boolean }[] {
  if (!p.position) return [];
  const games = positionGames(s, p);
  const def = p.scouting.tools.defense ?? 40,
    spd = p.scouting.tools.speed ?? 40;
  const range = (pos: Position) => (pos === 'SS' || pos === 'CF' ? (spd - 50) * 0.2 : pos === '2B' ? (spd - 50) * 0.1 : 0);
  return POSITIONS.map((pos) => ({ pos, grade: round5(def - fitPenalty(p, pos, games) + range(pos)), games: games[pos] ?? 0, main: pos === p.position, listed: listed(p, pos) }))
    .filter((x) => x.main || x.listed || x.games >= POSITION_FIT.shown)
    .sort((a, b) => Number(b.main) - Number(a.main) || Number(b.listed) - Number(a.listed) || b.grade - a.grade);
}

/** His other positions: the listed ones, and any he has 30 first-team games at (best grade first). */
export function secondaryPositions(s: LeagueState | null, p: Player): Position[] {
  if (!p.position) return [];
  const games = positionGames(s, p);
  return POSITIONS.filter((pos) => pos !== p.position && (listed(p, pos) || (games[pos] ?? 0) >= EXPERIENCED)).sort((a, b) => fitPenalty(p, a, games) - fitPenalty(p, b, games));
}

/** A season of regular play at a new position adds it to his list (V0.11, up to three; called each winter). */
export function learnPositions(p: Player, season: Partial<Record<FieldPos, number>> | undefined) {
  if (!p.position || !season) return;
  for (const [pos, n] of Object.entries(season) as [FieldPos, number][]) {
    if (pos === 'DH' || pos === p.position || listed(p, pos) || n < POSITION_FIT.learn) continue;
    if ((p.alt ?? []).length >= POSITION_FIT.most) break;
    (p.alt ??= []).push(pos);
  }
}

/** The positions a player from an older save is given (V0.11): where he has played most, then his draw. */
export function migrateAlt(p: Player, drawn: Position[]) {
  if (p.alt || !p.position) return;
  const games = positionGames(null, p);
  const played = POSITIONS.filter((pos) => pos !== p.position && (games[pos] ?? 0) >= EXPERIENCED).sort((a, b) => (games[b] ?? 0) - (games[a] ?? 0));
  p.alt = [...new Set([...played, ...drawn])].slice(0, POSITION_FIT.most);
}

/**
 * Where a hitter who no longer fits his position moves (V0.12), down the defensive spectrum: short to second or
 * third, second and third to first, centre to a corner, right to left, left to first. Read from his public
 * grades now, so the move follows the glove and legs he has lost with the years. Catchers stay. Null: he fits.
 */
export function positionMove(p: Pick<Player, 'position' | 'scouting'>): Position | null {
  const M = POSITION_FIT.move;
  const def = p.scouting.tools.defense ?? 40,
    spd = p.scouting.tools.speed ?? 40,
    pow = p.scouting.tools.power ?? 40,
    con = p.scouting.tools.contact ?? 40;
  const fits = (pos: Position) =>
    pos === 'SS' ? def >= M.ss.defense && spd >= M.ss.speed : pos === 'CF' ? def >= M.cf.defense && spd >= M.cf.speed : pos === '2B' || pos === '3B' || pos === 'RF' ? def >= M.corner : pos === 'LF' ? def >= M.left : true;
  const at = p.position;
  if (!at || at === 'C' || at === '1B' || fits(at)) return null;
  const down: Record<Exclude<Position, 'C' | '1B'>, Position[]> = {
    SS: pow > con ? ['3B', '2B', '1B'] : ['2B', '3B', '1B'],
    '2B': ['1B'],
    '3B': ['1B'],
    CF: ['RF', 'LF', '1B'],
    RF: ['LF', '1B'],
    LF: ['1B'],
  };
  return down[at].find(fits) ?? '1B';
}

/** Moves him to `to`; his old spot stays one he can play (V0.11, up to three). */
export function changePosition(p: Player, to: Position) {
  p.alt = [...new Set([...(p.position ? [p.position] : []), ...(p.alt ?? [])])].filter((x) => x !== to).slice(0, POSITION_FIT.most);
  p.position = to;
}

/** How well his public grades suit each spot (both groups: an infielder can go to an outfield corner). */
const suits = (p: Pick<Player, 'scouting'>) => new Map([...positionScores('IF', p.scouting.tools), ...positionScores('OF', p.scouting.tools)]);
/** Moves a club makes to fill a short spot: anyone can go to a corner or first; the middle needs the right group. */
const CAN_GO: Record<Exclude<Position, 'C'>, Position[]> = {
  SS: ['2B', '3B', '1B'],
  '2B': ['SS', '3B', '1B', 'LF'],
  '3B': ['1B', '2B', 'LF', 'RF'],
  '1B': ['3B', 'LF', 'RF'],
  CF: ['LF', 'RF'],
  RF: ['LF', 'CF', '1B'],
  LF: ['RF', '1B'],
};

/**
 * A club's depth chart each winter (V0.12): an AI club spreads its hitters (catchers aside) over the field in
 * KBO-like numbers. While a spot has more players than it needs and another fewer, the player who suits the
 * crowded spot least (against the short one) moves over; a few moves a winter at most. Draft rooms prize gloves
 * and legs, so without this the league fills up with shortstops and centre fielders and runs out of first basemen.
 */
export function balanceDepth(players: Player[]) {
  const D = POSITION_FIT.depth;
  const field = players.filter((p) => p.position && p.position !== 'C');
  const want = (pos: Position) => Math.max(1, Math.round(field.length * D.shares[pos as keyof typeof D.shares]));
  for (let moves = 0; moves < D.moves; moves++) {
    const count = (pos: Position) => field.filter((p) => p.position === pos).length;
    const spots = Object.keys(D.shares) as Exclude<Position, 'C'>[];
    const short = spots.filter((pos) => count(pos) < want(pos)).sort((a, b) => count(a) / want(a) - count(b) / want(b));
    const over = spots.filter((pos) => count(pos) > want(pos));
    let best: { p: Player; to: Position; cost: number } | null = null;
    for (const to of short)
      for (const from of over) {
        if (!CAN_GO[from].includes(to)) continue;
        for (const p of field.filter((x) => x.position === from)) {
          const fit = suits(p);
          const cost = fit.get(from)! - fit.get(to)!;
          if (!best || cost < best.cost) best = { p, to, cost };
        }
      }
    if (!best) return;
    changePosition(best.p, best.to);
  }
}
