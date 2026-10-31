import { k as __i18n_k } from '../i18n/index';
/* The regular season, one game day at a time: registered days, games, injuries and roster moves. */
import { recordVenues } from './venues';
import { logGame, notePart, partFor } from './gamelog';
import { farmMonth } from './farmreport';
import { addBatted, emptyBatted } from './battedball';
import { addField, emptyField } from './fielding';
import { layoutOf } from './layout';
import { rng } from '../draftroom';
import type { Player, PlayerId, TeamId } from '../model/types';
import { draftWatchDay } from './draftlog';
import { captainDay } from './captains';
import { adaptDay } from './adapt';
import { freakDay } from './freak';
import { simulateGame } from './engine/game';
import { emptySplit, type GameIn, type GameOut, type PlayEvent, type Splits, type TeamBox } from './engine/types';
import { compactBox, isUserGame, keepBox } from './boxscore';
import { gameMoments, milestone } from './milestones';
import { gameNews, milestoneNews, monthNews } from './news';
import { parkFactor } from './clubs';
import { assignSquads, futuresPreference, futuresSquad, makeFuturesLeague } from './futures';
import { chooseActive, firstTeamSize, matchInputs, pinnedIds } from './manager';
import { eunneun } from './josa';
import { noteEligibility } from './postentry';
import { assignUnifiedLeagues } from './unified';
import { manualReplacements, MIN_FIRST_TEAM } from './entry';
import { ensureNumbers } from './numbers';
import { attendance, clubState, recordGate } from './fans';
import { staffOf } from './staff';
import { setGoals } from './parent';
import { aiDeadlineDeals, aiForeignChanges, aiTrades, processWaivers } from './trade';
import { aiOffers, OFFERS } from './offers';
import { tempForeignDay } from './tempforeign';
import { tired, travelCost } from './travel';
import { allStarDay } from './allstar';
import { draftClass } from './players';
import { applyCombine, combineDay } from './combine';
import { scandalDay, serveSuspensions } from './scandals';
import { disciplineDay } from './discipline';
import { viralDay } from './viral';
import { staffTroubleDay } from './stafftrouble';
import { rivalDay } from './rivals';
import { brawlGame } from './brawl';
import { protestGame } from './protests';
import { meddleDay } from './scenarios';
import { brokerDay } from './broker';
import { openBooks } from './finance';
import { rosterLimit } from './offseason';
import { finishEvent, marchEvents, nationalTeamBack, nationalTeamCalls, nationalTeamLeaves, takeNationalWatch } from './national';
import { currentValue, isForeign } from './players';
import { makeSchedule } from './schedule';
import { addTiebreaker, isTiebreaker } from './tiebreak';
import { legacySeason } from './legacy1982';
import { rulesFor } from '../rules/history';
import { addMeetings } from './matchups';
import { addInto, developmentIds, emptyBat, emptyPit, firstTeamIds, registeredIds, type FuturesSeason, type LeagueState, type SeasonLine } from './state';
import { devForeignSeason, isDevForeign } from './devforeign';
import { standings } from './standings';
import { ENGINE } from './tuning';
import { carryOverInjuries, offRoster, rollInjuries } from './injuries';
import { openForeignBooks } from './foreigncap';
import { assignLeagues, sidesOf, twelveClubs, twelveGames } from './twelve';
import { calledGameNote, callRuling, isResumed, postpone, rainDuring, suspend, typhoonDay, weatherFor } from './weather';
import { finishTrips } from './training';
import { exhibitionDate, planExhibitions, playExhibitionDay } from './exhibition';
import { addSituations } from './engine/situation';
import { lifeDay } from './life';
import { alumniDay } from './alumni';
import { familyDay, familyGame, pruneFamilies } from './family';
import { featsGame } from './feats';
import { boardValue } from './era';
import { boardLeagues, framingWeight } from './board';
import { seasonMoods } from './contractmood';

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);

