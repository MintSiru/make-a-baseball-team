import { k as __i18n_k } from '../i18n/index';
/* Club finances (V0.6, RULES.md §13). After every season each club gets a report: revenue from the gate,
   sponsors (and a naming-rights fee), the league's broadcast money shared equally, merchandise,
   concessions and the postseason pool; expenses for players, staff, the front office, game days, the
   ballpark, the farm system and marketing. The parent covers what is left, up to what it approved.

   Only the user's club lives with the result (its fund); AI clubs' parents always cover them, and their
   reports are there to compare. Money in 만 원. */
import { playsHistory, ruleYear } from './era';
import type { Player, TeamId } from '../model/types';
import { salaryIn } from './contracts';
import { isForeign } from './players';
import { KBO_2026 } from '../rules/kbo2026';
import { boom, clubState, leaguePrice } from './fans';
import { payroll } from './offseason';
import { staffCost } from './staff';
import { firstTeamIds, orgPlayers, type ClubReport, type LeagueState, type SeriesResult } from './state';
import { twelveClubs } from './twelve';
import { DEMOTION, FANS, FINANCE as F, POSTSEASON_GATE } from './tuning';
import { concessionsShare, facilityUpkeep, premiumShare } from './facilities';
import { favouritesMerch } from './life';

/** The league's broadcast money for `year` (990억 for 2024–26; the next deal assumed 10% higher, then flat: V0.16). */
export function broadcastPool(year: number): number {
  const B = KBO_2026.broadcast;
  // 1.9.6: a league that plays history reads its own calendar, the rights small before 2015 (HISTORIC_BROADCAST).
  if (playsHistory() && year < 2015) return Math.round(B.annual2024 * historicBroadcast(year));
  year = playsHistory() ? year : ruleYear(year);
  if (year <= 2026) return Math.round(B.annual2024 * (year >= 2024 ? 1 : 0.55 + (year - 2015) * 0.04));
  return Math.round(B.annual2024 * B.nextDeal * (1 + B.growth) ** (year - 2027));
}

/** 1.9.6: the broadcast rights before 2015 as a share of 2024's 990억: a game estimate (no yearly figures found), from
    a few 억 in the 1980s through some 100억 around 2000 to 400억 or so with the new media by 2014 (RULES.md §9). */
const HISTORIC_BROADCAST: [number, number][] = [[1982, 0.02], [1990, 0.04], [1995, 0.06], [2000, 0.1], [2005, 0.13], [2010, 0.2], [2014, 0.42]];
function historicBroadcast(year: number): number {
  const pts = HISTORIC_BROADCAST;
  if (year <= pts[0]![0]) return pts[0]![1];
  const i = pts.findIndex(([y]) => y >= year);
  if (i < 0) return pts.at(-1)![1];
  const [y0, v0] = pts[i - 1]!,
    [y1, v1] = pts[i]!;
  return v0 + ((v1 - v0) * (year - y0)) / (y1 - y0);
}

/**
 * 1.8.4 (the 1.8 feedback): no prize shares by final position. Each postseason game's ticket money is split between
 * the home club, the visitors and the league, and the league's share pays the Korean Series champion a part of the
 * whole postseason's gate (POSTSEASON_GATE). With twelve clubs the NPB rule: the host keeps a game's whole gate
 * before the final, and the final is split as the Japan Series is (the players' pool is theirs, not the clubs').
 * A game played before 1.8.4 has no recorded gate: its money is the old flat price.
 */
export function postseasonTakes(s: LeagueState): Record<TeamId, number> {
  const out: Record<TeamId, number> = {};
  const add = (id: TeamId, x: number) => (out[id] = (out[id] ?? 0) + Math.round(x));
  const gateOf = (g: { att?: number; gate?: number }) => g.gate ?? Math.round((g.att ?? 0) * leaguePrice(s.year) * FANS.postseasonPrice);
  for (const x of s.postseason)
    x.games.forEach((g, i) => {
      const share = gameShares(s, x.round, i);
      add(g.home, gateOf(g) * share.home);
      add(g.away, gateOf(g) * share.away);
    });
  const ks = s.postseason.find((x) => x.round === 'ks');
  if (ks && !twelveClubs(s)) add(ks.winner, s.postseason.flatMap((x) => x.games).reduce((a, g) => a + gateOf(g), 0) * POSTSEASON_GATE.champion);
  return out;
}

