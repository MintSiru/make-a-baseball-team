/* The free-agent market (V0.5, RULES.md §4): grades from salary rank, a limit on outside signings,
   offers from every interested club (the user's included), the player's choice, and compensation to
   the club he leaves (a player outside the protected list plus money, or money only).

   The market runs in one pass, best players first, so a club's needs, payroll and signing count
   change as it signs. Decisions the user owes afterwards (a protected list when the user signed an
   A/B free agent, a compensation pick when an AI club signed one of the user's) wait in a queue on the
   offseason state. Money in 만 원. */
import type { Player, PlayerId, TeamId } from '../model/types';
import { KBO_2026, salaryCapFor } from '../rules/kbo2026';
import { renewSalary, salaryIn } from './contracts';
import { freeAgentsFor, leaveLeague, removeFromRoster } from './offseason';
import { ageIn, currentValue, isForeign, isPitcher, keepValue } from './players';
import { firstTeamIds, orgIds, orgPlayers, registeredIds, type Decision, type LeagueState } from './state';
import { MARKET } from './tuning';

export type FaGrade = 'A' | 'B' | 'C';
export interface FaOffer {
  /** Salary per season, 만 원. */
  annual: number;
  years: number;
}

export interface FaQueueItem {
  kind: 'protect' | 'compensation';
  fa: PlayerId;
  grade: 'A' | 'B';
  /** The club he left and the club he joined. */
  from: TeamId;
  to: TeamId;
  /** His salary the season before, the base of the compensation money. */
  salary: number;
}

const F = KBO_2026.freeAgency;

// ── Grades ───────────────────────────────────────────────────────────────────────────────────────

/** Average salary over the three seasons up to `year` (seasons he was paid). */
function recentSalary(p: Player, year: number) {
  const paid = [year - 2, year - 1, year].map((y) => salaryIn(p, y)).filter((x) => x > 0);
  return paid.length ? paid.reduce((a, b) => a + b, 0) / paid.length : 0;
}

/** A/B/C for this winter's free agents: salary rank in the club and in the league (domestic players), 35 and over C. */
export function faGrades(s: LeagueState, next: number, fas: Player[]): Record<PlayerId, FaGrade> {
  const year = next - 1;
  const domestic = s.teams.flatMap((t) => (s.rosters[t.id] ? orgPlayers(s, t.id) : [])).filter((p) => !isForeign(p));
  const pay = new Map(domestic.map((p) => [p.id, recentSalary(p, year)]));
  const rank = (ids: PlayerId[], id: PlayerId) => ids.filter((x) => (pay.get(x) ?? 0) > (pay.get(id) ?? 0)).length + 1;
  const all = domestic.map((p) => p.id);
  const out: Record<PlayerId, FaGrade> = {};
  for (const p of fas) {
    if (ageIn(p, next) >= F.grade.cFromAge) {
      out[p.id] = 'C';
      continue;
    }
    const club = orgPlayers(s, p.teamId!).filter((x) => !isForeign(x)).map((x) => x.id);
    const [c, l] = [rank(club, p.id), rank(all, p.id)];
    out[p.id] = c <= F.grade.clubTop[0] && l <= F.grade.leagueTop[0] ? 'A' : c <= F.grade.clubTop[1] && l <= F.grade.leagueTop[1] ? 'B' : 'C';
  }
  return out;
}

/** How many outside free agents each club may sign this winter. */
export const externalLimit = (count: number) => F.externalLimit.find((x) => count <= x.upTo)!.signs;

// ── Money ────────────────────────────────────────────────────────────────────────────────────────

/** What the market thinks he is worth: yearly pay from recent WAR, length from age (the V0.2 pricing). */
export function marketValue(p: Player, next: number): FaOffer {
  const recs = p.career.filter((r) => !r.level).slice(-3);
  const weights = recs.map((_, i) => i + 1);
  const war = recs.length ? recs.reduce((a, r, i) => a + r.war * weights[i]!, 0) / weights.reduce((a, b) => a + b, 0) : 0;
  const age = ageIn(p, next);
  const years = age <= 31 ? 4 : age <= 33 ? 3 : age <= 35 ? 2 : 1;
  const yearly = Math.min(MARKET.maxAnnual, Math.max(MARKET.minAnnual, 4000 + Math.max(0, war) ** 1.5 * MARKET.perWar));
  return { annual: Math.round(yearly / 1000) * 1000, years };
}