export function startSeason(s: LeagueState) {
  // 2.0.6: family ties to men gone from the records over the winter.
  pruneFamilies(s);
  s.phase = 'regular';
  // 2.0.59: last season's games called off (weather.ts).
  delete s.calledOff;
  delete s.suspendedGames;
  // 1.9.5: a legacy league's opening day — the clubs founded this year, the year's names, the leagues, the rules.
  legacySeason(s);
  // Twelve clubs (V0.9): two leagues are drawn once, before the first twelve-club season.
  if (s.twelve?.format === 'two' && !s.twelve.leagues && twelveClubs(s)) s.twelve.leagues = assignLeagues(s);
  const teams = firstTeamIds(s);
  // 1.9.2, 통일 한국: the two leagues of eight, drawn before the first sixteen-club season.
  assignUnifiedLeagues(s);
  // 1.9.9: one league or two, as the board voted (board.ts).
  boardLeagues(s);
  // 1.9.1: any other league in two leagues (leagueSides) gets its own pairings.
  const sides = sidesOf(s);
  const twelve = twelveGames(s, teams, s.year);
  // 1.9.5: a league that plays history plays its year's number of games (80 in 1982 … 144 from 2015).
  const games = s.historical || boardValue('games', s.year) !== undefined ? rulesFor(s.year).gamesPerClub : undefined;
  s.schedule = makeSchedule(teams, s.year, s.seed, twelve, games, !twelve && sides ? teams.map((id) => (sides[id] === 'dream' ? 0 : 1)) : undefined);
  s.next = 0;
  s.scores = [];
  s.lines = {};
  s.arms = {};
  s.rotation = {};
  s.away = {};
  s.demoted = {};
  s.waivers = [];
  s.foreignChanges = {};
  delete s.brawls;
  delete s.asiaChanges;
  s.marketDone = [];
  s.postseason = [];
  s.countedThrough = null;
  // Operations from last season can run past opening day (injuries.ts).
  carryOverInjuries(s, s.schedule[0]?.date);
  // The March tournament is over before opening day; a few come back hurt (V0.12).
  for (const e of marchEvents(s.year)) finishEvent(s, e);
  // Winter programmes abroad are over before camp (V0.10).
  finishTrips(s, s.schedule[0]?.date ?? `${s.year}-03-01`);
  for (const id of firstTeamIds(s)) setActive(s, id, chooseActive(s, id));
  // 2.0.39: the season's moods over money (a walk year, a big deal just signed, pay far over his play).
  seasonMoods(s);
  // The foreign players' salary cap: the season's books open with their guaranteed money (V0.7.8).
  openForeignBooks(s);
  s.futures = makeFuturesLeague(s);
  for (const t of s.teams) if (s.rosters[t.id]) assignSquads(s, t.id);
  ensureNumbers(s);
  // Every club's business side (fans, prices, staff) exists from its first season.
  for (const t of s.teams)
    if (s.rosters[t.id]) {
      clubState(s, t.id);
      staffOf(s, t.id);
    }
  s.gate = {};
  s.postseasonGate = 0;
  s.boxes = {};
  s.pbp = {};
  setGoals(s, s.year);
  if (s.user && s.user.firstTeamYear === s.year) milestone(s, s.year, __i18n_k("league.season.startSeason.8c583704", { year: s.year }), 'firstTeam');
  // The owner's budget for the season and season tickets (V0.12).
  openBooks(s);
  // 2.0.30: the spring games before opening day (exhibition.ts).
  planExhibitions(s);
}

// ── Futures league ──────────────────────────────────────────────────────────────────────────────

