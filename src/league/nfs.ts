/* Not for sale (NFS).

   2.0.45 (the user's request): the general manager marks our players not for sale, and the AI clubs stop asking for
   them (offers.ts). 2.0.46 (the user's request: AI 구단도 NFS 지정): each AI club keeps its own — three players its plan
   cannot do without: a contender its three best now, a rebuilding club its three best young players (25 or under, by
   what they will be), the rest its two best and its best young player. Nobody trades for them, we or the other AI
   clubs (trade.ts); they come off the list when the club's plan or its players change. */
import type { PlayerId, TeamId } from '../model/types';
import { ageIn, currentValue, futureValue, isForeign } from './players';
import { registeredIds, type LeagueState } from './state';
import { clubStrategy } from './strategy';

export const AI_NFS = { count: 3, youngAge: 25 };

/** Ours marked not for sale (2.0.45): only those still with us. */
export const notForSale = (s: LeagueState): PlayerId[] => (s.user?.notForSale ?? []).filter((id) => s.players[id]?.teamId === s.user!.teamId);
export const isNotForSale = (s: LeagueState, id: PlayerId) => notForSale(s).includes(id);

/** An AI club's not-for-sale players (2.0.46), by its plan. */
export function aiNotForSale(s: LeagueState, teamId: TeamId): PlayerId[] {
  if (teamId === s.user?.teamId || !s.rosters[teamId]) return [];
  const ps = registeredIds(s, teamId)
    .map((id) => s.players[id]!)
    .filter((p) => p && !isForeign(p) && p.contract?.kind !== 'development');
  const by = (f: (p: (typeof ps)[number]) => number) => (a: (typeof ps)[number], b: (typeof ps)[number]) => f(b) - f(a) || a.id.localeCompare(b.id);
  const now = [...ps].sort(by(currentValue));
  const young = ps.filter((p) => ageIn(p, s.year) <= AI_NFS.youngAge).sort(by(futureValue));
  const mode = clubStrategy(s, teamId).mode;
  const kept =
    mode === 'contend'
      ? now.slice(0, AI_NFS.count)
      : mode === 'rebuild'
        ? young.slice(0, AI_NFS.count)
        : [...now.slice(0, AI_NFS.count - 1), ...young.filter((p) => !now.slice(0, AI_NFS.count - 1).includes(p)).slice(0, 1)];
  return kept.map((p) => p.id);
}

/** A club's not-for-sale players: ours as marked, an AI club's by its plan. */
export const clubNotForSale = (s: LeagueState, teamId: TeamId): PlayerId[] => (teamId === s.user?.teamId ? notForSale(s) : aiNotForSale(s, teamId));