/**
 * A season's payroll: salaries set for that season, renewal estimates where they are not set yet, and
 * (the user's club) money still owed to players it let go. `without` leaves players out (deals being decided).
 */
export function projectedPayroll(s: LeagueState, teamId: TeamId, season: number, without: PlayerId[] = []) {
  const players = orgIds(s, teamId)
    .filter((id) => !without.includes(id))
    .reduce((sum, id) => {
      const p = s.players[id]!;
      return sum + (salaryIn(p, season) || (isForeign(p) ? 0 : renewSalary(p, season)));
    }, 0);
  return players + (teamId === s.user?.teamId ? deadMoney(s, season) : 0);
}

/** Salary the user's club still pays players it released (released players' guaranteed money). */
export const deadMoney = (s: LeagueState, season: number) => (s.user?.deadMoney ?? []).filter((x) => x.season === season).reduce((a, x) => a + x.amount, 0);

export function faContract(teamId: TeamId, next: number, offer: FaOffer): Player['contract'] {
  return { teamId, kind: 'freeAgent', signedIn: next - 1, signingBonus: 0, salaries: Array.from({ length: offer.years }, (_, i) => ({ season: next + i, amount: offer.annual })) };
}

/** What the signing club owes the former club: cash with a player, or cash only (RULES.md §4). */
export function compensationCash(grade: FaGrade, salary: number) {
  const c = F.compensation[grade];
  return { withPlayer: c.withPlayer === null ? null : Math.round(salary * c.withPlayer), cashOnly: Math.round(salary * c.cashOnly) };
}

// ── The AI's view ────────────────────────────────────────────────────────────────────────────────

/** How much better he is than what the club has at his spot (public grades). */
function improvement(s: LeagueState, teamId: TeamId, p: Player) {
  const mates = registeredIds(s, teamId)
    .map((id) => s.players[id]!)
    .filter((x) => x.id !== p.id && !isForeign(x));
  let bench: number;
  if (isPitcher(p)) {
    const same = mates.filter((x) => x.role === p.role).map(currentValue).sort((a, b) => b - a);
    bench = same[p.role === 'SP' ? 3 : 5] ?? 40;
  } else {
    const same = mates.filter((x) => x.position === p.position).map(currentValue).sort((a, b) => b - a);
    bench = same[0] ?? 40;
  }
  return currentValue(p) - bench;
}

/** Chance an AI club makes an offer: need at his spot, room under the salary cap, and his age. */
function interest(s: LeagueState, teamId: TeamId, p: Player, offer: FaOffer, next: number) {
  const gain = improvement(s, teamId, p);
  let x = MARKET.interest.base + gain * MARKET.interest.perGain;
  const room = salaryCapFor(next) - projectedPayroll(s, teamId, next);
  if (room < offer.annual) x *= MARKET.interest.overCap;
  if (ageIn(p, next) >= 34) x *= 0.6;
  return Math.max(0, Math.min(MARKET.interest.max, x));
}

// ── The market ───────────────────────────────────────────────────────────────────────────────────

/**
 * Every free agent this winter, best first: offers from his club and interested clubs (the user's as
 * given), he signs the best (a little loyalty to his club), and compensation follows. Returns the
 * queue of decisions the user owes.
 */
