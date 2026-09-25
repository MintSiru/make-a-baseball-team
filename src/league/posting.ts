/* The posting system (포스팅, RULES.md §4): after seven seasons a player may ask his club to post him
   to the major leagues. A club posts at most one player a winter. If a major league club signs him in
   the 30-day window, his KBO club receives a release fee from the guaranteed value (20% of the first
   $25M, 17.5% of the next $25M, 15% above $50M); if nobody signs him, he returns to his club.

   Interest and money in the game come from the public scouting grade and age (game assumption,
   anchored on recent deals: two-year deals for fringe players, four to six years for stars). */
import { hashUnit, rng } from '../draftroom';
import type { Player, PlayerId, TeamId } from '../model/types';
import { KBO_2026 } from '../rules/kbo2026';
import { MANWON_PER_USD } from './contracts';
import { usd } from './foreign';
import { eulreul, iga } from './josa';
import { leaveLeague } from './offseason';
import { ageIn, isForeign } from './players';
import { orgPlayers, type LeagueState } from './state';
import { logTransaction } from './trade';
import { milestone, unlock } from './milestones';
import { POSTING } from './tuning';

const P = KBO_2026.posting;

export interface PostingResult {
  id: PlayerId;
  teamId: TeamId;
  /** Signed: guaranteed years and dollars, and the fee his club receives (dollars). */
  deal: { years: number; total: number; fee: number } | null;
}

/** Release fee for a guaranteed major league contract (US dollars). */
export function postingFee(total: number): number {
  let fee = 0,
    rest = total,
    from = 0;
  for (const tier of P.feeTiers) {
    const span = tier.upTo === null ? rest : Math.min(rest, tier.upTo - from);
    fee += span * tier.rate;
    rest -= span;
    from = tier.upTo ?? from;
    if (rest <= 0) break;
  }
  return Math.round(fee);
}

/** Players who could be posted this winter and want to go: seven seasons, good enough, young enough. */
export function postingCandidates(s: LeagueState, teamId: TeamId, next: number): Player[] {
  return orgPlayers(s, teamId)
    .filter(
      (p) =>
        !isForeign(p) &&
        p.status === 'active' &&
        p.contract?.kind !== 'development' &&
        p.service.creditedSeasons >= P.seasons &&
        p.service.lastFreeAgencyAt === undefined &&
        p.service.postedIn === undefined &&
        !(p.contract?.kind === 'freeAgent' || p.contract?.kind === 'multiYear') &&
        p.scouting.current >= POSTING.minGrade &&
        ageIn(p, next) <= POSTING.maxAge &&
        // Not everyone dreams of the majors.
        hashUnit(`${p.id}-mlb-dream`) < POSTING.wants,
    )
    .sort((a, b) => b.scouting.current - a.scouting.current);
}

/** What the major leagues make of him: a guaranteed deal, or no taker. */
export function mlbMarket(p: Player, next: number, r: () => number): { years: number; total: number } | null {
  const g = p.scouting.current;
  const age = ageIn(p, next);
  const chance = Math.max(0.05, Math.min(0.95, POSTING.baseChance + (g - POSTING.minGrade) * POSTING.chancePerGrade - Math.max(0, age - 28) * POSTING.agePenalty));
  if (r() > chance) return null;
  const aav = POSTING.aavAt60 * Math.exp((g - 60) * POSTING.aavGrowth) * (age >= 30 ? 0.8 : 1) * (0.85 + r() * 0.3);
  const years = Math.max(1, (g >= 68 ? 6 : g >= 63 ? 4 : 2) - (age >= 30 ? 1 : 0));
  return { years, total: Math.round((aav * years) / 250_000) * 250_000 };
}

/** Posts `id` for his club; he signs abroad or stays. The club receives the fee in 만 원. */
export function post(s: LeagueState, id: PlayerId, next: number): PostingResult {
  const p = s.players[id]!;
  const teamId = p.teamId!;
  const market = mlbMarket(p, next, rng(`${s.seed}|posting|${next}|${id}`));
  // One try: a player who comes back unsigned waits for free agency.
  p.service.postedIn = next - 1;
  const short = s.teams.find((t) => t.id === teamId)?.short ?? teamId;
  if (!market) {
    logTransaction(s, `포스팅: ${short} ${iga(p.name)} 메이저리그 계약에 실패해 잔류`);
    return { id, teamId, deal: null };
  }
  const fee = postingFee(market.total);
  logTransaction(s, `포스팅: ${short} ${p.name} 메이저리그 ${market.years}년 ${usd(market.total)} 계약 (이적료 ${usd(fee)})`);
  const u = s.user;
  if (u && teamId === u.teamId) {
    unlock(s, 'posting', next - 1, p.name);
    milestone(s, next - 1, `${p.name} 메이저리그 진출 (${market.years}년 ${usd(market.total)})`);
    const won = Math.round(fee * MANWON_PER_USD);
    u.fund += won;
    u.ledger.push({ year: next - 1, label: `포스팅 이적료 · ${p.name}`, amount: won });
  }
  leaveLeague(s, p, 'overseas');
  return { id, teamId, deal: { ...market, fee } };
}

/** AI clubs: each lets its most wanted candidate go, most of the time. */
export function runAiPosting(s: LeagueState, next: number) {
  const r = rng(`${s.seed}|posting-ai|${next}`);
  for (const t of s.teams) {
    if (!s.rosters[t.id] || t.id === s.user?.teamId) continue;
    const best = postingCandidates(s, t.id, next)[0];
    if (best && r() < POSTING.aiAllows) post(s, best.id, next);
  }
}

/** A line for the user's log about how the posting went. */
export function postingNote(s: LeagueState, res: PostingResult, name: string) {
  return res.deal
    ? `${name} 메이저리그 진출: ${res.deal.years}년 ${usd(res.deal.total)}, 이적료 ${usd(res.deal.fee)} 수령`
    : `${eulreul(name)} 포스팅했지만 계약한 메이저리그 구단이 없어 잔류합니다`;
}
