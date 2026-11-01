import { k as __i18n_k } from '../i18n/index';
import { addSituations } from './engine/situation';
import { noteForeignOut, noteMove } from './moves';
/* Between seasons: close the books, then age every player a year and rebuild the rosters.

   Order (fixed; each step has its own random stream): close season, then OFFSEASON_STEPS —
   national-team exemptions → development → retirement → military service → posting → free agency → salaries →
   rookie draft → (expansion special draft) → roster limits → released players → foreign players.
   The user's club can make the game wait at a step for a decision (see OffseasonHooks). */
import { addVenues, emptyVenues } from './venues';
import { seasonStaff } from './clubrecords';
import { familyAtPick, familySeason, pruneFamilies } from './family';
import { closeMeetings, headToHead } from './matchups';
import { seasonMix } from './savant';
import { developPitches, pitchSnapshot } from './pitches';
import { learnWinter } from './newpitch';
import { twoWayWinter } from './twoway';
import { historicForeignCap, MODERN_FROM, rulesFor } from '../rules/history';
import { boardValue, playsHistory } from './era';
import { boardMeets, committeeMotions, holdMeeting } from './board';
import { lotteryNews, lotteryOrder } from './lottery';
import { endTemps } from './tempforeign';
import { hometownClub } from './fa';
import { draftRegionOf } from './territorial';
import { moodWinter } from './contractmood';
import { schoolBoost, schoolPick } from './schools';
import { hashUnit, observe, overall, rng, toGrade, type Tools } from '../draftroom';
import type { Player, PlayerId, SeasonRecord, TeamId } from '../model/types';
import { KBO_2026, minimumSalaryFor, salaryCapFor } from '../rules/kbo2026';
import { developmentOpen } from './features';
import { budgetBonus, foreignContract, MANWON_PER_USD, renewSalary, rookieContract, salaryIn, slotBonus, usdTotal } from './contracts';
import { splitContract } from './foreign';
import { foreignSlots } from './manager';
import { champion } from './postseason';
import { medicalReview, socialOnly } from './military';
import { ageIn, currentValue, draftClass, futureValue, isForeign, isPitcher, keepValue, makeForeign } from './players';
import { currentStandings } from './season';
import { queuedDecision } from './market';
import { closeMarket, judgeReinforcePromises, judgeStarterPromises, openMarket, payIncentives, playRound, roundDecision, settlePeriodOptions } from './fa';
import { aiTrades, applyPickTrades, clearPool } from './trade';
import { applyPickDrop, settleCap } from './cap';
import { dynastyWinter } from './dynasty';
import { applyForeignPickDrop, asiaCapFor, capPlayers, foreignCap, settleForeignCap, slotExempt, slotForeigners } from './foreigncap';
import { isSecondDraftYear, openSecondDraft, runSecondDraft, secondProtectDecision } from './seconddraft';
import { standings } from './standings';
import { addInto, developmentIds, emptyBat, emptyPit, firstTeamIds, orgIds, orgPlayers, registeredIds, type Decision, type DraftSlot, type DraftState, type LeagueState, type SeasonSummary } from './state';
import { batterWar, leagueContext, pitcherWar } from './stats';
import { maybeRetireNumber } from './numbers';
import { balanceDepth, changePosition, learnPositions, positionMove } from './positions';
import { driftPotential, futureBefore, winterReport } from './scouting';
import { logPick } from './draftlog';
import { applyDemotionCuts, settleFinances } from './finance';
import { awardHonours, computeAwards, hallOfFameCheck } from './awards';
import { nicknameWinter } from './nicknames';
import { seasonMoments } from './milestones';
import { addNews, seasonNews } from './news';
import { otherSportWinter } from './othersport';
import { devForeignAfter, devForeignBefore, isDevForeign } from './devforeign';
import { seasonFans } from './fans';
import { aiStaffWinter } from './staff';
import { runAiPosting } from './posting';
import { mlbWinter } from './mlb';
import { FUTURES, GROWTH, OFFSEASON as O, STAFF } from './tuning';
import { aiTakesKnown, expireForeignPool, foreignPoolAsk, leavePool, poolChoice, toForeignPool } from './foreignpool';
import { draftReturnees } from './returnees';
import { awardAlert, retirementAlert, seasonAlert } from './alerts';
import { applyInternational, asianGamesSoon, marchEvents, novemberEvents, winterSquads } from './national';
import { staffEdge, staffRating } from './staff';
import { gmDraftWeights, gmOf, sidesOf } from './twelve';
import { closeRivalry } from './rivalry';
import { facilityAging, facilityGrowth } from './facilities';
import { declineOf, growTools, matureAge, traitsOf } from './traits';
import { heroInterview } from './interviews';
import { applyCombine } from './combine';
import { isFantasyWinter, openFantasy, runFantasy } from './fantasy';
import type { SeasonAwards } from './awards';
import { runTryout, tryoutYear } from './tryout';
import { kyopoWinter } from './kyopo';
import { abroadVetsWinter } from './abroadvets';
import { playAsiaSeries } from './asiaseries';
import { takeNationalWatch } from './national';
import { naturalizeWinter } from './naturalize';
import { staffAgeWinter } from './staffage';
import { farmMonth, trainingGrowth } from './farmreport';

const normal = (r: () => number) => (r() + r() + r() - 1.5) / 1.5;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

export const rosterLimit = (season: number) => rulesFor(season).rosterLimit;

