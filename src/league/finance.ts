/* Club finances (V0.6, RULES.md §13). After every season each club gets a report: revenue from the gate,
   sponsors (and a naming-rights fee), the league's broadcast money shared equally, merchandise,
   concessions and the postseason pool; expenses for players, staff, the front office, game days, the
   ballpark, the farm system and marketing. The parent covers what is left, up to what it approved.

   Only the user's club lives with the result (its fund); AI clubs' parents always cover them, and their
   reports are there to compare. Money in 만 원. */
import type { TeamId } from '../model/types';
import { KBO_2026 } from '../rules/kbo2026';
import { boom, clubState, leaguePrice } from './fans';
import { payroll } from './offseason';
import { staffCost } from './staff';
import { firstTeamIds, type ClubReport, type LeagueState } from './state';
import { FANS, FINANCE as F } from './tuning';

/** The league's broadcast money for `year` (990억 for 2024–26; the next deal assumed 10% higher, then +3% a year). */
export function broadcastPool(year: number): number {
  const B = KBO_2026.broadcast;
  if (year <= 2026) return Math.round(B.annual2024 * (year >= 2024 ? 1 : 0.55 + (year - 2015) * 0.04));
  return Math.round(B.annual2024 * B.nextDeal * (1 + B.growth) ** (year - 2027));
}

/** Postseason pool: ticket money of every postseason game, less the league's costs. */
export function postseasonPool(s: LeagueState): number {
  const P = KBO_2026.postseasonShares;
  return Math.round((s.postseasonGate ?? 0) * (1 - P.costs));
}

/** Each postseason club's share of the pool (KBO 규정 제47조): the regular-season winner takes 20% first. */
export function postseasonShares(s: LeagueState, table: { teamId: TeamId; rank: number }[]): Record<TeamId, number> {
  const P = KBO_2026.postseasonShares;
  const pool = postseasonPool(s);
  const out: Record<TeamId, number> = {};
  if (!pool || !s.postseason.length) return out;
  const first = table.find((r) => r.rank === 1)?.teamId;
  if (first) out[first] = Math.round(pool * P.regularSeasonWinner);
  const rest = pool * (1 - P.regularSeasonWinner);
  const ks = s.postseason.find((x) => x.round === 'ks'),
    po = s.postseason.find((x) => x.round === 'po'),
    semi = s.postseason.find((x) => x.round === 'semipo'),
    wc = s.postseason.find((x) => x.round === 'wildcard');
  const loser = (x?: { high: TeamId; low: TeamId; winner: TeamId }) => (x ? (x.winner === x.high ? x.low : x.high) : null);
  const places: [TeamId | null, number][] = [
    [ks?.winner ?? null, P.champion],
    [loser(ks), P.runnerUp],
    [loser(po), P.third],
    [loser(semi), P.fourth],
    [loser(wc), P.fifth],
  ];
  for (const [id, share] of places) if (id) out[id] = (out[id] ?? 0) + Math.round(rest * share);
  return out;
}

/** Naming-rights fee a sponsor pays a club without a parent (키움증권: 110억 a year from 2024). */
export function namingFee(s: LeagueState, teamId: TeamId): number {
  const c = clubState(s, teamId);
  if (c.sponsor) return c.sponsor.annual;
  return F.naming.base;
}

/** The season's report for one club. `extra` adds cash already spent or received during the year (the user's ledger). */
export function clubReport(s: LeagueState, teamId: TeamId, year: number, shares: Record<TeamId, number>): ClubReport {
  const team = s.teams.find((t) => t.id === teamId)!;
  const c = clubState(s, teamId);
  const gate = s.gate?.[teamId];
  const fans = gate?.fans ?? 0;
  const inFirstTeam = firstTeamIds(s, year).includes(teamId);
  const clubs = firstTeamIds(s, year).length;
  const longTerm = team.stadium.ownership === 'longTermOperation';
  const heat = Math.max(0.5, 1 + c.interest * 0.5);
  const revenue = {
    gate: gate?.revenue ?? 0,
    broadcast: inFirstTeam ? Math.round(broadcastPool(year) / clubs) : 0,
    sponsors: Math.round((F.sponsor.base + (c.popularity / 1000) * F.sponsor.perThousandFans) * heat * (inFirstTeam ? 1 : F.futuresYear)),
    naming: team.parent.type === 'namingRights' ? namingFee(s, teamId) : 0,
    merchandise: Math.round(fans * F.merchPerFan * heat),
    concessions: Math.round(fans * (longTerm ? F.concessions.operator : F.concessions.tenant)),
    postseason: shares[teamId] ?? 0,
  };
  const homeGames = gate?.games ?? 0;
  const dome = team.stadium.size === 'dome';
  const expenses = {
    players: payroll(s, teamId, year) + (teamId === s.user?.teamId ? (s.user.deadMoney ?? []).filter((d) => d.season === year).reduce((a, d) => a + d.amount, 0) : 0),
    staff: staffCost(s, teamId),
    frontOffice: Math.round(F.frontOffice * (inFirstTeam ? 1 : F.futuresYear)),
    gameDays: homeGames * F.perHomeGame,
    ballpark: (longTerm ? F.ballpark.operator : F.ballpark.tenant) + (dome ? F.ballpark.dome : 0) + Math.round(team.stadium.capacity * F.ballpark.perSeat),
    farm: F.farm,
    marketing: c.marketing,
  };
  const income = Object.values(revenue).reduce((a, b) => a + b, 0);
  const spend = Object.values(expenses).reduce((a, b) => a + b, 0);
  return { year, fans, homeGames, price: c.price, revenue, expenses, operating: income - spend, support: 0 };
}

