import { k as __i18n_k } from '../i18n/index';
/* The postseason entry (1.9.0, from the 1.9 plan): before each series a club hands in thirty players (KBO since 2017:
   30 registered, 28 in uniform each game; the game lets all thirty play, as the regular season lets the whole first
   team play). Only players registered with the club by July 31 may be in it, foreign players by August 15 (S83): the
   league notes who they were on those days. The entry becomes the club's first team for the series; when the
   postseason is over each club gets its regular-season first team back. The user's club chooses its own before each
   series (a decision, unless the stop for it is off), the others the manager's way. */
import type { PlayerId, TeamId } from '../model/types';
import { KBO_2026 } from '../rules/kbo2026';
import { offRoster } from './injuries';
import { chooseActive } from './manager';
import { isForeign, isPitcher } from './players';
import { registeredIds, type Decision, type LeagueState, type SeriesResult } from './state';
import { stopsOf } from './stops';

export const ENTRY = KBO_2026.league.postseasonEntry;
/** Pitchers in an entry the manager's way (KBO postseason entries carry 13–15). */
const ENTRY_PITCHERS = 14;
/** The fewest a user's entry may have, and the hitters and pitchers a game needs. */
export const ENTRY_MIN = { players: 26, hitters: 10, pitchers: 9 };

export interface PostEntryState {
  year: number;
  /** Registered players (foreign players apart) on July 31, and foreign players on August 15, by club. */
  domestic?: Record<TeamId, PlayerId[]>;
  foreign?: Record<TeamId, PlayerId[]>;
  /** Each club's regular-season first team, given back after the postseason. */
  before?: Record<TeamId, PlayerId[]>;
  /** The round each club's entry is for. */
  round?: Record<TeamId, SeriesResult['round']>;
}

const stateOf = (s: LeagueState): PostEntryState => (s.postEntry?.year === s.year ? s.postEntry : (s.postEntry = { year: s.year }));

/** At the end of a regular-season day: the registered players once the deadline has passed. */
export function noteEligibility(s: LeagueState) {
  if (s.phase !== 'regular') return;
  const next = s.schedule[s.next]?.date ?? `${s.year}-12-31`;
  const late = next > `${s.year}-${ENTRY.deadline}`,
    lateForeign = next > `${s.year}-${ENTRY.foreignDeadline}`;
  if (!late) return;
  const e = stateOf(s);
  const clubs = s.teams.filter((t) => s.rosters[t.id]).map((t) => t.id);
  const snap = (foreign: boolean) => Object.fromEntries(clubs.map((id) => [id, registeredIds(s, id).filter((p) => isForeign(s.players[p]!) === foreign)]));
  e.domestic ??= snap(false);
  if (lateForeign) e.foreign ??= snap(true);
}

/** Why a registered player cannot be in the club's entry, or null. A league without the lists (a save from before
    1.9.0, or a season that never reached the deadline) lets everyone in. */
export function entryProblem(s: LeagueState, teamId: TeamId, id: PlayerId): 'late' | 'out' | null {
  const p = s.players[id]!;
  const e = s.postEntry?.year === s.year ? s.postEntry : undefined;
  const list = (isForeign(p) ? e?.foreign : e?.domestic)?.[teamId];
  if (list && !list.includes(id)) return 'late';
  if (p.status !== 'active' || offRoster(s, id)) return 'out';
  return null;
}

/** The players a club may put in its entry. */
export const entryCandidates = (s: LeagueState, teamId: TeamId) => registeredIds(s, teamId).filter((id) => !entryProblem(s, teamId, id));

/** The manager's entry: the first team's shape, thirty strong, from the eligible players. */
export const chooseEntry = (s: LeagueState, teamId: TeamId) => chooseActive(s, teamId, { size: ENTRY.registered, pitchers: ENTRY_PITCHERS, from: entryCandidates(s, teamId) });

/** What the scouts suggest for the user's club: the general manager's first team as it stands (the eligible ones),
    filled up to thirty the manager's way. */
export function suggestedEntry(s: LeagueState, teamId: TeamId): PlayerId[] {
  const ok = new Set(entryCandidates(s, teamId));
  const keep = (stateOf(s).before?.[teamId] ?? s.rosters[teamId]!.active).filter((id) => ok.has(id));
  const out = [...keep];
  for (const id of chooseEntry(s, teamId)) if (out.length < ENTRY.registered && !out.includes(id)) out.push(id);
  return out;
}

