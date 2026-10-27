import { answerOffer, setNotForSale } from './offers';
import { extendStaff, fireStaff } from './staffdeals';
import { askOwner } from './ownerask';
import { askBudget } from './budgetask';
import { sixManAllowed } from './manager';
import { setFavorite } from './favorites';
import type { StaffRole } from './state';
import { k as __i18n_k } from '../i18n/index';
/* What the player can do, as state transitions. The UI and the worker both call these. */
import { runRogue } from './rogue';
import { setEra, startYear } from './era';
import { STOP_KINDS, watchStops, type StopKind } from './stops';
import { closeSeason, advanceOffseason, beginOffseason } from './offseason';
import { playPostseason, postseasonDay, postseasonRound, startPostseason } from './postseason';
import { playDay, startSeason } from './season';
import type { PlayerId, TeamId } from '../model/types';
import { makeDevelopment, makeTrade, releasePlayer, replaceForeign, signFromPool } from './trade';
import { setTempKeep, signTemp } from './tempforeign';
import { movePlayer, registerPlayer, setLineupCard, setRole, today } from './entry';
import type { BullpenRole } from './engine/types';
import { ensureNumbers, setNumber } from './numbers';
import { setNickname } from './nicknames';
import { addTie, editPlayer, removeTie, type PlayerEdit, type Relation } from './editor';
import { editAbility, type AbilityEdit } from './abilityedit';
import { gmDiscipline } from './discipline';
import { switchPlayer } from './twoway';
import { setBoardOn, setRule, type BoardItem } from './board';
import { openProjects, startProject, type ProjectKind } from './ballpark';
import { clubState } from './fans';
import { FANS } from './tuning';
import { gameRecap, interviewNews, type NewsItem } from './news';
import { renameStadium } from './userclub';
import { renameClubs, type ClubLabel } from './clubs';
import { markAlertsSeen } from './alerts';
import type { Difficulty, ExpansionSettings, FacilityKind, LeagueState, LineupCard, SiteId, Squad, TradeExtras, TwelveSetting } from './state';
import { milestone } from './milestones';

/** A new scoreboard's lift to the fans' mood in its first season (V0.10, facilities.ts). */
const SCOREBOARD_BUZZ = 0.03;
import { foundClub, foundingDate, resolveDecision, type DecisionInput } from './expansion';
import { clearTripRecord, finishTrips, sendTrip } from './training';
import { holdCamp, sendDev } from './development';
import { inspect } from './scandals';
import { runCampaign } from './allstar';
import { workout } from './combine';
import { openFacilities, startFacility } from './facilities';
import { offerExtension } from './extensions';
import { setCaptains } from './captains';
import { planLearn } from './newpitch';
import { addCondition } from './conditions';
import { measureHandicap } from './dynamic';
import { exhibitionDate } from './exhibition';
import { canReinstate, canVoluntary, placeVoluntary, reinstate } from './voluntary';
import { sponsorSchool } from './schools';
import { spend, type SpendKind } from './spending';

