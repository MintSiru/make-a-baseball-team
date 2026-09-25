/* The regular season, one game day at a time: registered days, games, injuries and roster moves. */
import { rng } from '../draftroom';
import type { Player, PlayerId, TeamId } from '../model/types';
import { simulateGame } from './engine/game';
import type { GameOut, TeamBox } from './engine/types';
import { parkFactor } from './clubs';
import { assignSquads, futuresPreference, futuresSquad, makeFuturesLeague } from './futures';
import { chooseActive, teamInput } from './manager';
import { manualReplacements } from './entry';
import { aiForeignChanges, aiTrades, processWaivers } from './trade';
import { INTERNATIONAL } from './international';
import { rosterLimit, selectNationalTeam } from './offseason';
import { currentValue, isForeign, isPitcher } from './players';
import { makeSchedule } from './schedule';
import { addInto, developmentIds, emptyBat, emptyPit, firstTeamIds, registeredIds, type FuturesSeason, type LeagueState, type SeasonLine } from './state';
import { standings } from './standings';
import { ENGINE, FUTURES } from './tuning';

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);

export function startSeason(s: LeagueState) {
  s.phase = 'regular';
  s.schedule = makeSchedule(firstTeamIds(s), s.year, s.seed);
  s.next = 0;
  s.scores = [];
  s.lines = {};
  s.arms = {};
  s.rotation = {};
  s.injuries = {};
  s.away = {};
  s.demoted = {};
  s.waivers = [];
  s.foreignChanges = {};
  s.marketDone = [];
  s.postseason = [];
  s.countedThrough = null;
  for (const id of firstTeamIds(s)) setActive(s, id, chooseActive(s, id));
  s.futures = makeFuturesLeague(s);
  for (const t of s.teams) if (s.rosters[t.id]) assignSquads(s, t.id);
}

// ── Futures league ──────────────────────────────────────────────────────────────────────────────

function playFuturesDay(s: LeagueState, date: string) {
  const f = s.futures;
  if (!f) return;
  const prefer = futuresPreference(s);
  while (f.next < f.schedule.length && f.schedule[f.next]!.date <= date) {
    const g = f.schedule[f.next]!;
    f.next++;
    const home = teamInput(s, g.home, g.date, futuresSquad(s, g.home), `${g.home}:futures`, prefer),
      away = teamInput(s, g.away, g.date, futuresSquad(s, g.away), `${g.away}:futures`, prefer);
    if (!home || !away) continue;
    const out = simulateGame({ gameId: g.id, home, away, maxInnings: ENGINE.maxInnings, park: 1 }, gameRng(s, g.id));
    f.scores.push({ id: g.id, date: g.date, home: g.home, away: g.away, hs: out.home.runs, as: out.away.runs });
    const r = rng(`${s.seed}|injury|${g.id}`);
    for (const box of [out.home, out.away]) {
      record(s, box, g.date, f.lines);
      rollInjuries(s, box, g.date, r, FUTURES.injuryFactor);
    }
  }
}

/** Registers `active` as the first team; players who drop off go to the futures squad. */
function setActive(s: LeagueState, teamId: TeamId, active: PlayerId[]) {
  const r = s.rosters[teamId]!;
  const leaving = r.active.filter((id) => !active.includes(id));
  r.futures = [...r.futures.filter((id) => !active.includes(id)), ...leaving];
  r.third = r.third.filter((id) => !active.includes(id));
  r.active = active;
}

/**
 * From May 1 a development player can be registered (RULES.md §6). AI clubs register the ones who have
 * become as good as the weakest domestic first-team player, while there is room under the limit.
 */
function convertDevelopment(s: LeagueState, teamId: TeamId, date: string) {
  if (date < `${s.year}-05-01` || teamId === s.user?.teamId) return;
  let room = rosterLimit(s.year) - registeredIds(s, teamId).length;
  if (room <= 0) return;
  const firstTeam = s.rosters[teamId]!.active.map((id) => s.players[id]!).filter((p) => !isForeign(p));
  if (!firstTeam.length) return;
  const bar = Math.min(...firstTeam.map(currentValue)) - 2;
  const dev = developmentIds(s, teamId)
    .map((id) => s.players[id]!)
    .filter((p) => !s.injuries[p.id] && currentValue(p) >= bar)
    .sort((a, b) => currentValue(b) - currentValue(a));
  for (const p of dev) {
    if (room-- <= 0) break;
    registerDevelopment(p);
  }
}

