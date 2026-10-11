import { k as __i18n_k } from '../i18n/index';
/* Free-agent rules around the negotiation (V0.5, RULES.md §4): grades from salary rank, the limit on
   outside signings, compensation to the club a player leaves (a player outside the protected list plus money,
   or money only), the owner's free agent, and the payroll the budget is checked against. The negotiation
   itself is in fa.ts (V0.8). Decisions the user owes after a signing (a protected list when the user signed
   an A/B free agent, a compensation pick when another club signed one of the user's) wait in a queue on the
   offseason state. Money in 만 원. */
import { iga, ro } from './josa';
import type { Player, PlayerId, TeamId } from '../model/types';
import { KBO_2026 } from '../rules/kbo2026';
import { budgetBonus, renewSalary, salaryIn } from './contracts';
import { removeFromRoster } from './offseason';
import { ageIn, isForeign, keepValue } from './players';
import { orgIds, orgPlayers, registeredIds, type Decision, type LeagueState } from './state';
import { MARKET, PARENT } from './tuning';
import { rng } from '../draftroom';

export type FaGrade = 'A' | 'B' | 'C';
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

/**
 * A season's payroll: salaries set for that season, renewal estimates where they are not set yet, free-agent
 * bonuses spread over their deals (V0.8, as the salary cap counts them), and (the user's club) money still
 * owed to players it let go. `without` leaves players out (deals being decided).
 */
export function projectedPayroll(s: LeagueState, teamId: TeamId, season: number, without: PlayerId[] = []) {
  const players = orgIds(s, teamId)
    .filter((id) => !without.includes(id))
    .reduce((sum, id) => {
      const p = s.players[id]!;
      return sum + (salaryIn(p, season) || (isForeign(p) ? 0 : renewSalary(p, season))) + budgetBonus(p, season);
    }, 0);
  return players + (teamId === s.user?.teamId ? deadMoney(s, season) : 0);
}

/** Salary the user's club still pays players it released (released players' guaranteed money). */
export const deadMoney = (s: LeagueState, season: number) => (s.user?.deadMoney ?? []).filter((x) => x.season === season).reduce((a, x) => a + x.amount, 0);

/** What the signing club owes the former club: cash with a player, or cash only (RULES.md §4). */
export function compensationCash(grade: FaGrade, salary: number) {
  const c = F.compensation[grade];
  return { withPlayer: c.withPlayer === null ? null : Math.round(salary * c.withPlayer), cashOnly: Math.round(salary * c.cashOnly) };
}

// ── Compensation ─────────────────────────────────────────────────────────────────────────────────

const shortOf = (s: LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? id;

/** Money between clubs: only the user's club keeps books (V0.6 brings finances for everyone). */
export function moneyFor(s: LeagueState, payer: TeamId, payee: TeamId, amount: number, label: string, year: number) {
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
    moneyFor(s, item.to, item.from, cash.withPlayer!, __i18n_k("league.market.aiCompensation.a888086b", { name: name, grade: item.grade, name2: pick.name }), next - 1);
    if (s.user?.teamId === item.to) (s.user.log ??= []).push({ year: next - 1, text: __i18n_k("league.market.aiCompensation.text.3a631528", { name: name, name2: iga(pick.name), shortOf: ro(shortOf(s, item.from)) }) });
  } else moneyFor(s, item.to, item.from, cash.cashOnly, __i18n_k("league.market.aiCompensation.ace972ba", { name: name, grade: item.grade }), next - 1);
}

export function movePlayer(s: LeagueState, p: Player, to: TeamId) {
  removeFromRoster(s, p);
  p.teamId = to;
  if (p.contract) p.contract.teamId = to;
  s.rosters[to]!.futures.push(p.id);
}

// ── The user's decisions ─────────────────────────────────────────────────────────────────────────

/**
 * Now and then a conglomerate or mid-size owner decides to buy the club a star (V0.7.7): the best A- or
 * B-grade free agent of another club. Since V0.8 the owner pays a deal of up to the market's guaranteed money
 * plus 20% (fa.ts), outside the fund and the payroll budget; the general manager negotiates it. Not in the
 * winter before the first team.
 */
export function parentGiftFor(s: LeagueState, next: number, fas: Player[], grades: Record<PlayerId, FaGrade>): { id: PlayerId; premium: number } | null {
  const u = s.user;
  if (!u || next <= u.firstTeamYear) return null;
  const G = PARENT.faGift;
  if (rng(`${s.seed}|fa-gift|${next}`)() >= G[u.settings.parentType]) return null;
  const pick = fas
    .filter((p) => p.teamId !== u.teamId && grades[p.id] && grades[p.id] !== 'C' && ageIn(p, next) <= G.maxAge)
    .sort((a, b) => keepValue(b, next) - keepValue(a, next) || a.id.localeCompare(b.id))[0];
  return pick ? { id: pick.id, premium: G.premium } : null;
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