/** Why an entry the user hands in does not stand, or null. */
export function checkEntry(s: LeagueState, teamId: TeamId, ids: PlayerId[]): string | null {
  const ok = new Set(entryCandidates(s, teamId));
  if (new Set(ids).size !== ids.length || ids.some((id) => !ok.has(id))) return __i18n_k("league.postentry.text.6fa5ccf1");
  if (ids.length > ENTRY.registered) return __i18n_k("league.postentry.text.51d475e7", { max: ENTRY.registered });
  if (ids.length < ENTRY_MIN.players) return __i18n_k("league.postentry.text.1716fc61", { min: ENTRY_MIN.players });
  const pitchers = ids.filter((id) => isPitcher(s.players[id]!)).length;
  if (pitchers < ENTRY_MIN.pitchers || ids.length - pitchers < ENTRY_MIN.hitters) return __i18n_k("league.postentry.text.19606fb4", { pitchers: ENTRY_MIN.pitchers, hitters: ENTRY_MIN.hitters });
  return null;
}

/** Registers `ids` as the club's first team for the series (the regular-season one kept to give back). */
export function applyEntry(s: LeagueState, teamId: TeamId, ids: PlayerId[], round: SeriesResult['round']) {
  const e = stateOf(s);
  const r = s.rosters[teamId]!;
  (e.before ??= {})[teamId] ??= [...r.active];
  (e.round ??= {})[teamId] = round;
  const leaving = r.active.filter((id) => !ids.includes(id));
  r.futures = [...r.futures.filter((id) => !ids.includes(id)), ...leaving];
  r.third = r.third.filter((id) => !ids.includes(id));
  r.active = [...ids];
}

/** The entry decision for the user's club before a series. */
export function entryDecision(s: LeagueState, round: SeriesResult['round'], opp: TeamId): Decision {
  const teamId = s.user!.teamId;
  const candidates = entryCandidates(s, teamId);
  const late = registeredIds(s, teamId).filter((id) => entryProblem(s, teamId, id) === 'late');
  return { kind: 'postEntry', round, opp, candidates, late, size: ENTRY.registered, suggested: suggestedEntry(s, teamId) };
}

/** A new round's series: every club in them hands in its entry (the user's club through a decision with `stops`). */
export function openEntries(s: LeagueState, series: { round: SeriesResult['round']; high: TeamId; low: TeamId }[], stops: boolean) {
  const me = s.user?.teamId;
  for (const x of series)
    for (const [teamId, opp] of [
      [x.high, x.low],
      [x.low, x.high],
    ] as const) {
      if (!s.rosters[teamId] || stateOf(s).round?.[teamId] === x.round) continue;
      if (teamId !== me) applyEntry(s, teamId, chooseEntry(s, teamId), x.round);
      else if (stops && stopsOf(s).includes('postEntry') && !s.pending) s.pending = entryDecision(s, x.round, opp);
      else applyEntry(s, teamId, suggestedEntry(s, teamId), x.round);
    }
}

/** The user's entry decision still open when the postseason is played through: the suggestion stands. */
export function settleOurEntry(s: LeagueState) {
  const d = s.pending;
  if (d?.kind !== 'postEntry' || !s.user) return;
  s.pending = null;
  applyEntry(s, s.user.teamId, d.suggested.filter((id) => !entryProblem(s, s.user!.teamId, id)), d.round);
}

/** The postseason is over: each club gets its regular-season first team back (those still with it). */
export function restoreFirstTeams(s: LeagueState) {
  const e = s.postEntry;
  if (!e?.before) return;
  for (const [teamId, ids] of Object.entries(e.before)) {
    const r = s.rosters[teamId];
    if (!r) continue;
    const back = ids.filter((id) => r.active.includes(id) || r.futures.includes(id) || r.third.includes(id));
    const leaving = r.active.filter((id) => !back.includes(id));
    r.futures = [...r.futures.filter((id) => !back.includes(id)), ...leaving];
    r.third = r.third.filter((id) => !back.includes(id));
    r.active = back;
  }
  delete e.before;
}