function playFuturesDay(s: LeagueState, date: string) {
  const f = s.futures;
  if (!f) return;
  const prefer = futuresPreference(s);
  while (f.next < f.schedule.length && f.schedule[f.next]!.date <= date) {
    const g = f.schedule[f.next]!;
    f.next++;
    const { home, away } = matchInputs(
      s,
      g.date,
      { teamId: g.home, ids: futuresSquad(s, g.home), rotationKey: `${g.home}:futures`, prefer },
      { teamId: g.away, ids: futuresSquad(s, g.away), rotationKey: `${g.away}:futures`, prefer },
    );
    if (!home || !away) continue;
    const out = simulateGame({ gameId: g.id, home, away, maxInnings: ENGINE.maxInnings, park: 1 }, gameRng(s, g.id));
    f.scores.push({ id: g.id, date: g.date, home: g.home, away: g.away, hs: out.home.runs, as: out.away.runs });
    const r = rng(`${s.seed}|injury|${g.id}`);
    for (const box of [out.home, out.away]) {
      record(s, box, g.date, f.lines);
      // 2.0.66 (the user's request): the futures player's last ten games and months, as the first team's (gamelog.ts).
      logGame(f.lines, box, g.date, box === out.home ? g.away : g.home, box === out.home);
      rollInjuries(s, box, g.date, r, (id, teamId) => lineOf(s, id, teamId), 'futures');
    }
  }
}

/** Registers `active` as the first team; players who drop off go to the futures squad. */
/** 2.0.64 (the user's request): why one of ours cannot be kept in the futures (2군 전용), or null. */
export function checkFuturesOnly(s: LeagueState, id: PlayerId, on: boolean): string | null {
  const u = s.user;
  const p = s.players[id];
  if (!u || !p || p.teamId !== u.teamId) return __i18n_k("league.season.text.184c07ee");
  if (on && pinnedIds(s).includes(id)) return __i18n_k("league.season.text.abb03c36", { name: eunneun(p.name) });
  return null;
}

/** Keeps one of ours in the futures, or lets the manager call him up again. One on the first team goes down now; the
    manager fills his place (on a roster the general manager runs, it is his to fill). */
export function setFuturesOnly(s: LeagueState, id: PlayerId, on: boolean) {
  const problem = checkFuturesOnly(s, id, on);
  if (problem) throw new Error(problem);
  const u = s.user!;
  const list = (u.futuresOnly ?? []).filter((x) => x !== id && s.players[x]?.teamId === u.teamId);
  if (on) list.push(id);
  if (list.length) u.futuresOnly = list;
  else delete u.futuresOnly;
  const r = s.rosters[u.teamId];
  if (!on || !r?.active.includes(id)) return;
  if (u.entry === 'manual') setActive(s, u.teamId, r.active.filter((x) => x !== id));
  else setActive(s, u.teamId, chooseActive(s, u.teamId));
}

/** 2.0.64: a player just fixed on the lineup card comes up at once when the manager runs the roster (a fixed player
    who cannot play — hurt, away — waits until he can). */
export function keepPinnedUp(s: LeagueState) {
  const u = s.user;
  const r = u && s.rosters[u.teamId];
  if (!u || !r || u.entry === 'manual' || !firstTeamIds(s).includes(u.teamId)) return;
  const ideal = chooseActive(s, u.teamId);
  if (pinnedIds(s).some((id) => ideal.includes(id) && !r.active.includes(id))) setActive(s, u.teamId, ideal);
}

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
    .filter((p) => !isDevForeign(p) && !s.injuries[p.id] && currentValue(p) >= bar)
    .sort((a, b) => currentValue(b) - currentValue(a));
  for (const p of dev) {
    if (room-- <= 0) break;
    registerDevelopment(p);
  }
  // 2.0.37: a development foreign player takes a foreign slot, not a place under the limit (devforeign.ts).
  devForeignSeason(s, teamId, bar);
}

/** 육성선수 → 소속선수: the same salary on a regular contract. */
export function registerDevelopment(p: Player) {
  if (p.contract) p.contract.kind = isForeign(p) ? 'foreign' : 'standard';
}

function lineOf(s: LeagueState, id: PlayerId, teamId: TeamId): SeasonLine {
  return (s.lines[id] ??= { teamId, days: 0, lost: 0, bat: null, pit: null });
}