/** The home club's and the visitors' shares of one postseason game's gate (game `i`, 0-based, of its series). */
export function gameShares(s: LeagueState, round: SeriesResult['round'], i: number): { home: number; away: number } {
  const G = POSTSEASON_GATE;
  if (!twelveClubs(s)) return { home: G.home, away: G.away };
  if (round !== 'ks') return { home: G.npb.host, away: 0 };
  const club = i < G.npb.earlyGames ? G.npb.early.club : G.npb.late.club;
  return { home: club, away: club };
}

/** One club's postseason in money: games at home and away and what it took from them (for the club's report). */
export function postseasonGateOf(s: LeagueState, teamId: TeamId) {
  const games = s.postseason.flatMap((x) => x.games).filter((g) => g.home === teamId || g.away === teamId);
  return { home: games.filter((g) => g.home === teamId).length, away: games.filter((g) => g.away === teamId).length, take: postseasonTakes(s)[teamId] ?? 0 };
}

/** Naming-rights fee a sponsor pays a club without a parent (키움증권: 110억 a year from 2024). */
export function namingFee(s: LeagueState, teamId: TeamId): number {
  const c = clubState(s, teamId);
  if (c.sponsor) return c.sponsor.annual;
  return F.naming.base;
}

/** An AI club's player money beyond the salaries and bonuses (V0.8): incentives earned this season, less the
    salary cut for players sent down (see demotionCut). The user's club settles both through its fund. */
function faCash(s: LeagueState, teamId: TeamId, year: number) {
  return orgPlayers(s, teamId).reduce((a, p) => a + (p.contract?.fa?.paid.find((x) => x.season === year)?.amount ?? 0) - demotionCut(s, p, year), 0);
}

/**
 * The KBO's cut for a player paid 3억 or more who is off the first-team roster for reasons other than injury
 * (규약, RULES.md §2): half of 1/300 of his salary for each such day of the regular season. Registered days
 * count the injured list and national-team duty, so the days he was not registered are the days he was sent
 * down. Domestic players only.
 */
export function demotionCut(s: LeagueState, p: Player, year: number) {
  const salary = salaryIn(p, year);
  if (salary < DEMOTION.from || isForeign(p) || p.status === 'military' || !s.schedule.length) return 0;
  const span = Math.round((Date.parse(s.schedule.at(-1)!.date) - Date.parse(s.schedule[0]!.date)) / 86400000) + 1;
  const days = p.career.filter((r) => r.year === year && !r.level).reduce((a, r) => a + r.days, 0);
  const down = Math.max(0, span - days);
  return down ? Math.round((salary / 300) * DEMOTION.share * down) : 0;
}

