/* What the player can do, as state transitions. The UI and the worker both call these. */
import { closeSeason, advanceOffseason, beginOffseason } from './offseason';
import { playPostseason } from './postseason';
import { playDay, startSeason } from './season';
import type { PlayerId, TeamId } from '../model/types';
import { makeTrade, releasePlayer, replaceForeign, signFromPool } from './trade';
import { movePlayer, registerPlayer, setLineupCard, setRole } from './entry';
import type { BullpenRole } from './engine/types';
import { ensureNumbers, setNumber } from './numbers';
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
import { foundClub, FOUNDING_DATE, resolveDecision, type DecisionInput } from './expansion';
import { finishTrips, sendTrip } from './training';
import { inspect } from './scandals';
import { openFacilities, startFacility } from './facilities';

export type Action =
  | { kind: 'days'; days: number }
  | { kind: 'regularEnd' }
  | { kind: 'postseason' }
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
  // The business side (V0.6)
  | { kind: 'ticketPrice'; level: number }
  | { kind: 'marketing'; amount: number }
  | { kind: 'stadiumProject'; project: ProjectKind }
  // Stories (V0.7)
  | { kind: 'interview'; id: PlayerId }
  | { kind: 'gameStory'; id: string }
  | { kind: 'storyText'; id: string; ai: NonNullable<NewsItem['ai']> | null }
  | { kind: 'alertsSeen'; ids?: string[] }
  | { kind: 'tutorial'; seen?: string; off?: boolean; on?: boolean }
  /** When a twelfth club comes (V0.9), until it is founded. */
  | { kind: 'twelveSetting'; setting: TwelveSetting }
  // The market (V0.5)
  | { kind: 'trade'; teamId: TeamId; give: PlayerId[]; get: PlayerId[]; extras?: TradeExtras }
  | { kind: 'release'; id: PlayerId }
  | { kind: 'signPool'; id: PlayerId }
  | { kind: 'foreignSwap'; out: PlayerId; in: string }
  // Players and facilities (V0.10)
  | { kind: 'trip'; id: PlayerId; site: SiteId }
  | { kind: 'facility'; facility: FacilityKind }
  /** The general manager gives one of our players a uniform number (V0.12). */
  | { kind: 'number'; id: PlayerId; number: number }
  /** The club's own doping test on one of our players (V0.12). */
  | { kind: 'inspect'; id: PlayerId }
  /** The season-ticket discount for the coming season (V0.12). */
  | { kind: 'seasonTickets'; discount: number };

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
const WHILE_WAITING: Action['kind'][] = ['ticketPrice', 'marketing', 'stadiumProject', 'renameStadium', 'clubNames', 'difficulty', 'interview', 'gameStory', 'storyText', 'alertsSeen', 'tutorial', 'lineupCard', 'twelveSetting', 'trip', 'facility', 'number', 'inspect', 'seasonTickets'];
export const allowedWhileWaiting = (action: Action) => action.kind === 'decide' || WHILE_WAITING.includes(action.kind);

export function apply(s: LeagueState, action: Action): LeagueState {
  if (s.pending && !allowedWhileWaiting(action)) return s; // the game waits for a decision
  switch (action.kind) {
    case 'days':
      for (let i = 0; i < action.days && playDay(s); i++);
      break;
    case 'regularEnd':
      while (playDay(s));
      break;
    case 'toFounding':
      while (s.year === 2026 && (nextDate(s) ?? '9999') < FOUNDING_DATE && playDay(s));
      break;
    case 'found':
      foundClub(s, action.settings);
      break;
    case 'postseason':
      if (regularOver(s)) playPostseason(s);
      break;
    case 'nextSeason':
      if (s.phase === 'postseason') {
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
    case 'difficulty': {
      const u = s.user;
      if (!u || u.settings.difficulty === action.level) break;
      const label = { easy: '쉬움', normal: '보통', hard: '어려움' } as const;
      milestone(s, s.offseason?.year ?? s.year, `난이도 변경: ${label[u.settings.difficulty]} → ${label[action.level]}`);
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
      startProject(s, action.project);
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
    case 'twelveSetting': {
      const u = s.user;
      if (!u || s.twelve) break;
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
    case 'release':
      releasePlayer(s, action.id);
      break;
    case 'signPool':
      signFromPool(s, action.id);
      break;
    case 'foreignSwap':
      if (s.user) replaceForeign(s, s.user.teamId, action.out, action.in);
      break;
    case 'trip':
      sendTrip(s, action.id, action.site);
      break;
    case 'facility':
      startFacility(s, action.facility);
      break;
    case 'number':
      setNumber(s, action.id, action.number);
      break;
    case 'inspect':
      inspect(s, action.id);
      break;
    case 'seasonTickets':
      if (s.user && [0, 0.1, 0.2, 0.3].includes(action.discount)) clubState(s, s.user.teamId).seasonTicketDiscount = action.discount;
      break;
  }
  // Anyone who joined a club (or became a registered player) gets his number.
  ensureNumbers(s);
  return s;
}

/** The date of the next game day, or null once the regular season is done. */
export const nextDate = (s: LeagueState) => s.schedule[s.next]?.date ?? null;