export type Action =
  /** `stops` (1.6.0): end the run early at the moments the user asked to stop for (stops.ts). */
  | { kind: 'days'; days: number; stops?: boolean }
  | { kind: 'regularEnd'; stops?: boolean }
  /** 2.0.53 (the user's request): the spring games played to the last, the next day opening day. */
  | { kind: 'exhibitionEnd' }
  | { kind: 'postseason'; stops?: boolean }
  /** 1.3.0: the postseason step by step — draw the bracket, the next game day, the rest of the round. */
  | { kind: 'postseasonStart' }
  | { kind: 'postseasonDay' }
  | { kind: 'postseasonRound'; stops?: boolean }
  /** 1.3.0: our plan for the next postseason game (starter null: the manager's choice). */
  | { kind: 'postPlan'; starter?: PlayerId | null; allOut?: boolean }
  /** 1.3.0: a prospect in for a private workout before the draft. */
  | { kind: 'workout'; draftYear: number; id: PlayerId; name: string }
  | { kind: 'nextSeason' }
  | { kind: 'toFounding' }
  | { kind: 'found'; settings: ExpansionSettings }
  | { kind: 'decide'; input: DecisionInput }
  // The general manager's roster (V0.4)
  | { kind: 'entryMode'; mode: 'auto' | 'manual' }
  | { kind: 'move'; id: PlayerId; to: Squad }
  | { kind: 'register'; id: PlayerId }
  | { kind: 'setRole'; id: PlayerId; role: 'SP' | 'RP' }
  | { kind: 'penRole'; id: PlayerId; role: BullpenRole | null }
  | { kind: 'platoon'; id: PlayerId; side: 'L' | 'R' | null }
  /** The general manager's lineup card (V0.8); null gives it all back to the manager. */
  | { kind: 'lineupCard'; card: LineupCard | null }
  | { kind: 'renameStadium'; name: string; which: 'current' | 'new' }
  /** Names of the ten existing clubs (V0.13, settings). */
  | { kind: 'clubNames'; labels: Record<TeamId, ClubLabel> }
  /** The basic difficulty, changed mid-game (V0.14): noted on the club's timeline. */
  | { kind: 'difficulty'; level: Difficulty }
  /** 1.9.9: the board's meetings on or off, from the coming winter (board.ts). */
  | { kind: 'board'; on: boolean }
  // The business side (V0.6)
  | { kind: 'ticketPrice'; level: number }
  | { kind: 'marketing'; amount: number }
  | { kind: 'stadiumProject'; project: ProjectKind; layout?: import('./layout').ParkLayout }
  // Stories (V0.7)
  | { kind: 'interview'; id: PlayerId }
  | { kind: 'gameStory'; id: string }
  | { kind: 'storyText'; id: string; ai: NonNullable<NewsItem['ai']> | null }
  | { kind: 'alertsSeen'; ids?: string[] }
  | { kind: 'tutorial'; seen?: string; off?: boolean; on?: boolean }
  /** 1.5.0: hand the decisions before the first-team debut to the scouts, or take them back. */
  | { kind: 'autoPrep'; on: boolean }
  | { kind: 'stops'; kinds: StopKind[] }
  /** 살려야 한다 (1.6.0): the runaway AI's five years, right after the founding. */
  | { kind: 'rogue' }
  /** When a twelfth club comes (V0.9), until it is founded. */
  | { kind: 'twelveSetting'; setting: TwelveSetting }
  // The market (V0.5)
  | { kind: 'trade'; teamId: TeamId; give: PlayerId[]; get: PlayerId[]; extras?: TradeExtras }
  | { kind: 'tradeOffer'; id: string; accept: boolean }
  | { kind: 'release'; id: PlayerId }
  /** 2.0.48 (trade.ts): one of ours to a development contract in the winter. */
  | { kind: 'toDevelopment'; id: PlayerId }
  | { kind: 'signPool'; id: PlayerId }
  | { kind: 'devSend'; what: 'fall' | 'abl'; ids: PlayerId[] }
  | { kind: 'wrapCamp'; site: import('./development').CampSite }
  | { kind: 'foreignSwap'; out: PlayerId; in: string }
  // 2.0.18: a stand-in for an injured foreign player, and whom to keep when he is back.
  | { kind: 'tempSign'; for: PlayerId; in: string }
  | { kind: 'tempKeep'; id: PlayerId; keep: 'injured' | 'temp' }
  /** 1.7.0: a multi-year deal before free agency (extensions.ts). */
  | { kind: 'extend'; id: PlayerId; years: number }
  /** 1.7.0: the captain and vice-captains (captains.ts). */
  | { kind: 'captains'; captain: PlayerId | null; vice: PlayerId[] }
  /** 1.8.0 (staffdeals.ts): extend a head in his last season, or dismiss him (an interim takes over). */
  | { kind: 'staffExtend'; role: StaffRole; years: number }
  | { kind: 'staffFire'; role: StaffRole }
  /** 1.8.0 (ownerask.ts): ask the owner to pay for a free agent (once a winter). */
  | { kind: 'askOwner'; id: PlayerId }
  /** 2.0.34: ask the owner for more payroll budget this season (a share of it). */
  | { kind: 'askBudget'; share: number }
  /** 1.8.0: two leagues' postseason format (from the next postseason drawn). */
  | { kind: 'twoLeaguePlayoffs'; style: 'kbo' | 'npb' }
  // Players and facilities (V0.10)
  | { kind: 'trip'; id: PlayerId; site: SiteId }
  /** 2.0.31: clear the training screen's record of programmes abroad. */
  | { kind: 'clearTrips' }
  /** 2.0.8: a pitch for one of our pitchers to learn this winter (null cancels). */
  | { kind: 'learnPitch'; id: PlayerId; type: import('./pitches').PitchType | null }
  | { kind: 'facility'; facility: FacilityKind }
  /** The general manager gives one of our players a uniform number (V0.12). */
  | { kind: 'number'; id: PlayerId; number: number }
  /** 1.9.3 (nicknames.ts): the general manager's own nickname for one of our players (empty: the fans' again). */
  | { kind: 'nickname'; id: PlayerId; text: string }
  /** 2.0.9 (editor.ts): any player's name, hometown, school and nickname. */
  | { kind: 'editPlayer'; id: PlayerId; edit: PlayerEdit }
  /** 2.0.9: ties `other` to him as his `rel` (null unties them). */
  | { kind: 'familyTie'; id: PlayerId; other: PlayerId; rel: Relation | null }
  /** 2.0.12 (twoway.ts): turn one of our players around (pitcher ↔ hitter, the winter only), or start or stop two-way play. */
  | { kind: 'switchSide'; id: PlayerId; what: 'convert' | 'twoWayOn' | 'twoWayOff' }
  /** 2.0.13 (board.ts): with the board off, a league rule set by hand from the coming season. */
  | { kind: 'leagueRule'; item: BoardItem; value: number }
  /** The club's own doping test on one of our players (V0.12). */
  | { kind: 'inspect'; id: PlayerId }
  /** 1.2.0: a drive for our All-Star candidates' fan ballots. */
  | { kind: 'allStarCampaign' }
  /** 1.2.0: the optional foreign veteran rule (seasons, or off). */
  | { kind: 'foreignVeteran'; seasons: number | null }
  /** 2.0.37: development foreign players a club may keep (1 or 2), or null for none (devforeign.ts). */
  | { kind: 'devForeign'; places: number | null }
  | { kind: 'retiredBar'; rise: boolean }
  | { kind: 'travelFatigue'; on: boolean }
  /** 2.0.34: a six-man rotation for every club (twelve clubs or more). */
  | { kind: 'sixMan'; on: boolean }
  | { kind: 'abilityEditor'; on: boolean }
  | { kind: 'discipline'; id: PlayerId; days: number }
  /** 2.0.37: onto the voluntary retired list, and back from it (voluntary.ts). */
  | { kind: 'voluntary'; id: PlayerId }
  | { kind: 'reinstate'; id: PlayerId }
  | { kind: 'editAbility'; id: PlayerId; edit: AbilityEdit }
  /** 2.0.34: star a player (or take the star off). */
  | { kind: 'favorite'; id: PlayerId; on: boolean }
  /** 2.0.45 (offers.ts): one of ours not for sale (NFS), or for sale again. */
  | { kind: 'notForSale'; id: PlayerId; on: boolean }
  | { kind: 'postingMax'; max: number | null }
  | { kind: 'capForfeit'; on: boolean }
  | { kind: 'dynamicDifficulty'; on: boolean }
  | { kind: 'addCondition'; id: import('./conditions').ConditionId }
  /** The season-ticket discount for the coming season (V0.12). */
  | { kind: 'seasonTickets'; discount: number }
  // 2.0.39 (schools.ts): sponsor (or stop sponsoring) a high school of the club's region.
  | { kind: 'sponsorSchool'; name: string; on: boolean }
  // 2.0.39 (spending.ts): the fund's other uses.
  | { kind: 'spend'; what: SpendKind; tier?: number }
  // 2.0.42 (asiaseries.ts).
  | { kind: 'asiaSeries'; on: boolean };

