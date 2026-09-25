/* League state: everything the season loop reads and writes. Plain JSON, so a snapshot is just
   JSON.stringify(state). All randomness is derived from `seed` plus a purpose string. */
import type { BatTotals, PitTotals, Player, PlayerId, Team, TeamId } from '../model/types';
import type { ScheduledGame } from './schedule';
import type { GameScore, StandingRow } from './standings';
import type { BullpenRole } from './engine/types';

export type LeaguePhase = 'regular' | 'postseason' | 'offseason';

export interface ClubRoster {
  /** First-team (1군) registered players. */
  active: PlayerId[];
  /** The futures squad (퓨처스 출전조): registered and development players who play futures games. */
  futures: PlayerId[];
  /** The third squad (잔류군·재활군): rehab and training, no games. */
  third: PlayerId[];
}

export type Squad = 'active' | 'futures' | 'third';

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

// ── Front office (V0.6) ───────────────────────────────────────────────────────────────────────────

export type StaffRole = 'manager' | 'hitting' | 'pitching' | 'fielding' | 'farm' | 'scouting' | 'medical' | 'analytics';
export type ManagerStyle = 'balanced' | 'smallBall' | 'youth' | 'quickHook' | 'patient';

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  /** 20–80 in five-point steps (public). */
  rating: number;
  age: number;
  /** 만 원 a year. */
  salary: number;
  /** Last season under contract. */
  until: number;
  style?: ManagerStyle;
}

/** One season's accounts (만 원). */
export interface ClubReport {
  year: number;
  fans: number;
  homeGames: number;
  price: number;
  revenue: { gate: number; broadcast: number; sponsors: number; naming: number; merchandise: number; concessions: number; postseason: number };
  expenses: { players: number; staff: number; frontOffice: number; gameDays: number; ballpark: number; farm: number; marketing: number };
  operating: number;
  /** Paid by the parent (or city, or investor) to cover the deficit. */
  support: number;
  /** The user's club: other cash in or out of the fund during the year. */
  cashFlows?: number;
}

/** A club's business side: fans, prices, staff and accounts. */
export interface ClubState {
  /** Fans who would come to an ordinary game at the average price in 2025 terms. */
  popularity: number;
  /** Mood from −0.6 to +0.8. */
  interest: number;
  /** Ticket price as a multiple of the league average. */
  price: number;
  /** Marketing spend per year (만 원). */
  marketing: number;
  staff?: Partial<Record<StaffRole, StaffMember>>;
  reports: ClubReport[];
  /** Naming-rights clubs: the sponsor, its fee and the last season of the deal. */
  sponsor?: { name: string; annual: number; until: number };
}

export interface SeasonGoals {
  year: number;
  /** Finish at or above this rank. */
  rank: number;
  /** Average attendance to reach. */
  fans: number;
  /** Largest deficit (operating result plus spending) the parent accepts (만 원, negative). */
  result: number;
}

export interface Evaluation {
  year: number;
  score: number;
  lines: { label: string; ok: boolean; text: string }[];
  /** Change to next year's support and payroll budget (fraction). */
  change: number;
  trust: number;
}

export interface StadiumProject {
  kind: 'expand' | 'fences' | 'newPark';
  label: string;
  /** Opens before this season. */
  opens: number;
  cost: number;
  seats?: number;
  park?: number;
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
  /** Futures league standings, from 2026 (growth then depends on playing time). */
  futures?: StandingRow[];
}

