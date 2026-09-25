/* League state: everything the season loop reads and writes. Plain JSON, so a snapshot is just
   JSON.stringify(state). All randomness is derived from `seed` plus a purpose string. */
import type { BatTotals, PitTotals, Player, PlayerId, Team, TeamId } from '../model/types';
import type { ScheduledGame } from './schedule';
import type { GameScore, StandingRow } from './standings';

export type LeaguePhase = 'regular' | 'postseason' | 'offseason';

export interface ClubRoster {
  /** First-team (1군) registered players. */
  active: PlayerId[];
  /** Everyone else under contract who is not serving (퓨처스·육성). */
  futures: PlayerId[];
}

export interface ArmState {
  lastDate: string;
  lastPitches: number;
  /** Consecutive days pitched ending at lastDate. */
  streak: number;
}

export interface Injury {
  until: string; // back on this date
  days: number;
  /** On the injured list: registered days keep counting (RULES.md §7). */
  onList: boolean;
}

export interface SeasonLine {
  teamId: TeamId;
  days: number;
  /** Days lost to injury. */
  lost: number;
  bat: BatTotals | null;
  pit: PitTotals | null;
}

export interface SeriesResult {
  round: 'wildcard' | 'semipo' | 'po' | 'ks';
  high: TeamId;
  low: TeamId;
  highWins: number;
  lowWins: number;
  winner: TeamId;
  games: GameScore[];
}

export interface SeasonSummary {
  year: number;
  table: StandingRow[];
  series: SeriesResult[];
  champion: TeamId | null;
  /** League totals for the balance checks and the record room. */
  totals: { bat: BatTotals; pit: PitTotals; games: number };
  /** The user's club in its futures year. */
  userFutures?: { w: number; l: number; t: number; rs: number; ra: number };
}

/** A choice the game waits for before it can go on. Only the user's club ever raises one. */
export type Decision =
  | { kind: 'tryout'; candidates: PlayerId[]; max: number }
  | { kind: 'draftPick'; overall: number; label: string }
  | { kind: 'freeAgents'; candidates: PlayerId[]; max: number }
  | { kind: 'specialDraft'; lists: Record<TeamId, PlayerId[]>; protectedCount: number; fee: number }
  | { kind: 'released'; candidates: PlayerId[]; max: number }
  | { kind: 'foreign'; candidates: PlayerId[]; regular: number; asia: number }
  | { kind: 'roster'; candidates: PlayerId[]; release: number; limit: number };

export interface DraftSlot {
  teamId: TeamId;
  label: string;
}

export interface DraftState {
  year: number;
  slots: DraftSlot[];
  next: number;
  /** Prospects still on the board (stored in `players` with status 'amateur' until the draft ends). */
  pool: PlayerId[];
  developmentDone: boolean;
}

export interface OffseasonState {
  year: number;
  step: number;
  draft: DraftState | null;
  /** Players cut to meet roster limits, waiting to be re-signed or retire. */
  released: PlayerId[];
  /** Sub-steps already settled by the user this offseason. */
  done: string[];
}

/** The club the user runs (V0.3: an expansion club). Money in 만 원. */
export interface UserClub {
  teamId: TeamId;
  settings: ExpansionSettings;
  /** One-off founding fund left for fees, bonuses and special-draft payments. */
  fund: number;
  /** Yearly limit on the club's player payroll. */
  payrollBudget: number;
  firstTeamYear: number;
  ledger: { year: number; label: string; amount: number }[];
}

export type Promotion = 'afterFutures' | 'immediate';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface ExpansionSettings {
  name: string;
  short: string;
  color: string;
  cityId: string;
  parentType: import('../club/types').ParentCompanyType;
  parentName: string;
  stadium: 'existing' | 'newMedium' | 'newLarge' | 'dome';
  promotion: Promotion;
  difficulty: Difficulty;
  /** Scenario hook for later versions (V0.3 always null: sandbox). */
  scenario: string | null;
}

/** The expansion club's futures season before it joins the first team. */
export interface FuturesSeason {
  schedule: import('./schedule').ScheduledGame[];
  next: number;
  scores: GameScore[];
  lines: Record<PlayerId, SeasonLine>;
}

export interface LeagueState {
  sim: string;
  seed: string;
  year: number;
  phase: LeaguePhase;
  teams: Team[];
  players: Record<PlayerId, Player>;
  rosters: Record<TeamId, ClubRoster>;
  schedule: ScheduledGame[];
  /** Index of the next unplayed game in `schedule` (sorted by date). */
  next: number;
  scores: GameScore[];
  lines: Record<PlayerId, SeasonLine>;
  arms: Record<PlayerId, ArmState>;
  rotation: Record<TeamId, number>;
  injuries: Record<PlayerId, Injury>;
  /** Last date registered days were counted for. */
  countedThrough: string | null;
  postseason: SeriesResult[];
  history: SeasonSummary[];
  international: { year: number; name: string; medal: boolean; squad: PlayerId[] }[];
  /** Null in a spectator league. */
  user: UserClub | null;
  pending: Decision | null;
  offseason: OffseasonState | null;
  futures: FuturesSeason | null;
}

export const emptyBat = (): BatTotals => ({ g: 0, pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, bb: 0, hbp: 0, k: 0, r: 0, rbi: 0, sb: 0, cs: 0, sf: 0, sh: 0, gdp: 0 });
export const emptyPit = (): PitTotals => ({ g: 0, gs: 0, outs: 0, bf: 0, h: 0, hr: 0, bb: 0, hbp: 0, k: 0, r: 0, er: 0, w: 0, l: 0, sv: 0, hld: 0, qs: 0, pitches: 0 });

export function addInto<T extends object>(into: T, from: Partial<T>): T {
  const acc = into as Record<string, number>;
  for (const [k, v] of Object.entries(from)) if (typeof v === 'number' && k in into) acc[k] = (acc[k] ?? 0) + v;
  return into;
}

/** Clubs playing in the first-team league this season (an expansion club joins from `firstTeamFrom`). */
export const firstTeamIds = (s: LeagueState, year = s.year) =>
  s.teams.filter((t) => t.firstTeamFrom !== null && t.firstTeamFrom <= year).map((t) => t.id);

export const hasBenefits = (s: LeagueState, teamId: string, year = s.year) => {
  const t = s.teams.find((x) => x.id === teamId);
  return !!t?.benefitsUntil && year <= t.benefitsUntil;
};
