/* Between seasons: close the books, then age every player a year and rebuild the rosters.

   Order (fixed; each step has its own random stream): close season, then OFFSEASON_STEPS —
   national-team exemptions → development → retirement → military service → posting → free agency → salaries →
   rookie draft → (expansion special draft) → roster limits → released players → foreign players.
   The user's club can make the game wait at a step for a decision (see OffseasonHooks). */
import { observe, overall, rng, toGrade, type Tools } from '../draftroom';
import DraftSeason from '../draftroom/season.js';
import type { Player, PlayerId, SeasonRecord, TeamId } from '../model/types';
import { KBO_2026, minimumSalaryFor, salaryCapFor } from '../rules/kbo2026';
import { foreignContract, freeAgentContract, MANWON_PER_USD, renewSalary, rookieContract, salaryIn, slotBonus, usdTotal } from './contracts';
import { splitContract } from './foreign';
import { INTERNATIONAL } from './international';
import { foreignSlots } from './manager';
import { champion } from './postseason';
import { ageIn, currentValue, draftClass, futureValue, isForeign, isPitcher, keepValue, makeForeign } from './players';
import { currentStandings } from './season';
import { queuedDecision, runFreeAgency } from './market';
import { aiTrades, clearPool } from './trade';
import { applyPickDrop, settleCap } from './cap';
import { isSecondDraftYear, openSecondDraft, runSecondDraft, secondProtectDecision } from './seconddraft';
import { standings } from './standings';
import { addInto, developmentIds, emptyBat, emptyPit, firstTeamIds, orgIds, orgPlayers, registeredIds, type Decision, type DraftSlot, type DraftState, type LeagueState, type SeasonSummary } from './state';
import { batterWar, leagueContext, pitcherWar } from './stats';
import { maybeRetireNumber } from './numbers';
import { settleFinances } from './finance';
import { awardHonours, computeAwards, hallOfFameCheck } from './awards';
import { seasonMoments } from './milestones';
import { seasonNews } from './news';
import { seasonFans } from './fans';
import { aiStaffWinter } from './staff';
import { runAiPosting } from './posting';
import { FUTURES, OFFSEASON as O, STAFF } from './tuning';
import { staffEdge, staffRating } from './staff';

type Develop = (p: object, tools: Tools, yearIndex: number, age: number, daysLost: number, r: () => number, boost?: number, focus?: string, scale?: number) => Tools;
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
  let futuresTable: SeasonSummary['futures'];
  const f = s.futures;
  if (f) {
    const ids = new Set([...Object.keys(f.lines), ...Object.keys(f.training)]);
    for (const id of ids) {
      const p = s.players[id];
      if (!p) continue;
      const line = f.lines[id];
      const thirdDays = f.training[id] ?? 0;
      p.career.push({ year: s.year, teamId: line?.teamId ?? p.teamId ?? '', level: 'futures', age: ageIn(p, s.year), days: 0, bat: line?.bat ?? null, pit: line?.pit ?? null, war: 0, ...(thirdDays ? { thirdDays } : {}) });
    }
    futuresTable = standings(f.teams, f.scores);
  }
  if (f && s.user && !firstTeamIds(s).includes(s.user.teamId)) {
    const me = s.user.teamId;
    userFutures = { w: 0, l: 0, t: 0, rs: 0, ra: 0 };
    for (const g of f.scores) {
      if (g.home !== me && g.away !== me) continue;
      const [mine, theirs] = g.home === me ? [g.hs, g.as] : [g.as, g.hs];
      userFutures.rs += mine;
      userFutures.ra += theirs;
      if (mine > theirs) userFutures.w++;
      else if (mine < theirs) userFutures.l++;
      else userFutures.t++;
    }
  }
  s.futures = null;
  settleCap(s, s.year);
  clearPool(s);
  aiTrades(s, rng(`${s.seed}|ai-trades-winter|${s.year}`));
  s.history.push({
    year: s.year,
    table: currentStandings(s),
    series: s.postseason,
    champion: champion(s),
    totals: { bat, pit, games: s.scores.length },
    ...(userFutures ? { userFutures } : {}),
    ...(futuresTable ? { futures: futuresTable } : {}),
  });
  // The business year closes with the baseball one: accounts, fans' mood, AI staff changes.
  const summary = s.history[s.history.length - 1]!;
  summary.awards = computeAwards(s, s.year, summary.table, summary.champion);
  awardHonours(s, s.year, summary.awards);
  settleFinances(s, s.year, summary.table);
  seasonMoments(s, s.year, summary.awards);
  seasonNews(s, s.year);
  seasonFans(s, s.year, summary.table, summary.champion);
  aiStaffWinter(s, s.year, summary.table);
  s.phase = 'offseason';
}