/** Moves finished-season lines into careers, credits service days and stores the season summary. */
export function closeSeason(s: LeagueState) {
  // 2.0.18: the stand-ins still standing in leave with the season (tempforeign.ts).
  endTemps(s);
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
    // 2.0.4: the spray chart is the season's alone (a save stays small); a pitcher's mix and velocity are kept.
    const { spray: _spray, ...batKept } = line.bat ?? {};
    // 2.0.30: the situations go to his career's (situation.ts), not on each season's record.
    for (const [side, l] of [['bat', line.bat], ['pit', line.pit]] as const) {
      const x = l?.split?.X;
      if (!x) continue;
      addSituations(((p.situ ??= {})[side] ??= {}), x);
      delete l.split!.X;
    }
    // 2.0.64 (gamelog.ts): a season between clubs keeps each club's line, with its WAR.
    const parts = line.parts?.map((x) => ({ ...x, war: Math.round(((x.bat ? batterWar(x.bat, p.position ?? 'DH', lg) : 0) + (x.pit ? pitcherWar(x.pit, lg) : 0)) * 10) / 10 }));
    const rec: SeasonRecord = { year: s.year, teamId: line.teamId, age: ageIn(p, s.year), days: line.days, bat: line.bat ? (batKept as typeof line.bat) : null, pit: line.pit, war: Math.round(war * 10) / 10, ...(line.pit ? seasonMix(p, s.year) : {}), ...(parts ? { parts } : {}) };
    if (line.bat || line.pit || line.days) p.career.push(rec);
    // 2.0.15: the season's venues join his career's.
    if (line.venues) addVenues((p.venues ??= emptyVenues()), line.venues);
    p.service.carriedDays += line.days;
    while (p.service.carriedDays >= KBO_2026.freeAgency.daysPerSeason) {
      p.service.carriedDays -= KBO_2026.freeAgency.daysPerSeason;
      p.service.creditedSeasons++;
    }
  }
  // 1.4.0: the postseason's lines go to each player's postseason record.
  for (const [id, line] of Object.entries(s.postLines ?? {})) {
    const p = s.players[id];
    if (p && (line.bat || line.pit)) (p.post ??= []).push({ year: s.year, teamId: line.teamId, bat: line.bat, pit: line.pit });
  }
  delete s.postLines;
  // 2.0.66: the last month's report on our futures and reserve players (farmreport.ts).
  const lastDay = s.schedule.at(-1)?.date;
  if (lastDay) farmMonth(s, lastDay.slice(0, 7), lastDay);
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
  payIncentives(s, s.year);
  applyDemotionCuts(s, s.year);
  judgeStarterPromises(s, s.year);
  settleCap(s, s.year);
  settleForeignCap(s, s.year);
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
    ...(sidesOf(s) ? { leagues: { ...sidesOf(s)! } } : {}),
    h2h: headToHead(s.scores),
    staff: seasonStaff(s),
  });
  // 2.0.6: a son past his father's career home runs or wins.
  familySeason(s);
  // 2.0.7: home runs in a row end with the season.
  delete s.hrRuns;
  closeMeetings(s);
  // The business year closes with the baseball one: accounts, fans' mood, AI staff changes.
  const summary = s.history[s.history.length - 1]!;
  seasonAlert(s, s.year);
  summary.awards = computeAwards(s, s.year, summary.table, summary.champion);
  awardHonours(s, s.year, summary.awards);
  nicknameWinter(s, s.year);
  awardAlert(s, s.year, summary.awards);
  awardInterview(s, s.year, summary.awards);
  settleFinances(s, s.year, summary.table);
  // 2.0.26: the anti-dynasty alliance and the balance fund (dynasty.ts).
  dynastyWinter(s, s.year);
  seasonMoments(s, s.year, summary.awards);
  seasonNews(s, s.year);
  seasonFans(s, s.year, summary.table, summary.champion);
  closeRivalry(s, s.year);
  // 2.0.38: heads age, and some retire (staffage.ts), before the clubs settle their staff.
  staffAgeWinter(s, s.year);
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
  if (!futuresLeague || (isForeign(p) && !p.origin.devForeign) || ageIn(p, year) > G.maxAge) return 1;
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
  // The user's club's training facilities (V0.10; none for AI clubs, whose staff ratings stand for theirs).
  const built = facilityGrowth(s, p, year);
  const out: Coaching = {};
  for (const [k, role] of Object.entries(TOOL_COACH)) out[k as keyof Tools] = STAFF.growth * staffEdge(staffRating(s, p.teamId, role)) + farm + built;
  return out;
}

/** One year of growth and aging on hidden ability, then a fresh public scouting report. */
/** `slower`: share off the late-career decline (the user's gym, V0.10). */
export function developPlayer(p: Player, year: number, lostDays: number, r: () => number, scale = 1, coaching: Coaching = {}, slower = 0) {
  const age = ageIn(p, year);
  // 2.0.6: his pitches as they stood, for the change shown next season.
  const pitchesBefore = isPitcher(p) ? pitchSnapshot(p) : null;
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
  } else if (isForeign(p) && !p.origin.devForeign) {
    next = { ...h.current };
  } else {
    // By his growth type, genius and work ethic (1.1.0, traits.ts).
    next = growTools(p, age, lostDays, r, p.plan?.focus ?? 'balanced', scale);
  }
  // Coaches speed up (or slow down) the growth part.
  for (const k of Object.keys(next) as (keyof Tools)[]) {
    const before = h.current[k] ?? next[k]!;
    const gain = next[k]! - before;
    if (gain > 0 && coaching[k]) next[k] = clamp(before + gain * (1 + coaching[k]!), 20, 80);
  }
  // Late-career decline on top of Draft Room's aging (which was tuned for players under 33), from an age that
  // goes with his growth type (33 for 보통 since 1.6.0), eased by work ethic (1.1.0).
  const V = O.veteranDecline;
  const extra = declineOf(p, age, V.perYear, V.steepPerYear) * (1 - slower);
  if (extra > 0)
    for (const k of Object.keys(next) as (keyof Tools)[]) {
      const f = k === 'speed' ? V.speed : k === 'command' || k === 'eye' ? V.skill : 1;
      next[k] = clamp(next[k]! - extra * f + normal(r) * 0.6, 20, 80);
    }
  h.current = next;
  if (pitchesBefore) developPitches(p, year, age);
  rescout(p, year + 1, yearIndex + 1, r);
  logGrades(p, year + 1);
  if (pitchesBefore && Object.keys(pitchesBefore).length) p.pitchLast = { season: year, grades: pitchesBefore };
}

/** Abilities in a grade log entry (1.7.0), after the season and the overall grade. */
export const GRADE_KEYS = ['contact', 'power', 'eye', 'speed', 'defense', 'stuff', 'command', 'breaking', 'stamina'] as const;
const GRADE_LOG_MAX = 25;

