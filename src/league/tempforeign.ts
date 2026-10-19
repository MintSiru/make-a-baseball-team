import { k as __i18n_k } from '../i18n/index';
/* 2.0.18 (the user's request): the injury replacement foreign player (부상 대체 외국인 선수, the KBO's from 2024,
   RULES.md §5, S38). A foreign player out six weeks or more goes on the rehabilitation list and his club may sign a
   stand-in for the time he is out, without using one of the season's replacements; the stand-in is paid by the month
   (at most $100K a month) and, a game assumption, outside the foreign salary cap. When the injured player is back the
   club keeps one of the two: the injured player (the stand-in leaves), or the stand-in (the injured player is let go,
   which counts as one of the season's replacements and needs the replacement window open). A stand-in still with his
   club when the season ends leaves with it.

   The other clubs sign one for nearly every long injury and keep the better of the two; our club signs from the
   market screen and says beforehand which of the two it keeps (the injured player, unless it says otherwise). */
import { rng } from '../draftroom';
import type { Player, PlayerId, TeamId } from '../model/types';
import { KBO_2026 } from '../rules/kbo2026';
import { foreignContract } from './contracts';
import { today } from './entry';
import { addAlert } from './alerts';
import { wagwa } from './josa';
import { firstTeamSize } from './manager';
import { isForeign, isPitcher, makeForeign } from './players';
import { firstTeamIds, orgPlayers, type LeagueState } from './state';
import { countReplacement, leaveForeign, logTransaction, replacementsLeft } from './trade';

export const TEMP_FOREIGN = {
  /** The shortest layoff that allows a stand-in (days). */
  minDays: 42,
  /** The most a stand-in is paid a month (US dollars). */
  monthlyUsd: 100_000,
  /** Candidates on the market for each injured player. */
  candidates: 6,
  /** How often another club signs one for a long injury, and by how much a stand-in must be better to stay. */
  aiChance: 0.85,
  keepMargin: 3,
};

