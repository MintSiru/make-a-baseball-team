import { k as __i18n_k } from '../i18n/index';
/* Each AI club's plan (1.6.0, from the 1.4 review): on top of the common trade value (trade.ts), a club weighs a
   player by what it is trying to do. A club near the top goes for now (contend), one at the bottom with an old
   roster or out of the race builds for later (rebuild), the rest stay balanced. It also knows where it is short
   (its best at each spot against the league's), how old its first team is and how much room it has under the
   salary cap. All of it from public information: standings, ages, the scouts' grades and contracts.

   checkTrade asks the other club's plan for its weights and says why it likes or refuses an offer. The guards stay
   as they were (roster limits, the trade window); the plan adds two of its own: a club keeps its last catchers
   and enough starting pitchers, and does not take on pay that would put it over the salary cap. */
import type { Player, TeamId } from '../model/types';
import { salaryCapFor } from '../rules/kbo2026';
import { capTotal } from './cap';
import { salaryIn } from './contracts';
import { ageIn, currentValue, futureValue, isForeign, isPitcher } from './players';
import { standings } from './standings';
import { firstTeamIds, orgPlayers, registeredIds, type LeagueState } from './state';
import { STRATEGY as S } from './tuning';

export type ClubMode = 'contend' | 'balanced' | 'rebuild';
export const MODE_LABEL: Record<ClubMode, string> = { contend: __i18n_k("league.strategy.mODE_LABEL.contend.24a019cb"), balanced: __i18n_k("league.strategy.mODE_LABEL.balanced.45c89bab"), rebuild: __i18n_k("league.strategy.mODE_LABEL.rebuild.f7c61df8") };

export type Spot = 'SP' | 'RP' | 'C' | 'IF' | 'OF';
export const SPOT_LABEL: Record<Spot, string> = { SP: __i18n_k("league.strategy.sPOT_LABEL.sP.cd036b1a"), RP: __i18n_k("league.strategy.sPOT_LABEL.rP.5b8607a3"), C: __i18n_k("league.strategy.sPOT_LABEL.c.5f31470d"), IF: __i18n_k("league.strategy.sPOT_LABEL.iF.d7fc242c"), OF: __i18n_k("league.strategy.sPOT_LABEL.oF.7435120b") };
/** How many at each spot a first team leans on. */
const CORE: Record<Spot, number> = { SP: 5, RP: 6, C: 1, IF: 4, OF: 3 };

export const spotOf = (p: Player): Spot => (isPitcher(p) ? (p.role === 'SP' ? 'SP' : 'RP') : p.position === 'C' ? 'C' : ['LF', 'CF', 'RF'].includes(p.position ?? '') ? 'OF' : 'IF');

export interface ClubStrategy {
  mode: ClubMode;
  /** Why, in a line. */
  why: string;
  /** Spots where its core is clearly below the league's, the worst first. */
  needs: Spot[];
  /** Average age of its core. */
  age: number;
  /** Room under next season's salary cap (만 원; negative when over). */
  room: number;
}

/** A club's best few at a spot (public grade now). */
function coreAt(players: Player[], spot: Spot): number {
  const xs = players
    .filter((p) => spotOf(p) === spot)
    .map(currentValue)
    .sort((a, b) => b - a)
    .slice(0, CORE[spot]);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / CORE[spot] : 0;
}

const domestic = (s: LeagueState, teamId: TeamId) => orgPlayers(s, teamId).filter((p) => p.status === 'active' && !isForeign(p));

/** Where the club stands: its rank this season (or last) and how far it is from the postseason line. */
function standing(s: LeagueState, teamId: TeamId): { rank: number; clubs: number; behind: number; share: number } {
  const ids = firstTeamIds(s, s.year);
  const playing = s.phase === 'regular' && s.scores.length > 0;
  const rows = playing ? standings(ids, s.scores) : (s.history.at(-1)?.table ?? []);
  const row = rows.find((r) => r.teamId === teamId);
  if (!row) return { rank: Math.ceil(ids.length / 2), clubs: ids.length, behind: 0, share: 0 };
  const line = rows[Math.min(rows.length - 1, S.spots - 1)]!;
  const behind = (line.w - line.l - (row.w - row.l)) / 2;
  const share = playing ? (row.w + row.l + row.t) / 144 : 1;
  return { rank: row.rank, clubs: rows.length, behind, share };
}