/** First-team registered days: every calendar day on the active roster (or the injured list) counts. */
function countDays(s: LeagueState, date: string) {
  const from = s.countedThrough ?? addDays(date, -1);
  const days = daysBetween(from, date);
  if (days <= 0) return;
  // 2.0.64 (gamelog.ts): the days go to his club's part too once he has played for two.
  const add = (id: PlayerId, teamId: TeamId) => {
    const line = lineOf(s, id, teamId);
    // The earlier club's part is his line so far: begun before today's days are added.
    const part = partFor(line, teamId);
    line.days += days;
    if (part) part.days += days;
  };
  for (const teamId of firstTeamIds(s)) for (const id of s.rosters[teamId]!.active) add(id, teamId);
  for (const [id, inj] of Object.entries(s.injuries)) if (inj.onList && s.players[id]?.teamId) add(id, s.players[id]!.teamId!);
  for (const id of Object.keys(s.away)) if (s.players[id]?.teamId) add(id, s.players[id]!.teamId!);
  if (s.futures) for (const t of s.teams) for (const id of s.rosters[t.id]?.third ?? []) s.futures.training[id] = (s.futures.training[id] ?? 0) + days;
  s.countedThrough = date;
}

/** Adds a box score to season lines (`lines`; null records only pitcher rest) and updates rest days. */
function addSplits(into: { split?: Splits }, from: Splits) {
  into.split ??= { L: emptySplit(), R: emptySplit() };
  addInto(into.split.L, from.L);
  addInto(into.split.R, from.R);
  if (from.S) addInto((into.split.S ??= emptySplit()), from.S);
  if (from.X) addSituations((into.split.X ??= {}), from.X);
}

/** Adds a box score to the lines (the season's unless given) and to the pitchers' arm use. */
export function record(s: LeagueState, box: TeamBox, date: string, lines: Record<PlayerId, SeasonLine> | null = s.lines) {
  const lineOf = (id: PlayerId, teamId: TeamId) => (lines ? (lines[id] ??= { teamId, days: 0, lost: 0, bat: null, pit: null }) : null);
  for (const b of box.batting) {
    const line = lineOf(b.id, box.teamId);
    if (!line) continue;
    const bat = (line.bat ??= emptyBat());
    const { id: _id, pos: _pos, split, sub, bip, fld, spray, hrSeq: _hrSeq, ...counts } = b;
    addInto(bat, counts);
    if (bip) addBatted((bat.bip ??= emptyBatted()), bip);
    if (fld) addField((bat.fld ??= emptyField()), fld);
    if (split && lines === s.lines) addSplits(bat, split);
    if (spray && lines === s.lines) (bat.spray ??= []).push(...spray);
    // Games at a position are the starts there (1.7.0: a substitute's inning or two does not count).
    if (lines === s.lines && !sub) (bat.posG ??= {})[b.pos] = (bat.posG[b.pos] ?? 0) + 1;
    // 1.7.0: a pinch runner or a late glove played in the game too.
    if (b.pa > 0 || sub) bat.g++;
  }
  for (const p of box.pitching) {
    const line = lineOf(p.id, box.teamId);
    if (line) {
      const pit = (line.pit ??= emptyPit());
      const { id: _id, split, bip, ...counts } = p;
      addInto(pit, counts);
      if (bip) addBatted((pit.bip ??= emptyBatted()), bip);
      if (split && lines === s.lines) addSplits(pit, split);
      pit.g++;
    }
    const arm = s.arms[p.id];
    const consecutive = arm && daysBetween(arm.lastDate, date) === 1 ? arm.streak + 1 : 1;
    s.arms[p.id] = { lastDate: date, lastPitches: p.pitches, streak: consecutive };
  }
  if (box.vs && lines === s.lines) addMeetings(s, box.vs);
}