/** After the season: the user's club gets back the cut salary of players it sent down. */
export function applyDemotionCuts(s: LeagueState, year: number) {
  const u = s.user;
  if (!u) return;
  for (const p of orgPlayers(s, u.teamId)) {
    const cut = demotionCut(s, p, year);
    if (cut <= 0) continue;
    u.ledger.push({ year, label: __i18n_k("league.finance.applyDemotionCuts.label.7af3b205", { name: p.name }), amount: cut });
    u.fund += cut;
  }
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
    // 1.9.2, 통일 리그: sixteen clubs sell more games, so the deal grows with them (each club's share as with eleven).
    broadcast: inFirstTeam ? Math.round((broadcastPool(year) * (s.unified ? Math.max(1, clubs / 11) : 1)) / clubs) : 0,
    sponsors: Math.round((F.sponsor.base + (c.popularity / 1000) * F.sponsor.perThousandFans) * heat * (inFirstTeam ? 1 : F.futuresYear)),
    naming: team.parent.type === 'namingRights' ? namingFee(s, teamId) : 0,
    // The user's club (V0.10): its best-loved players sell shirts, and its shops sell more food.
    merchandise: Math.round(fans * F.merchPerFan * heat * (1 + favouritesMerch(s, teamId))),
    concessions: Math.round(fans * (longTerm ? F.concessions.operator : F.concessions.tenant) * (1 + concessionsShare(s, teamId))),
    postseason: shares[teamId] ?? 0,
  };
  const homeGames = gate?.games ?? 0;
  const dome = team.stadium.size === 'dome';
  const upkeep = facilityUpkeep(s, teamId);
  const expenses = {
    players:
      payroll(s, teamId, year) +
      (teamId === s.user?.teamId ? (s.user.deadMoney ?? []).filter((d) => d.season === year).reduce((a, d) => a + d.amount, 0) : faCash(s, teamId, year)),
    staff: staffCost(s, teamId),
    frontOffice: Math.round((F.frontOffice.base + (c.popularity / 1000) * F.frontOffice.perThousandFans) * (inFirstTeam ? 1 : F.futuresYear)),
    gameDays: homeGames * F.perHomeGame,
    ballpark: (longTerm ? F.ballpark.operator : F.ballpark.tenant) + (dome ? F.ballpark.dome : 0) + Math.round(team.stadium.capacity * F.ballpark.perSeat) + upkeep.ballpark,
    farm: F.farm + upkeep.training,
    marketing: c.marketing,
  };
  const income = Object.values(revenue).reduce((a, b) => a + b, 0);
  const spend = Object.values(expenses).reduce((a, b) => a + b, 0);
  return { year, fans, homeGames, price: c.price, revenue, expenses, operating: income - spend, sellouts: gate?.sellouts ?? 0, support: 0 };
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
export function settleFinances(s: LeagueState, year: number, _table?: { teamId: TeamId; rank: number }[]) {
  // 1.8.4: each club's take of the postseason games it played (the final table no longer decides prize shares).
  const shares = postseasonTakes(s);
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
      const budget = u.seasonSupport?.year === year ? u.seasonSupport : null;
      if (budget) {
        // V0.12: the owner paid its budget at opening; the club lives with the result (season tickets were
        // banked at opening too), and an empty fund is topped up at a cost in trust.
        const tickets = clubState(s, t.id).seasonTickets;
        u.fund += report.operating - (tickets?.year === year ? tickets.paid : 0);
        u.ledger.push({ year, label: __i18n_k("league.finance.settleFinances.label.4fc3fe70", { year: year, value: tickets?.year === year ? __i18n_k("league.finance.settleFinances.label.937e406a") : '' }), amount: report.operating - (tickets?.year === year ? tickets.paid : 0), settlement: true });
        report.support = budget.amount + emergencySupport(s, year);
      } else {
        const deficit = -(report.operating + Math.min(0, cash));
        report.support = parentSupport(s, t.id, deficit, year);
        u.fund += report.operating + report.support;
        u.ledger.push({ year, label: __i18n_k("league.finance.settleFinances.label.3a90ee4b", { year: year }), amount: report.operating, settlement: true });
        if (report.support) u.ledger.push({ year, label: supportLabel(t.parent.type), amount: report.support, settlement: true });
      }
      u.settledAt = u.ledger.length;
    } else report.support = parentSupport(s, t.id, -report.operating);
    const reports = clubState(s, t.id).reports;
    reports.push(report);
    if (reports.length > F.keepReports) reports.splice(0, reports.length - F.keepReports);
  }
  s.gate = {};
  s.postseasonGate = 0;
}

/** An empty fund after the season: the owner tops it up to zero and trusts the general manager less (V0.12). */
function emergencySupport(s: LeagueState, year: number): number {
  const u = s.user!;
  if (u.fund >= 0) return 0;
  const amount = -u.fund;
  u.fund = 0;
  const E = F.emergency;
  const drop = Math.min(E.most, E.base + Math.floor(amount / E.per));
  u.trust = Math.max(0, (u.trust ?? 60) - drop);
  u.ledger.push({ year, label: __i18n_k("league.finance.emergencySupport.label.e60fe3f4", { drop: drop }), amount, settlement: true });
  return amount;
}