/** What the parent pays to cover a deficit. AI parents always cover it; the user's covers up to its approved support. */
export function parentSupport(s: LeagueState, teamId: TeamId, deficit: number, year = s.year): number {
  if (deficit <= 0) return 0;
  if (teamId !== s.user?.teamId) return deficit;
  // The founding years (before the first-team debut) are the owner's investment: all covered.
  if (year < s.user.firstTeamYear) return deficit;
  return Math.min(deficit, s.user.support ?? deficit);
}

/**
 * After the season: reports for every club, the user's fund settles (the year's operating result plus
 * what it already spent from the fund, covered by the parent up to its approved support).
 */
export function settleFinances(s: LeagueState, year: number, table: { teamId: TeamId; rank: number }[]) {
  const shares = postseasonShares(s, table);
  const u = s.user;
  for (const t of s.teams) {
    if (!s.rosters[t.id]) continue;
    const isUser = t.id === u?.teamId;
    // The user's club files reports from its first season of games (futures or first team).
    if (isUser && year < u!.firstTeamYear - 1 + (u!.settings.promotion === 'immediate' ? 1 : 0)) continue;
    if (!isUser && !firstTeamIds(s, year).includes(t.id)) continue;
    const report = clubReport(s, t.id, year, shares);
    if (isUser && u) {
      // Money spent or received from the fund since the last settlement (last winter's bonuses and
      // signings, this season's fees and levies, posting fees); building work is not covered.
      const cash = u.ledger
        .slice(u.settledAt ?? 0)
        .filter((l) => !l.settlement && !l.capital)
        .reduce((a, l) => a + l.amount, 0);
      report.cashFlows = cash;
      const deficit = -(report.operating + Math.min(0, cash));
      report.support = parentSupport(s, t.id, deficit, year);
      u.fund += report.operating + report.support;
      u.ledger.push({ year, label: `${year} 시즌 운영 결산 (수입 − 지출)`, amount: report.operating, settlement: true });
      if (report.support) u.ledger.push({ year, label: supportLabel(t.parent.type), amount: report.support, settlement: true });
      u.settledAt = u.ledger.length;
    } else report.support = parentSupport(s, t.id, -report.operating);
    const reports = clubState(s, t.id).reports;
    reports.push(report);
    if (reports.length > F.keepReports) reports.splice(0, reports.length - F.keepReports);
  }
  s.gate = {};
  s.postseasonGate = 0;
}

export const supportLabel = (type: string) =>
  type === 'citizen' ? '지자체 출자·시민주주 지원' : type === 'namingRights' ? '투자자 지원' : '모기업 지원 (광고·운영 지원금)';

/**
 * A running estimate for the whole season: the gate so far carried over the remaining home games (or,
 * before the first one, what the fan base and price suggest).
 */
export function projectedReport(s: LeagueState, teamId: TeamId): ClubReport {
  const home = s.schedule.filter((g) => g.home === teamId).length;
  const gate = s.gate?.[teamId];
  const team = s.teams.find((t) => t.id === teamId)!;
  const c = clubState(s, teamId);
  const perGame = gate?.games
    ? gate.fans / gate.games
    : Math.min(team.stadium.capacity, c.popularity * boom(s.year) * Math.max(0.45, 1 + FANS.moodWeight * c.interest) * c.price ** -FANS.elasticity);
  const fans = Math.round(perGame * home);
  const saved = s.gate;
  s.gate = { ...(saved ?? {}), [teamId]: { games: home, fans, sellouts: 0, revenue: Math.round(fans * leaguePrice(s.year) * c.price) } };
  try {
    return clubReport(s, teamId, s.year, {});
  } finally {
    s.gate = saved;
  }
}

export const ticketPriceWon = (s: LeagueState, teamId: TeamId, year = s.year) => Math.round(leaguePrice(year) * clubState(s, teamId).price * 10000);
