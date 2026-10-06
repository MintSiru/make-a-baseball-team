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
  /** What it is (V0.7.7; injuries.ts), and whether it needed an operation. */
  part?: string;
  surgery?: 'minor' | 'major';
  /** A knock: out of the lineup for a few days but still registered. */
  dtd?: boolean;
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
  /** Sold-out home games. */
  sellouts?: number;
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
  /** Naming-rights clubs: the sponsor, its fee and the last season of the deal; since V0.7.7 its goal, the
      first season judged against it, and the seasons missed in a row (parent.ts). */
  sponsor?: { name: string; annual: number; until: number; goal?: SponsorGoal; risk?: number; from?: number; missed?: number };
  /** Season tickets (V0.12, the user's club): the discount set for the coming season, and this season's sale
      (seats sold, money taken at opening). */
  seasonTicketDiscount?: number;
  seasonTickets?: { year: number; discount: number; sold: number; paid: number };
}

/** What a naming sponsor wants for its money (V0.7.7). `risk`: the chance it walks out after a missed season. */
export type SponsorGoal = { kind: 'none' } | { kind: 'rank'; rank: number } | { kind: 'fans'; fans: number };
export interface SponsorOffer {
  name: string;
  annual: number;
  years: number;
  goal?: SponsorGoal;
  risk?: number;
}

/** A citizen club's mayor (V0.7.7): elected every four years in June; the stance moves the city's money. */
export interface Mayor {
  name: string;
  stance: 'friendly' | 'neutral' | 'hostile';
  since: number;
  until: number;
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
  /** Two leagues (V0.9): each club's side that season. */
  leagues?: Record<TeamId, LeagueSide>;
  series: SeriesResult[];
  champion: TeamId | null;
  /** League totals for the balance checks and the record room. */
  totals: { bat: BatTotals; pit: PitTotals; games: number };
  /** The user's club in its futures year. */
  userFutures?: { w: number; l: number; t: number; rs: number; ra: number };
  /** Futures league standings, from 2026 (growth then depends on playing time). */
  futures?: StandingRow[];
  /** MVP, rookie, golden gloves and titles (V0.7). */
  awards?: import('./awards').SeasonAwards;
}

/** A choice the game waits for before it can go on. Only the user's club ever raises one. */
export type Decision =
  | { kind: 'tryout'; candidates: PlayerId[]; max: number }
  | { kind: 'draftPick'; overall: number; label: string }
  | { kind: 'specialDraft'; lists: Record<TeamId, PlayerId[]>; protectedCount: number; fee: number }
  | { kind: 'released'; candidates: PlayerId[]; max: number }
  | { kind: 'foreign'; candidates: PlayerId[]; regular: number; asia: number }
  | { kind: 'roster'; candidates: PlayerId[]; release: number; limit: number }
  // Every year (V0.4)
  /** `social`: graded 4급 after an operation (V0.7.7), who can only serve as social service agents. */
  | { kind: 'military'; candidates: PlayerId[]; forced: PlayerId[]; social?: PlayerId[] }
  | { kind: 'rookieBonus'; picks: { id: PlayerId; slot: number; ask: number }[]; final: boolean }
  | { kind: 'development'; candidates: PlayerId[]; max: number }
  | { kind: 'camp'; players: PlayerId[] }
  // The market (V0.5); since V0.8 the free-agent negotiation in rounds (fa.ts, the market on `offseason.fa`)
  | { kind: 'faRound'; round: number; day: number; date: string }
  /** Free-agent deals whose guaranteed seasons end with a club option (V0.8): take it up or let him go. */
  | { kind: 'faOptions'; rows: { id: PlayerId; years: number; annual: number }[] }
  | { kind: 'faProtect'; fa: PlayerId; grade: 'A' | 'B'; from: TeamId; protect: number; candidates: PlayerId[] }
  | { kind: 'faCompensation'; fa: PlayerId; grade: 'A' | 'B'; to: TeamId; list: PlayerId[]; withPlayer: number; cashOnly: number }
  | { kind: 'salaries'; rows: SalaryRow[] }
  | { kind: 'secondProtect'; candidates: PlayerId[]; protect: number }
  | { kind: 'secondPick'; round: number; fee: number; candidates: PlayerId[] }
  | { kind: 'foreignRenew'; rows: { id: PlayerId; ask: number; war: number; leaving: boolean }[] }
  | { kind: 'posting'; candidates: PlayerId[]; max: number }
  // Coming home (V0.7.3): posted players back from the majors, whose rights the club holds
  | { kind: 'returnee'; rows: { id: PlayerId; years: number; annual: number; abroad: number }[] }
  | { kind: 'sponsor'; offers: SponsorOffer[]; ended?: string }
  | { kind: 'staff'; rows: { role: StaffRole; current: StaffMember; expiring: boolean; buyout: number; candidates: StaffMember[] }[] }
  // The twelfth club (V0.9, rival.ts): design it (or, offered by the board, vote it down), then protect our players
  // from its special draft
  | { kind: 'rival'; year: number; event: boolean; suggestion: RivalSettings }
  | { kind: 'rivalProtect'; candidates: PlayerId[]; protect: number; fee: number }
  /** Our players who want to retire (V0.11): the chance each listens if the club asks him to play on. */
  | { kind: 'retire'; rows: { id: PlayerId; chance: number }[] }
  /** Our players named for a national team (V0.12): hurt, and whether the event could spare him the army. */
  | { kind: 'national'; event: string; rows: { id: PlayerId; injured: boolean; exemption: boolean }[] }
  /** One of our players was disciplined by the KBO (V0.12): the club's answer. */
  | { kind: 'scandal'; id: PlayerId; offense: string; penalty: string }
  /** An investor from the founding days claims part of the club (V0.12, dispute.ts). */
  | { kind: 'dispute'; investor: string; firm: string; settle: number; legal: number; loss: number };