export interface TempForeign {
  teamId: TeamId;
  /** The stand-in and the injured player he stands in for. */
  id: PlayerId;
  for: PlayerId;
  from: string;
  /** Our club's choice for the day the injured player is back (the injured player by default). */
  keep?: 'injured' | 'temp';
}

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const seasonEnd = (s: LeagueState) => `${s.year}-10-01`;
const short = (s: LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? id;

export const tempsOf = (s: LeagueState, teamId: TeamId) => (s.tempForeign ?? []).filter((t) => t.teamId === teamId);
export const isTemp = (s: LeagueState, id: PlayerId) => (s.tempForeign ?? []).some((t) => t.id === id);

/** The club's foreign players out long enough for a stand-in and without one. */
export function tempEligible(s: LeagueState, teamId: TeamId): Player[] {
  if (s.phase !== 'regular') return [];
  const covered = new Set(tempsOf(s, teamId).map((t) => t.for));
  return orgPlayers(s, teamId).filter((p) => {
    const inj = s.injuries[p.id];
    return isForeign(p) && !isTemp(s, p.id) && !covered.has(p.id) && !!inj && inj.days >= TEMP_FOREIGN.minDays && daysBetween(today(s), inj.until) >= 14;
  });
}

/** Why a stand-in cannot be signed for `forId` now (null if he can). */
export function tempWindow(s: LeagueState, teamId: TeamId, forId: PlayerId): string | null {
  if (s.phase !== 'regular') return __i18n_k("league.tempforeign.text.bff9d532");
  if (today(s) > `${s.year}-${KBO_2026.foreign.replacementDeadline}`) return __i18n_k("league.tempforeign.text.d457abc2");
  if (!tempEligible(s, teamId).some((p) => p.id === forId)) return __i18n_k("league.tempforeign.text.7b8ea04f");
  return null;
}

/** The stand-ins on offer for an injured player: the same kind (pitcher or hitter) and the same quota. */
export function tempMarket(s: LeagueState, teamId: TeamId, forId: PlayerId): Player[] {
  const injured = s.players[forId];
  if (!injured) return [];
  return Array.from({ length: TEMP_FOREIGN.candidates }, (_, k) => {
    const p = makeForeign(s.seed, `tf${s.year}-${teamId}-${forId}-${k}`, s.year, { kind: isPitcher(injured) ? 'pitcher' : 'hitter', asiaQuota: !!injured.origin.asiaQuota });
    p.status = 'amateur';
    return p;
  });
}

/** What a stand-in costs (US dollars): by the month until the injured player is due back (or the season ends), at
    most $100K a month and never more than his asking price for the same share of a season. */
export function tempPrice(s: LeagueState, p: Player, forId: PlayerId): number {
  const until = s.injuries[forId]?.until ?? seasonEnd(s);
  const end = until < seasonEnd(s) ? until : seasonEnd(s);
  const months = Math.max(1, Math.ceil(daysBetween(today(s), end) / 30));
  const ask = p.origin.background?.ask ?? TEMP_FOREIGN.monthlyUsd * 6;
  return Math.round(Math.min(TEMP_FOREIGN.monthlyUsd, ask / 6) * months / 10_000) * 10_000;
}

export function checkTemp(s: LeagueState, teamId: TeamId, forId: PlayerId, inId: string): string | null {
  const closed = tempWindow(s, teamId, forId);
  if (closed) return closed;
  return tempMarket(s, teamId, forId).some((p) => p.id === inId) ? null : __i18n_k("league.tempforeign.text.170a2e0c");
}

/** Signs a stand-in for an injured foreign player. */
export function signTemp(s: LeagueState, teamId: TeamId, forId: PlayerId, inId: string) {
  if (checkTemp(s, teamId, forId, inId)) return;
  const p = tempMarket(s, teamId, forId).find((x) => x.id === inId)!;
  const injured = s.players[forId]!;
  const price = tempPrice(s, p, forId);
  p.status = 'active';
  p.teamId = teamId;
  p.contract = { ...foreignContract(teamId, s.year, { bonus: 0, salary: price, options: 0 }, !!p.origin.asiaQuota, price), temp: forId };
  s.players[p.id] = p;
  const r = s.rosters[teamId]!;
  r[r.active.length < firstTeamSize(s, teamId) ? 'active' : 'futures'].push(p.id);
  (s.tempForeign ??= []).push({ teamId, id: p.id, for: forId, from: today(s) });
  const text = __i18n_k("league.tempforeign.text.868c4b32", { club: short(s, teamId), injured: injured.name, name: p.name, usd: price.toLocaleString('en-US') });
  logTransaction(s, text);
  if (s.user?.teamId === teamId) (s.user.log ??= []).push({ year: s.year, text });
}

/** Our club's choice for the day the injured player is back. */
export function setTempKeep(s: LeagueState, id: PlayerId, keep: 'injured' | 'temp') {
  const t = (s.tempForeign ?? []).find((x) => x.id === id && x.teamId === s.user?.teamId);
  if (t) t.keep = keep;
}

/** Ends a stand-in's time: one of the two goes. */
function settle(s: LeagueState, t: TempForeign, keepTemp: boolean, seasonOver = false) {
  const temp = s.players[t.id],
    injured = s.players[t.for];
  s.tempForeign = (s.tempForeign ?? []).filter((x) => x !== t);
  if (!temp) return;
  let text: string;
  if (keepTemp && injured && injured.teamId === t.teamId) {
    // The stand-in stays on a regular contract for the rest of the season; the injured player goes (a replacement).
    delete temp.contract?.temp;
    leaveForeign(s, injured);
    removeFrom(s, t.teamId, injured.id);
    countReplacement(s, t.teamId, !!injured.origin.asiaQuota);
    text = __i18n_k("league.tempforeign.text.bc78cf62", { club: short(s, t.teamId), name: wagwa(temp.name), injured: injured.name });
  } else {
    removeFrom(s, t.teamId, temp.id);
    leaveForeign(s, temp);
    text = !seasonOver && injured && injured.teamId === t.teamId ? __i18n_k("league.tempforeign.text.921b34ac", { club: short(s, t.teamId), injured: injured.name, name: temp.name }) : __i18n_k("league.tempforeign.text.a23fff60", { club: short(s, t.teamId), name: temp.name });
  }
  logTransaction(s, text);
  if (s.user?.teamId === t.teamId) {
    (s.user.log ??= []).push({ year: s.year, text });
    addAlert(s, { id: `temp-${t.id}`, date: s.phase === 'regular' ? today(s) : `${s.year}-10-01`, kind: 'move', title: text, lines: [text], players: [t.id, t.for].filter((id) => s.players[id]) });
  }
}

function removeFrom(s: LeagueState, teamId: TeamId, id: PlayerId) {
  const r = s.rosters[teamId];
  if (!r) return;
  for (const k of Object.keys(r) as (keyof typeof r)[]) if (Array.isArray(r[k])) (r[k] as PlayerId[]).splice(0, (r[k] as PlayerId[]).length, ...(r[k] as PlayerId[]).filter((x) => x !== id));
}

/** The day's business: the other clubs sign stand-ins for long injuries; an injured player back (or gone) settles
    his stand-in. */
export function tempForeignDay(s: LeagueState, date: string) {
  for (const t of [...(s.tempForeign ?? [])]) {
    const injured = s.players[t.for];
    const back = !injured || injured.teamId !== t.teamId || !s.injuries[t.for];
    if (!back) continue;
    const mine = t.teamId === s.user?.teamId;
    const temp = s.players[t.id];
    const windowOpen = date <= `${s.year}-${KBO_2026.foreign.replacementDeadline}` && !!injured && (injured.origin.asiaQuota ? replacementsLeft(s, t.teamId).asia : replacementsLeft(s, t.teamId).regular) > 0;
    const better = !!temp && !!injured && temp.scouting.current >= injured.scouting.current + TEMP_FOREIGN.keepMargin;
    settle(s, t, !!injured && injured.teamId === t.teamId && windowOpen && (mine ? t.keep === 'temp' : better));
  }
  const me = s.user?.teamId;
  for (const teamId of firstTeamIds(s)) {
    if (teamId === me) continue;
    for (const p of tempEligible(s, teamId)) {
      if (tempWindow(s, teamId, p.id)) continue;
      const r = rng(`${s.seed}|temp-foreign|${s.year}|${p.id}`);
      if (r() > TEMP_FOREIGN.aiChance) continue;
      const pick = tempMarket(s, teamId, p.id).sort((a, b) => b.scouting.current - a.scouting.current || a.id.localeCompare(b.id))[0];
      if (pick) signTemp(s, teamId, p.id, pick.id);
    }
  }
}

/** The season is over: the stand-ins still standing in leave. */
export function endTemps(s: LeagueState) {
  for (const t of [...(s.tempForeign ?? [])]) settle(s, t, false, true);
}