/** 육성선수 → 소속선수: the same salary on a regular contract. */
export function registerDevelopment(p: Player) {
  if (p.contract) p.contract.kind = 'standard';
}

function lineOf(s: LeagueState, id: PlayerId, teamId: TeamId): SeasonLine {
  return (s.lines[id] ??= { teamId, days: 0, lost: 0, bat: null, pit: null });
}

/** First-team registered days: every calendar day on the active roster (or the injured list) counts. */
function countDays(s: LeagueState, date: string) {
  const from = s.countedThrough ?? addDays(date, -1);
  const days = daysBetween(from, date);
  if (days <= 0) return;
  for (const teamId of firstTeamIds(s)) for (const id of s.rosters[teamId]!.active) lineOf(s, id, teamId).days += days;
  for (const [id, inj] of Object.entries(s.injuries)) if (inj.onList && s.players[id]?.teamId) lineOf(s, id, s.players[id]!.teamId!).days += days;
  for (const id of Object.keys(s.away)) if (s.players[id]?.teamId) lineOf(s, id, s.players[id]!.teamId!).days += days;
  if (s.futures) for (const t of s.teams) for (const id of s.rosters[t.id]?.third ?? []) s.futures.training[id] = (s.futures.training[id] ?? 0) + days;
  s.countedThrough = date;
}

/** Adds a box score to season lines (`lines`; null records only pitcher rest) and updates rest days. */
function record(s: LeagueState, box: TeamBox, date: string, lines: Record<PlayerId, SeasonLine> | null = s.lines) {
  const lineOf = (id: PlayerId, teamId: TeamId) => (lines ? (lines[id] ??= { teamId, days: 0, lost: 0, bat: null, pit: null }) : null);
  for (const b of box.batting) {
    const line = lineOf(b.id, box.teamId);
    if (!line) continue;
    const bat = (line.bat ??= emptyBat());
    const { id: _id, pos: _pos, ...counts } = b;
    addInto(bat, counts);
    if (b.pa > 0) bat.g++;
  }
  for (const p of box.pitching) {
    const line = lineOf(p.id, box.teamId);
    if (line) {
      const pit = (line.pit ??= emptyPit());
      const { id: _id, ...counts } = p;
      addInto(pit, counts);
      pit.g++;
    }
    const arm = s.arms[p.id];
    const consecutive = arm && daysBetween(arm.lastDate, date) === 1 ? arm.streak + 1 : 1;
    s.arms[p.id] = { lastDate: date, lastPitches: p.pitches, streak: consecutive };
  }
}

/**
 * Per appearance injury chance from the season risk; longer layoffs follow Draft Room's health split.
 * Futures injuries (`factor` < 1) do not go on the first-team injured list.
 */
function rollInjuries(s: LeagueState, box: TeamBox, date: string, r: () => number, factor = 1) {
  const ids = [...box.batting.map((b) => b.id), ...box.pitching.map((p) => p.id)];
  for (const id of ids) {
    const p = s.players[id]!;
    const perGame = isPitcher(p) ? (p.role === 'SP' ? 28 : 55) : 120;
    const age = Math.max(0, Number(date.slice(0, 4)) - Number(p.birthday.slice(0, 4)) - 30);
    const chance = (factor * p.hidden.injuryRisk * (1 + age * 0.06)) / perGame;
    if (r() < chance) {
      const long = r() < 0.22;
      const days = long ? 65 + Math.floor(r() * 66) : 7 + Math.floor(r() * 28);
      s.injuries[id] = { until: addDays(date, days), days, onList: factor === 1 };
      lineOf(s, id, p.teamId!).lost += days;
    }
  }
}