/** The season's public report, kept for the graph on his screen (a pitcher's batting grades as 0, and the other way). */
export function logGrades(p: Player, season: number) {
  const t = p.scouting.tools as Record<string, number | undefined>;
  const entry = [season, p.scouting.current, ...GRADE_KEYS.map((k) => t[k] ?? 0)];
  const log = (p.gradeLog ??= []);
  if (log.at(-1)?.[0] === season) log[log.length - 1] = entry;
  else log.push(entry);
  if (log.length > GRADE_LOG_MAX) log.splice(0, log.length - GRADE_LOG_MAX);
}

/** Our biggest award winner of the season talks to the reporters (1.2.0): MVP, then 신인왕, then a golden glove. */
function awardInterview(s: LeagueState, year: number, a: SeasonAwards) {
  const u = s.user;
  if (!u) return;
  const ours = (id: PlayerId | null) => !!id && s.players[id]?.teamId === u.teamId;
  const glove = a.goldenGloves.find((g) => ours(g.id));
  const pick: [PlayerId, string] | null = ours(a.mvp) ? [a.mvp!, 'MVP'] : ours(a.rookie) ? [a.rookie!, '신인왕'] : glove ? [glove.id, '골든글러브'] : null;
  if (!pick) return;
  const iv = heroInterview(s, pick[0], `${year}-11-25`, { kind: 'award', label: pick[1] }, `award-${year}-${pick[0]}`);
  if (iv) addNews(s, iv);
}

/** A new public report: current grades through Draft Room's observer, future value from reachable potential. */
export function rescout(p: Player, season: number, yearIndex: number, r: () => number) {
  const role = p.role;
  const seen = observe(p.hidden.current, role, { observerBias: p.hidden.observerBias }, yearIndex, r);
  const age = ageIn(p, season);
  const room = clamp((matureAge(p) - age) / O.scouting.window, 0, 1) * Math.min(1, p.hidden.developmentRate);
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
    // The season's revisions start again from this report (V0.12).
    base: fv,
  });
  delete p.scouting.moved;
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
  // 2.0.28 (moves.ts): retirement, or a foreign player going home.
  if (status === 'retired') noteMove(s, p, 'retire', p.teamId, null);
  else if (p.origin.kind === 'foreign' && p.teamId) noteForeignOut(s, p, p.teamId);
  removeFromRoster(s, p);
  p.teamId = null;
  p.contract = null;
  p.status = status;
  // A player leaving during the season (released, replaced) takes his injury and absence with him.
  delete s.injuries[p.id];
  delete s.away?.[p.id];
  if (!p.career.some((c) => !c.level) && !s.lines[p.id]) delete s.players[p.id];
}

/**
 * The chance a player calls it a career before `season`: from 33 on, rising with age. Ability decides most of it
 * (V0.11): a regular who can still play keeps going, a star into his late thirties; a fringe player goes early,
 * sooner still after a season without a first-team day; a good last season keeps him another year.
 */
export function retirementChance(p: Player, season: number, knownRecords = true): number {
  // 1.6.0: a career's length follows the growth type (초조숙 shorter, 초만성 longer).
  const age = ageIn(p, season) - (isForeign(p) ? 0 : GROWTH.types[traitsOf(p).growth].career);
  const R = O.retirement;
  if (age < R.from) return 0;
  const cur = p.scouting.current;
  const keep = R.byGrade.find(([grade]) => cur >= grade)?.[1] ?? R.weak;
  let base = age >= R.old.age ? R.old.chance * Math.max(keep, R.old.floor) : R.byAge[Math.min(age - R.from, R.byAge.length - 1)]! * keep;
  if (knownRecords) {
    const last = lastRecord(p, season - 1);
    if (!last || last.days === 0) base *= 1.6;
    else if (last.war >= R.goodYear) base *= 0.5;
  }
  return clamp(base, 0, 0.97);
}

/** 1.9.3: 강철야구 — the veterans who came back to the tryout keep playing through the club's first three seasons. */
export const STEEL_HOLD = 3;

/** The club whose players don't retire before `season` (강철야구's first seasons), or null. */
function steelHeld(s: LeagueState, season: number): TeamId | null {
  const u = s.user;
  return u?.settings.scenario === 'steel' && season < u.firstTeamYear + STEEL_HOLD ? u.teamId : null;
}

/** Who decides to retire after `year` (the user's decision and the step draw the same list). */
export function retiring(s: LeagueState, year: number): PlayerId[] {
  const r = rng(`${s.seed}|retire|${year}`);
  const out: PlayerId[] = [];
  const held = steelHeld(s, year + 1);
  for (const p of Object.values(s.players)) {
    if (p.status !== 'active' || isForeign(p)) continue;
    // The same draw for everyone, then a career ended by an injury (1.6.0) goes whatever it says.
    const wants = r() < retirementChance(p, year + 1);
    if ((wants && !(held && p.teamId === held)) || p.life?.careerOver) out.push(p.id);
  }
  return out;
}

/** The chance a player who wants to retire listens when the club asks him to play on (V0.11): younger and better, likelier. */
export function persuadeChance(p: Player, season: number): number {
  const P = O.retirement.persuade;
  return clamp(P.base - Math.max(0, ageIn(p, season) - P.from) * P.perYear + (p.scouting.current - 50) * P.perGrade, P.min, P.max);
}

// ── Military service and national teams ─────────────────────────────────────────────────────────

/** The twelfth club before its first first-team season (V0.9): it keeps its few players out of the army. */
const founding = (s: LeagueState, teamId: TeamId, next: number) => !!s.twelve && s.twelve.teamId === teamId && next <= s.twelve.firstTeam;