export const regularOver = (s: LeagueState) => s.phase === 'regular' && s.next >= s.schedule.length;

/** Starts the new year once the offseason has nothing left to ask; ballpark work due this season opens
    first (a project can be started at any point of the winter). */
function finishOffseason(s: LeagueState) {
  if (s.phase === 'offseason' && !s.offseason && !s.pending) {
    openProjects(s, s.year);
    // Facilities due this season (V0.10); a new scoreboard draws people in.
    if (openFacilities(s, s.year).includes('scoreboard') && s.user) clubState(s, s.user.teamId).interest += SCOREBOARD_BUZZ;
    startSeason(s);
  }
}

/** What the player can still do while the game waits for a decision: the front office (tickets,
    marketing, ballpark), the news, reading alerts and the tutorial. Everything else waits. */
const WHILE_WAITING: Action['kind'][] = ['autoPrep', 'clearTrips', 'stops', 'signPool', 'devSend', 'wrapCamp', 'rogue', 'ticketPrice', 'marketing', 'stadiumProject', 'renameStadium', 'clubNames', 'difficulty', 'board', 'interview', 'gameStory', 'storyText', 'alertsSeen', 'tutorial', 'lineupCard', 'twelveSetting', 'trip', 'facility', 'number', 'nickname', 'editPlayer', 'familyTie', 'switchSide', 'leagueRule', 'inspect', 'seasonTickets', 'allStarCampaign', 'foreignVeteran', 'devForeign', 'retiredBar', 'travelFatigue', 'postingMax', 'capForfeit', 'dynamicDifficulty', 'addCondition', 'workout', 'extend', 'captains', 'staffExtend', 'askOwner', 'askBudget', 'twoLeaguePlayoffs', 'sixMan', 'favorite', 'notForSale', 'toDevelopment', 'abilityEditor', 'editAbility', 'discipline', 'sponsorSchool', 'spend', 'asiaSeries'];
export const allowedWhileWaiting = (action: Action) => action.kind === 'decide' || WHILE_WAITING.includes(action.kind);

