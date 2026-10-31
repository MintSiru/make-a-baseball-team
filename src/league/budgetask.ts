import { k as __i18n_k } from '../i18n/index';
/* 2.0.34 (the user's request: 연봉 예산 조르기): when the payroll budget is too tight for the free agents or the foreign
   players the club wants, the general manager may go to the owner, once a season, for more of it — apart from the
   salary cap, which is the league's and stays where it is. The raise is for the season being paid only (next winter's
   budget is set afresh, as always). A conglomerate gives most readily, a citizen club least; trust and a good season
   help, and the bigger the raise the harder the sell. A no costs a little trust, a yes a point. */
import { rng } from '../draftroom';
import { addAlert } from './alerts';
import { eok } from './fa';
import { payrollSeason } from './payroll';
import type { LeagueState } from './state';
import { PARENT } from './tuning';

export const BUDGET_ASK = {
  base: { conglomerate: 0.6, midsize: 0.45, namingRights: 0.3, citizen: 0.25 },
  /** Each point of trust above (or below) 50. */
  perTrust: 0.01,
  /** The raises the general manager may ask for, as shares of the budget. */
  shares: [0.05, 0.1, 0.2] as const,
  /** Odds lost for each tenth of the budget asked for. */
  perTenth: 0.15,
  /** Last season's place: the top three help, the bottom three hurt. */
  rank: 0.1,
  min: 0.05,
  max: 0.9,
  noTrust: 3,
  yesTrust: 1,
};

export interface BudgetAsk {
  /** The season whose budget was asked about. */
  season: number;
  share: number;
  amount: number;
  yes: boolean;
}

/** Why the owner cannot be asked now, or null. */
export function askBudgetProblem(s: LeagueState): string | null {
  const u = s.user;
  if (!u) return __i18n_k("league.budgetask.text.272add95");
  if (u.independent) return __i18n_k("league.budgetask.text.8c0ad1e5");
  if (s.phase !== 'regular' && s.phase !== 'offseason') return __i18n_k("league.budgetask.text.1bf0a8c9");
  const season = payrollSeason(s);
  if (u.budgetAsks?.some((a) => a.season === season)) return __i18n_k("league.budgetask.text.af4a5ddb", { season });
  return null;
}

/** The raise asked for at a share of the budget (rounded to 1천만 원). */
export const askedAmount = (s: LeagueState, share: number) => Math.round((s.user!.payrollBudget * share) / 1000) * 1000;

/** The odds the owner says yes to a raise of `share`. */
export function askBudgetChance(s: LeagueState, share: number): number {
  const u = s.user!;
  const trust = u.trust ?? PARENT.startTrust;
  const B = BUDGET_ASK;
  const year = s.offseason ? s.offseason.year : s.year - 1;
  const table = s.history.find((h) => h.year === year)?.table ?? [];
  const rank = table.find((r) => r.teamId === u.teamId)?.rank;
  const place = rank === undefined ? 0 : rank <= 3 ? B.rank : rank > table.length - 3 ? -B.rank : 0;
  const p = B.base[u.settings.parentType] + (trust - 50) * B.perTrust + place - share * 10 * B.perTenth;
  return Math.max(B.min, Math.min(B.max, p));
}

/** We ask; the owner raises this season's payroll budget, or says no. */
export function askBudget(s: LeagueState, share: number): boolean {
  const problem = askBudgetProblem(s);
  if (problem) throw new Error(problem);
  if (!BUDGET_ASK.shares.includes(share as (typeof BUDGET_ASK.shares)[number])) throw new Error(__i18n_k("league.budgetask.text.3294cb4c"));
  const u = s.user!;
  const season = payrollSeason(s);
  const amount = askedAmount(s, share);
  const yes = rng(`${s.seed}|budget-ask|${season}`)() < askBudgetChance(s, share);
  (u.budgetAsks ??= []).push({ season, share, amount, yes });
  const year = s.offseason ? s.offseason.year : s.year;
  const date = s.offseason ? `${year}-12-01` : (s.schedule[s.next]?.date ?? `${year}-03-01`);
  if (yes) {
    u.payrollBudget += amount;
    u.trust = Math.max(0, (u.trust ?? PARENT.startTrust) - BUDGET_ASK.yesTrust);
    addAlert(s, { id: `budget-ask-${season}`, date, kind: 'owner', title: __i18n_k("league.budgetask.text.27cf9c9f", { season, amount: eok(amount) }), lines: [__i18n_k("league.budgetask.text.c368a551", { budget: eok(u.payrollBudget) })], tone: 'good' });
  } else {
    u.trust = Math.max(0, (u.trust ?? PARENT.startTrust) - BUDGET_ASK.noTrust);
    addAlert(s, { id: `budget-ask-${season}`, date, kind: 'owner', title: __i18n_k("league.budgetask.text.ed931f0c"), lines: [__i18n_k("league.budgetask.text.f3ede7f8")], tone: 'bad' });
  }
  (u.log ??= []).push({ year, text: yes ? __i18n_k("league.budgetask.text.cae3f2f7", { season, amount: eok(amount) }) : __i18n_k("league.budgetask.text.0ecbb891") });
  return yes;
}
