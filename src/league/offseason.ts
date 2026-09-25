/* Between seasons: close the books, then age every player a year and rebuild the rosters.

   Order (fixed; each step has its own random stream): close season, then OFFSEASON_STEPS —
   national-team exemptions → development → retirement → military service → free agency → salaries →
   rookie draft → (expansion special draft) → roster limits → released players → foreign players.
   The user's club can make the game wait at a step for a decision (see OffseasonHooks). */
import { observe, overall, rng, toGrade, type Tools } from '../draftroom';
import DraftSeason from '../draftroom/season.js';
import type { Player, PlayerId, SeasonRecord, TeamId } from '../model/types';
import { KBO_2026, salaryCapFor } from '../rules/kbo2026';
import { foreignContract, freeAgentContract, MANWON_PER_USD, renewSalary, rookieContract, salaryIn, slotBonus } from './contracts';
import { INTERNATIONAL } from './international';
import { foreignSlots } from './manager';
import { champion } from './postseason';
import { ageIn, currentValue, draftClass, futureValue, isForeign, isPitcher, keepValue, makeForeign } from './players';
import { currentStandings } from './season';
import { addInto, emptyBat, emptyPit, firstTeamIds, type Decision, type DraftSlot, type DraftState, type LeagueState, type SeasonSummary } from './state';
import { batterWar, leagueContext, pitcherWar } from './stats';
import { OFFSEASON as O } from './tuning';

type Develop = (p: object, tools: Tools, yearIndex: number, age: number, daysLost: number, r: () => number) => Tools;
const developTools = (DraftSeason as unknown as { developTools: Develop }).developTools;
const normal = (r: () => number) => (r() + r() + r() - 1.5) / 1.5;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

export const rosterLimit = (season: number) => (season >= 2026 ? KBO_2026.league.rosterLimit : 65);

/** Moves finished-season lines into careers, credits service days and stores the season summary. */
export function closeSeason(s: LeagueState) {
  const bat = emptyBat(),
    pit = emptyPit();
  for (const line of Object.values(s.lines)) {
    if (line.bat) addInto(bat, line.bat);
    if (line.pit) addInto(pit, line.pit);
  }
  const lg = leagueContext(bat, pit);
  for (const [id, line] of Object.entries(s.lines)) {
    const p = s.players[id];
    if (!p) continue;
    const war = (line.bat ? batterWar(line.bat, p.position ?? 'DH', lg) : 0) + (line.pit ? pitcherWar(line.pit, lg) : 0);
    const rec: SeasonRecord = { year: s.year, teamId: line.teamId, age: ageIn(p, s.year), days: line.days, bat: line.bat, pit: line.pit, war: Math.round(war * 10) / 10 };
    if (line.bat || line.pit || line.days) p.career.push(rec);
    p.service.carriedDays += line.days;
    while (p.service.carriedDays >= KBO_2026.freeAgency.daysPerSeason) {
      p.service.carriedDays -= KBO_2026.freeAgency.daysPerSeason;
      p.service.creditedSeasons++;
    }
  }
  let userFutures: SeasonSummary['userFutures'];
  if (s.futures && s.user) {
    for (const [id, line] of Object.entries(s.futures.lines)) {
      const p = s.players[id];
      if (p) p.career.push({ year: s.year, teamId: line.teamId, level: 'futures', age: ageIn(p, s.year), days: 0, bat: line.bat, pit: line.pit, war: 0 });
    }
    const me = s.user.teamId;
    userFutures = { w: 0, l: 0, t: 0, rs: 0, ra: 0 };
    for (const g of s.futures.scores) {
      const [mine, theirs] = g.home === me ? [g.hs, g.as] : [g.as, g.hs];
      userFutures.rs += mine;
      userFutures.ra += theirs;
      if (mine > theirs) userFutures.w++;
      else if (mine < theirs) userFutures.l++;
      else userFutures.t++;
    }
    s.futures = null;
  }
  s.history.push({ year: s.year, table: currentStandings(s), series: s.postseason, champion: champion(s), totals: { bat, pit, games: s.scores.length }, ...(userFutures ? { userFutures } : {}) });
  s.phase = 'offseason';
}

const lastRecord = (p: Player, year: number) => p.career.find((r) => r.year === year && !r.level);

// ── Development ──────────────────────────────────────────────────────────────────────────────────

