/* Positions a player can handle (V0.7, reworked in V0.11). Every hitter has one main position and up to three
   others he handles (`alt`): there he gives up half the usual gap (model/position.ts outOfPosition). Anywhere
   else costs the full gap and more, until 30 first-team games there make him a real option; a season of 40
   games at a new spot adds it to his list. The grade shown for each position is his public fielding grade
   less that cost, with range for the middle of the field. */
import type { FieldPos } from './engine/types';
import type { Player } from '../model/types';
import { POSITION_FIT } from './tuning';
import { outOfPosition, type Position } from '../model/position';
import type { LeagueState } from './state';

export const POSITIONS: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

export const POSITION_SHORT: Record<FieldPos, string> = { C: '포수', '1B': '1루', '2B': '2루', '3B': '3루', SS: '유격', LF: '좌익', CF: '중견', RF: '우익', DH: '지명' };

const EXPERIENCED = POSITION_FIT.experienced;

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
