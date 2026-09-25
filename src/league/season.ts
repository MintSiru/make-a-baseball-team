/* The regular season, one game day at a time: registered days, games, injuries and roster moves. */
import { rng } from '../draftroom';
import type { PlayerId, TeamId } from '../model/types';
import { simulateGame } from './engine/game';
import type { GameOut, TeamBox } from './engine/types';
import { parkFactor } from './clubs';
import { chooseActive, teamInput } from './manager';
import { isPitcher } from './players';
import { makeSchedule } from './schedule';
import { addInto, emptyBat, emptyPit, type LeagueState, type SeasonLine } from './state';
import { standings } from './standings';
import { ENGINE } from './tuning';

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);

export function startSeason(s: LeagueState) {
  s.phase = 'regular';
  s.schedule = makeSchedule(
    s.teams.map((t) => t.id),
    s.year,
    s.seed,
  );
  s.next = 0;
  s.scores = [];
  s.lines = {};
  s.arms = {};
  s.rotation = {};
  s.injuries = {};
  s.postseason = [];
  s.countedThrough = null;
  for (const t of s.teams) setActive(s, t.id, chooseActive(s, t.id));
}

function setActive(s: LeagueState, teamId: TeamId, active: PlayerId[]) {
  const r = s.rosters[teamId]!;
  const all = [...r.active, ...r.futures];
  r.active = active;
  r.futures = all.filter((id) => !active.includes(id));
}

function lineOf(s: LeagueState, id: PlayerId, teamId: TeamId): SeasonLine {
  return (s.lines[id] ??= { teamId, days: 0, lost: 0, bat: null, pit: null });
}

/** First-team registered days: every calendar day on the active roster (or the injured list) counts. */
function countDays(s: LeagueState, date: string) {
  const from = s.countedThrough ?? addDays(date, -1);
  const days = daysBetween(from, date);
  if (days <= 0) return;
  for (const t of s.teams) for (const id of s.rosters[t.id]!.active) lineOf(s, id, t.id).days += days;
  for (const [id, inj] of Object.entries(s.injuries)) if (inj.onList) lineOf(s, id, s.players[id]!.teamId!).days += days;
  s.countedThrough = date;
}

function record(s: LeagueState, box: TeamBox, date: string) {
  for (const b of box.batting) {
    const line = lineOf(s, b.id, box.teamId);
    const bat = (line.bat ??= emptyBat());
    const { id: _id, pos: _pos, ...counts } = b;
    addInto(bat, counts);
    if (b.pa > 0) bat.g++;
  }
  for (const p of box.pitching) {
    const line = lineOf(s, p.id, box.teamId);
    const pit = (line.pit ??= emptyPit());
    const { id: _id, ...counts } = p;
    addInto(pit, counts);
    pit.g++;
    const arm = s.arms[p.id];
    const consecutive = arm && daysBetween(arm.lastDate, date) === 1 ? arm.streak + 1 : 1;
    s.arms[p.id] = { lastDate: date, lastPitches: p.pitches, streak: consecutive };
  }
}

/** Per appearance injury chance from the season risk; longer layoffs follow Draft Room's health split. */
function rollInjuries(s: LeagueState, box: TeamBox, date: string, r: () => number) {
  const ids = [...box.batting.map((b) => b.id), ...box.pitching.map((p) => p.id)];
  for (const id of ids) {
    const p = s.players[id]!;
    const perGame = isPitcher(p) ? (p.role === 'SP' ? 28 : 55) : 120;
    const age = Math.max(0, Number(date.slice(0, 4)) - Number(p.birthday.slice(0, 4)) - 30);
    const chance = (p.hidden.injuryRisk * (1 + age * 0.06)) / perGame;
    if (r() < chance) {
      const long = r() < 0.22;
      const days = long ? 65 + Math.floor(r() * 66) : 7 + Math.floor(r() * 28);
      s.injuries[id] = { until: addDays(date, days), days, onList: true };
      lineOf(s, id, p.teamId!).lost += days;
    }
  }
}

/** Injured players leave the first team; recovered ones come back when they are better than the weakest. */
function maintainRosters(s: LeagueState, date: string, reshuffle: boolean) {
  for (const [id, inj] of Object.entries(s.injuries)) if (inj.until <= date) delete s.injuries[id];
  for (const t of s.teams) {
    const r = s.rosters[t.id]!;
    const hurt = r.active.some((id) => s.injuries[id]);
    if (hurt || reshuffle) setActive(s, t.id, chooseActive(s, t.id));
  }
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
  // Every ten game days the manager looks at the whole roster again; otherwise only injuries force moves.
  maintainRosters(s, date, day > 0 && Math.floor(s.next / (s.teams.length / 2)) % 10 === 0);
  return s.next < s.schedule.length;
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

export const currentStandings = (s: LeagueState) =>
  standings(
    s.teams.map((t) => t.id),
    s.scores,
  );