/** One year of growth and aging on hidden ability, then a fresh public scouting report. */
export function developPlayer(p: Player, year: number, lostDays: number, r: () => number) {
  const age = ageIn(p, year);
  const yearIndex = Math.max(0, year - p.proSince);
  const h = p.hidden;
  let next: Tools;
  const route = p.status === 'military' ? p.service.route : undefined;
  if (route === 'army' || route === 'social') {
    const [base, span] = route === 'army' ? O.serviceDecline.army : O.serviceDecline.social;
    next = Object.fromEntries(
      Object.entries(h.current).map(([k, v]) => [k, clamp(v! - (base + r() * span) * (k === 'stuff' || k === 'speed' ? 1.35 : 1), 20, 80)]),
    ) as Tools;
  } else if (isForeign(p)) {
    next = { ...h.current };
  } else {
    next = developTools({ potentialTools: h.potential, growthCurve: h.growthCurve, developmentRate: h.developmentRate }, h.current, yearIndex, age, lostDays, r);
  }
  // Late-career decline on top of Draft Room's aging (which was tuned for players under 33).
  const V = O.veteranDecline;
  const extra = Math.max(0, age - V.from) * V.perYear + Math.max(0, age - V.steepFrom) * V.steepPerYear;
  if (extra > 0)
    for (const k of Object.keys(next) as (keyof Tools)[]) {
      const f = k === 'speed' ? V.speed : k === 'command' || k === 'eye' ? V.skill : 1;
      next[k] = clamp(next[k]! - extra * f + normal(r) * 0.6, 20, 80);
    }
  h.current = next;
  rescout(p, year + 1, yearIndex + 1, r);
}

/** A new public report: current grades through Draft Room's observer, future value from reachable potential. */
export function rescout(p: Player, season: number, yearIndex: number, r: () => number) {
  const role = p.role;
  const seen = observe(p.hidden.current, role, { observerBias: p.hidden.observerBias }, yearIndex, r);
  const age = ageIn(p, season);
  const room = clamp((O.scouting.matureAge + (p.hidden.growthCurve === 'late' ? 2 : 0) - age) / O.scouting.window, 0, 1) * Math.min(1, p.hidden.developmentRate);
  const bias = p.hidden.observerBias / (1 + yearIndex);
  const future: Tools = {};
  for (const [k, v] of Object.entries(p.hidden.current) as [keyof Tools, number][]) {
    const pot = p.hidden.potential[k] ?? v;
    future[k] = toGrade(v + Math.max(0, pot - v) * room + bias + normal(r) * 2);
  }
  const fv = Math.max(seen.ready, toGrade(overall(future, role)));
  Object.assign(p.scouting, {
    season,
    tools: seen.tools,
    futureTools: future,
    current: seen.ready,
    futureValue: fv,
    floor: Math.max(20, seen.ready - (age <= 24 ? 5 : 0)),
    ceiling: Math.max(fv, toGrade(fv + (age <= 24 ? 5 : 0))),
    uncertainty: yearIndex <= 1 ? '높음' : yearIndex <= 4 ? '보통' : '낮음',
  });
}

// ── Leaving the league ───────────────────────────────────────────────────────────────────────────

function removeFromRoster(s: LeagueState, p: Player) {
  if (!p.teamId) return;
  const r = s.rosters[p.teamId];
  if (r) {
    r.active = r.active.filter((id) => id !== p.id);
    r.futures = r.futures.filter((id) => id !== p.id);
  }
}

/** Retire or drop a player. Players who never reached the first team are forgotten to keep saves small. */
export function leaveLeague(s: LeagueState, p: Player, status: 'retired' | 'overseas') {
  removeFromRoster(s, p);
  p.teamId = null;
  p.contract = null;
  p.status = status;
  if (!p.career.length) delete s.players[p.id];
}

export function retirementChance(p: Player, season: number, knownRecords = true): number {
  const age = ageIn(p, season);
  const R = O.retirement;
  let base = age >= 41 ? 0.95 : age >= R.from ? R.byAge[Math.min(age - R.from, R.byAge.length - 1)]! : 0;
  const cur = p.scouting.current;
  if (cur >= 55) base *= 0.45;
  else if (cur < 45) base *= 1.8;
  const last = lastRecord(p, season - 1);
  if (knownRecords && (!last || last.days === 0)) base *= 1.6;
  return clamp(base, 0, 0.97);
}

