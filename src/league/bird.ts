/* 2.0.69 (the user's request): the Larry Bird rule (래리 버드 룰), a board rule in force from the start (the board or
   the general manager may drop it). A club that re-signs its own free agent — one who has played three seasons or
   more for it — may go over the salary cap to keep him, and his new deal counts half against the cap (the
   competitive balance tax and the free-agent market's room alike) as long as the rule stands. */
import type { Player, TeamId } from '../model/types';
import { boardValue } from './era';

export const BIRD = { seasons: 3, share: 0.5 };

/** The rule stands in `season` (on unless the board, or the general manager, took it away). */
export const birdRuleOn = (season?: number) => (boardValue('birdRule', season) ?? 1) === 1;

/** He has played `BIRD.seasons` seasons or more for the club (on its first team or its farm). */
export function hasBirdRights(p: Player, teamId: TeamId | null | undefined): boolean {
  if (!teamId) return false;
  return new Set(p.career.filter((c) => c.teamId === teamId).map((c) => c.year)).size >= BIRD.seasons;
}

/** His club re-signing him next season comes under the rule. */
export const birdResign = (p: Player, from: TeamId | null | undefined, teamId: TeamId, next: number) => teamId === from && birdRuleOn(next) && hasBirdRights(p, from);

/** The share of his pay in `season` that counts against the salary cap. */
export const birdShare = (p: Player, season: number) => (p.contract?.fa?.bird && birdRuleOn(season) ? BIRD.share : 1);