/** A choice the game waits for before it can go on. Only the user's club ever raises one. */
export type Decision =
  | { kind: 'tryout'; candidates: PlayerId[]; max: number }
  | { kind: 'draftPick'; overall: number; label: string }
  | { kind: 'freeAgents'; candidates: PlayerId[]; max: number }
  | { kind: 'specialDraft'; lists: Record<TeamId, PlayerId[]>; protectedCount: number; fee: number }
  | { kind: 'released'; candidates: PlayerId[]; max: number }
  | { kind: 'foreign'; candidates: PlayerId[]; regular: number; asia: number }
  | { kind: 'roster'; candidates: PlayerId[]; release: number; limit: number }
  // Every year (V0.4)
  | { kind: 'military'; candidates: PlayerId[]; forced: PlayerId[] }
  | { kind: 'ownFreeAgents'; candidates: PlayerId[] }
  | { kind: 'rookieBonus'; picks: { id: PlayerId; slot: number; ask: number }[]; final: boolean }
  | { kind: 'development'; candidates: PlayerId[]; max: number }
  | { kind: 'camp'; players: PlayerId[] }
  // The market (V0.5)
  | { kind: 'faMarket'; candidates: PlayerId[]; grades: Record<PlayerId, 'A' | 'B' | 'C'>; limit: number }
  | { kind: 'faProtect'; fa: PlayerId; grade: 'A' | 'B'; from: TeamId; protect: number; candidates: PlayerId[] }
  | { kind: 'faCompensation'; fa: PlayerId; grade: 'A' | 'B'; to: TeamId; list: PlayerId[]; withPlayer: number; cashOnly: number }
  | { kind: 'salaries'; rows: SalaryRow[] }
  | { kind: 'secondProtect'; candidates: PlayerId[]; protect: number }
  | { kind: 'secondPick'; round: number; fee: number; candidates: PlayerId[] }
  | { kind: 'foreignRenew'; rows: { id: PlayerId; ask: number; war: number; leaving: boolean }[] }
  | { kind: 'posting'; candidates: PlayerId[]; max: number }
  | { kind: 'sponsor'; offers: { name: string; annual: number; years: number }[] }
  | { kind: 'staff'; rows: { role: StaffRole; current: StaffMember; expiring: boolean; buyout: number; candidates: StaffMember[] }[] };

/** One player in the winter's salary talks (만 원). */
export interface SalaryRow {
  id: PlayerId;
  prev: number;
  /** The club's figure from last season's record (고과). */
  merit: number;
  /** What the player asks for. */
  ask: number;
  /** Three pro years or more: he may take a disagreement to salary arbitration (RULES.md §2). */
  arbitration: boolean;
  /** A multi-year deal before free agency the club can offer (비FA 다년계약), or null. */
  extension: { annual: number; years: number } | null;
}

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
  /** The user's club has settled its rookies' bonuses and its development signings. */
  bonusDone?: boolean;
  userDevelopmentDone?: boolean;
}

export interface OffseasonState {
  year: number;
  step: number;
  draft: DraftState | null;
  /** Players cut to meet roster limits, waiting to be re-signed or retire. */
  released: PlayerId[];
  /** Sub-steps already settled by the user this offseason. */
  done: string[];
  /** The free-agent market: the user's offers, whether it has run, and the decisions it left for the user. */
  faOffers?: Record<PlayerId, { annual: number; years: number }>;
  faDone?: boolean;
  faQueue?: import('./market').FaQueueItem[];
  /** The second draft in progress (odd winters). */
  second?: import('./seconddraft').SecondDraftState | null;
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
  /** Cash in and out of the fund; `settlement` marks the year-end operating result and parent support. */
  ledger: { year: number; label: string; amount: number; settlement?: boolean; capital?: boolean }[];
  /** Bullpen roles the general manager set (the manager fills the rest). */
  penRoles?: Record<PlayerId, BullpenRole>;
  /** Platoon halves: players who start only against left- ('L') or right-handed ('R') starters. */
  platoon?: Record<PlayerId, 'L' | 'R'>;
  /** First-team registrations: the manager's (auto) or the general manager's own (manual). */
  entry?: 'auto' | 'manual';
  /** Most the parent will pay this year to cover a deficit (V0.6; 만 원). */
  support?: number;
  /** The parent's goals for the season and its trust in the general manager (0–100). */
  goals?: SeasonGoals;
  trust?: number;
  /** Year-end evaluations. */
  evaluations?: Evaluation[];
  /** Ballpark works under way. */
  projects?: StadiumProject[];
  /** Relieved of duty (only when firing is on). */
  fired?: number;
  /** The owner's running multiplier on support and payroll budget (evaluations, events). */
  budgetScale?: number;
  /** The naming deal ended: a sponsor decision comes this winter. */
  sponsorPending?: boolean;
  /** Ledger length at the last settlement: later entries go into the next one. */
  settledAt?: number;
  /** The general manager has picked staff once (the first winter always asks). */
  staffSeen?: boolean;
  /** Guaranteed salary still owed to players the club released (counts against the payroll budget). */
  deadMoney?: { season: number; amount: number; label: string }[];
  /** Name for the new ballpark when it opens (STADIUM_PLANS); default "<city> 신구장". */
  newStadiumName?: string;
  /** Club news: military results, re-signings, refusals, position changes. */
  log?: { year: number; text: string }[];
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
  /** The owner may fire the general manager after bad evaluations (V0.6; off in the sandbox). */
  firing?: boolean;
}