export function runFreeAgency(s: LeagueState, next: number, r: () => number, userOffers: Record<PlayerId, FaOffer> = {}): FaQueueItem[] {
  const user = s.user?.teamId ?? null;
  const fas = freeAgentsFor(s, next);
  const grades = faGrades(s, next, fas);
  const limit = externalLimit(fas.length);
  const signed: Record<TeamId, number> = {};
  const clubs = firstTeamIds(s, next).filter((id) => id !== user);
  const queue: FaQueueItem[] = [];
  const order = [...fas].sort((a, b) => keepValue(b, next) - keepValue(a, next) || a.id.localeCompare(b.id));
  for (const p of order) {
    if (!p.teamId || p.status !== 'active') continue;
    const from = p.teamId;
    const salary = salaryIn(p, next - 1);
    const base = marketValue(p, next);
    const offers: { teamId: TeamId; offer: FaOffer }[] = [];
    for (const t of clubs) {
      if (t !== from && (signed[t] ?? 0) >= limit) continue;
      const chance = t === from ? MARKET.stay * (ageIn(p, next) <= 32 ? 1 : 0.8) : interest(s, t, p, base, next);
      if (r() >= chance) continue;
      const k = t === from ? 0.92 + r() * 0.15 : 0.9 + r() * 0.25;
      offers.push({ teamId: t, offer: { annual: Math.round((base.annual * k) / 1000) * 1000, years: base.years } });
    }
    const mine = userOffers[p.id];
    if (user && mine && (from === user || (signed[user] ?? 0) < limit)) offers.push({ teamId: user, offer: mine });
    const score = (o: { teamId: TeamId; offer: FaOffer }) => o.offer.annual * (1 + 0.15 * (o.offer.years - 1)) * (o.teamId === from ? MARKET.loyalty : 1);
    const best = offers.sort((a, b) => score(b) - score(a) || (a.teamId === user ? -1 : 1))[0];
    if (!best) {
      // Nobody bid: his club brings him back cheaper, or (the user's own, unsigned) he retires.
      if (from === user) {
        (s.user!.log ??= []).push({ year: next - 1, text: `FA ${p.name} 계약 못 함, 은퇴` });
        leaveLeague(s, p, 'retired');
      } else sign(s, p, from, next, { annual: Math.round((base.annual * 0.85) / 1000) * 1000, years: Math.max(1, base.years - 1) });
      continue;
    }
    sign(s, p, best.teamId, next, best.offer);
    if (best.teamId === user) (s.user!.log ??= []).push({ year: next - 1, text: `FA ${p.name} ${from === user ? '재계약' : `영입 (${shortOf(s, from)}에서)`} · ${best.offer.years}년 연 ${Math.round(best.offer.annual / 1000) / 10}억` });
    else if (from === user) (s.user!.log ??= []).push({ year: next - 1, text: `FA ${p.name} ${shortOf(s, best.teamId)}로 이적` });
    if (best.teamId === from) continue;
    signed[best.teamId] = (signed[best.teamId] ?? 0) + 1;
    const grade = grades[p.id] ?? 'C';
    if (grade === 'C') {
      moneyFor(s, best.teamId, from, compensationCash('C', salary).cashOnly, `FA ${p.name} 보상금 (C등급)`, next - 1);
      continue;
    }
    const item: FaQueueItem = { kind: 'protect', fa: p.id, grade, from, to: best.teamId, salary };
    if (best.teamId === user) queue.push(item);
    else if (from === user) queue.push({ ...item, kind: 'compensation' });
    else aiCompensation(s, item, protectedBy(s, best.teamId, grade, next), next);
  }
  return queue;
}