/**
 * Opening day (V0.12, docs/FINANCE.md ①): the owner fixes the season's support from the expected result (less payroll
 * over the budget it set) and what the fund spent over the winter, within its limit, and pays it now. Season tickets
 * sold for the season come in too (③). Before the first first-team season the owner still covers everything after it.
 */
export function openBooks(s: LeagueState) {
  const u = s.user;
  if (!u || s.year < u.firstTeamYear || !firstTeamIds(s, s.year).includes(u.teamId)) return;
  // The owner budgets on an ordinary season; the season-ticket discount is the club's own bet.
  const operating = projectedReport(s, u.teamId).operating;
  sellSeasonTickets(s);
  const tickets = clubState(s, u.teamId).seasonTickets;
  const over = Math.max(0, payroll(s, u.teamId, s.year) - u.payrollBudget);
  const cash = u.ledger
    .slice(u.settledAt ?? 0)
    .filter((l) => !l.settlement && !l.capital)
    .reduce((a, l) => a + l.amount, 0);
  const need = Math.max(0, -operating - over - Math.min(0, cash));
  const amount = Math.min(u.support ?? need, Math.round(need / 1000) * 1000);
  u.seasonSupport = { year: s.year, amount };
  u.fund += amount;
  u.ledger.push({ year: s.year, label: __i18n_k("league.finance.openBooks.label.4119d9fc", { year: s.year, supportLabel: supportLabel(s.teams.find((t) => t.id === u.teamId)!.parent.type) }), amount, settlement: true });
  if (tickets?.year === s.year && tickets.paid) {
    u.fund += tickets.paid;
    u.ledger.push({ year: s.year, label: __i18n_k("league.finance.openBooks.label.086c82a0", { year: s.year, value: tickets.sold.toLocaleString('ko-KR'), value2: Math.round(tickets.discount * 100) }), amount: tickets.paid, settlement: true });
  }
}

/** Season tickets at opening: how many sell at the discount set in the winter, paid for every home game now. */
function sellSeasonTickets(s: LeagueState) {
  const u = s.user!;
  const c = clubState(s, u.teamId);
  const team = s.teams.find((t) => t.id === u.teamId)!;
  const discount = c.seasonTicketDiscount ?? 0;
  const T = F.seasonTickets;
  const sold = Math.round(Math.min(team.stadium.capacity * T.maxShare, c.popularity * boom(s.year) * (T.share[discount] ?? T.share[0]!) * Math.max(0.5, 1 + c.interest)));
  const home = s.schedule.filter((g) => g.home === u.teamId).length;
  const paid = Math.round(sold * home * leaguePrice(s.year) * c.price * (1 - discount));
  c.seasonTickets = { year: s.year, discount, sold, paid };
  // The money counts as this season's ticket revenue.
  const gate = ((s.gate ??= {})[u.teamId] ??= { games: 0, fans: 0, sellouts: 0, revenue: 0 });
  gate.revenue += paid;
}

export const supportLabel = (type: string) =>
  type === 'citizen' ? __i18n_k("league.finance.supportLabel.cb656803") : type === 'namingRights' ? __i18n_k("league.finance.supportLabel.f49549e7") : __i18n_k("league.finance.supportLabel.3aa623c2");

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
  // What is in already (season tickets included, V0.12), and the walk-up tickets of the home games to come.
  const tickets = c.seasonTickets?.year === s.year ? c.seasonTickets : null;
  const walkUp = Math.max(0, perGame - (tickets ? tickets.sold * F.seasonTickets.show : 0));
  const later = (home - (gate?.games ?? 0)) * walkUp * leaguePrice(s.year) * c.price * (1 + premiumShare(s, teamId));
  const saved = s.gate;
  s.gate = { ...(saved ?? {}), [teamId]: { games: home, fans, sellouts: 0, revenue: Math.round((gate?.revenue ?? 0) + later) } };
  try {
    return clubReport(s, teamId, s.year, {});
  } finally {
    s.gate = saved;
  }
}

export const ticketPriceWon = (s: LeagueState, teamId: TeamId, year = s.year) => Math.round(leaguePrice(year) * clubState(s, teamId).price * 10000);