/** Injured players leave the first team; recovered ones come back when they are better than the weakest. */
function maintainRosters(s: LeagueState, date: string, reshuffle: boolean) {
  for (const [id, inj] of Object.entries(s.injuries)) if (inj.until <= date) delete s.injuries[id];
  for (const [id, until] of Object.entries(s.away)) if (until < date) delete s.away[id];
  const manual = s.user?.entry === 'manual' ? s.user.teamId : null;
  for (const teamId of firstTeamIds(s)) {
    const r = s.rosters[teamId]!;
    const hurt = r.active.some((id) => s.injuries[id] || s.away[id]);
    if (teamId === manual) {
      // The general manager's roster stands; only players who cannot play are replaced.
      if (hurt) {
        const ideal = chooseActive(s, teamId);
        manualReplacements(s, (candidates) => ideal.find((id) => candidates.includes(id)) ?? candidates[0]);
      }
      continue;
    }
    if (reshuffle) convertDevelopment(s, teamId, date);
    if (hurt || reshuffle) setActive(s, teamId, chooseActive(s, teamId));
  }
  if (reshuffle) for (const t of s.teams) if (s.rosters[t.id] && t.id !== manual) assignSquads(s, t.id);
}

function gameRng(s: LeagueState, id: string) {
  return rng(`${s.seed}|game|${id}`);
}

export function playGame(s: LeagueState, homeId: TeamId, awayId: TeamId, id: string, date: string, maxInnings: number | null): GameOut | null {
  const home = teamInput(s, homeId, date),
    away = teamInput(s, awayId, date);
  if (!home || !away) return null;
  return simulateGame({ gameId: id, home, away, maxInnings, park: parkFactor(homeId) }, gameRng(s, id));
}

/** Plays every game on the next date. Returns false when the regular season is over. */
export function playDay(s: LeagueState): boolean {
  if (s.phase !== 'regular' || s.next >= s.schedule.length) return false;
  const date = s.schedule[s.next]!.date;
  countDays(s, date);
  returnFromService(s, date);
  nationalTeamLeaves(s, date);
  processWaivers(s, date);
  marketEvents(s, date);
  const day = s.next;
  while (s.next < s.schedule.length && s.schedule[s.next]!.date === date) {
    const g = s.schedule[s.next]!;
    const out = playGame(s, g.home, g.away, g.id, date, ENGINE.maxInnings);
    s.next++;
    if (!out) continue;
    record(s, out.home, date);
    record(s, out.away, date);
    s.scores.push({ id: g.id, date, home: g.home, away: g.away, hs: out.home.runs, as: out.away.runs });
    const r = rng(`${s.seed}|injury|${g.id}`);
    rollInjuries(s, out.home, date, r);
    rollInjuries(s, out.away, date, r);
  }
  playFuturesDay(s, date);
  // Every ten game days the manager looks at the whole roster again; otherwise only injuries force moves.
  maintainRosters(s, date, day > 0 && Math.floor(s.next / (firstTeamIds(s).length / 2)) % 10 === 0);
  return s.next < s.schedule.length;
}

/** AI clubs' own moves: a round of trades in mid-June, foreign replacements in July. */
function marketEvents(s: LeagueState, date: string) {
  const once = (key: string, from: string, run: () => void) => {
    const id = `${s.year}-${key}`;
    if (date < `${s.year}-${from}` || s.marketDone?.includes(id)) return;
    (s.marketDone ??= []).push(id);
    run();
  };
  once('trades', '06-15', () => aiTrades(s, rng(`${s.seed}|ai-trades|${s.year}`)));
  once('foreign', '07-01', () => aiForeignChanges(s, date, rng(`${s.seed}|ai-foreign|${s.year}`)));
}

/** An in-season national team leaves its clubs on its date; clubs call up replacements (maintainRosters). */
function nationalTeamLeaves(s: LeagueState, date: string) {
  const event = INTERNATIONAL.find((e) => e.year === s.year && e.dates);
  if (!event?.dates || date < event.dates.from || s.international.some((e) => e.year === s.year)) return;
  const entry = selectNationalTeam(s, s.year);
  if (!entry) return;
  for (const id of entry.squad) if (s.players[id]?.status === 'active') s.away[id] = event.dates.to;
  maintainRosters(s, date, false);
}

/** Soldiers discharged during the season rejoin their club's futures roster. */
function returnFromService(s: LeagueState, date: string) {
  for (const p of Object.values(s.players)) {
    if (p.status === 'military' && p.service.returnsOn && p.service.returnsOn <= date) {
      p.status = 'active';
      p.service.military = 'served';
      delete p.service.route;
      delete p.service.returnsOn;
      if (p.teamId) s.rosters[p.teamId]!.futures.push(p.id);
    }
  }
}

export function playRegularSeason(s: LeagueState) {
  while (playDay(s));
}

export const currentStandings = (s: LeagueState) => standings(firstTeamIds(s), s.scores);