// ── The twelfth club (V0.9) ───────────────────────────────────────────────────────────────────────

/** How the twelfth club's front office builds a team: balanced, through youth, for now, or for value. */
export type GmStyle = 'balanced' | 'develop' | 'winNow' | 'moneyball';
/** One league of twelve, or two of six (드림·매직리그, the 1999–2000 precedent). */
export type LeagueFormat = 'single' | 'two';
export type LeagueSide = 'dream' | 'magic';

/** When a twelfth club comes: never, in a set winter, or when the board puts it to the clubs. */
export interface TwelveSetting {
  mode: 'off' | 'year' | 'event';
  /** The winter it is founded (it plays futures the next season and joins the first team the one after). */
  year?: number;
}

/** What the player decides for the rival club. */
export interface RivalSettings {
  name: string;
  short: string;
  color: string;
  cityId: string;
  parentType: import('../club/types').ParentCompanyType;
  parentName: string;
  gm: GmStyle;
  manager: ManagerStyle;
  format: LeagueFormat;
}

/** The twelfth club once founded, the league format from its first season, and the rivalry's record. */
export interface TwelveState {
  teamId: TeamId;
  cityId: string;
  /** The winter it was founded; its first first-team season. */
  founded: number;
  firstTeam: number;
  format: LeagueFormat;
  gm: GmStyle;
  manager: ManagerStyle;
  /** Two leagues: each club's side, set when the twelve clubs first play. */
  leagues?: Record<TeamId, LeagueSide>;
  /** Season series against the user's club, from the user's side. */
  h2h?: { year: number; w: number; l: number; t: number }[];
  /** Who it took in its special draft. */
  picks?: { from: TeamId; id: PlayerId; name: string }[];
}

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

/** A released or non-retained foreign player on the market: when and from which club, and his last contract (US dollars). */
export interface ForeignPoolEntry {
  id: PlayerId;
  since: number;
  from: TeamId;
  usd: number;
}

export interface DraftSlot {
  teamId: TeamId;
  label: string;
  /** The club whose pick this was, when it came in a trade (V0.7.8). */
  via?: TeamId;
}

/** Cash and draft picks in a trade (V0.7.8), from the user's side: cash in 만 원, picks as rounds of the
    coming draft (`picksOut` ours, `picksIn` theirs). */
export interface TradeExtras {
  cashOut?: number;
  cashIn?: number;
  picksOut?: number[];
  picksIn?: number[];
}

/** A traded draft pick: `from`'s pick in round `round` of the draft of `year` now belongs to `to`. */
export interface PickTrade {
  year: number;
  round: number;
  from: TeamId;
  to: TeamId;
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
  /** The AI clubs have decided which foreign players to keep, ahead of the user's foreign signings (V0.7.3). */
  foreignRenewed?: boolean;
  /** The free-agent negotiation (V0.8), whether it is over, and the decisions it left for the user. */
  fa?: import('./fa').FaMarket;
  faDone?: boolean;
  faQueue?: import('./market').FaQueueItem[];
  /** The second draft in progress (odd winters). */
  second?: import('./seconddraft').SecondDraftState | null;
  /** The user's club's protected players in the twelfth club's special draft (V0.9). */
  rivalProtect?: PlayerId[];
  /** Our players who wanted to retire and agreed to play on (V0.11). */
  stay?: PlayerId[];
}

