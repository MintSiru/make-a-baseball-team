/* Between seasons: close the books, then age every player a year and rebuild the rosters.

   Order (fixed; each step has its own random stream):
   close season → national-team exemptions → development → retirement → military service →
   free agency → salaries → rookie draft → roster limits → foreign players. */
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
import { addInto, emptyBat, emptyPit, type LeagueState } from './state';
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
  s.history.push({ year: s.year, table: currentStandings(s), series: s.postseason, champion: champion(s), totals: { bat, pit, games: s.scores.length } });
  s.phase = 'offseason';
}

const lastRecord = (p: Player, year: number) => p.career.find((r) => r.year === year);

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

function payroll(s: LeagueState, teamId: TeamId, season: number) {
  return [...s.rosters[teamId]!.active, ...s.rosters[teamId]!.futures].reduce((sum, id) => sum + salaryIn(s.players[id]!, season), 0);
}

function freeAgency(s: LeagueState, next: number, r: () => number) {
  const agents = Object.values(s.players)
    .filter((p) => isFreeAgent(p, next))
    .sort((a, b) => b.scouting.current - a.scouting.current);
  for (const p of agents) {
    const war = lastRecord(p, next - 1)?.war ?? 0;
    // Only players with a market declare; the rest re-sign as usual.
    if (p.scouting.current < O.freeAgency.minGrade && war < 1) continue;
    const from = p.teamId!;
    let to = from;
    if (r() > O.freeAgency.stayChance) {
      const others = s.teams.map((t) => t.id).filter((id) => id !== from);
      const room = others.map((id) => Math.max(1, salaryCapFor(next) - payroll(s, id, next)) * (0.5 + r()));
      to = others[room.indexOf(Math.max(...room))]!;
    }
    removeFromRoster(s, p);
    p.teamId = to;
    s.rosters[to]!.futures.push(p.id);
    p.contract = freeAgentContract(p, to, next);
    p.service.lastFreeAgencyAt = p.service.creditedSeasons;
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

/** The September draft of `draftYear`: reverse order of that season's standings, 11 picks per club, then development deals. */
export function runDraft(s: LeagueState, draftYear: number, order: TeamId[]) {
  const r = rng(`${s.seed}|draft-picks|${draftYear}`);
  const pool = draftClass(s.seed, draftYear);
  const clubs = order.length;
  const taken = new Set<PlayerId>();
  const counts = Object.fromEntries(order.map((id) => [id, orgCounts(s, id)]));
  const score = (p: Player, teamId: TeamId) => {
    const c = counts[teamId]!;
    const total = Object.values(c).reduce((a, b) => a + b, 0) || 1;
    const need = clamp(((TARGET_SHARE[p.role] ?? 0.2) - (c[p.role] ?? 0) / total) * 40, -4, 4);
    return futureValue(p) * 0.6 + currentValue(p) * 0.4 - p.amateur.draftRank * 0.02 + need + normal(r) * 2;
  };
  let overallPick = 0;
  const signed: Player[] = [];
  for (let round = 1; round <= KBO_2026.draft.rounds; round++) {
    for (const teamId of order) {
      overallPick++;
      let best: Player | null = null,
        bestScore = -Infinity;
      for (const p of pool) {
        if (taken.has(p.id)) continue;
        const v = score(p, teamId);
        if (v > bestScore) {
          bestScore = v;
          best = p;
        }
      }
      if (!best) continue;
      taken.add(best.id);
      best.origin.overallPick = overallPick;
      sign(s, best, teamId, rookieContract(teamId, draftYear + 1, slotBonus(overallPick, clubs)));
      counts[teamId]![best.role] = (counts[teamId]![best.role] ?? 0) + 1;
      signed.push(best);
    }
  }
  // Development contracts (육성선수) for the best of the rest.
  for (let k = 0; k < O.developmentSignings; k++)
    for (const teamId of order) {
      const p = pool.filter((x) => !taken.has(x.id)).sort((a, b) => score(b, teamId) - score(a, teamId))[0];
      if (!p) continue;
      taken.add(p.id);
      sign(s, p, teamId, rookieContract(teamId, draftYear + 1, 0, true));
      signed.push(p);
    }
  return signed;
}

function orgCounts(s: LeagueState, teamId: TeamId): Record<string, number> {
  const c: Record<string, number> = {};
  for (const id of [...s.rosters[teamId]!.active, ...s.rosters[teamId]!.futures]) {
    const role = s.players[id]!.role;
    c[role] = (c[role] ?? 0) + 1;
  }
  return c;
}

function sign(s: LeagueState, p: Player, teamId: TeamId, contract: Player['contract']) {
  p.status = 'active';
  p.teamId = teamId;
  p.contract = contract;
  s.players[p.id] = p;
  s.rosters[teamId]!.futures.push(p.id);
}

// ── Roster limits and foreign players ────────────────────────────────────────────────────────────

export function enforceLimits(s: LeagueState, next: number, r: () => number) {
  const released: Player[] = [];
  const limit = rosterLimit(next) - O.openSpots;
  for (const t of s.teams) {
    const roster = s.rosters[t.id]!;
    const ids = [...roster.active, ...roster.futures];
    if (ids.length <= limit) continue;
    const cut = ids
      .map((id) => s.players[id]!)
      .filter((p) => !isForeign(p) && p.contract?.kind !== 'freeAgent')
      .sort((a, b) => keepValue(a, next) - keepValue(b, next))
      .slice(0, ids.length - limit);
    for (const p of cut) {
      removeFromRoster(s, p);
      p.teamId = null;
      released.push(p);
    }
  }
  // Released players good enough to help somewhere get one chance with a club that has room.
  released.sort((a, b) => keepValue(b, next) - keepValue(a, next));
  for (const p of released) {
    const age = ageIn(p, next);
    const room = s.teams.filter((t) => s.rosters[t.id]!.active.length + s.rosters[t.id]!.futures.length < rosterLimit(next) - 1);
    if (room.length && age <= O.release.maxAge && keepValue(p, next) >= O.release.minValue && r() < O.release.signChance) {
      const to = room[Math.floor(r() * room.length)]!;
      p.teamId = to.id;
      s.rosters[to.id]!.futures.push(p.id);
      p.contract = { teamId: to.id, kind: 'standard', signedIn: next - 1, signingBonus: 0, salaries: [{ season: next, amount: renewSalary(p, next) }] };
    } else leaveLeague(s, p, 'retired');
  }
}

/** Keeps each club at three foreign players (two pitchers, one hitter) plus the Asia quota from 2026. */
export function refreshForeigners(s: LeagueState, next: number, r: () => number) {
  const slots = foreignSlots(next);
  for (const t of s.teams) {
    const roster = s.rosters[t.id]!;
    const current = [...roster.active, ...roster.futures].map((id) => s.players[id]!).filter(isForeign);
    for (const p of current) {
      const last = lastRecord(p, next - 1);
      const keep = last && ageIn(p, next) <= 35 && last.war >= (isPitcher(p) ? O.foreign.keepWarPitcher : O.foreign.keepWarHitter) && r() < O.foreign.keepChance;
      if (keep) {
        const prevUsd = salaryIn(p, next - 1) / MANWON_PER_USD;
        const usd = Math.min(1_800_000, prevUsd + Math.max(0, last.war - 2) * 150_000 + 50_000);
        p.contract = foreignContract(t.id, next, usd, !!p.origin.asiaQuota);
      } else leaveLeague(s, p, 'overseas');
    }
    const staying = [...roster.active, ...roster.futures].map((id) => s.players[id]!).filter(isForeign);
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

export function runOffseason(s: LeagueState) {
  const year = s.year,
    next = year + 1;
  applyInternational(s, year);
  const devR = (id: string) => rng(`${s.seed}|develop|${year}|${id}`);
  for (const p of Object.values(s.players)) {
    if (p.status === 'retired' || p.status === 'overseas' || p.status === 'amateur') continue;
    if (p.proSince > year) continue; // drafted this fall, first season still ahead
    developPlayer(p, year, s.lines[p.id]?.lost ?? 0, devR(p.id));
  }
  const retR = rng(`${s.seed}|retire|${year}`);
  for (const p of Object.values(s.players)) {
    if (p.status !== 'active' || isForeign(p)) continue;
    if (retR() < retirementChance(p, next)) leaveLeague(s, p, 'retired');
  }
  const milR = rng(`${s.seed}|military|${year}`);
  for (const p of Object.values(s.players)) {
    if (p.status === 'military' && p.service.returnsOn && p.service.returnsOn < `${next}-03-01`) {
      p.status = 'active';
      p.service.military = 'served';
      delete p.service.route;
      delete p.service.returnsOn;
      if (p.teamId) s.rosters[p.teamId]!.futures.push(p.id);
    } else if (p.status === 'active' && p.service.military === 'pending' && !isForeign(p) && p.teamId) enlist(s, p, next, milR);
  }
  freeAgency(s, next, rng(`${s.seed}|fa|${year}`));
  renewContracts(s, next);
  const order = [...(s.history[s.history.length - 1]?.table ?? [])].reverse().map((row) => row.teamId);
  runDraft(s, year, order.length ? order : s.teams.map((t) => t.id));
  enforceLimits(s, next, rng(`${s.seed}|limits|${year}`));
  refreshForeigners(s, next, rng(`${s.seed}|foreign|${year}`));
  s.year = next;
}

export { lastRecord };