export function enlist(s: LeagueState, p: Player, next: number, r: () => number, onlyMust = false) {
  const M = O.military;
  const age = ageIn(p, next);
  const last = lastRecord(p, next - 1);
  const must = age >= M.mustAge;
  if (!must && onlyMust) return;
  if (!must) {
    if (age < M.minAge) return;
    const days = last?.days ?? 0;
    const lost = s.lines[p.id]?.lost ?? 0;
    const route = lost >= 105 ? 'rehab' : days >= 120 && (last?.war ?? 0) >= 1.5 ? 'regular' : days >= 60 ? 'backup' : days > 0 ? 'cameo' : 'futures';
    const factor = M.byAge.find(([maxAge]) => age <= maxAge)?.[1] ?? M.byAge[M.byAge.length - 1]![1];
    // Clubs hold back likely picks when Asian Games are this season or next.
    const games = asianGamesSoon(next);
    if (games && p.scouting.current >= M.holdForGames && age <= (games.limit?.maxAge ?? 99)) return;
    // A 4급 player in a long rehab serves now: the service and the rehab run together.
    const rehab = socialOnly(p) && (s.injuries[p.id]?.until ?? '') > `${next}-05-01`;
    if (r() >= (rehab ? M.socialInRehab : Math.min(0.95, (M.byRoute[route] ?? 0.2) * factor))) return;
  }
  const route = socialOnly(p) ? 'social' : r() < sangmuChance(p, next) ? 'sangmu' : r() < M.socialBase ? 'social' : 'army';
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

export const faSeasonsNeeded = (p: Player, next: number) => {
  // 1.9.5: a league that plays history has no free agency before the winter of 1999, then the year's seasons (college
  // players one fewer from 2011; RULES.md §14).
  if (playsHistory() && next - 1 < MODERN_FROM) {
    const n = rulesFor(next - 1).freeAgencySeasons;
    return n == null ? Infinity : n - (p.origin.entryCategory === 'college' && next - 1 >= 2011 ? 1 : 0);
  }
  return faSeasonsFor(p, next - 1);
};

/** Seasons to free agency for a player after `season` (1.9.9: as the board set them; college players one fewer). */
export function faSeasonsFor(p: Player, season: number): number {
  const board = boardValue('faSeasons', season);
  if (board !== undefined) return board - (p.origin.entryCategory === 'college' ? 1 : 0);
  return p.origin.entryCategory === 'college' ? KBO_2026.freeAgency.seasonsCollege : KBO_2026.freeAgency.seasonsHighSchool;
}

export function isFreeAgent(p: Player, next: number) {
  if (isForeign(p) || p.status !== 'active' || !p.teamId) return false;
  if (p.contract && p.contract.salaries.some((x) => x.season >= next)) return false;
  const s = p.service;
  // A declined period option or an opt-out (V0.8) frees him whatever his service.
  if (s.optionFree === next - 1) return true;
  if (faSeasonsNeeded(p, next) === Infinity) return false;
  return s.lastFreeAgencyAt === undefined ? s.creditedSeasons >= faSeasonsNeeded(p, next) : s.creditedSeasons - s.lastFreeAgencyAt >= KBO_2026.freeAgency.seasonsToRequalify;
}

/** A season's pay: salaries and free-agent bonuses spread over their deals (V0.8). */
export function payroll(s: LeagueState, teamId: TeamId, season: number) {
  return orgIds(s, teamId).reduce((sum, id) => sum + salaryIn(s.players[id]!, season) + budgetBonus(s.players[id]!, season), 0);
}

/** Players who reach free agency this winter and have a market (the rest re-sign as usual). */
export function freeAgentsFor(s: LeagueState, next: number): Player[] {
  return Object.values(s.players)
    .filter((p) => isFreeAgent(p, next))
    .filter((p) => p.scouting.current >= O.freeAgency.minGrade || (lastRecord(p, next - 1)?.war ?? 0) >= 1 || p.service.optionFree === next - 1)
    .sort((a, b) => b.scouting.current - a.scouting.current);
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
/** 1.9.7: the rounds are the year's (a history game's draft grows; today's eleven otherwise). The draft held in
    September of `draftYear` fills the next season. */
export const standardSlots = (order: TeamId[], draftYear?: number): DraftSlot[] =>
  Array.from({ length: draftYear === undefined ? KBO_2026.draft.rounds : rulesFor(draftYear + 1).draftRounds }, (_, i) => order.map((teamId) => ({ teamId, label: `${i + 1}R` }))).flat();

/** Puts the September draft of `draftYear` on the board. */
export function openDraft(s: LeagueState, draftYear: number, slots: DraftSlot[]): DraftState {
  // The class as the clubs know it after the combine (1.3.0).
  const pool = applyCombine(s.seed, draftYear, draftClass(s.seed, draftYear, s.unified));
  // 2.0.39: the high schools our club sponsors send their players a little better (schools.ts).
  schoolBoost(s, pool, draftYear);
  for (const p of pool) s.players[p.id] = p;
  // Draftees who went abroad and are back after the two-year wait (V0.7.3), ranked among this class.
  const back = draftReturnees(s, draftYear);
  for (const p of back) p.amateur.draftRank = 1 + pool.filter((q) => futureValue(q) > futureValue(p)).length;
  return { year: draftYear, slots: [...territorialSlots(s, draftYear, slots), ...slots], next: 0, pool: [...pool, ...back].map((p) => p.id), developmentDone: false };
}

/** 1.9.5: a league that plays history picks its territorial (1차) players first, up to the year's number each (no limit
    in the early 1980s: three, a game assumption), from the high schools of its region (RULES.md §14). */
export const TERRITORIAL_CAP = 3;
function territorialSlots(s: LeagueState, draftYear: number, slots: DraftSlot[]): DraftSlot[] {
  // 1.9.9: outside a history game, only when the board brought them back (board.ts).
  if (!s.historical && boardValue('territorial', draftYear + 1) === undefined) return [];
  const n = Math.min(rulesFor(draftYear + 1).territorialPicks, TERRITORIAL_CAP);
  if (n <= 0) return [];
  const clubs = [...new Set(slots.map((x) => x.teamId))];
  return Array.from({ length: n }, () => clubs.map((teamId) => ({ teamId, label: __i18n_k("league.offseason.text.f1f3e66a"), territorial: true }))).flat();
}

/** A prospect from the club's region (where he went to school or was born; 2.0.39: or from the region its city lies in). */
const fromRegion = (s: LeagueState, teamId: TeamId, p: Player) => hometownClub(s, teamId, p.education.region, p.birthplace) || p.education.region === draftRegionOf(s, teamId);
/** 1.9.8: who a club may take with a territorial (1차) pick: a high-school player from its region. */
/** 2.0.39: high school only — the early and two-year college entrants and the overseas returnees went through too. */
export const territorialEligible = (s: LeagueState, teamId: TeamId, p: Player) => p.origin.entryCategory === 'high-school' && fromRegion(s, teamId, p);

function draftScore(s: LeagueState, p: Player, counts: Record<string, number>, r: () => number, weights: [number, number] = [0.6, 0.4]) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const need = clamp(((TARGET_SHARE[p.role] ?? 0.2) - (counts[p.role] ?? 0) / total) * 40, -4, 4);
  return futureValue(p) * weights[0] + currentValue(p) * weights[1] - p.amateur.draftRank * 0.02 + need + normal(r) * 2;
}

/** The pick an AI club (or the auto-pick for the user) would make. */
/** 2.0.60 (the user's request): the priority the general manager sets before leaving a pick to the scouts — a position
    (선발·불펜·포수·내야·외야) and a pathway (고졸·대졸·그 밖), either or both. The draft table shows only those
    players, and the scouts pick among them (any of the rest when none is left). */
export type DraftPathway = 'hs' | 'college' | 'other';
export interface DraftPrefer {
  role?: import('../draftroom').Role;
  path?: DraftPathway;
}
export const DRAFT_ROLES: import('../draftroom').Role[] = ['SP', 'RP', 'C', 'IF', 'OF'];
export const DRAFT_PATHS: DraftPathway[] = ['hs', 'college', 'other'];
/** High school, college (four-year, early entry, two-year) or the rest (independent clubs, back from abroad). */
export const draftPathOf = (p: Player): DraftPathway => (p.origin.pathway === '고졸' ? 'hs' : /대|2년제/.test(p.origin.pathway) ? 'college' : 'other');
export const fitsPrefer = (p: Player, pr: DraftPrefer | undefined) => !pr || ((!pr.role || p.role === pr.role) && (!pr.path || draftPathOf(p) === pr.path));

/** The scouts' pick for us under the general manager's priority; their own pick when no one fits it. */
export function preferredDraftChoice(s: LeagueState, d: DraftState, teamId: TeamId, pickNo: number): Player | null {
  if (d.prefer && (d.prefer.role || d.prefer.path)) {
    const p = aiDraftChoice(s, { ...d, pool: d.pool.filter((id) => fitsPrefer(s.players[id]!, d.prefer)) }, teamId, pickNo);
    if (p) return p;
  }
  return aiDraftChoice(s, d, teamId, pickNo);
}

export function aiDraftChoice(s: LeagueState, d: DraftState, teamId: TeamId, pickNo: number): Player | null {
  const r = rng(`${s.seed}|draft-picks|${d.year}|${pickNo}`);
  const counts = orgCounts(s, teamId);
  // The twelfth club's front office leans to upside or to readiness (V0.9).
  const weights = gmDraftWeights(gmOf(s, teamId));
  let best: Player | null = null,
    bestScore = -Infinity;
  const territorial = !!d.slots[pickNo - 1]?.territorial;
  for (const id of d.pool) {
    const p = s.players[id]!;
    if (territorial && !territorialEligible(s, teamId, p)) continue;
    const v = draftScore(s, p, counts, r, weights);
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
  p.origin.draftGrade = p.scouting.futureValue;
  // 1.9.7: a territorial (1차) pick is on record as one; the others are numbered among themselves (2차).
  const before = d.slots.slice(0, d.next).filter((x) => x.territorial).length;
  if (slot.territorial) p.origin.territorial = true;
  else if (before) p.origin.secondPick = overall - before;
  logPick(s, p, slot.teamId, d.year, overall, slot.label);
  // 2.0.6: now and then a coach's son, a player's younger brother or a twin.
  familyAtPick(s, p, slot.teamId, d.year, overall, (s.draftLog ?? []).filter((x) => x.year === d.year && x.id !== p.id).map((x) => x.id));
  logGrades(p, d.year + 1);
  if (slot.via) p.origin.pickVia = slot.via;
  schoolPick(s, p, slot.teamId);
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
    // 1.9.5: a territorial pick nobody from the region is left for is passed.
    if (slot.territorial && !aiDraftChoice(s, d, slot.teamId, d.next + 1)) {
      d.next++;
      continue;
    }
    // 1.9.8: ours, the territorial picks too (among the region's high-school players).
    if (slot.teamId === s.user?.teamId) {
      const eligible = slot.territorial ? d.pool.filter((id) => territorialEligible(s, slot.teamId, s.players[id]!)) : undefined;
      s.pending = { kind: 'draftPick', overall: d.next + 1, label: slot.label, ...(eligible ? { eligible } : {}) };
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
    // Development contracts (육성선수) for the best of the rest (2.0.50: when there are any that year).
    const order = [...new Set(d.slots.map((x) => x.teamId))].filter((id) => !(userDrafts && id === userTeam));
    for (let k = 0; developmentOpen(d.year + 1) && k < O.development.signings; k++)
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
  pruneFamilies(s);
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
    noteMove(s, p, 'release', p.teamId, null);
    p.teamId = null;
    released.push(p);
  };
  for (const t of s.teams) {
    if (t.id === s.user?.teamId) continue; // the user's club is never cut by the AI
    const dev = developmentIds(s, t.id)
      .map((id) => s.players[id]!)
      // 2.0.37: development foreign players have their own places (devforeign.ts).
      .filter((p) => !isDevForeign(p))
      .sort((a, b) => keepValue(b, next) - keepValue(a, next));
    // 2.0.50: none before there were any (a legacy save from before: the ones it has go).
    dev.forEach((p, i) => {
      if (i >= D.aiTarget || ageIn(p, next) > D.maxAge || !developmentOpen(next)) release(p);
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
      if (ageIn(p, next) <= D.convertAge && devCount < D.aiTarget && developmentOpen(next)) {
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
      noteMove(s, p, 'signReleased', null, to.id);
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
  // 1.9.6: a history game's cap holds for a renewal too (12만 달러 to 2004).
  const cap = historicForeignCap(next) ?? 1_800_000;
  const asked = prevUsd + (p.origin.asiaQuota ? Math.min(KBO_2026.foreign.asiaQuotaRaisePerYearUSD, raise) : raise);
  // 2.0.39 (the user's report): a replacement signed late in the season was paid for the weeks left (a few tens of
  // thousands of dollars) and re-signed from that; now he asks at least what a full season of him is worth.
  return Math.round(Math.min(cap, Math.max(asked, foreignWorth(p, war))) / 10_000) * 10_000;
}

/** 2.0.39: what a full season of a foreign player is worth to re-sign (US dollars): his grade, scaled by his last
    season (a flop is cheap, a star asks near the cap). The Asia quota player under his own cap. */
export const FOREIGN_WORTH = { regular: { base: 450_000, perGrade: 45_000, from: 50 }, asia: { base: 90_000, perGrade: 5_000, from: 45 } };
export function foreignWorth(p: Player, war: number): number {
  const W = p.origin.asiaQuota ? FOREIGN_WORTH.asia : FOREIGN_WORTH.regular;
  const form = war >= 4 ? 1.3 : war >= 2.5 ? 1.15 : war >= 1 ? 0.95 : war >= 0 ? 0.75 : 0.55;
  const worth = (W.base + (p.scouting.current - W.from) * W.perGrade) * form;
  return Math.max(0, p.origin.asiaQuota ? Math.min(KBO_2026.foreign.asiaQuotaCapUSD, worth) : worth);
}

/** A star foreign player may leave for MLB or NPB whatever the club offers (chance by his season). 2.0.27: less
    often (most of the KBO's best foreigners stay a few seasons), and a player past 35 may still sign on. */
export function foreignLeaves(s: LeagueState, p: Player, next: number) {
  const war = lastRecord(p, next - 1)?.war ?? 0;
  const chance = ageIn(p, next) > 35 ? 0.6 : war >= 6 ? 0.35 : war >= 4 ? 0.12 : 0.03;
  return rng(`${s.seed}|foreign-abroad|${next}|${p.id}`)() < chance;
}

export function renewForeigners(s: LeagueState, teamId: TeamId, next: number, r: () => number) {
  const current = orgPlayers(s, teamId).filter((p) => isForeign(p) && !isDevForeign(p));
  const wanted = new Set(
    current
      .filter((p) => {
        const last = lastRecord(p, next - 1);
        return last && ageIn(p, next) <= 35 && last.war >= (isPitcher(p) ? O.foreign.keepWarPitcher : O.foreign.keepWarHitter) && r() < O.foreign.keepChance;
      })
      .map((p) => p.id),
  );
  // The foreign salary cap (V0.7.8): the best seasons first; a keeper who would leave too little room for
  // the signings still to come is let go.
  const regular = current.filter((p) => !p.origin.asiaQuota && wanted.has(p.id) && !slotExempt(s, p, next)).sort((a, b) => (lastRecord(b, next - 1)?.war ?? 0) - (lastRecord(a, next - 1)?.war ?? 0));
  const slots = foreignSlots(s, teamId, next).regular;
  const kept: Player[] = [];
  let total = 0;
  for (const p of regular) {
    const ask = foreignRenewalAsk(p, next);
    const reserve = Math.max(0, slots - kept.length - 1) * O.foreign.newReserveUSD;
    if (total + ask + reserve > foreignCap(s, teamId, next, [...kept, p])) wanted.delete(p.id);
    else {
      kept.push(p);
      total += ask;
    }
  }
  for (const p of current) {
    if (wanted.has(p.id)) p.contract = foreignContract(teamId, next, splitContract(foreignRenewalAsk(p, next), r), !!p.origin.asiaQuota, p.origin.asiaQuota ? asiaCapFor(p, teamId, next) : undefined);
    // Not kept: a star may go to MLB or Japan; the others join the market of KBO-experienced foreigners.
    else if (!(s.user && !foreignLeaves(s, p, next) && toForeignPool(s, p, next - 1))) leaveLeague(s, p, 'overseas');
  }
}

/** With the player's club in the league, every AI club decides whom to keep before the user's foreign
    signings, so the players let go are on the market in time (the real order: reserve lists at the end
    of November, new signings over the winter). */
export function aiForeignRenewals(s: LeagueState, next: number) {
  const o = s.offseason;
  if (!s.user || !o || o.foreignRenewed) return;
  const r = rng(`${s.seed}|foreign-renew|${o.year}`);
  for (const t of s.teams) {
    if (t.firstTeamFrom === null || t.firstTeamFrom > next || t.id === s.user.teamId) continue;
    renewForeigners(s, t.id, next, r);
  }
  o.foreignRenewed = true;
}

export const foreignOn = (s: LeagueState, teamId: TeamId) => orgPlayers(s, teamId).filter((p) => isForeign(p) && !isDevForeign(p));

/** Keeps each AI club at three foreign players (two pitchers, one hitter) plus the Asia quota from 2026. */
export function refreshForeigners(s: LeagueState, next: number, r: () => number) {
  // 1.9.6: in a tryout year (1998–1999 of a history game) the clubs keep or let go their own first, then draft.
  if (tryoutYear(next)) {
    for (const t of s.teams)
      if (t.firstTeamFrom !== null && t.firstTeamFrom <= next && t.id !== s.user?.teamId && !s.offseason?.foreignRenewed) renewForeigners(s, t.id, next, r);
    if (s.offseason) s.offseason.foreignRenewed = true;
    runTryout(s, next, false);
  }
  const cap = historicForeignCap(next);
  for (const t of s.teams) {
    if (t.firstTeamFrom === null || t.firstTeamFrom > next) continue; // no foreign players in a futures-only season
    if (t.id === s.user?.teamId) continue; // the user's club renews and signs in its own foreign decision
    if (!s.offseason?.foreignRenewed) renewForeigners(s, t.id, next, r);
    const slots = foreignSlots(s, t.id, next);
    // The veterans the optional rule exempts take no slot (1.2.0).
    const staying = slotForeigners(s, t.id, next);
    const regular = staying.filter((p) => !p.origin.asiaQuota);
    const pitchers = regular.filter(isPitcher).length;
    let k = 0;
    // Under the foreign salary cap (V0.7.8): each new signing gets at most what is left, keeping a floor for the rest.
    const price = (ask: number, asia: boolean) => {
      if (asia) return ask;
      const signed = capPlayers(s, t.id, next);
      const left = slots.regular - signed.length - 1;
      const room = foreignCap(s, t.id, next, signed) - signed.reduce((a, p) => a + usdTotal(p.contract), 0) - left * O.foreign.newFloorUSD;
      return Math.min(cap ?? Infinity, Math.max(O.foreign.newFloorUSD, Math.min(ask, room)));
    };
    const add = (kind: 'pitcher' | 'hitter', asia: boolean) => {
      const id = `f${next}-${t.id}-${k++}`;
      // Now and then a proven KBO foreigner another club let go (foreignpool.ts, own stream).
      const known = poolChoice(s, kind, asia);
      if (known && aiTakesKnown(`${s.seed}|foreign-pool|${next}|${id}`)) {
        leavePool(s, known.id);
        sign(s, known, t.id, foreignContract(t.id, next, splitContract(price(foreignPoolAsk(s, known), asia), rng(`${s.seed}|foreign-pool-terms|${next}|${id}`)), asia, cap ?? undefined));
        return;
      }
      // 1.7.0: now and then an old big-league name (players.ts veteranOnMarket).
      const p = makeForeign(s.seed, id, next, { kind, asiaQuota: asia, veteran: !asia && hashUnit(`${s.seed}|ai-veteran|${id}`) < AI_VETERAN });
      sign(s, p, t.id, foreignContract(t.id, next, splitContract(price(p.origin.background!.ask, asia), r), asia, cap ?? undefined));
    };
    for (let i = pitchers; i < 2 && regular.length + k < slots.regular; i++) add('pitcher', false);
    while (regular.length + k < slots.regular) add('hitter', false);
    if (slots.asia && !staying.some((p) => p.origin.asiaQuota)) add(r() < 0.75 ? 'pitcher' : 'hitter', true);
  }
}

/** 1.7.0: the share of an AI club's new regular foreign signings who are old big-league names. */
const AI_VETERAN = 0.05;

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
  /** The twelfth club's part of a step (V0.9), once, after the user's decision and before the step's own work. */
  auto?(s: LeagueState, step: OffseasonStep): void;
}
const hooks: OffseasonHooks = {};
export const setOffseasonHooks = (h: OffseasonHooks) => Object.assign(hooks, h);

export const OFFSEASON_STEPS = ['board', 'international', 'develop', 'retire', 'military', 'posting', 'freeAgency', 'renew', 'draft', 'special', 'secondDraft', 'limits', 'released', 'foreign', 'check', 'camp'] as const;
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
    if (hooks.auto && (s.twelve || s.unified || s.legacy) && !o.done.includes(`auto:${step}`)) {
      o.done.push(`auto:${step}`);
      hooks.auto(s, step);
    }
    switch (step) {
      case 'board':
        // 1.9.9: the winter's board meeting (board.ts), when our club did not hold it through its decision.
        if (boardMeets(s, year) && !o.boardHeld) holdMeeting(s, year, committeeMotions(s, year));
        o.boardHeld = true;
        break;
      case 'international':
        // November events: named and played now (V0.12); anything else of the year left unfinished too.
        winterSquads(s, novemberEvents(year));
        applyInternational(s, year);
        // 2.0.42: the Asia Series, when the league plays it (asiaseries.ts).
        playAsiaSeries(s, year, s.history.find((h) => h.year === year)?.champion ?? null);
        // 2.0.42: the November tournament's games, watched or not (the step runs again after: it is all done once).
        if (takeNationalWatch(s)) return 'waiting';
        break;
      case 'develop': {
        const futuresLeague = !!s.history.find((h) => h.year === year)?.futures;
        // 2.0.8: new pitches learned over the winter (ours as planned, other clubs' now and then).
        learnWinter(s, year);
        // 2.0.12: the other side grows or fades; other clubs' two-way and turned-around players.
        twoWayWinter(s, year);
        // 1.7.0: the future grade moves once a season, here; our young players' moves make one report.
        const before = futureBefore(s);
        for (const p of Object.values(s.players)) {
          if (p.status === 'retired' || p.status === 'overseas' || p.status === 'amateur') continue;
          if (p.proSince > year) continue; // drafted this fall, first season still ahead
          // The ceiling moves first (V0.12): a breakout, a stall, a little drift.
          driftPotential(p, year, rng(`${s.seed}|potential|${year}|${p.id}`));
          // 2.0.39: a settled or pressured season costs a step first (contractmood.ts).
          moodWinter(s, p, year);
          developPlayer(p, year, s.lines[p.id]?.lost ?? 0, rng(`${s.seed}|develop|${year}|${p.id}`), growthScale(p, year, futuresLeague) * trainingGrowth(s, p, year), coachingFor(s, p, year), facilityAging(s, p));
          // A season of regular play at a new position adds it to his list (V0.11).
          learnPositions(p, s.lines[p.id]?.bat?.posG);
          // Other clubs move a player who has lost the glove or legs for his spot (V0.12); ours is the user's call (camp).
          const to = p.teamId !== s.user?.teamId ? positionMove(p) : null;
          if (to) changePosition(p, to);
        }
        winterReport(s, year, before);
        break;
      }
      case 'retire': {
        // Players the user's club talked round stay (V0.11); our retirements make a pop-up.
        const stay = new Set(o.stay ?? []);
        const gone = retiring(s, year)
          .filter((id) => !stay.has(id) || s.players[id]!.life?.careerOver)
          .map((id) => s.players[id]!);
        retirementAlert(s, gone, o.stay ?? [], year);
        for (const p of gone) leaveLeague(s, p, 'retired');
        // 2.0.37: now and then one leaves for another sport, and one who left comes back.
        otherSportWinter(s, year);
        break;
      }
      case 'military': {
        medicalReview(s, year);
        const r = rng(`${s.seed}|military|${year}`);
        for (const p of Object.values(s.players)) {
          if (p.status === 'military' && p.service.returnsOn && p.service.returnsOn < `${next}-03-01`) {
            p.status = 'active';
            p.service.military = 'served';
            delete p.service.route;
            delete p.service.returnsOn;
            if (p.teamId) s.rosters[p.teamId]!.futures.push(p.id);
          } else if (p.status === 'active' && p.service.military === 'pending' && !isForeign(p) && p.teamId && p.teamId !== s.user?.teamId) enlist(s, p, next, r, founding(s, p.teamId, next));
        }
        break;
      }
      case 'posting':
        // 1.7.0: last season's line for our players in the majors (mlb.ts), then this winter's postings.
        mlbWinter(s, year);
        runAiPosting(s, next);
        break;
      case 'freeAgency': {
        // No market in the fantasy draft's winter (1.6.0): every player is on the board anyway.
        if (isFantasyWinter(s, year)) {
          o.faDone = true;
          break;
        }
        // The negotiation in rounds (V0.8): period options first, then the market opens.
        if (!o.faDone && !o.fa) {
          settlePeriodOptions(s, next);
          o.fa = openMarket(s, next);
        }
        const m = o.fa;
        while (!o.faDone) {
          // Protected lists and compensation picks the user owes, one at a time, as signings happen.
          const item = o.faQueue?.[0];
          if (item) {
            s.pending = queuedDecision(s, item, next);
            return 'waiting';
          }
          if (!m || m.closed) {
            if (m) closeMarket(s, m, next);
            o.faDone = true;
            break;
          }
          if (s.user && !m.run) {
            s.pending = roundDecision(m);
            return 'waiting';
          }
          const touched = playRound(s, m, next);
          if (m.run === 'round' || (m.run === 'news' && touched)) delete m.run;
        }
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
        // 판타지 드래프트 (1.6.0): the whole league and this year's class, in place of the rookie draft.
        if (isFantasyWinter(s, year)) {
          o.fantasy ??= openFantasy(s, year);
          if (runFantasy(s, o.fantasy) === 'wait') return 'waiting';
          break;
        }
        if (!o.draft) {
          const table = s.history[s.history.length - 1]?.table ?? [];
          let order = table.length ? [...table].reverse().map((row) => row.teamId) : firstTeamIds(s, year);
          // 2.0.17: the board's draft lottery (lottery.ts).
          if (table.length && boardValue('lottery', year + 1) === 1) {
            const res = lotteryOrder(s, year, order);
            order = res.after;
            lotteryNews(s, res);
          }
          // Picks traded during the year (V0.7.8) go to the clubs that hold them.
          const slots = applyPickTrades(s, year, applyForeignPickDrop(s, year, applyPickDrop(s, year, hooks.draftSlots?.(s, year, order) ?? standardSlots(order, year))));
          o.draft = openDraft(s, year, slots);
        }
        if (runDraft(s, o.draft) === 'wait') return 'waiting';
        break;
      }
      case 'special':
        break; // expansion special draft: entirely a user decision (see expansion.ts)
      case 'secondDraft': {
        if (!isSecondDraftYear(year) || isFantasyWinter(s, year)) break;
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
        // 1.9.9: fewer foreign places from next season (board.ts): the clubs over them let their least valuable go.
        trimForeigners(s, next);
        o.released = cutToLimits(s, next).map((p) => p.id);
        break;
      case 'released':
        placeReleased(
          s,
          o.released.map((id) => s.players[id]!).filter(Boolean),
          next,
          rng(`${s.seed}|limits|${year}`),
        );
        // 2.0.42: the AI clubs' long-serving foreign players who naturalize (naturalize.ts), before the foreign step.
        naturalizeWinter(s, next);
        break;
      case 'foreign':
        // 2.0.37: development foreign players — those three seasons in go, ready ones take a slot (devforeign.ts).
        devForeignBefore(s, next);
        refreshForeigners(s, next, rng(`${s.seed}|foreign|${year}`));
        devForeignAfter(s, next);
        expireForeignPool(s, year);
        // 1.9.6: overseas Korean players of a history game (kyopo.ts).
        kyopoWinter(s, next);
        // 2.0.41: Korean veterans home from abroad, in any game (abroadvets.ts).
        abroadVetsWinter(s, next);
        break;
      case 'check':
        break; // the user's club over the limit after foreign signings: a user decision (expansion.ts)
      case 'camp':
        // Spring camp plans are a user decision only (AI clubs keep balanced plans), but AI clubs set their depth
        // chart here, newcomers included (V0.12). Opening day is near: the reinforcements promised to free agents are judged.
        for (const t of s.teams) if (s.rosters[t.id] && t.id !== s.user?.teamId) balanceDepth(orgPlayers(s, t.id).filter((p) => p.status === 'active'));
        // The March tournament's squad is named before camp ends (V0.12).
        winterSquads(s, marchEvents(next));
        judgeReinforcePromises(s, o.fa, next);
        break;
    }
    o.step++;
  }
  s.offseason = null;
  s.year = next;
  return 'done';
}

/** 1.9.9: a club with more foreign players than next season's places (the board cut them, board.ts) lets the least
    valuable go, ours too (with a notice): they join the market of KBO-experienced foreigners or go abroad. */
function trimForeigners(s: LeagueState, next: number) {
  for (const t of s.teams) {
    if (!s.rosters[t.id] || t.firstTeamFrom === null || t.firstTeamFrom > next) continue;
    const slots = foreignSlots(s, t.id, next);
    const have = slotForeigners(s, t.id, next);
    for (const [asia, max] of [
      [false, slots.regular],
      [true, slots.asia],
    ] as const) {
      const list = have.filter((p) => !!p.origin.asiaQuota === asia).sort((a, b) => currentValue(a) - currentValue(b) || a.id.localeCompare(b.id));
      for (const p of list.slice(0, Math.max(0, list.length - max))) {
        if (t.id === s.user?.teamId) addNews(s, { id: `foreign-cut-${next}-${p.id}`, date: `${next - 1}-12-01`, kind: 'move', title: __i18n_k("league.offseason.text.19a2581b", { name: p.name }), body: __i18n_k("league.offseason.text.d65e73e3", { name: p.name }), quotes: [], facts: {}, players: [p.id], mine: true });
        removeFromRoster(s, p);
        if (!(s.user && !foreignLeaves(s, p, next) && toForeignPool(s, p, next - 1))) leaveLeague(s, p, 'overseas');
      }
    }
  }
}

/** A whole draft with AI picks only (the history bootstrap). */
export function runWholeDraft(s: LeagueState, draftYear: number, order: TeamId[]) {
  runDraft(s, openDraft(s, draftYear, standardSlots(order, draftYear)));
}

/** A whole offseason with no user decisions (spectator leagues and history). */
export function runOffseason(s: LeagueState) {
  beginOffseason(s);
  if (advanceOffseason(s) === 'waiting') throw new Error('offseason waits for a decision; use advanceOffseason');
}

export { lastRecord, removeFromRoster };