/** A spot in the batting order the general manager fixed: who bats there and where he plays. */
/** A national team named for an event (V0.12 adds the id, kind, result and the club's requests). */
export interface NationalEntry {
  id: string;
  year: number;
  name: string;
  kind?: import('./international').EventKind;
  /** The result earned the military exemption. */
  medal: boolean;
  finish?: import('./international').Finish;
  squad: PlayerId[];
  /** Players the clubs kept home, the squad left for the event, and the user's club was asked. */
  excused?: PlayerId[];
  left?: boolean;
  asked?: boolean;
}

export interface LineupSlot {
  id: PlayerId;
  pos: import('./engine/types').FieldPos;
}

/**
 * The general manager's lineup card (V0.8): the nine spots of the batting order against a right-handed (`R`)
 * and a left-handed (`L`) starter, each fixed or left to the manager (null); the starting rotation in order
 * (the manager fills the rest of the five); and whether fixed regulars still get the manager's days off.
 */
export interface LineupCard {
  R: (LineupSlot | null)[];
  L: (LineupSlot | null)[];
  rotation: PlayerId[];
  rest: boolean;
}

/** The club the user runs (V0.3: an expansion club). Money in 만 원. */
export interface UserClub {
  teamId: TeamId;
  /** An investor's claim on the club (V0.12, naming-rights clubs): when it came, settled or the verdict's winter. */
  dispute?: { year: number; investor: string; firm: string; settled?: number; verdictIn?: number; decided?: number };
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
  /** The general manager's lineup card (V0.8): spots he fixed himself; the manager fills the rest. */
  lineup?: LineupCard;
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
  /** A citizen club's mayor (V0.7.7). */
  mayor?: Mayor;
  /** Free agents the owner paid for (V0.7.7): their salary is added to the payroll budget while they are under contract. */
  parentGifts?: { id: PlayerId; name: string; annual: number; from: number; to: number }[];
  /** Promises made to free agents (V0.8) and whether they were kept: broken ones cost later free agents' trust. */
  promises?: { year: number; id: PlayerId; name: string; kind: import('../model/types').FaPromise; kept: boolean }[];
  /** The club's story: timeline of firsts and big moments, and unlocked achievements (V0.7). */
  timeline?: { year: number; text: string; key?: string }[];
  achievements?: { id: string; year: number }[];
  /** Ledger length at the last settlement: later entries go into the next one. */
  settledAt?: number;
  /** The season's support from the owner, fixed and paid at opening (V0.12, finance.ts). */
  seasonSupport?: { year: number; amount: number };
  /** The general manager has picked staff once (the first winter always asks). */
  staffSeen?: boolean;
  /** Guaranteed salary still owed to players the club released (counts against the payroll budget). The
      player's id is kept from V0.16 (older saves only have the label). */
  deadMoney?: { season: number; amount: number; label: string; id?: PlayerId }[];
  /** Name for the new ballpark when it opens (STADIUM_PLANS); default "<city> 신구장". */
  newStadiumName?: string;
  /** Club news: military results, re-signings, refusals, position changes. */
  log?: { year: number; text: string }[];
  /** Tutorial mode (V0.7.5): lessons already read, and whether the player turned the guide off. */
  tutorialSeen?: string[];
  tutorialOff?: boolean;
  /** Winters the board voted down a twelfth club (V0.9, event mode). */
  twelveNo?: number[];
  /** Short programmes at private training centres abroad (V0.10, training.ts). */
  trips?: TrainingTrip[];
  /** Facilities built (level by kind) and under construction (V0.10, facilities.ts). */
  facilities?: Partial<Record<FacilityKind, number>>;
  facilityWorks?: { kind: FacilityKind; level: number; opens: number; cost: number }[];
}

/** A private training centre abroad (V0.10). */
export type SiteId = 'seattle' | 'arizona' | 'florida' | 'tokyo';

