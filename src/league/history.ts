/* The league before the player arrives. KBO has had ten clubs since 2015, so the simulated history
   starts there: a quick 20-year bootstrap (development and turnover only, no games) builds the 2015
   rosters, then 2015–2025 are played in full. Records therefore start in 2015; earlier careers exist
   only as ability, service time and salary. Club results before 2026 are fictional. */
import { rng } from '../draftroom';
import { SIM_VERSION } from '../core/version';
import type { Player } from '../model/types';
import { existingTeams } from './clubs';
import { estimatedSalary, freeAgentContract } from './contracts';
import { applyInternational, closeSeason, developPlayer, enforceLimits, enlist, leaveLeague, refreshForeigners, retirementChance, runOffseason, runWholeDraft } from './offseason';
import { playPostseason } from './postseason';
import { currentValue, isForeign } from './players';
import { playRegularSeason, startSeason } from './season';
import { emptyRoster, orgPlayers, type LeagueState } from './state';

export const HISTORY_START = 2015;
export const GAME_START = 2026;
const BOOTSTRAP_YEARS = 20;

function emptyState(seed: string): LeagueState {
  const teams = existingTeams();
  return {
    sim: SIM_VERSION,
    seed,
    year: HISTORY_START - BOOTSTRAP_YEARS,
    phase: 'offseason',
    teams,
    players: {},
    rosters: Object.fromEntries(teams.map((t) => [t.id, emptyRoster()])),
    schedule: [],
    next: 0,
    scores: [],
    lines: {},
    arms: {},
    rotation: {},
    injuries: {},
    away: {},
    countedThrough: null,
    postseason: [],
    history: [],
    international: [],
    user: null,
    pending: null,
    offseason: null,
    futures: null,
  };
}

const orgOf = orgPlayers;

/** One season without games: the best 28 of each club are credited first-team time. */
function virtualSeason(s: LeagueState) {
  for (const t of s.teams) {
    const org = orgOf(s, t.id).sort((a, b) => currentValue(b) - currentValue(a));
    org.forEach((p, i) => {
      if (i < 20) p.service.creditedSeasons++;
      else if (i < 30) p.service.carriedDays += 70;
      if (p.service.carriedDays >= 145) {
        p.service.carriedDays -= 145;
        p.service.creditedSeasons++;
      }
    });
  }
}

function fastOffseason(s: LeagueState) {
  const year = s.year,
    next = year + 1;
  applyInternational(s, year);
  for (const p of Object.values(s.players)) {
    if (p.status !== 'active' && p.status !== 'military') continue;
    if (p.proSince > year) continue;
    developPlayer(p, year, 0, rng(`${s.seed}|develop|${year}|${p.id}`));
  }
  const r = rng(`${s.seed}|bootstrap|${year}`);
  for (const p of Object.values(s.players)) {
    if (p.status === 'military' && p.service.returnsOn && Number(p.service.returnsOn.slice(0, 4)) <= next) {
      p.status = 'active';
      p.service.military = 'served';
      delete p.service.route;
      delete p.service.returnsOn;
      if (p.teamId) s.rosters[p.teamId]!.futures.push(p.id);
    }
  }
  for (const p of Object.values(s.players)) {
    if (p.status !== 'active') continue;
    if (r() < retirementChance(p, next, false)) leaveLeague(s, p, 'retired');
    else if (p.service.military === 'pending' && p.teamId) enlist(s, p, next, r);
  }
  const order = s.teams.map((t) => t.id).sort(() => r() - 0.5);
  runWholeDraft(s, year, order);
  enforceLimits(s, next, r);
  s.year = next;
}

/** Veterans entering the simulated era get salaries (and long deals for established stars) from their grades. */
function bootstrapContracts(s: LeagueState) {
  const r = rng(`${s.seed}|bootstrap-contracts`);
  for (const p of Object.values(s.players)) {
    if (p.status === 'retired' || !p.teamId || isForeign(p)) continue;
    const star = p.service.creditedSeasons >= 8 && p.scouting.current >= 55;
    if (star) {
      p.contract = freeAgentContract(p, p.teamId, s.year - Math.floor(r() * 3));
      p.contract.salaries = p.contract.salaries.map((x) => ({ ...x, amount: estimatedSalary(p, s.year) }));
      p.service.lastFreeAgencyAt = p.service.creditedSeasons - Math.floor(r() * 3);
    } else if (p.contract) {
      p.contract.salaries = [{ season: s.year, amount: Math.max(estimatedSalary(p, s.year), p.contract.salaries.at(-1)?.amount ?? 0) }];
    }
  }
}

export function bootstrap(seed: string): LeagueState {
  const s = emptyState(seed);
  while (s.year < HISTORY_START) {
    if (s.year > HISTORY_START - BOOTSTRAP_YEARS) virtualSeason(s);
    fastOffseason(s);
  }
  bootstrapContracts(s);
  refreshForeigners(s, s.year, rng(`${seed}|foreign|bootstrap`));
  startSeason(s);
  return s;
}

/** Regular season, postseason, closing the books, offseason, next opening day. */
export function playFullSeason(s: LeagueState) {
  playRegularSeason(s);
  playPostseason(s);
  closeSeason(s);
  runOffseason(s);
  startSeason(s);
}

/** A new league, played through 2025, waiting at 2026 opening day. */
export function createLeague(seed: string, onYear?: (year: number) => void): LeagueState {
  const s = bootstrap(seed);
  while (s.year < GAME_START) {
    onYear?.(s.year);
    playFullSeason(s);
  }
  return s;
}

export const activePlayers = (s: LeagueState): Player[] => Object.values(s.players).filter((p) => p.status === 'active' && p.teamId);