export function clubStrategy(s: LeagueState, teamId: TeamId): ClubStrategy {
  const players = domestic(s, teamId);
  const next = s.phase === 'regular' || s.phase === 'postseason' ? s.year : s.year + 1;
  // Needs: the spots where this club's core trails the league's average core the most.
  const clubs = firstTeamIds(s, s.year).filter((id) => s.rosters[id]);
  const spots: Spot[] = ['SP', 'RP', 'C', 'IF', 'OF'];
  const league = Object.fromEntries(spots.map((k) => [k, clubs.reduce((a, id) => a + coreAt(domestic(s, id), k), 0) / Math.max(1, clubs.length)])) as Record<Spot, number>;
  const needs = spots
    .map((k) => ({ k, gap: league[k] - coreAt(players, k) }))
    .filter((x) => x.gap >= S.needGap)
    .sort((a, b) => b.gap - a.gap)
    .map((x) => x.k);
  const core = [...players].sort((a, b) => currentValue(b) - currentValue(a)).slice(0, 20);
  const age = core.length ? core.reduce((a, p) => a + ageIn(p, next), 0) / core.length : 27;
  const room = salaryCapFor(next) - capTotal(s, teamId, next);
  const st = standing(s, teamId);
  let mode: ClubMode = 'balanced';
  let why = __i18n_k("league.strategy.clubStrategy.why.a630e0a2");
  // Early in the season a club goes by last year; later by where it stands now.
  if (st.rank <= S.contendRank && (st.share < 0.25 || st.behind <= 0)) {
    mode = 'contend';
    why = __i18n_k("league.strategy.clubStrategy.99089f67", { rank: st.rank, value: st.share >= 0.25 ? '' : __i18n_k("league.strategy.clubStrategy.e6de1983") });
  } else if (st.rank > st.clubs - S.rebuildBottom && (age >= S.oldCore || (st.share >= 0.5 && st.behind >= S.outOfRace))) {
    mode = 'rebuild';
    why = age >= S.oldCore ? __i18n_k("league.strategy.clubStrategy.4b263ca3", { value: age.toFixed(1) }) : __i18n_k("league.strategy.clubStrategy.65566450", { value: Math.round(st.behind) });
  }
  return { mode, why, needs, age, room };
}

/** How much more (or less) a club with this plan values a player it would get, against the common value. */
export function planFactor(s: LeagueState, plan: ClubStrategy, p: Player): number {
  const age = ageIn(p, s.year);
  const ready = currentValue(p) >= futureValue(p) - 3;
  let k = 1;
  if (plan.mode === 'contend') k *= ready && age >= 25 ? S.contend.now : age <= 23 ? S.contend.young : 1;
  if (plan.mode === 'rebuild') k *= age <= 25 ? S.rebuild.young : age >= 30 ? S.rebuild.old : 1;
  if (plan.needs.includes(spotOf(p))) k *= S.need;
  return k;
}

/** Picks and cash as the plan sees them. */
export const pickFactor = (plan: ClubStrategy) => (plan.mode === 'rebuild' ? S.rebuild.picks : plan.mode === 'contend' ? S.contend.picks : 1);
export const cashFactor = (plan: ClubStrategy) => (plan.mode === 'rebuild' ? S.rebuild.cash : 1);

/** Why the club would refuse outright, whatever the value: its last catchers or starters, or the cap. */
export function planGuard(s: LeagueState, teamId: TeamId, plan: ClubStrategy, gives: Player[], gets: Player[]): string | null {
  const name = s.teams.find((t) => t.id === teamId)?.short ?? teamId;
  const left = registeredIds(s, teamId)
    .map((id) => s.players[id]!)
    .filter((p) => !isForeign(p) && !gives.some((g) => g.id === p.id));
  const plus = [...left, ...gets];
  if (gives.some((p) => spotOf(p) === 'C') && plus.filter((p) => spotOf(p) === 'C').length < S.keep.C) return __i18n_k("league.strategy.planGuard.9f23596c", { name: name });
  if (gives.some((p) => spotOf(p) === 'SP') && plus.filter((p) => spotOf(p) === 'SP').length < S.keep.SP) return __i18n_k("league.strategy.planGuard.27848eb0", { name: name });
  const season = s.phase === 'regular' || s.phase === 'postseason' ? s.year : s.year + 1;
  const added = gets.reduce((a, p) => a + salaryIn(p, season), 0) - gives.reduce((a, p) => a + salaryIn(p, season), 0);
  if (added > 0 && added > plan.room) return __i18n_k("league.strategy.planGuard.b99f3e9b", { name: name, value: Math.max(0, Math.round(plan.room / 10000)) });
  return null;
}

/** What the club says about an offer: its plan, and the players it likes or does not want. */
export function planReasons(s: LeagueState, teamId: TeamId, plan: ClubStrategy, gets: Player[], picks: number, cash: number): string[] {
  const name = s.teams.find((t) => t.id === teamId)?.short ?? teamId;
  const out = [`${name} · ${MODE_LABEL[plan.mode]}: ${plan.why}`];
  if (plan.needs.length) out.push(__i18n_k("league.strategy.planReasons.f3ef1a81", { value: plan.needs.map((k) => SPOT_LABEL[k]).join(', ') }));
  for (const p of gets) {
    const k = planFactor(s, plan, p);
    if (k >= 1.1) out.push(__i18n_k("league.strategy.planReasons.86e653e4", { name: p.name, value: plan.needs.includes(spotOf(p)) ? __i18n_k("league.strategy.planReasons.e6dda645", { value: SPOT_LABEL[spotOf(p)] }) : plan.mode === 'contend' ? __i18n_k("league.strategy.planReasons.12f87a5c") : __i18n_k("league.strategy.planReasons.c2faf004") }));
    else if (k <= 0.9) out.push(__i18n_k("league.strategy.planReasons.86e653e4", { name: p.name, value: plan.mode === 'rebuild' ? __i18n_k("league.strategy.planReasons.a25d7de4") : __i18n_k("league.strategy.planReasons.8407af5e") }));
  }
  if (picks && plan.mode !== 'balanced') out.push(plan.mode === 'rebuild' ? __i18n_k("league.strategy.planReasons.76223a91") : __i18n_k("league.strategy.planReasons.8d1bac8f"));
  if (cash && plan.mode === 'rebuild') out.push(__i18n_k("league.strategy.planReasons.22e7f930"));
  return out;
}