export interface TrainingTrip {
  id: PlayerId;
  site: SiteId;
  /** The season it counts for: a winter programme for the next season, or one during the season. */
  season: number;
  from: string;
  until: string;
  cost: number;
  inSeason: boolean;
  /** Filled in when he is back. */
  result?: { gains: Partial<Record<import('../draftroom').ToolKey, number>>; velocity?: [number, number]; injury?: string; text: string };
}

/** What the club can build (V0.10): ballpark improvements and training facilities. */
export type FacilityKind = 'premium' | 'scoreboard' | 'turf' | 'concessions' | 'indoor' | 'gym' | 'rehab' | 'analytics' | 'futuresPark' | 'dorm';

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
  /** Tutorial mode (V0.7.5): a guide from the founding through the futures year (promotion after futures). */
  tutorial?: boolean;
  /** A twelfth club, the rival (V0.9). Off when missing. */
  twelve?: TwelveSetting;
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
  /** Away with the national team until this date (registered days still count); since V0.10 also on family
      leave (경조사 휴가), which the KBO counts the same way. */
  away: Record<PlayerId, string>;
  /** Abroad at a training centre until this date (V0.10): off the roster, registered days do not count. */
  abroad?: Record<PlayerId, string>;
  /** When the user's players were last sent down from the first team (ten days before re-registering). */
  demoted?: Record<PlayerId, string>;
  /** Players on waivers (seven days) and unattached players any club may sign (V0.5). */
  waivers?: { id: PlayerId; from: TeamId; until: string }[];
  pool?: PlayerId[];
  /** Foreign players with KBO experience whose clubs let them go (V0.7.3, foreignpool.ts). */
  foreignPool?: ForeignPoolEntry[];
  /** Foreign replacements used this season, by club. */
  foreignChanges?: Record<TeamId, number>;
  /** League moves for the news feed: trades, waiver claims, foreign changes. */
  transactions?: { date: string; text: string }[];
  /** One-off market events already run this season ("2027-trades-06"). */
  marketDone?: string[];
  /** 1.2.0, an optional league rule (off when missing): a foreign player with this many first-team seasons in the
      league no longer takes a foreign slot or counts against the foreign salary cap (NPB's way; foreigncap.ts). */
  foreignVeteran?: number | null;
  /** 1.2.0 (allstar.ts): this season's All-Star voting and game, and every finished year. */
  allStar?: import('./allstar').AllStarState;
  allStarHistory?: import('./allstar').AllStarRecord[];
  /** Competitive balance tax records by club, and clubs whose first-round pick drops, by draft year. */
  cap?: Record<TeamId, import('./cap').CapRecord[]>;
  pickDrop?: Record<number, TeamId[]>;
  /** Draft picks that changed hands in trades (V0.7.8). */
  pickTrades?: PickTrade[];
  /** The foreign salary cap (V0.7.8, foreigncap.ts): this season's books, past verdicts, and clubs whose
      second-round pick drops in a draft. */
  foreignBooks?: Record<TeamId, { season: number; spent: number; cap: number }>;
  foreignCap?: Record<TeamId, import('./foreigncap').ForeignCapRecord[]>;
  foreignPickDrop?: Record<number, TeamId[]>;
  /** Last date registered days were counted for. */
  countedThrough: string | null;
  postseason: SeriesResult[];
  history: SeasonSummary[];
  international: NationalEntry[];
  /** Players serving a KBO suspension or ban (V0.12, scandals.ts). */
  suspended?: Record<PlayerId, import('./scandals').Suspension>;
  /** News articles (V0.7, news.ts). */
  news?: import('./news').NewsItem[];
  /** Pop-up alerts for the user's club (V0.7.4, alerts.ts). */
  alerts?: import('./alerts').Alert[];
  /** Retired greats (V0.7). */
  hallOfFame?: import('./awards').HallEntry[];
  /** Fans, prices, staff and accounts of every club (V0.6). */
  clubs?: Record<TeamId, ClubState>;
  /** This season's home gates, and the postseason ticket money. */
  gate?: Record<TeamId, import('./fans').GateLine>;
  postseasonGate?: number;
  /** Box scores and play-by-play logs kept for viewing (V0.7, boxscore.ts). */
  boxes?: Record<string, import('./boxscore').StoredBox>;
  pbp?: Record<string, import('./engine/types').PlayEvent[]>;
  /** The twelfth club (V0.9), once founded. */
  twelve?: TwelveState;
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

/** The owner pays for a free agent (V0.7.7): the offer it makes, outside the payroll budget. */