// ── Military service and national teams ─────────────────────────────────────────────────────────

export function applyInternational(s: LeagueState, year: number) {
  const event = INTERNATIONAL.find((e) => e.year === year);
  if (!event) return;
  const r = rng(`${s.seed}|international|${year}`);
  const pool = Object.values(s.players).filter((p) => (p.status === 'active' || p.status === 'military') && p.teamId && !isForeign(p));
  const age = (p: Player) => year - Number(p.birthday.slice(0, 4));
  const byGrade = (a: Player, b: Player) => b.scouting.current - a.scouting.current;
  const L = event.limit;
  const squad = L
    ? pool.filter((p) => age(p) <= L.maxAge || year - p.proSince < L.maxProYears).sort(byGrade).slice(0, event.squad - L.wildcards)
    : pool.sort(byGrade).slice(0, event.squad);
  if (L) squad.push(...pool.filter((p) => !squad.includes(p) && age(p) <= L.wildcardMaxAge).sort(byGrade).slice(0, L.wildcards));
  const medal = event.result ? event.result === 'medal' : r() < event.medalChance;
  s.international.push({ year, name: event.name, medal, squad: squad.map((p) => p.id) });
  if (!medal) return;
  for (const p of squad) {
    if (p.service.military === 'pending' || p.service.military === 'serving') {
      if (p.status === 'military') {
        p.status = 'active';
        if (p.teamId) s.rosters[p.teamId]!.futures.push(p.id);
      }
      p.service.military = 'exempt';
      delete p.service.route;
      delete p.service.returnsOn;
    }
  }
}

export function enlist(s: LeagueState, p: Player, next: number, r: () => number) {
  const M = O.military;
  const age = ageIn(p, next);
  const last = lastRecord(p, next - 1);
  const must = age >= M.mustAge;
  if (!must) {
    if (age < M.minAge) return;
    const days = last?.days ?? 0;
    const lost = s.lines[p.id]?.lost ?? 0;
    const route = lost >= 105 ? 'rehab' : days >= 120 && (last?.war ?? 0) >= 1.5 ? 'regular' : days >= 60 ? 'backup' : days > 0 ? 'cameo' : 'futures';
    const factor = M.byAge.find(([maxAge]) => age <= maxAge)?.[1] ?? M.byAge[M.byAge.length - 1]![1];
    // Clubs hold back likely picks when Asian Games are this season or next.
    const games = INTERNATIONAL.find((e) => (e.year === next || e.year === next + 1) && e.kind === 'asianGames');
    if (games && p.scouting.current >= M.holdForGames && age <= (games.limit?.maxAge ?? 99)) return;
    if (r() >= Math.min(0.95, (M.byRoute[route] ?? 0.2) * factor)) return;
  }
  const grade = p.scouting.current;
  const played = p.career.some((c) => c.days > 0);
  const sangmu = age <= M.sangmu.maxAge && grade >= M.sangmu.minGrade ? clamp((grade - M.sangmu.minGrade) * M.sangmu.perGrade + (played ? M.sangmu.playedBonus : 0), M.sangmu.min, M.sangmu.max) : 0;
  const lost = s.lines[p.id]?.lost ?? 0;
  const route = r() < sangmu ? 'sangmu' : r() < Math.min(0.4, M.socialBase + lost * 0.0012) ? 'social' : 'army';
  removeFromRoster(s, p);
  p.status = 'military';
  p.service.military = 'serving';
  p.service.route = route;
  p.service.returnsOn = route === 'social' ? `${next + 1}-09-15` : `${next + 1}-06-15`;
}

// ── Free agency and salaries ─────────────────────────────────────────────────────────────────────

const faSeasonsNeeded = (p: Player) => (p.origin.entryCategory === 'college' ? KBO_2026.freeAgency.seasonsCollege : KBO_2026.freeAgency.seasonsHighSchool);

function isFreeAgent(p: Player, next: number) {
  if (isForeign(p) || p.status !== 'active' || !p.teamId) return false;
  if (p.contract && p.contract.salaries.some((x) => x.season >= next)) return false;
  const s = p.service;
  return s.lastFreeAgencyAt === undefined ? s.creditedSeasons >= faSeasonsNeeded(p) : s.creditedSeasons - s.lastFreeAgencyAt >= KBO_2026.freeAgency.seasonsToRequalify;
}