const lastRecord = (p: Player, year: number) => p.career.find((r) => r.year === year && !r.level);

// ── Development ──────────────────────────────────────────────────────────────────────────────────

/**
 * How fast a young player grew last season: playing time (first team and futures) and days trained in
 * the third squad. Neutral (1) for seasons without a futures league and for players past the age limit.
 */
export function growthScale(p: Player, year: number, futuresLeague: boolean): number {
  const G = FUTURES.growth;
  if (!futuresLeague || isForeign(p) || ageIn(p, year) > G.maxAge) return 1;
  const major = lastRecord(p, year);
  const minor = p.career.find((c) => c.year === year && c.level === 'futures');
  const reps = isPitcher(p)
    ? ((major?.pit?.outs ?? 0) + (minor?.pit?.outs ?? 0) * G.futuresWeight) / 3 / G.fullInnings
    : ((major?.bat?.pa ?? 0) + (minor?.bat?.pa ?? 0) * G.futuresWeight) / G.fullPA;
  const train = (minor?.thirdDays ?? 0) / G.trainDays;
  return clamp(G.base + G.play * Math.min(1, reps) + G.train * Math.min(1, train), G.base, G.max);
}

/** Coaching staff effect on this player's growth: an extra share for each ability (staff.ts). */
export type Coaching = Partial<Record<keyof Tools, number>>;

const TOOL_COACH: Record<string, 'hitting' | 'pitching' | 'fielding'> = {
  contact: 'hitting',
  power: 'hitting',
  eye: 'hitting',
  speed: 'fielding',
  defense: 'fielding',
  stuff: 'pitching',
  command: 'pitching',
  breaking: 'pitching',
  stamina: 'pitching',
};

export function coachingFor(s: LeagueState, p: Player, year: number): Coaching {
  if (!p.teamId || p.status !== 'active') return {};
  const farm = ageIn(p, year) <= 24 && (lastRecord(p, year)?.days ?? 0) < 60 ? STAFF.farmGrowth * staffEdge(staffRating(s, p.teamId, 'farm')) : 0;
  const out: Coaching = {};
  for (const [k, role] of Object.entries(TOOL_COACH)) out[k as keyof Tools] = STAFF.growth * staffEdge(staffRating(s, p.teamId, role)) + farm;
  return out;
}

/** One year of growth and aging on hidden ability, then a fresh public scouting report. */
export function developPlayer(p: Player, year: number, lostDays: number, r: () => number, scale = 1, coaching: Coaching = {}) {
  const age = ageIn(p, year);
  const yearIndex = Math.max(0, year - p.proSince);
  const h = p.hidden;
  if (p.velocity != null && h.current.stuff != null) p.velocityStuff ??= h.current.stuff;
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
    next = developTools({ potentialTools: h.potential, growthCurve: h.growthCurve, developmentRate: h.developmentRate }, h.current, yearIndex, age, lostDays, r, 0, p.plan?.focus ?? 'balanced', scale);
  }
  // Coaches speed up (or slow down) the growth part.
  for (const k of Object.keys(next) as (keyof Tools)[]) {
    const before = h.current[k] ?? next[k]!;
    const gain = next[k]! - before;
    if (gain > 0 && coaching[k]) next[k] = clamp(before + gain * (1 + coaching[k]!), 20, 80);
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
    r.third = r.third.filter((id) => id !== p.id);
  }
}