/** The season's futures league (from 2026): every club's futures squad plus 상무. */
export interface FuturesSeason {
  teams: TeamId[];
  schedule: import('./schedule').ScheduledGame[];
  next: number;
  scores: GameScore[];
  lines: Record<PlayerId, SeasonLine>;
  /** Days each player spent in the third squad (training or rehab). */
  training: Record<PlayerId, number>;
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
  /** Away with the national team until this date (registered days still count). */
  away: Record<PlayerId, string>;
  /** When the user's players were last sent down from the first team (ten days before re-registering). */
  demoted?: Record<PlayerId, string>;
  /** Players on waivers (seven days) and unattached players any club may sign (V0.5). */
  waivers?: { id: PlayerId; from: TeamId; until: string }[];
  pool?: PlayerId[];
  /** Foreign replacements used this season, by club. */
  foreignChanges?: Record<TeamId, number>;
  /** League moves for the news feed: trades, waiver claims, foreign changes. */
  transactions?: { date: string; text: string }[];
  /** One-off market events already run this season ("2027-trades-06"). */
  marketDone?: string[];
  /** Competitive balance tax records by club, and clubs whose first-round pick drops, by draft year. */
  cap?: Record<TeamId, import('./cap').CapRecord[]>;
  pickDrop?: Record<number, TeamId[]>;
  /** Last date registered days were counted for. */
  countedThrough: string | null;
  postseason: SeriesResult[];
  history: SeasonSummary[];
  international: { year: number; name: string; medal: boolean; squad: PlayerId[] }[];
  /** Fans, prices, staff and accounts of every club (V0.6). */
  clubs?: Record<TeamId, ClubState>;
  /** This season's home gates, and the postseason ticket money. */
  gate?: Record<TeamId, import('./fans').GateLine>;
  postseasonGate?: number;
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

// ── Club organisation ────────────────────────────────────────────────────────────────────────────

/** Development players (육성선수) sit outside the registered-player limit (RULES.md §6). */
export const isDevelopment = (p: Player) => p.contract?.kind === 'development';

/** Everyone under contract with the club who is not serving: first team, futures squad and third squad. */
export const orgIds = (s: LeagueState, teamId: TeamId): PlayerId[] => {
  const r = s.rosters[teamId]!;
  return [...r.active, ...r.futures, ...r.third];
};
export const orgPlayers = (s: LeagueState, teamId: TeamId): Player[] => orgIds(s, teamId).map((id) => s.players[id]!);
/** Registered players (소속선수), the ones the 68-player limit counts. */
export const registeredIds = (s: LeagueState, teamId: TeamId) => orgIds(s, teamId).filter((id) => !isDevelopment(s.players[id]!));
export const developmentIds = (s: LeagueState, teamId: TeamId) => orgIds(s, teamId).filter((id) => isDevelopment(s.players[id]!));

export function squadOf(s: LeagueState, id: PlayerId): Squad | null {
  const p = s.players[id];
  const r = p?.teamId ? s.rosters[p.teamId] : undefined;
  if (!r) return null;
  return r.active.includes(id) ? 'active' : r.futures.includes(id) ? 'futures' : r.third.includes(id) ? 'third' : null;
}

/** Moves a player between squads of his club (no rule checks: callers check). */
export function moveTo(s: LeagueState, id: PlayerId, squad: Squad) {
  const p = s.players[id]!;
  const r = s.rosters[p.teamId!]!;
  r.active = r.active.filter((x) => x !== id);
  r.futures = r.futures.filter((x) => x !== id);
  r.third = r.third.filter((x) => x !== id);
  r[squad].push(id);
}

export const emptyRoster = (): ClubRoster => ({ active: [], futures: [], third: [] });