/** Injured players leave the first team; recovered ones come back when they are better than the weakest. */
function maintainRosters(s: LeagueState, date: string, reshuffle: boolean) {
  // A first-team player back from the injured list or the national team is recalled at once.
  const back = new Set<TeamId>();
  for (const [id, inj] of Object.entries(s.injuries))
    if (inj.until <= date) {
      delete s.injuries[id];
      const p = s.players[id];
      if (inj.onList && p?.teamId) back.add(p.teamId);
    }
  for (const [id, until] of Object.entries(s.away))
    if (until < date) {
      delete s.away[id];
      const p = s.players[id];
      if (p?.teamId) back.add(p.teamId);
    }
  const manual = s.user?.entry === 'manual' ? s.user.teamId : null;
  for (const teamId of firstTeamIds(s)) {
    const r = s.rosters[teamId]!;
    const hurt = r.active.some((id) => offRoster(s, id)) || back.has(teamId);
    if (teamId === manual) {
      // The general manager's roster stands; only players who cannot play are replaced — and (2.0.41) a first team
      // left short by a 문책성 2군행 (discipline.ts) is filled back to the minimum.
      if (hurt || r.active.length < Math.min(firstTeamSize(s, teamId), MIN_FIRST_TEAM)) {
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

export function playGame(s: LeagueState, homeId: TeamId, awayId: TeamId, id: string, date: string, maxInnings: number | null, log?: PlayEvent[], rain?: { inning: number; top: boolean } | null): GameOut | null {
  const { home: home0, away: away0 } = matchInputs(s, date, { teamId: homeId }, { teamId: awayId });
  if (!home0 || !away0) return null;
  // 2.0.22: a side that came from another city for this series plays its first game tired (travel.ts).
  const trip = travelCost(s, id, homeId, awayId);
  const home = tired(home0, trip.home),
    away = tired(away0, trip.away);
  const park = s.teams.find((t) => t.id === homeId)?.stadium.park ?? parkFactor(homeId);
  // 1.9.9: the board's game rules (board.ts), the 승부치기 in the regular season only.
  const ghost = maxInnings !== null ? boardValue('ghostRunner', s.year) : undefined;
  const three = boardValue('threeBatter', s.year) === 1;
  // 2.0.1: the batted-ball stream, apart from the game's so the plays stay as they were drawn.
  const balls = rng(`${s.seed}|balls|${id}`);
  // 2.0.2: the home park's fences (layout.ts).
  const host = s.teams.find((t) => t.id === homeId);
  const layout = host ? layoutOf(host) : undefined;
  // 2.0.17: the umpires (no ABS or challenges) let a catcher's framing count.
  const framing = framingWeight(s.year);
  const input: GameIn = { gameId: id, home, away, maxInnings, park, balls, ...(layout ? { layout } : {}), ...(ghost ? { ghostFrom: 10 } : {}), ...(three ? { threeBatter: true } : {}), ...(framing ? { framing } : {}) };
  if (!rain) return simulateGame(input, gameRng(s, id), log);
  // 2.0.59: rain during the game (weather.ts). The game is drawn whole, then what the rain makes of it; a game called
  // with its score standing is drawn again to that point (the same draws, so the same game up to there).
  const fresh = (): GameIn => ({ ...(structuredClone({ ...input, balls: undefined }) as GameIn), balls: rng(`${s.seed}|balls|${id}`) });
  const wholeLog: PlayEvent[] | undefined = log && [];
  const whole = simulateGame(fresh(), gameRng(s, id), wholeLog);
  const ruling = callRuling(whole.away.lineScore, whole.home.lineScore, rain);
  if (!ruling || ruling.kind !== 'final') {
    if (log) log.push(...wholeLog!);
    return ruling ? { ...whole, called: ruling } : whole;
  }
  return { ...simulateGame({ ...fresh(), stopAfter: { inning: ruling.inning, top: ruling.top } }, gameRng(s, id), log), called: ruling };
}

/** Plays every game on the next date. Returns false when the regular season is over. */
export function playDay(s: LeagueState): boolean {
  if (s.phase !== 'regular' || s.next >= s.schedule.length) return false;
  // The game waits while the user has something to decide (an in-season decision, V0.12).
  if (s.pending) return false;
  // 2.0.42: a tournament just over waits for the general manager's word on watching it (national.ts).
  if (takeNationalWatch(s)) return false;
  // 2.0.30: the spring games come first, a date at a time (exhibition.ts).
  if (exhibitionDate(s)) return playExhibitionDay(s, (box, day, lines) => record(s, box, day, lines)) || s.next < s.schedule.length;
  const date = s.schedule[s.next]!.date;
  // A national team named today may need the user's word on his players first (V0.12): the day waits.
  if (nationalTeamCalls(s, date)) return false;
  countDays(s, date);
  // The user's players back from training abroad, and what happened off the field today (V0.10).
  finishTrips(s, date);
  lifeDay(s, date);
  // 2.0.36: what goes round on social media (viral.ts).
  viralDay(s, date);
  // Our former-player manager and coaches (1.4.0).
  alumniDay(s, date);
  // 2.0.6: twins on the first team together, a manager's struggling son.
  familyDay(s, date);
  // Now and then something worse (V0.12): the club answers before the next day.
  scandalDay(s, date);
  // 2.0.36: 문책성 2군행 (discipline.ts).
  disciplineDay(s, date);
  // 2.0.36: the dugout's and the front office's own trouble (stafftrouble.ts).
  staffTroubleDay(s, date);
  // Scenario 재기 (1.6.0): the owner calls.
  meddleDay(s, date);
  // 2.0.41: a broker's offer, or an old deal coming out (broker.ts).
  brokerDay(s, date);
  returnFromService(s, date);
  nationalTeamAway(s, date);
  nationalTeamBack(s, date);
  processWaivers(s, date);
  marketEvents(s, date);
  // 2.0.18: stand-ins for foreign players out six weeks or more (tempforeign.ts).
  tempForeignDay(s, date);
  // 2.0.59: a typhoon through our city (weather.ts).
  typhoonDay(s, date);
  // The All-Star voting and game (1.2.0), the draft combine (1.3.0).
  allStarDay(s, date);
  combineDay(s, date, () => applyCombine(s.seed, s.year, draftClass(s.seed, s.year, s.unified)));
  // 1.7.0: the draft class in the papers (draftlog.ts).
  draftWatchDay(s, date);
  // 1.7.0: foreigners in their first season who fail to adapt (adapt.ts).
  adaptDay(s, date);
  // 1.7.0: now and then a silly injury off the field (freak.ts).
  freakDay(s, date);
  const day = s.next;
  // The first game day of a month: last month's story.
  if (day > 0 && s.schedule[day - 1]!.date.slice(5, 7) !== date.slice(5, 7)) {
    monthNews(s, date);
    // 2.0.66 (the user's request): the coaches' month on our futures and reserve players (farmreport.ts).
    farmMonth(s, s.schedule[day - 1]!.date.slice(0, 7), date);
  }
  while (s.next < s.schedule.length && s.schedule[s.next]!.date === date) {
    const g = s.schedule[s.next]!;
    // 2.0.59: rain, a heat wave or snow calls it off: it goes to the end of the season (weather.ts).
    const sky = isTiebreaker(g.id) ? null : weatherFor(s, g);
    if (sky) {
      postpone(s, sky, date);
      continue;
    }
    // 2.0.59: a suspended game finished today, before the day's game: the whole of it was drawn on its first day.
    const kept = isResumed(g.id) ? s.suspendedGames?.[g.id] : undefined;
    if (kept) delete s.suspendedGames![g.id];
    const log: PlayEvent[] | undefined = kept ? kept.log : isUserGame(s, g.home, g.away) ? [] : undefined;
    // 1.9.5: a tiebreaker is played until it is decided; a league that plays history stops at its year's limit.
    const limit = isTiebreaker(g.id) ? null : s.historical || boardValue('extras', s.year) !== undefined ? rulesFor(s.year).extraInnings : ENGINE.maxInnings;
    const out = kept ? { ...kept.out, called: undefined } : playGame(s, g.home, g.away, g.id, date, limit, log, isTiebreaker(g.id) ? null : rainDuring(s, g));
    // 2.0.59: rain before five innings — no game, played again; a suspended game — finished another day.
    if (out?.called?.kind === 'noGame') {
      postpone(s, 'rain', date, out.called.inning);
      continue;
    }
    if (out?.called?.kind === 'suspended') {
      suspend(s, out, log, date);
      continue;
    }
    s.next++;
    if (!out) continue;
    if (out.called) calledGameNote(s, out, g, date);
    // 2.0.64 (gamelog.ts): a player new at a club starts his part there; then the game row and the month.
    notePart(s.lines, out.home);
    notePart(s.lines, out.away);
    record(s, out.home, date);
    record(s, out.away, date);
    logGame(s.lines, out.home, date, g.away, true);
    logGame(s.lines, out.away, date, g.home, false);
    // 2.0.15: home and road, and the ballpark.
    recordVenues(s.lines, out.home, true, g.home);
    recordVenues(s.lines, out.away, false, g.home);
    serveSuspensions(s, g.home);
    serveSuspensions(s, g.away);
    const att = attendance(s, { id: g.id, date, home: g.home, away: g.away });
    recordGate(s, g.home, att);
    s.scores.push({ id: g.id, date, home: g.home, away: g.away, hs: out.home.runs, as: out.away.runs, att, ...(out.called ? { called: out.called.inning } : {}), ...(kept ? { from: kept.from } : {}) });
    // 2.0.6: relatives on the two sides.
    familyGame(s, out.home, out.away, date);
    // 2.0.7: perfect games, no-hitters, cycles, home runs in a row.
    featsGame(s, out, date);
    // 2.0.25: a hit batter, a pitch thrown back, the benches clearing (brawl.ts).
    brawlGame(s, out, g.id, date);
    // 2.0.28: arguing a call, now and then an ejection (protests.ts).
    protestGame(s, out, g.id, date);
    const box = compactBox(out, g.id, date, att, kept?.from);
    keepBox(s, box, log);
    if (log) {
      gameMoments(s, box);
      gameNews(s, box, log);
      milestoneNews(s, date, [...out.home.batting, ...out.home.pitching, ...out.away.batting, ...out.away.pitching].map((x) => x.id));
    }
    const r = rng(`${s.seed}|injury|${g.id}`);
    rollInjuries(s, out.home, date, r, (id, teamId) => lineOf(s, id, teamId));
    rollInjuries(s, out.away, date, r, (id, teamId) => lineOf(s, id, teamId));
  }
  // 1.7.0: our captain's meeting in a slump and his moment of the month (captains.ts).
  captainDay(s, date, day > 0 && s.schedule[day - 1]!.date.slice(5, 7) !== date.slice(5, 7));
  // 2.0.36: rival players (rivals.ts).
  rivalDay(s, date);
  playFuturesDay(s, date);
  // Every ten game days the manager looks at the whole roster again; otherwise only injuries force moves.
  maintainRosters(s, date, day > 0 && Math.floor(s.next / (firstTeamIds(s).length / 2)) % 10 === 0);
  // 1.9.0: who may play in the postseason, once the registration deadlines have passed (postentry.ts).
  noteEligibility(s);
  // 1.9.5: a tie for first or for the last postseason place is played off the next day (tiebreak.ts).
  if (s.next >= s.schedule.length) addTiebreaker(s);
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
  // 1.6.0: contenders buy from rebuilding clubs before the deadline (strategy.ts).
  once('deadline', '07-22', () => aiDeadlineDeals(s, rng(`${s.seed}|ai-deadline|${s.year}`)));
  once('foreign', '07-01', () => aiForeignChanges(s, date, rng(`${s.seed}|ai-foreign|${s.year}`)));
  // 2.0.28: the clubs come to us with trades (offers.ts).
  for (const d of OFFERS.dates) once(`offers-${d}`, d, () => aiOffers(s, date, rng(`${s.seed}|offers|${s.year}|${d}`)));
}

/** An in-season national team leaves its clubs on its date; clubs call up replacements (maintainRosters). */
function nationalTeamAway(s: LeagueState, date: string) {
  if (nationalTeamLeaves(s, date)) maintainRosters(s, date, false);
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