/** Retire or drop a player. Players who never reached the first team are forgotten to keep saves small. */
export function leaveLeague(s: LeagueState, p: Player, status: 'retired' | 'overseas') {
  if (status === 'retired' && p.teamId) maybeRetireNumber(s, p, p.teamId, s.year);
  if (status === 'retired') hallOfFameCheck(s, p, s.year);
  removeFromRoster(s, p);
  p.teamId = null;
  p.contract = null;
  p.status = status;
  // A player leaving during the season (released, replaced) takes his injury and absence with him.
  delete s.injuries[p.id];
  delete s.away?.[p.id];
  if (!p.career.some((c) => !c.level) && !s.lines[p.id]) delete s.players[p.id];
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

/** Picks the national team for `year`'s event and its result (once per event). */
export function selectNationalTeam(s: LeagueState, year: number) {
  const event = INTERNATIONAL.find((e) => e.year === year);
  if (!event) return null;
  const existing = s.international.find((e) => e.year === year);
  if (existing) return existing;
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
  const entry = { year, name: event.name, medal, squad: squad.map((p) => p.id) };
  s.international.push(entry);
  return entry;
}

/** After the event: a medal exempts the squad from military service (예술체육요원, RULES.md §11). */
export function applyInternational(s: LeagueState, year: number) {
  const entry = selectNationalTeam(s, year);
  if (!entry?.medal) return;
  for (const p of entry.squad.map((id) => s.players[id]).filter((p): p is Player => !!p)) {
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
  const lost = s.lines[p.id]?.lost ?? 0;
  const route = r() < sangmuChance(p, next) ? 'sangmu' : r() < Math.min(0.4, M.socialBase + lost * 0.0012) ? 'social' : 'army';
  enlistAs(s, p, next, route);
}

/** Chance that 상무 (the armed forces athletic corps) accepts the player: grade, age and first-team experience. */
export function sangmuChance(p: Player, next: number): number {
  const M = O.military;
  const grade = p.scouting.current;
  const played = p.career.some((c) => c.days > 0);
  return ageIn(p, next) <= M.sangmu.maxAge && grade >= M.sangmu.minGrade
    ? clamp((grade - M.sangmu.minGrade) * M.sangmu.perGrade + (played ? M.sangmu.playedBonus : 0), M.sangmu.min, M.sangmu.max)
    : 0;
}

/** Starts service before season `next`: 18 months (상무, 현역) or 21 months (사회복무). */
export function enlistAs(s: LeagueState, p: Player, next: number, route: 'sangmu' | 'army' | 'social') {
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
  return orgIds(s, teamId).reduce((sum, id) => sum + salaryIn(s.players[id]!, season), 0);
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


/** Sets next season's pay for a player: keeps the last few salaries, development players stay development until they play. */
export function setSalary(p: Player, next: number, amount: number) {
  const kind = p.contract?.kind === 'development' && !lastRecord(p, next - 1)?.days ? 'development' : 'standard';
  p.contract = { teamId: p.teamId!, kind, signedIn: next - 1, signingBonus: 0, salaries: [...(p.contract?.salaries ?? []).slice(-3), { season: next, amount }] };
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
  // AI clubs pay the slot value; the user's club negotiates each bonus after the draft (rookieBonus).
  sign(s, p, slot.teamId, rookieContract(slot.teamId, d.year + 1, slotBonus(overall, clubs)));
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
  const userTeam = s.user?.teamId;
  const userDrafts = !!userTeam && d.slots.some((x) => x.teamId === userTeam);
  // The user's club settles its rookies' bonuses, then signs development players before the AI clubs.
  if (userDrafts && !d.bonusDone) {
    d.bonusDone = true;
    const dec = hooks.rookies?.(s, d) ?? null;
    if (dec) {
      s.pending = dec;
      return 'wait';
    }
  }
  if (userDrafts && !d.userDevelopmentDone) {
    d.userDevelopmentDone = true;
    const dec = hooks.development?.(s, d) ?? null;
    if (dec) {
      s.pending = dec;
      return 'wait';
    }
  }
  if (!d.developmentDone) {
    // Development contracts (육성선수) for the best of the rest.
    const order = [...new Set(d.slots.map((x) => x.teamId))].filter((id) => !(userDrafts && id === userTeam));
    for (let k = 0; k < O.development.signings; k++)
      for (const teamId of order) {
        if (developmentIds(s, teamId).length >= (teamId === userTeam ? O.development.cap : O.development.aiTarget)) continue;
        const r = rng(`${s.seed}|draft-dev|${d.year}|${k}|${teamId}`);
        const counts = orgCounts(s, teamId);
        const p = d.pool.map((id) => s.players[id]!).sort((a, b) => draftScore(s, b, counts, r) - draftScore(s, a, counts, r))[0];
        if (!p) continue;
        d.pool = d.pool.filter((id) => id !== p.id);
        sign(s, p, teamId, developmentContract(teamId, d.year + 1));
      }
    d.developmentDone = true;
  }
  for (const id of d.pool) delete s.players[id];
  d.pool = [];
  return 'done';
}

function orgCounts(s: LeagueState, teamId: TeamId): Record<string, number> {
  const c: Record<string, number> = {};
  for (const id of orgIds(s, teamId)) {
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

/** A development contract (육성선수) for next season at the minimum salary. */
export const developmentContract = (teamId: TeamId, next: number, bonus = 0): Player['contract'] => ({
  teamId,
  kind: 'development',
  signedIn: next - 1,
  signingBonus: bonus,
  salaries: [{ season: next, amount: minimumSalaryFor(next) }],
});

/**
 * Cuts every AI club down to its offseason limit; returns the released players (no longer on a roster).
 * Registered players over the limit are released, or kept as development players when young enough
 * and there is room (방출 뒤 육성선수 재계약). Development players past the age limit or over the
 * club's target are let go.
 */
export function cutToLimits(s: LeagueState, next: number): Player[] {
  const released: Player[] = [];
  const limit = rosterLimit(next) - O.openSpots;
  const D = O.development;
  const release = (p: Player) => {
    removeFromRoster(s, p);
    p.teamId = null;
    released.push(p);
  };
  for (const t of s.teams) {
    if (t.id === s.user?.teamId) continue; // the user's club is never cut by the AI
    const dev = developmentIds(s, t.id)
      .map((id) => s.players[id]!)
      .sort((a, b) => keepValue(b, next) - keepValue(a, next));
    dev.forEach((p, i) => {
      if (i >= D.aiTarget || ageIn(p, next) > D.maxAge) release(p);
    });
    const ids = registeredIds(s, t.id);
    if (ids.length <= limit) continue;
    const cut = ids
      .map((id) => s.players[id]!)
      // Foreign players, free agents and this fall's early-round draftees are never cut in their first winter.
      .filter((p) => !isForeign(p) && p.contract?.kind !== 'freeAgent' && !(p.proSince >= next && (p.origin.overallPick ?? Infinity) <= O.protectedRounds * s.teams.length))
      .sort((a, b) => keepValue(a, next) - keepValue(b, next))
      .slice(0, ids.length - limit);
    let devCount = developmentIds(s, t.id).length;
    for (const p of cut) {
      if (ageIn(p, next) <= D.convertAge && devCount < D.aiTarget) {
        p.contract = developmentContract(t.id, next);
        devCount++;
      } else release(p);
    }
  }
  return released.sort((a, b) => keepValue(b, next) - keepValue(a, next));
}

/** Released players good enough to help somewhere get one chance with an AI club that has room; the rest retire. */
export function placeReleased(s: LeagueState, released: Player[], next: number, r: () => number) {
  for (const p of released) {
    if (p.teamId) continue; // signed by the user
    const age = ageIn(p, next);
    const room = s.teams.filter((t) => t.id !== s.user?.teamId && registeredIds(s, t.id).length < rosterLimit(next) - O.openSpots);
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
/** A foreign player's asking total to re-sign (US dollars): last year's total plus a raise for his season (Asia quota: at most +10만 달러). */
export function foreignRenewalAsk(p: Player, next: number) {
  const war = lastRecord(p, next - 1)?.war ?? 0;
  const prevUsd = usdTotal(p.contract) || salaryIn(p, next - 1) / MANWON_PER_USD;
  const raise = Math.max(0, war - 2) * 150_000 + 50_000;
  return Math.round(Math.min(1_800_000, prevUsd + (p.origin.asiaQuota ? Math.min(KBO_2026.foreign.asiaQuotaRaisePerYearUSD, raise) : raise)) / 10_000) * 10_000;
}

/** A star foreign player may leave for MLB or NPB whatever the club offers (chance by his season). */
export function foreignLeaves(s: LeagueState, p: Player, next: number) {
  const war = lastRecord(p, next - 1)?.war ?? 0;
  const chance = ageIn(p, next) > 35 ? 1 : war >= 6 ? 0.5 : war >= 4 ? 0.2 : 0.03;
  return rng(`${s.seed}|foreign-abroad|${next}|${p.id}`)() < chance;
}

export function renewForeigners(s: LeagueState, teamId: TeamId, next: number, r: () => number) {
  const current = orgPlayers(s, teamId).filter(isForeign);
  for (const p of current) {
    const last = lastRecord(p, next - 1);
    const keep = last && ageIn(p, next) <= 35 && last.war >= (isPitcher(p) ? O.foreign.keepWarPitcher : O.foreign.keepWarHitter) && r() < O.foreign.keepChance;
    if (keep) p.contract = foreignContract(teamId, next, splitContract(foreignRenewalAsk(p, next), r), !!p.origin.asiaQuota);
    else leaveLeague(s, p, 'overseas');
  }
}

export const foreignOn = (s: LeagueState, teamId: TeamId) => orgPlayers(s, teamId).filter(isForeign);

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
      sign(s, p, t.id, foreignContract(t.id, next, splitContract(p.origin.background!.ask, r), asia));
    };
    for (let i = pitchers; i < 2 && regular.length + k < slots.regular; i++) add('pitcher', false);
    while (regular.length + k < slots.regular) add('hitter', false);
    if (slots.asia && !staying.some((p) => p.origin.asiaQuota)) add(r() < 0.75 ? 'pitcher' : 'hitter', true);
  }
}

// ── The whole offseason ──────────────────────────────────────────────────────────────────────────

/** Hooks the user's club plugs into the offseason. The expansion module fills these in; a spectator league leaves them empty. */
export interface OffseasonHooks {
  /** Called once when the offseason starts (the owner's yearly money). */
  begin?(s: LeagueState): void;
  draftSlots?(s: LeagueState, draftYear: number, order: TeamId[]): DraftSlot[];
  /** After the last pick: the user's rookies' bonuses, then the user's development signings. */
  rookies?(s: LeagueState, d: DraftState): Decision | null;
  development?(s: LeagueState, d: DraftState): Decision | null;
  /** Return a decision to wait for, or null to go on. Called once per step until the step reports done. */
  decide?(s: LeagueState, step: OffseasonStep): Decision | null;
}
const hooks: OffseasonHooks = {};
export const setOffseasonHooks = (h: OffseasonHooks) => Object.assign(hooks, h);

export const OFFSEASON_STEPS = ['international', 'develop', 'retire', 'military', 'posting', 'freeAgency', 'renew', 'draft', 'special', 'secondDraft', 'limits', 'released', 'foreign', 'check', 'camp'] as const;
export type OffseasonStep = (typeof OFFSEASON_STEPS)[number];

export function beginOffseason(s: LeagueState) {
  s.offseason = { year: s.year, step: 0, draft: null, released: [], done: [] };
  hooks.begin?.(s);
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
        const futuresLeague = !!s.history.find((h) => h.year === year)?.futures;
        for (const p of Object.values(s.players)) {
          if (p.status === 'retired' || p.status === 'overseas' || p.status === 'amateur') continue;
          if (p.proSince > year) continue; // drafted this fall, first season still ahead
          developPlayer(p, year, s.lines[p.id]?.lost ?? 0, rng(`${s.seed}|develop|${year}|${p.id}`), growthScale(p, year, futuresLeague), coachingFor(s, p, year));
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
          } else if (p.status === 'active' && p.service.military === 'pending' && !isForeign(p) && p.teamId && p.teamId !== s.user?.teamId) enlist(s, p, next, r);
        }
        break;
      }
      case 'posting':
        runAiPosting(s, next);
        break;
      case 'freeAgency': {
        if (!o.faDone) {
          o.faQueue = runFreeAgency(s, next, rng(`${s.seed}|fa|${year}`), o.faOffers ?? {});
          o.faDone = true;
        }
        // Protected lists and compensation picks the user owes, one at a time.
        const item = o.faQueue?.[0];
        if (item) {
          s.pending = queuedDecision(s, item, next);
          return 'waiting';
        }
        break;
      }
      case 'renew':
        renewContracts(s, next);
        break;
      case 'draft': {
        if (!o.draft) {
          const table = s.history[s.history.length - 1]?.table ?? [];
          const order = table.length ? [...table].reverse().map((row) => row.teamId) : firstTeamIds(s, year);
          const slots = applyPickDrop(s, year, hooks.draftSlots?.(s, year, order) ?? standardSlots(order));
          o.draft = openDraft(s, year, slots);
        }
        if (runDraft(s, o.draft) === 'wait') return 'waiting';
        break;
      }
      case 'special':
        break; // expansion special draft: entirely a user decision (see expansion.ts)
      case 'secondDraft': {
        if (!isSecondDraftYear(year)) break;
        if (!o.second) o.second = openSecondDraft(s, year);
        const u = s.user;
        // The user's club protects its 35 before anyone picks (not in the winter it joins the first team).
        if (u && u.firstTeamYear <= year && !o.second.protected[u.teamId]) {
          s.pending = secondProtectDecision(s, o.second);
          return 'waiting';
        }
        if (runSecondDraft(s, o.second) === 'wait') return 'waiting';
        break;
      }
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
      case 'check':
        break; // the user's club over the limit after foreign signings: a user decision (expansion.ts)
      case 'camp':
        break; // spring camp plans: a user decision only (AI clubs keep balanced plans)
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
