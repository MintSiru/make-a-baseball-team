/* The second draft (2차 드래프트, RULES.md §6): every other winter since 2023. Each club protects 35;
   players in their first three pro years, this winter's free-agent signings and foreign players are
   exempt. Clubs pick in reverse order of the standings for three rounds (the bottom three get two more
   picks), may pass, pay 4억 / 3억 / 2억 / 1억 by round to the club losing the player, and a club loses at
   most four players. */
import { iga, ro } from './josa';
import type { Player, PlayerId, TeamId } from '../model/types';
import { KBO_2026 } from '../rules/kbo2026';
import { movePlayer } from './market';
import { isForeign, keepValue } from './players';
import { firstTeamIds, orgPlayers, type Decision, type LeagueState } from './state';
import { logTransaction } from './trade';
import { moveNews } from './movenews';
import { SECOND } from './tuning';

const R = KBO_2026.secondaryDraft;

export interface SecondDraftState {
  year: number;
  slots: { teamId: TeamId; round: number }[];
  next: number;
  /** Protected lists by club (the user's arrives with its decision). */
  protected: Record<TeamId, PlayerId[]>;
  losses: Record<TeamId, number>;
  /** Clubs that passed: they pick no more. */
  passed: TeamId[];
  /** Players taken in this draft cannot be taken again. */
  picked?: PlayerId[];
}

export const isSecondDraftYear = (year: number) => year >= R.firstYear && (year - R.firstYear) % 2 === 0;

/** Players who never need protecting. */
const exempt = (p: Player, year: number) =>
  isForeign(p) || p.proSince >= year - (R.exemptProYears - 1) || (p.contract?.kind === 'freeAgent' && p.contract.signedIn === year);

/** Everyone a club could lose: its players and its soldiers, less the exempt. */
export function exposable(s: LeagueState, teamId: TeamId, year: number): Player[] {
  const soldiers = Object.values(s.players).filter((p) => p.teamId === teamId && p.status === 'military');
  return [...orgPlayers(s, teamId), ...soldiers].filter((p) => !exempt(p, year));
}

const clubsIn = (s: LeagueState, year: number) => firstTeamIds(s, year).filter((id) => id !== s.user?.teamId || s.user.firstTeamYear <= year);

export function openSecondDraft(s: LeagueState, year: number): SecondDraftState {
  const table = s.history.find((h) => h.year === year)?.table ?? [];
  const clubs = clubsIn(s, year);
  const order = [...table].reverse().map((r) => r.teamId).filter((id) => clubs.includes(id));
  const slots: SecondDraftState['slots'] = [];
  for (let round = 1; round <= R.rounds; round++) for (const teamId of order) slots.push({ teamId, round });
  const bottom = order.slice(0, R.extraPicksBottomClubs.clubs);
  for (let k = 0; k < R.extraPicksBottomClubs.picks; k++) for (const teamId of bottom) slots.push({ teamId, round: R.rounds + 1 + k });
  const prot: Record<TeamId, PlayerId[]> = {};
  for (const teamId of clubs) {
    if (teamId === s.user?.teamId) continue;
    prot[teamId] = exposable(s, teamId, year)
      .sort((a, b) => keepValue(b, year + 1) - keepValue(a, year + 1))
      .slice(0, R.protected)
      .map((p) => p.id);
  }
  return { year, slots, next: 0, protected: prot, losses: {}, passed: [] };
}

/** Players `teamId` may take on its turn. */
export function secondPool(s: LeagueState, sd: SecondDraftState, teamId: TeamId): Player[] {
  return Object.keys(sd.protected)
    .filter((t) => t !== teamId && (sd.losses[t] ?? 0) < R.maxLossPerClub)
    .flatMap((t) => exposable(s, t, sd.year).filter((p) => !sd.protected[t]!.includes(p.id) && !sd.picked?.includes(p.id)))
    .sort((a, b) => keepValue(b, sd.year + 1) - keepValue(a, sd.year + 1));
}

export const feeFor = (round: number) => R.fees[round - 1] ?? R.laterRoundFee;

export function makeSecondPick(s: LeagueState, sd: SecondDraftState, id: PlayerId | null) {
  const slot = sd.slots[sd.next]!;
  sd.next++;
  if (!id) {
    sd.passed.push(slot.teamId);
    return;
  }
  const p = s.players[id]!;
  const from = p.teamId!;
  sd.losses[from] = (sd.losses[from] ?? 0) + 1;
  (sd.picked ??= []).push(id);
  if (p.status === 'military') {
    p.teamId = slot.teamId;
    if (p.contract) p.contract.teamId = slot.teamId;
  } else movePlayer(s, p, slot.teamId);
  const fee = feeFor(slot.round);
  const u = s.user;
  const short = (t: TeamId) => s.teams.find((x) => x.id === t)?.short ?? t;
  if (u && slot.teamId === u.teamId) {
    u.fund -= fee;
    u.ledger.push({ year: sd.year, label: `2차 드래프트 ${slot.round}라운드 · ${p.name} 양도금`, amount: -fee });
    (u.log ??= []).push({ year: sd.year, text: `2차 드래프트 ${slot.round}라운드 ${p.name} 지명 (${short(from)}에서)` });
  }
  if (u && from === u.teamId) {
    u.fund += fee;
    u.ledger.push({ year: sd.year, label: `2차 드래프트 · ${p.name} 양도금`, amount: fee });
    (u.log ??= []).push({ year: sd.year, text: `2차 드래프트로 ${iga(p.name)} ${ro(short(slot.teamId))} 이적` });
  }
  logTransaction(s, `2차 드래프트 ${slot.round}R: ${short(slot.teamId)} ${p.name} (${short(from)}에서)`);
  moveNews(s, { type: 'secondDraft', teamId: slot.teamId, from, id, round: slot.round }, `${sd.year}-11-20`);
}

/** Runs AI picks until the user is on the clock or the draft is over. */
export function runSecondDraft(s: LeagueState, sd: SecondDraftState): 'wait' | 'done' {
  while (sd.next < sd.slots.length) {
    const slot = sd.slots[sd.next]!;
    if (sd.passed.includes(slot.teamId)) {
      sd.next++;
      continue;
    }
    if (slot.teamId === s.user?.teamId) {
      s.pending = secondPickDecision(s, sd);
      return 'wait';
    }
    const best = secondPool(s, sd, slot.teamId)[0];
    makeSecondPick(s, sd, best && keepValue(best, sd.year + 1) >= SECOND.minValue ? best.id : null);
  }
  return 'done';
}

export function secondProtectDecision(s: LeagueState, sd: SecondDraftState): Decision {
  const candidates = exposable(s, s.user!.teamId, sd.year)
    .sort((a, b) => keepValue(b, sd.year + 1) - keepValue(a, sd.year + 1))
    .map((p) => p.id);
  return { kind: 'secondProtect', candidates, protect: R.protected };
}

export function secondPickDecision(s: LeagueState, sd: SecondDraftState): Decision {
  const slot = sd.slots[sd.next]!;
  return { kind: 'secondPick', round: slot.round, fee: feeFor(slot.round), candidates: secondPool(s, sd, slot.teamId).slice(0, 80).map((p) => p.id) };
}