export function payroll(s: LeagueState, teamId: TeamId, season: number) {
  return [...s.rosters[teamId]!.active, ...s.rosters[teamId]!.futures].reduce((sum, id) => sum + salaryIn(s.players[id]!, season), 0);
}

/** Players who reach free agency this winter and have a market (the rest re-sign as usual). */
export function freeAgentsFor(s: LeagueState, next: number): Player[] {
  return Object.values(s.players)
    .filter((p) => isFreeAgent(p, next))
    .filter((p) => p.scouting.current >= O.freeAgency.minGrade || (lastRecord(p, next - 1)?.war ?? 0) >= 1)
    .sort((a, b) => b.scouting.current - a.scouting.current);
}

export function signFreeAgent(s: LeagueState, p: Player, to: TeamId, next: number) {
  removeFromRoster(s, p);
  p.teamId = to;
  s.rosters[to]!.futures.push(p.id);
  p.contract = freeAgentContract(p, to, next);
  p.service.lastFreeAgencyAt = p.service.creditedSeasons;
}

function freeAgency(s: LeagueState, next: number, r: () => number) {
  // The user's club signs its own free agents in its own decisions; AI clubs never sign for it.
  const userTeam = s.user?.teamId;
  const clubs = firstTeamIds(s, next).filter((id) => id !== userTeam);
  for (const p of freeAgentsFor(s, next)) {
    const from = p.teamId!;
    let to = from;
    if (r() > O.freeAgency.stayChance || from === userTeam) {
      const others = clubs.filter((id) => id !== from);
      const room = others.map((id) => Math.max(1, salaryCapFor(next) - payroll(s, id, next)) * (0.5 + r()));
      to = others[room.indexOf(Math.max(...room))]!;
    }
    signFreeAgent(s, p, to, next);
  }
}

function renewContracts(s: LeagueState, next: number) {
  for (const p of Object.values(s.players)) {
    if (!p.teamId || isForeign(p) || (p.status !== 'active' && p.status !== 'military')) continue;
    if (p.contract?.salaries.some((x) => x.season === next)) continue;
    const amount = renewSalary(p, next);
    // A development player who reached the first team becomes a regular contract player.
    const kind = p.contract?.kind === 'development' && !lastRecord(p, next - 1)?.days ? 'development' : 'standard';
    p.contract = { teamId: p.teamId, kind, signedIn: next - 1, signingBonus: 0, salaries: [...(p.contract?.salaries ?? []).slice(-3), { season: next, amount }] };
  }
}

// ── Rookie draft ─────────────────────────────────────────────────────────────────────────────────

const TARGET_SHARE: Record<string, number> = { SP: 0.26, RP: 0.26, C: 0.08, IF: 0.22, OF: 0.18 };

/** Eleven rounds in the given order, labelled by round. */
export const standardSlots = (order: TeamId[]): DraftSlot[] =>
  Array.from({ length: KBO_2026.draft.rounds }, (_, i) => order.map((teamId) => ({ teamId, label: `${i + 1}R` }))).flat();

/** Puts the September draft of `draftYear` on the board. */
export function openDraft(s: LeagueState, draftYear: number, slots: DraftSlot[]): DraftState {
  const pool = draftClass(s.seed, draftYear);
  for (const p of pool) s.players[p.id] = p;
  return { year: draftYear, slots, next: 0, pool: pool.map((p) => p.id), developmentDone: false };
}

function draftScore(s: LeagueState, p: Player, counts: Record<string, number>, r: () => number) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const need = clamp(((TARGET_SHARE[p.role] ?? 0.2) - (counts[p.role] ?? 0) / total) * 40, -4, 4);
  return futureValue(p) * 0.6 + currentValue(p) * 0.4 - p.amateur.draftRank * 0.02 + need + normal(r) * 2;
}

/** The pick an AI club (or the auto-pick for the user) would make. */
export function aiDraftChoice(s: LeagueState, d: DraftState, teamId: TeamId, pickNo: number): Player | null {
  const r = rng(`${s.seed}|draft-picks|${d.year}|${pickNo}`);
  const counts = orgCounts(s, teamId);
  let best: Player | null = null,
    bestScore = -Infinity;
  for (const id of d.pool) {
    const p = s.players[id]!;
    const v = draftScore(s, p, counts, r);
    if (v > bestScore) {
      bestScore = v;
      best = p;
    }
  }
  return best;
}