export function apply(s: LeagueState, action: Action): LeagueState {
  // The league's own calendar (1.6.0: a game may start before 2026).
  setEra(s);
  if (s.pending && !allowedWhileWaiting(action)) return s; // the game waits for a decision
  switch (action.kind) {
    case 'days': {
      const stop = action.stops ? watchStops(s) : null;
      for (let i = 0; i < action.days && playDay(s); i++) if (stop?.()) break;
      break;
    }
    case 'regularEnd': {
      const stop = action.stops ? watchStops(s) : null;
      while (playDay(s)) if (stop?.()) break;
      break;
    }
    case 'exhibitionEnd':
      while (exhibitionDate(s) && playDay(s));
      break;
    case 'toFounding':
      while (s.year === startYear() && (nextDate(s) ?? '9999') < foundingDate() && playDay(s));
      break;
    case 'found':
      foundClub(s, action.settings);
      break;
    case 'postseason':
      if (regularOver(s) || (s.phase === 'postseason' && s.bracket && !s.bracket.done)) playPostseason(s, !!action.stops);
      break;
    case 'postseasonStart':
      if (regularOver(s)) startPostseason(s, true);
      break;
    case 'postseasonDay':
      if (s.phase === 'postseason') postseasonDay(s, true);
      break;
    case 'postseasonRound':
      if (s.phase === 'postseason') postseasonRound(s, !!action.stops);
      break;
    case 'postPlan': {
      const u = s.user;
      if (!u || s.phase !== 'postseason') break;
      const plan = (u.postPlan ??= {});
      if (action.starter !== undefined) {
        if (action.starter && s.players[action.starter]?.teamId === u.teamId && s.rosters[u.teamId]!.active.includes(action.starter)) plan.starter = action.starter;
        else delete plan.starter;
      }
      if (action.allOut !== undefined) plan.allOut = action.allOut;
      break;
    }
    case 'nextSeason':
      if (s.phase === 'postseason') {
        // A postseason still being played goes to its end first (1.3.0).
        if (s.bracket && !s.bracket.done) playPostseason(s);
        if (s.user) delete s.user.postPlan;
        // Programmes abroad still running end with the season (V0.10).
        finishTrips(s, `${s.year}-12-31`);
        closeSeason(s);
        beginOffseason(s);
        advanceOffseason(s);
        finishOffseason(s);
      }
      break;
    case 'decide':
      resolveDecision(s, action.input);
      finishOffseason(s);
      break;
    case 'entryMode':
      if (s.user) s.user.entry = action.mode;
      break;
    case 'move':
      movePlayer(s, action.id, action.to);
      break;
    case 'register':
      registerPlayer(s, action.id);
      break;
    case 'penRole':
    case 'platoon': {
      const u = s.user;
      if (!u || s.players[action.id]?.teamId !== u.teamId) break;
      const map = action.kind === 'penRole' ? (u.penRoles ??= {}) : (u.platoon ??= {});
      const value = action.kind === 'penRole' ? action.role : action.side;
      if (value) (map as Record<string, string>)[action.id] = value;
      else delete map[action.id];
      break;
    }
    case 'setRole':
      setRole(s, action.id, action.role);
      break;
    case 'lineupCard':
      setLineupCard(s, action.card);
      break;
    case 'renameStadium':
      renameStadium(s, action.name, action.which);
      break;
    case 'clubNames':
      renameClubs(s.teams, action.labels);
      break;
    case 'board':
      setBoardOn(s, action.on);
      break;
    case 'difficulty': {
      const u = s.user;
      if (!u || u.settings.difficulty === action.level) break;
      const label = { easy: __i18n_k("league.actions.label.easy.aeb16cc3"), normal: '보통', hard: __i18n_k("league.actions.label.hard.485e4f6a") } as const;
      milestone(s, s.offseason?.year ?? s.year, __i18n_k("league.actions.apply.fc7d2de8", { value: label[u.settings.difficulty], value2: label[action.level] }));
      u.settings.difficulty = action.level;
      break;
    }
    case 'ticketPrice':
    case 'marketing': {
      if (!s.user) break;
      const c = clubState(s, s.user.teamId);
      if (action.kind === 'ticketPrice') c.price = Math.round(Math.max(FANS.priceMin, Math.min(FANS.priceMax, action.level)) * 100) / 100;
      else c.marketing = Math.round(Math.max(FANS.marketing.min, Math.min(FANS.marketing.max, action.amount)) / 10_000) * 10_000;
      break;
    }
    case 'stadiumProject':
      startProject(s, action.project, action.layout);
      break;
    case 'interview':
      if (s.players[action.id]?.teamId === s.user?.teamId) interviewNews(s, action.id, s.phase === 'regular' ? (s.schedule[Math.max(0, s.next - 1)]?.date ?? `${s.year}-03-01`) : `${s.year}-11-15`);
      break;
    case 'gameStory':
      gameRecap(s, action.id);
      break;
    case 'alertsSeen':
      markAlertsSeen(s, action.ids);
      break;
    case 'tutorial': {
      // The guide's progress lives with the club, so a saved game picks up where it was.
      const u = s.user;
      if (!u) break;
      if (action.seen && !(u.tutorialSeen ??= []).includes(action.seen)) u.tutorialSeen.push(action.seen);
      if (action.off) u.tutorialOff = true;
      if (action.on) delete u.tutorialOff;
      break;
    }
    case 'rogue':
      return runRogue(s);
    case 'stops': {
      const u = s.user;
      if (!u) break;
      u.settings.stops = STOP_KINDS.filter((k) => k !== 'offer' && action.kinds.includes(k));
      u.settings.offerStop = action.kinds.includes('offer');
      break;
    }
    case 'autoPrep': {
      const u = s.user;
      if (!u) break;
      if (action.on) u.settings.autoPrep = true;
      else delete u.settings.autoPrep;
      break;
    }
    case 'twelveSetting': {
      const u = s.user;
      // 2.0.43: a unified league's clubs are counted at its founding (four or five from the north), so it stays as set.
      if (!u || s.twelve || s.unified) break;
      const st = action.setting;
      if (st.mode === 'off') delete u.settings.twelve;
      else u.settings.twelve = st.mode === 'year' ? { mode: 'year', year: Math.max(u.firstTeamYear, st.year ?? u.firstTeamYear) } : { mode: 'event' };
      break;
    }
    case 'storyText': {
      // A language model's version of an article, or null to go back to the template.
      const item = s.news?.find((n) => n.id === action.id);
      if (item) {
        if (action.ai) item.ai = action.ai;
        else delete item.ai;
      }
      break;
    }
    case 'trade':
      makeTrade(s, action.teamId, action.give, action.get, action.extras);
      break;
    case 'tradeOffer':
      answerOffer(s, action.id, action.accept);
      break;
    case 'release':
      releasePlayer(s, action.id);
      break;
    case 'toDevelopment':
      makeDevelopment(s, action.id);
      break;
    case 'signPool':
      signFromPool(s, action.id);
      break;
    case 'foreignSwap':
      if (s.user) replaceForeign(s, s.user.teamId, action.out, action.in);
      break;
    case 'tempSign':
      if (s.user) signTemp(s, s.user.teamId, action.for, action.in);
      break;
    case 'tempKeep':
      setTempKeep(s, action.id, action.keep);
      break;
    case 'trip':
      sendTrip(s, action.id, action.site);
      break;
    case 'clearTrips':
      clearTripRecord(s);
      break;
    case 'devSend':
      // 2.0.28 (development.ts): the fall league, a winter in Australia.
      sendDev(s, action.what, action.ids);
      break;
    case 'wrapCamp':
      holdCamp(s, action.site);
      break;
    case 'learnPitch':
      planLearn(s, action.id, action.type);
      break;
    case 'facility':
      startFacility(s, action.facility);
      break;
    case 'number':
      setNumber(s, action.id, action.number);
      break;
    case 'nickname':
      setNickname(s, action.id, action.text);
      break;
    case 'editPlayer':
      editPlayer(s, action.id, action.edit);
      break;
    case 'familyTie':
      if (action.rel) addTie(s, action.id, action.other, action.rel);
      else removeTie(s, action.id, action.other);
      break;
    case 'switchSide':
      switchPlayer(s, action.id, action.what);
      break;
    case 'leagueRule':
      setRule(s, action.item, action.value);
      break;
    case 'extend':
      offerExtension(s, action.id, action.years);
      break;
    case 'captains':
      setCaptains(s, action.captain, action.vice);
      break;
    case 'staffExtend':
      extendStaff(s, action.role, action.years);
      break;
    case 'staffFire':
      fireStaff(s, action.role);
      break;
    case 'askBudget':
      askBudget(s, action.share);
      break;
    case 'askOwner':
      askOwner(s, action.id);
      break;
    case 'twoLeaguePlayoffs':
      if (s.twelve) s.twelve.playoffs = action.style;
      else if (s.leagueSides) s.leagueSides.playoffs = action.style;
      break;
    case 'inspect':
      inspect(s, action.id);
      break;
    case 'foreignVeteran': {
      if (!s.user || (action.seasons !== null && ![5, 8].includes(action.seasons)) || (s.foreignVeteran ?? null) === action.seasons) break;
      s.foreignVeteran = action.seasons;
      milestone(s, s.offseason?.year ?? s.year, action.seasons ? __i18n_k("league.actions.apply.e689101c", { seasons: action.seasons }) : __i18n_k("league.actions.apply.a4c1dacc"));
      break;
    }
    case 'devForeign': {
      if (!s.user || (action.places !== null && ![1, 2].includes(action.places)) || (s.devForeign ?? null) === action.places) break;
      s.devForeign = action.places;
      milestone(s, s.offseason?.year ?? s.year, action.places ? __i18n_k("league.actions.text.dc689d71", { n: action.places }) : __i18n_k("league.actions.text.9b5484dd"));
      break;
    }
    case 'favorite':
      setFavorite(s, action.id, action.on);
      break;
    case 'notForSale':
      setNotForSale(s, action.id, action.on);
      break;
    case 'discipline':
      gmDiscipline(s, action.id, action.days, today(s));
      break;
    case 'voluntary': {
      const problem = canVoluntary(s, action.id);
      if (problem) throw new Error(problem);
      placeVoluntary(s, s.players[action.id]!, 'club');
      break;
    }
    case 'reinstate': {
      const problem = canReinstate(s, action.id);
      if (problem) throw new Error(problem);
      reinstate(s, action.id);
      break;
    }
    case 'abilityEditor':
      if (!s.user) break;
      if (action.on) s.abilityEditor = true;
      else delete s.abilityEditor;
      break;
    case 'editAbility':
      editAbility(s, action.id, action.edit);
      break;
    case 'sixMan':
      if (!s.user || !sixManAllowed(s)) break;
      if (action.on) s.sixMan = true;
      else delete s.sixMan;
      break;
    case 'travelFatigue':
      // 2.0.22: tiredness from the road on or off (travel.ts).
      if (!s.user) break;
      if (action.on) delete s.travelFatigue;
      else s.travelFatigue = false;
      break;
    case 'dynamicDifficulty':
      // 2.0.25: the difficulty that moves with our club (dynamic.ts); measured now, then each winter.
      if (!s.user) break;
      if (action.on) {
        s.dynamicDifficulty = true;
        s.user.handicap = measureHandicap(s, s.offseason?.year ?? s.year - 1);
      } else {
        delete s.dynamicDifficulty;
        // 2.0.27: the anti-dynasty alliance goes with it (dynasty.ts).
        delete s.alliance;
      }
      break;
    case 'capForfeit':
      // 2.0.24: the salary cap's pick forfeiture on or off (cap.ts).
      if (!s.user) break;
      if (action.on) s.capForfeit = true;
      else delete s.capForfeit;
      break;
    case 'postingMax':
      // 2.0.24: how many players a club may post in a winter (posting.ts); null the KBO's one.
      if (!s.user || (action.max !== null && ![2, 3, 99].includes(action.max))) break;
      if (action.max === null) delete s.postingMax;
      else s.postingMax = action.max;
      break;
    case 'addCondition':
      // 2.0.23: another scenario's conditions added to the game under way (conditions.ts).
      addCondition(s, action.id);
      break;
    case 'retiredBar':
      // 2.0.22: the rising retired-number bar on or off (numbers.ts).
      if (!s.user) break;
      if (action.rise) delete s.retiredBarRise;
      else s.retiredBarRise = false;
      break;
    case 'workout':
      workout(s, action.draftYear, action.id, action.name);
      break;
    case 'allStarCampaign':
      runCampaign(s, s.phase === 'regular' ? (s.schedule[s.next]?.date ?? `${s.year}-07-01`) : `${s.year}-07-01`);
      break;
    case 'seasonTickets':
      if (s.user && [0, 0.1, 0.2, 0.3].includes(action.discount)) clubState(s, s.user.teamId).seasonTicketDiscount = action.discount;
      break;
    case 'sponsorSchool':
      sponsorSchool(s, action.name, action.on);
      break;
    case 'spend':
      spend(s, action.what, action.tier);
      break;
    case 'asiaSeries':
      // 2.0.42: the Asia Series on or off (asiaseries.ts).
      if (!s.user) break;
      if (action.on) s.asiaSeries = true;
      else delete s.asiaSeries;
      break;
  }
  // Anyone who joined a club (or became a registered player) gets his number.
  ensureNumbers(s);
  return s;
}

/** The date of the next game day, or null once the regular season is done. */
/** 2.0.30: a spring game's date first, while there are any (exhibition.ts). */
export const nextDate = (s: LeagueState) => exhibitionDate(s) ?? s.schedule[s.next]?.date ?? null;
