/* Positions a player can handle (V0.7). Every hitter has one main position; he can also play the others
   at a cost (model/position.ts outOfPosition). Experience cuts the cost in half: 30 first-team games
   at a position (this season and before) make him a real option there. The grade shown for each
   position is his public fielding grade less that cost, with range for the middle of the field. */
import type { FieldPos } from './engine/types';
import type { Player } from '../model/types';
import { outOfPosition, type Position } from '../model/position';
import type { LeagueState } from './state';

export const POSITIONS: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

export const POSITION_SHORT: Record<FieldPos, string> = { C: '포수', '1B': '1루', '2B': '2루', '3B': '3루', SS: '유격', LF: '좌익', CF: '중견', RF: '우익', DH: '지명' };

const EXPERIENCED = 30;

/** First-team games at each position: career plus this season. */
export function positionGames(s: LeagueState | null, p: Player): Partial<Record<FieldPos, number>> {
  const out: Partial<Record<FieldPos, number>> = {};
  const add = (g?: Partial<Record<FieldPos, number>>) => {
    for (const [k, v] of Object.entries(g ?? {})) out[k as FieldPos] = (out[k as FieldPos] ?? 0) + (v ?? 0);
  };
  for (const c of p.career) if (!c.level) add(c.bat?.posG);
  if (s) add(s.lines[p.id]?.bat?.posG);
  return out;
}

/** Grade points lost playing `at`: the position gap, halved once he has played there. */
export function fitPenalty(p: Player, at: FieldPos, games: Partial<Record<FieldPos, number>>): number {
  const base = outOfPosition(p.position, at);
  return (games[at] ?? 0) >= EXPERIENCED ? Math.round(base / 2) : base;
}

const round5 = (x: number) => Math.max(20, Math.min(80, Math.round(x / 5) * 5));

/** Public grade at each position (main position first, then by grade). */
export function positionGrades(s: LeagueState | null, p: Player): { pos: Position; grade: number; games: number; main: boolean }[] {
  if (!p.position) return [];
  const games = positionGames(s, p);
  const def = p.scouting.tools.defense ?? 40,
    spd = p.scouting.tools.speed ?? 40;
  const range = (pos: Position) => (pos === 'SS' || pos === 'CF' ? (spd - 50) * 0.2 : pos === '2B' ? (spd - 50) * 0.1 : 0);
  return POSITIONS.map((pos) => ({ pos, grade: round5(def - fitPenalty(p, pos, games) + range(pos)), games: games[pos] ?? 0, main: pos === p.position }))
    .filter((x) => x.main || x.games > 0 || (x.pos !== 'C' && x.grade >= 35))
    .sort((a, b) => Number(b.main) - Number(a.main) || b.grade - a.grade);
}

/** Other positions he handles well: played there, or within five points of his main grade. */
export function secondaryPositions(s: LeagueState | null, p: Player): Position[] {
  const all = positionGrades(s, p);
  const main = all.find((x) => x.main);
  if (!main) return [];
  return all.filter((x) => !x.main && (x.games >= EXPERIENCED || x.grade >= main.grade - 5)).map((x) => x.pos);
}