export function makePick(s: LeagueState, d: DraftState, p: Player) {
  const slot = d.slots[d.next]!;
  const overall = d.next + 1;
  p.origin.overallPick = overall;
  d.pool = d.pool.filter((id) => id !== p.id);
  const clubs = new Set(d.slots.map((x) => x.teamId)).size;
  sign(s, p, slot.teamId, rookieContract(slot.teamId, d.year + 1, slotBonus(overall, clubs)));
  if (s.user?.teamId === slot.teamId) {
    s.user.fund -= p.contract!.signingBonus;
    s.user.ledger.push({ year: d.year, label: `신인 계약금 · ${p.name}`, amount: -p.contract!.signingBonus });
  }
  d.next++;
}

/** Runs AI picks until the user's club is on the clock or the draft is over. */
function runDraft(s: LeagueState, d: DraftState): 'wait' | 'done' {
  while (d.next < d.slots.length) {
    const slot = d.slots[d.next]!;
    if (slot.teamId === s.user?.teamId) {
      s.pending = { kind: 'draftPick', overall: d.next + 1, label: slot.label };
      return 'wait';
    }
    const p = aiDraftChoice(s, d, slot.teamId, d.next + 1);
    if (!p) break;
    makePick(s, d, p);
  }
  if (!d.developmentDone) {
    // Development contracts (육성선수) for the best of the rest, the user's club included (automatic in V0.3).
    const order = [...new Set(d.slots.map((x) => x.teamId))];
    for (let k = 0; k < O.developmentSignings; k++)
      for (const teamId of order) {
        const r = rng(`${s.seed}|draft-dev|${d.year}|${k}|${teamId}`);
        const counts = orgCounts(s, teamId);
        const p = d.pool.map((id) => s.players[id]!).sort((a, b) => draftScore(s, b, counts, r) - draftScore(s, a, counts, r))[0];
        if (!p) continue;
        d.pool = d.pool.filter((id) => id !== p.id);
        sign(s, p, teamId, rookieContract(teamId, d.year + 1, 0, true));
      }
    d.developmentDone = true;
  }
  for (const id of d.pool) delete s.players[id];
  d.pool = [];
  return 'done';
}

function orgCounts(s: LeagueState, teamId: TeamId): Record<string, number> {
  const c: Record<string, number> = {};
  for (const id of [...s.rosters[teamId]!.active, ...s.rosters[teamId]!.futures]) {
    const role = s.players[id]!.role;
    c[role] = (c[role] ?? 0) + 1;
  }
  return c;
}

export function sign(s: LeagueState, p: Player, teamId: TeamId, contract: Player['contract']) {
  p.status = 'active';
  p.teamId = teamId;
  p.contract = contract;
  s.players[p.id] = p;
  s.rosters[teamId]!.futures.push(p.id);
}

// ── Roster limits and foreign players ────────────────────────────────────────────────────────────

/** Cuts every club down to its offseason limit; returns the released players (no longer on a roster). */
export function cutToLimits(s: LeagueState, next: number): Player[] {
  const released: Player[] = [];
  const limit = rosterLimit(next) - O.openSpots;
  for (const t of s.teams) {
    if (t.id === s.user?.teamId) continue; // the user's club is never cut by the AI
    const roster = s.rosters[t.id]!;
    const ids = [...roster.active, ...roster.futures];
    if (ids.length <= limit) continue;
    const cut = ids
      .map((id) => s.players[id]!)
      // Foreign players, free agents and this fall's early-round draftees are never cut in their first winter.
      .filter((p) => !isForeign(p) && p.contract?.kind !== 'freeAgent' && !(p.proSince >= next && (p.origin.overallPick ?? Infinity) <= O.protectedRounds * s.teams.length))
      .sort((a, b) => keepValue(a, next) - keepValue(b, next))
      .slice(0, ids.length - limit);
    for (const p of cut) {
      removeFromRoster(s, p);
      p.teamId = null;
      released.push(p);
    }
  }
  return released.sort((a, b) => keepValue(b, next) - keepValue(a, next));
}

