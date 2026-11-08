/* Not for sale (NFS).

   2.0.45 (the user's request): the general manager marks our players not for sale, and the AI clubs stop asking for
   them (offers.ts). 2.0.46 (the user's request: AI 구단도 NFS 지정): each AI club keeps its own — three players its plan
   cannot do without: a contender its three best now, a rebuilding club its three best young players (25 or under, by
   what they will be), the rest its two best and its best young player. Nobody trades for them, we or the other AI
   clubs (trade.ts); they come off the list when the club's plan or its players change.

   2.0.81 (the user's report: 원클럽맨 레전드가 트레이드 가능): beside the three, a club keeps its franchise icons — a
   player who has played every first-team season for it, `iconSeasons` or more, and is a retired-number candidate
   there (most of the way to its bar) or has an MVP or `iconGloves` golden gloves. */
import type { Player, PlayerId, TeamId } from '../model/types';
import { retireMerit } from './numbers';
import { ageIn, currentValue, futureValue, isForeign } from './players';
import { registeredIds, type LeagueState } from './state';
import { clubStrategy } from './strategy';

export const AI_NFS = { count: 3, youngAge: 25, iconSeasons: 8, iconMerit: 0.6, iconGloves: 2 };

/** 2.0.81: a franchise icon of the club: one-club man, long here, and a legend there (see above). */
export function franchiseIcon(s: LeagueState, p: Player, teamId: TeamId): boolean {
  const seasons = p.career.filter((c) => !c.level && ((c.bat?.g ?? 0) + (c.pit?.g ?? 0) > 0));
  if (seasons.length < AI_NFS.iconSeasons || seasons.some((c) => c.teamId !== teamId || c.parts?.some((x) => x.teamId !== teamId))) return false;
  const honours = p.honors ?? [];
  // (The season's MVP: not the all-star game's nor a series'.)
  const mvp = honours.some((h) => /^\d{4} MVP$/.test(h));
  const gloves = honours.filter((h) => h.includes('골든글러브')).length;
  return mvp || gloves >= AI_NFS.iconGloves || retireMerit(s, p, teamId).merit >= AI_NFS.iconMerit;
}

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
  // 2.0.81: and its franchise icons.
  const icons = ps.filter((p) => !kept.includes(p) && franchiseIcon(s, p, teamId));
  return [...kept, ...icons].map((p) => p.id);
}

/** A club's not-for-sale players: ours as marked, an AI club's by its plan. */
export const clubNotForSale = (s: LeagueState, teamId: TeamId): PlayerId[] => (teamId === s.user?.teamId ? notForSale(s) : aiNotForSale(s, teamId));
