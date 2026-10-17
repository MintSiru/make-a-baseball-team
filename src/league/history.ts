/* The league before the player arrives. KBO has had ten clubs since 2015, so the simulated history
   starts there: a quick 20-year bootstrap (development and turnover only, no games) builds the 2015
   rosters, then 2015–2025 are played in full. Records therefore start in 2015; earlier careers exist
   only as ability, service time and salary. Club results before 2026 are fictional. */
import { era, setEra, startYear } from './era';
import { rng } from '../draftroom';
import { SIM_VERSION } from '../core/version';
import type { Player } from '../model/types';
import { existingTeams } from './clubs';
import { LEGACY_ERA, LEGACY_START, legacyTeams } from './legacy1982';
import { estimatedSalary, freeAgentContract } from './contracts';
import { closeSeason, developPlayer, enforceLimits, enlist, leaveLeague, refreshForeigners, retirementChance, runOffseason, runWholeDraft } from './offseason';
import { applyInternational } from './national';
import { playPostseason } from './postseason';
import { currentValue, isForeign } from './players';
import { balanceDepth, changePosition, positionMove } from './positions';
import { driftPotential } from './scouting';
import { playRegularSeason, startSeason } from './season';
import { emptyRoster, orgPlayers, type LeagueState } from './state';

/** The usual calendar; a game started earlier (era.ts) moves both by its shift. */
export const HISTORY_START = 2015;
export const GAME_START = 2026;
const BOOTSTRAP_YEARS = 20;
const historyStart = () => HISTORY_START + era();

function emptyState(seed: string, legacy = false): LeagueState {
  // A game started earlier (era.ts) still has the ten clubs of today from its history's first season: the clubs
  // that joined later in reality (키움, NC, KT) are there from the start of the fictional history. 1.9.5: the 1982
  // legacy start has the six clubs of 1982 under their names then; the others are founded in their years (legacy.ts).
  const teams = legacy
    ? legacyTeams(LEGACY_START)
    : existingTeams().map((t) => (t.firstTeamFrom != null && t.firstTeamFrom > historyStart() ? { ...t, firstTeamFrom: historyStart(), founded: Math.min(t.founded, historyStart() - 2) } : t));
  return {
    sim: SIM_VERSION,
    seed,
    ...(era() ? { era: era() } : {}),
    // 1.9.7: with its state from the start, so the first opening is on the league's timeline.
    ...(legacy ? { historical: true, legacy: { clubs: [] } } : {}),
    year: (legacy ? LEGACY_START : historyStart()) - BOOTSTRAP_YEARS,
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
    driftPotential(p, year, rng(`${s.seed}|potential|${year}|${p.id}`));
    developPlayer(p, year, 0, rng(`${s.seed}|develop|${year}|${p.id}`));
    // Down the defensive spectrum as the glove and legs go (V0.12).
    const to = positionMove(p);
    if (to) changePosition(p, to);
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
  for (const t of s.teams) if (s.rosters[t.id]) balanceDepth(orgPlayers(s, t.id).filter((p) => p.status === 'active'));
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

export function bootstrap(seed: string, legacy = false): LeagueState {
  const s = emptyState(seed, legacy);
  const start = legacy ? LEGACY_START : historyStart();
  while (s.year < start) {
    if (s.year > start - BOOTSTRAP_YEARS) virtualSeason(s);
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

/** A new league, played through 2025, waiting at 2026 opening day (`shift` years earlier for 「백 투 더 패스트」).
    1.9.5, `historical` (the 1982 legacy start): no fictional history, the league of 1982 waiting at its first opening
    day, its era shift keeping the money in today's terms while the rules follow the KBO's own years. */
export function createLeague(seed: string, onYear?: (year: number) => void, shift = 0, historical = false): LeagueState {
  // 1.9.5: the legacy start's shift is its own (the scenario's era, LEGACY_ERA).
  if (shift === LEGACY_ERA) historical = true;
  setEra(historical ? { era: LEGACY_ERA, historical: true } : shift);
  if (historical) {
    const s = bootstrap(seed, true);
    // The clubs history founds later join `s.legacy.clubs` (legacy1982.ts); it also runs the AI clubs' founding steps.
    // 1.9.7: before 1982 there was no KBO draft: the first players came from the amateur and company leagues, with
    // no pick on record (the bootstrap's own drafts are only how the game makes them).
    for (const p of Object.values(s.players)) {
      const o = p.origin;
      if (o.kind !== 'draftClass' || o.draftYear === undefined || o.draftYear >= LEGACY_START) continue;
      o.preLeague = true;
      delete o.overallPick;
      delete o.draftGrade;
      delete o.pickVia;
    }
    if (s.draftLog) s.draftLog = s.draftLog.filter((x) => x.year >= LEGACY_START);
    return s;
  }
  const s = bootstrap(seed);
  while (s.year < startYear()) {
    onYear?.(s.year);
    playFullSeason(s);
  }
  return s;
}

export const activePlayers = (s: LeagueState): Player[] => Object.values(s.players).filter((p) => p.status === 'active' && p.teamId);