/** Released players good enough to help somewhere get one chance with an AI club that has room; the rest retire. */
export function placeReleased(s: LeagueState, released: Player[], next: number, r: () => number) {
  for (const p of released) {
    if (p.teamId) continue; // signed by the user
    const age = ageIn(p, next);
    const room = s.teams.filter((t) => t.id !== s.user?.teamId && s.rosters[t.id]!.active.length + s.rosters[t.id]!.futures.length < rosterLimit(next) - 1);
    if (room.length && age <= O.release.maxAge && keepValue(p, next) >= O.release.minValue && r() < O.release.signChance) {
      const to = room[Math.floor(r() * room.length)]!;
      p.teamId = to.id;
      s.rosters[to.id]!.futures.push(p.id);
      p.contract = { teamId: to.id, kind: 'standard', signedIn: next - 1, signingBonus: 0, salaries: [{ season: next, amount: renewSalary(p, next) }] };
    } else leaveLeague(s, p, 'retired');
  }
}

export function enforceLimits(s: LeagueState, next: number, r: () => number) {
  placeReleased(s, cutToLimits(s, next), next, r);
}

/** Keeps or lets go of a club's foreign players after the season. */
export function renewForeigners(s: LeagueState, teamId: TeamId, next: number, r: () => number) {
  const roster = s.rosters[teamId]!;
  const current = [...roster.active, ...roster.futures].map((id) => s.players[id]!).filter(isForeign);
  for (const p of current) {
    const last = lastRecord(p, next - 1);
    const keep = last && ageIn(p, next) <= 35 && last.war >= (isPitcher(p) ? O.foreign.keepWarPitcher : O.foreign.keepWarHitter) && r() < O.foreign.keepChance;
    if (keep) {
      const prevUsd = salaryIn(p, next - 1) / MANWON_PER_USD;
      const usd = Math.min(1_800_000, prevUsd + Math.max(0, last.war - 2) * 150_000 + 50_000);
      p.contract = foreignContract(teamId, next, usd, !!p.origin.asiaQuota);
    } else leaveLeague(s, p, 'overseas');
  }
}

export const foreignOn = (s: LeagueState, teamId: TeamId) => [...s.rosters[teamId]!.active, ...s.rosters[teamId]!.futures].map((id) => s.players[id]!).filter(isForeign);

/** Keeps each AI club at three foreign players (two pitchers, one hitter) plus the Asia quota from 2026. */
export function refreshForeigners(s: LeagueState, next: number, r: () => number) {
  for (const t of s.teams) {
    if (t.firstTeamFrom === null || t.firstTeamFrom > next) continue; // no foreign players in a futures-only season
    if (t.id === s.user?.teamId) continue; // the user's club renews and signs in its own foreign decision
    renewForeigners(s, t.id, next, r);
    const slots = foreignSlots(s, t.id, next);
    const staying = foreignOn(s, t.id);
    const regular = staying.filter((p) => !p.origin.asiaQuota);
    const pitchers = regular.filter(isPitcher).length;
    let k = 0;
    const add = (kind: 'pitcher' | 'hitter', asia: boolean) => {
      const id = `f${next}-${t.id}-${k++}`;
      const p = makeForeign(s.seed, id, next, { kind, asiaQuota: asia });
      const usd = asia ? 150_000 + Math.floor(r() * 50_000) : 550_000 + Math.floor(r() * 450_000);
      sign(s, p, t.id, foreignContract(t.id, next, usd, asia));
    };
    for (let i = pitchers; i < 2 && regular.length + k < slots.regular; i++) add('pitcher', false);
    while (regular.length + k < slots.regular) add('hitter', false);
    if (slots.asia && !staying.some((p) => p.origin.asiaQuota)) add(r() < 0.75 ? 'pitcher' : 'hitter', true);
  }
}

// ── The whole offseason ──────────────────────────────────────────────────────────────────────────

/** Hooks the user's club plugs into the offseason. The expansion module fills these in; a spectator league leaves them empty. */
export interface OffseasonHooks {
  draftSlots?(s: LeagueState, draftYear: number, order: TeamId[]): DraftSlot[];
  /** Return a decision to wait for, or null to go on. Called once per step until the step reports done. */
  decide?(s: LeagueState, step: OffseasonStep): Decision | null;
}
const hooks: OffseasonHooks = {};
export const setOffseasonHooks = (h: OffseasonHooks) => Object.assign(hooks, h);