const shortOf = (s: LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? id;

function sign(s: LeagueState, p: Player, teamId: TeamId, next: number, offer: FaOffer) {
  removeFromRoster(s, p);
  p.teamId = teamId;
  s.rosters[teamId]!.futures.push(p.id);
  p.contract = faContract(teamId, next, offer);
  p.service.lastFreeAgencyAt = p.service.creditedSeasons;
}

/** Money between clubs: only the user's club keeps books (V0.6 brings finances for everyone). */
function moneyFor(s: LeagueState, payer: TeamId, payee: TeamId, amount: number, label: string, year: number) {
  const u = s.user;
  if (!u || !amount) return;
  if (payer === u.teamId) {
    u.fund -= amount;
    u.ledger.push({ year, label, amount: -amount });
  } else if (payee === u.teamId) {
    u.fund += amount;
    u.ledger.push({ year, label, amount });
  }
}

/** Players a club does not have to list: foreign players, this winter's free-agent signings and this fall's draftees. */
const autoProtected = (p: Player, next: number) => isForeign(p) || p.proSince >= next || (p.contract?.kind === 'freeAgent' && p.contract.signedIn === next - 1);

/** The players an AI club protects: its best by keep value (20 for an A-grade signing, 25 for B). */
export function protectedBy(s: LeagueState, teamId: TeamId, grade: 'A' | 'B', next: number): Set<PlayerId> {
  const n = F.compensation[grade].protected!;
  const listable = registeredIds(s, teamId)
    .map((id) => s.players[id]!)
    .filter((p) => !autoProtected(p, next))
    .sort((a, b) => keepValue(b, next) - keepValue(a, next));
  return new Set(listable.slice(0, n).map((p) => p.id));
}

/** Players the former club may take from the signing club. */
export function compensationPool(s: LeagueState, teamId: TeamId, protectedIds: Set<PlayerId>, next: number) {
  return registeredIds(s, teamId)
    .map((id) => s.players[id]!)
    .filter((p) => !autoProtected(p, next) && !protectedIds.has(p.id))
    .sort((a, b) => keepValue(b, next) - keepValue(a, next));
}

/** The former club's choice when it is an AI club: the best unprotected player if he is worth it, else money only. */
export function aiCompensation(s: LeagueState, item: FaQueueItem, protectedIds: Set<PlayerId>, next: number) {
  const pick = compensationPool(s, item.to, protectedIds, next)[0];
  const cash = compensationCash(item.grade, item.salary);
  const name = s.players[item.fa]?.name ?? '';
  if (pick && keepValue(pick, next) >= MARKET.compensationPickValue) {
    movePlayer(s, pick, item.from);
    moneyFor(s, item.to, item.from, cash.withPlayer!, `FA ${name} 보상금 (${item.grade}등급, 보상선수 ${pick.name})`, next - 1);
    if (s.user?.teamId === item.to) (s.user.log ??= []).push({ year: next - 1, text: `FA ${name} 보상선수로 ${pick.name}이(가) ${shortOf(s, item.from)}로 이적` });
  } else moneyFor(s, item.to, item.from, cash.cashOnly, `FA ${name} 보상금 (${item.grade}등급, 보상선수 없이)`, next - 1);
}

export function movePlayer(s: LeagueState, p: Player, to: TeamId) {
  removeFromRoster(s, p);
  p.teamId = to;
  if (p.contract) p.contract.teamId = to;
  s.rosters[to]!.futures.push(p.id);
}

// ── The user's decisions ─────────────────────────────────────────────────────────────────────────

export function marketDecision(s: LeagueState, next: number): Decision | null {
  const fas = freeAgentsFor(s, next);
  if (!fas.length) return null;
  const grades = faGrades(s, next, fas);
  return { kind: 'faMarket', candidates: fas.map((p) => p.id), grades, limit: externalLimit(fas.length) };
}

/** The next decision the user owes after the market, or null. */
export function queuedDecision(s: LeagueState, item: FaQueueItem, next: number): Decision {
  const cash = compensationCash(item.grade, item.salary);
  if (item.kind === 'protect') {
    const candidates = registeredIds(s, item.to)
      .map((id) => s.players[id]!)
      .filter((p) => !autoProtected(p, next))
      .sort((a, b) => keepValue(b, next) - keepValue(a, next))
      .map((p) => p.id);
    return { kind: 'faProtect', fa: item.fa, grade: item.grade, from: item.from, protect: F.compensation[item.grade].protected!, candidates };
  }
  const list = compensationPool(s, item.to, protectedBy(s, item.to, item.grade, next), next).map((p) => p.id);
  return { kind: 'faCompensation', fa: item.fa, grade: item.grade, to: item.to, list, withPlayer: cash.withPlayer!, cashOnly: cash.cashOnly };
}

export { recentSalary };
