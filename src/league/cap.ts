import { k as __i18n_k } from '../i18n/index';
/* The competitive balance tax (경쟁균형세, RULES.md §3): each club's top-40 pay after the season is
   measured against the cap. Over it: 30% of the excess the first season, 50% the second in a row,
   100% from the third plus the next draft's first-round pick nine places later. From 2027 there is a
   floor too; the game has a club under it pay the shortfall (game assumption). Only the user's club
   pays money (clubs' finances come in V0.6); the pick penalty applies to everyone. */
import type { PlayerId, TeamId } from '../model/types';
import { KBO_2026, salaryCapFor } from '../rules/kbo2026';
import { addAlert } from './alerts';
import { bonusShare, capPay, renewSalary } from './contracts';
import { isForeign } from './players';
import { firstTeamIds, orgPlayers, type LeagueState } from './state';

const C = KBO_2026.salaryCap;

export function capFloorFor(year: number): number | null {
  if (year < C.floor.from) return null;
  return Math.round(C.floor.amount * (1 + C.floor.growth) ** (year - C.floor.from));
}

/** A club's top-40 total for `year` (its players and soldiers under contract that season): salaries, free-agent
    bonuses spread over their deals and incentives paid (V0.8). 2.0.21 (the user's request): foreign players are
    left out, as the KBO leaves them out (rookies stay in, the game's pay being lower than the league's; RULES.md §9).
    `estimate` (the winter, before the salary talks): a player not yet signed for `year` counts at the raise he can
    expect; `without`: players to leave out (the free agents on the market, whose offers count instead). The FA
    market's cap line and the season's settlement read the same total. */
export function capTotal(s: LeagueState, teamId: TeamId, year: number, opts: { estimate?: boolean; without?: Set<PlayerId> } = {}) {
  const soldiers = Object.values(s.players).filter((p) => p.teamId === teamId && p.status === 'military');
  const pay = [...orgPlayers(s, teamId), ...soldiers]
    .filter((p) => !isForeign(p) && !opts.without?.has(p.id))
    .map((p) => capPay(p, year) || (opts.estimate ? renewSalary(p, year) + bonusShare(p, year) : 0))
    .sort((a, b) => b - a);
  return pay.slice(0, C.topPlayers).reduce((a, b) => a + b, 0);
}

export interface CapRecord {
  year: number;
  total: number;
  cap: number;
  over: number;
  /** Consecutive seasons over the cap, this one included. */
  streak: number;
  levy: number;
}

/** 2.0.24: the option's bar for losing a first-round pick — over the cap three seasons running, or by a tenth of it. */
export const FORFEIT = { streak: 3, share: 0.1 };

/** Measures every club after the season and applies the sanctions. */
export function settleCap(s: LeagueState, year: number) {
  if (year < C.from) return;
  const cap = salaryCapFor(year);
  const floor = capFloorFor(year);
  for (const teamId of firstTeamIds(s, year)) {
    const total = capTotal(s, teamId, year);
    const past = s.cap?.[teamId] ?? [];
    const prev = past.find((r) => r.year === year - 1);
    const over = Math.max(0, total - cap);
    const streak = over > 0 ? (prev && prev.over > 0 ? prev.streak + 1 : 1) : 0;
    let levy = over > 0 ? Math.round(over * C.levies[Math.min(streak, C.levies.length) - 1]!) : 0;
    const short = floor !== null ? Math.max(0, floor - total) : 0;
    levy += short;
    ((s.cap ??= {})[teamId] ??= []).push({ year, total, cap, over, streak, levy });
    if (streak >= C.pickDropFrom) ((s.pickDrop ??= {})[year + 1] ??= []).push(teamId);
    // 2.0.24 (the user's request, a game option): a club far over the cap, or over it three seasons running, loses its
    // next first-round pick outright.
    const forfeit = !!s.capForfeit && over > 0 && (streak >= FORFEIT.streak || over >= cap * FORFEIT.share);
    if (forfeit) ((s.pickForfeit ??= {})[year + 1] ??= []).push(teamId);
    const u = s.user;
    if (u && teamId === u.teamId && levy > 0) {
      u.fund -= levy;
      u.ledger.push({ year, label: over > 0 ? __i18n_k("league.cap.settleCap.label.ef53c030", { streak: streak }) : __i18n_k("league.cap.settleCap.label.bc31f2ef"), amount: -levy });
      (u.log ??= []).push({
        year,
        text: over > 0 ? __i18n_k("league.cap.settleCap.text.5233d51f", { value: streak >= C.pickDropFrom ? __i18n_k("league.cap.settleCap.text.284072e6") : '' }) : __i18n_k("league.cap.settleCap.text.980ebad7"),
      });
      if (forfeit) {
        const text = __i18n_k("league.cap.text.0c580fdc", { year: year + 1 });
        u.log!.push({ year, text });
        addAlert(s, { id: `cap-forfeit-${year}`, date: `${year}-12-20`, kind: 'owner', title: text, lines: [__i18n_k("league.cap.text.5d5212f4", { pct: Math.round((over / cap) * 100), streak })], tone: 'bad' });
      }
    }
  }
}

/** A club's first-round pick drops nine places when it was over the cap three seasons running. */
export function applyPickDrop<T extends { teamId: TeamId }>(s: LeagueState, draftYear: number, slots: T[]): T[] {
  const drop = s.pickDrop?.[draftYear];
  const forfeit = s.pickForfeit?.[draftYear] ?? [];
  if (!drop?.length && !forfeit.length) return slots;
  const out = [...slots];
  // 2.0.24: a forfeited first-round pick is gone (its first pick of the draft).
  for (const teamId of forfeit) {
    const i = out.findIndex((x) => x.teamId === teamId);
    if (i >= 0) out.splice(i, 1);
  }
  if (!drop?.length) return out;
  for (const teamId of drop) {
    const i = out.findIndex((x) => x.teamId === teamId);
    if (i < 0) continue;
    const [slot] = out.splice(i, 1);
    out.splice(Math.min(out.length, i + C.pickDrop), 0, slot!);
  }
  return out;
}