export const OFFSEASON_STEPS = ['international', 'develop', 'retire', 'military', 'freeAgency', 'renew', 'draft', 'special', 'limits', 'released', 'foreign'] as const;
export type OffseasonStep = (typeof OFFSEASON_STEPS)[number];

export function beginOffseason(s: LeagueState) {
  s.offseason = { year: s.year, step: 0, draft: null, released: [], done: [] };
}

/** Runs offseason steps until the user must decide something ('waiting') or the new year starts ('done'). */
export function advanceOffseason(s: LeagueState): 'waiting' | 'done' {
  const o = s.offseason;
  if (!o) return 'done';
  if (s.pending) return 'waiting';
  const year = o.year,
    next = year + 1;
  while (o.step < OFFSEASON_STEPS.length) {
    const step = OFFSEASON_STEPS[o.step]!;
    // A user decision that belongs before the automatic part of this step.
    if (!o.done.includes(step)) {
      const d = hooks.decide?.(s, step) ?? null;
      o.done.push(step);
      if (d) {
        s.pending = d;
        return 'waiting';
      }
    }
    switch (step) {
      case 'international':
        applyInternational(s, year);
        break;
      case 'develop': {
        for (const p of Object.values(s.players)) {
          if (p.status === 'retired' || p.status === 'overseas' || p.status === 'amateur') continue;
          if (p.proSince > year) continue; // drafted this fall, first season still ahead
          developPlayer(p, year, s.lines[p.id]?.lost ?? 0, rng(`${s.seed}|develop|${year}|${p.id}`));
        }
        break;
      }
      case 'retire': {
        const r = rng(`${s.seed}|retire|${year}`);
        for (const p of Object.values(s.players)) {
          if (p.status !== 'active' || isForeign(p)) continue;
          if (r() < retirementChance(p, next)) leaveLeague(s, p, 'retired');
        }
        break;
      }
      case 'military': {
        const r = rng(`${s.seed}|military|${year}`);
        for (const p of Object.values(s.players)) {
          if (p.status === 'military' && p.service.returnsOn && p.service.returnsOn < `${next}-03-01`) {
            p.status = 'active';
            p.service.military = 'served';
            delete p.service.route;
            delete p.service.returnsOn;
            if (p.teamId) s.rosters[p.teamId]!.futures.push(p.id);
          } else if (p.status === 'active' && p.service.military === 'pending' && !isForeign(p) && p.teamId) enlist(s, p, next, r);
        }
        break;
      }
      case 'freeAgency':
        freeAgency(s, next, rng(`${s.seed}|fa|${year}`));
        break;
      case 'renew':
        renewContracts(s, next);
        break;
      case 'draft': {
        if (!o.draft) {
          const table = s.history[s.history.length - 1]?.table ?? [];
          const order = table.length ? [...table].reverse().map((row) => row.teamId) : firstTeamIds(s, year);
          const slots = hooks.draftSlots?.(s, year, order) ?? standardSlots(order);
          o.draft = openDraft(s, year, slots);
        }
        if (runDraft(s, o.draft) === 'wait') return 'waiting';
        break;
      }
      case 'special':
        break; // expansion special draft: entirely a user decision (see expansion.ts)
      case 'limits':
        o.released = cutToLimits(s, next).map((p) => p.id);
        break;
      case 'released':
        placeReleased(
          s,
          o.released.map((id) => s.players[id]!).filter(Boolean),
          next,
          rng(`${s.seed}|limits|${year}`),
        );
        break;
      case 'foreign':
        refreshForeigners(s, next, rng(`${s.seed}|foreign|${year}`));
        break;
    }
    o.step++;
  }
  s.offseason = null;
  s.year = next;
  return 'done';
}

/** A whole draft with AI picks only (the history bootstrap). */
export function runWholeDraft(s: LeagueState, draftYear: number, order: TeamId[]) {
  runDraft(s, openDraft(s, draftYear, standardSlots(order)));
}

/** A whole offseason with no user decisions (spectator leagues and history). */
export function runOffseason(s: LeagueState) {
  beginOffseason(s);
  if (advanceOffseason(s) === 'waiting') throw new Error('offseason waits for a decision; use advanceOffseason');
}

export { lastRecord, removeFromRoster };
