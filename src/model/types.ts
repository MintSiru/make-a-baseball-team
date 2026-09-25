/* League data model. One `Player` type covers amateurs, pros, veterans and foreigners.

   Draft Room's rule carries over: hidden ability (`hidden`) and what scouts report (`scouting`) are
   kept apart. UI, AI clubs and news may read `scouting` and public facts only (see publicView). */
import type { ParentCompanyType, StadiumOwnership, StadiumSize } from '../club/types';
import type { AmateurRecord, HistoryEntry, Intent, Role, Tools } from '../draftroom';
import type { FieldPos, Splits } from '../league/engine/types';

export type PlayerId = string;
export type TeamId = string;

/** Continuous 20–80 ability the player does not see. */
export interface HiddenAbility {
  current: Tools;
  potential: Tools;
  growthCurve: 'early' | 'normal' | 'late';
  developmentRate: number;
  observerBias: number;
  injuryRisk: number;
}

/** A scouting report: five-point 20–80 grades with observer error. */
export interface ScoutingReport {
  season: number;
  tools: Tools;
  futureTools: Tools;
  current: number;
  futureValue: number;
  floor: number;
  ceiling: number;
  uncertainty: string;
  tags: string[];
  strength: string;
  weakness: string;
}

export type PlayerStatus = 'amateur' | 'active' | 'military' | 'freeAgent' | 'overseas' | 'retired';

export type MilitaryStatus = 'pending' | 'serving' | 'served' | 'exempt';
export type ServiceRoute = 'sangmu' | 'army' | 'social';

export interface Service {
  /** Full seasons credited toward free agency (a season = rules.freeAgency.daysPerSeason first-team days). */
  creditedSeasons: number;
  /** First-team days not yet rolled into a credited season. */
  carriedDays: number;
  military: MilitaryStatus;
  /** While serving: the route and the discharge date. */
  route?: ServiceRoute;
  returnsOn?: string;
  /** The winter he was posted to the major leagues (a player is posted once). */
  postedIn?: number;
  /** Credited seasons when he last became a free agent (re-qualifies four seasons later). */
  lastFreeAgencyAt?: number;
}

export type ContractKind = 'rookie' | 'standard' | 'multiYear' | 'freeAgent' | 'foreign' | 'asiaQuota' | 'development';

/** Money in 만 원. */
export interface Contract {
  teamId: TeamId;
  kind: ContractKind;
  signedIn: number;
  signingBonus: number;
  salaries: { season: number; amount: number }[];
  /** Foreign contracts in US dollars: guaranteed bonus and salary, and options paid for a good season. */
  usd?: { bonus: number; salary: number; options: number };
}

export interface PlayerOrigin {
  kind: 'draftClass' | 'foreign';
  /** Calendar year of the draft the player entered (a September draft of year Y fills the Y+1 roster). */
  draftYear?: number;
  /** Id inside the source Draft Room pool. */
  sourceId?: string;
  pathway: string;
  entryCategory: string;
  /** Draft pick in the league draft (overall), when drafted by a club. */
  overallPick?: number;
  /** Nationality for foreign players. */
  nationality?: string;
  asiaQuota?: boolean;
  /** Foreign players: where he played before and what he asked for when he came (US dollars). */
  background?: { level: ForeignLevel; text: string; ask: number };
}

export type ForeignLevel = 'mlb' | 'mlbCup' | 'aaa' | 'npb' | 'npbFarm' | 'jpIndie' | 'cpbl' | 'abl' | 'indie';

/** Counting stats for one season at the first-team level. */
export interface BatTotals {
  g: number;
  pa: number;
  ab: number;
  h: number;
  d: number;
  t: number;
  hr: number;
  bb: number;
  hbp: number;
  k: number;
  r: number;
  rbi: number;
  sb: number;
  cs: number;
  sf: number;
  sh: number;
  gdp: number;
  /** First team only: against left- and right-handed pitchers. */
  split?: Splits;
}

export interface PitTotals {
  g: number;
  gs: number;
  outs: number;
  bf: number;
  h: number;
  hr: number;
  bb: number;
  hbp: number;
  k: number;
  r: number;
  er: number;
  w: number;
  l: number;
  sv: number;
  hld: number;
  qs: number;
  pitches: number;
  /** First team only: against left- and right-handed batters. */
  split?: Splits;
}

export interface SeasonRecord {
  year: number;
  teamId: TeamId;
  /** Futures-league line (futures games are simulated from 2026); first team when absent. */
  level?: 'futures';
  age: number;
  /** First-team registered days this season (0 on a futures line). */
  days: number;
  /** Futures line only: days in the third squad (잔류군), training or in rehab. */
  thirdDays?: number;
  bat: BatTotals | null;
  pit: PitTotals | null;
  war: number;
}

export interface Player {
  id: PlayerId;
  name: string;
  birthday: string;
  birthplace: string;
  height: number;
  weight: number;
  throws: '좌' | '우';
  bats: '좌' | '우' | '양';
  role: Role;
  /** Everyday position for hitters; pitchers use `role` (SP/RP). */
  position: Exclude<FieldPos, 'DH'> | null;
  archetype: string;
  personality: string;
  /** Top velocity when he was drafted or signed (km/h); `velocityStuff` is his hidden 구위 then. */
  velocity: number | null;
  velocityStuff?: number;
  twoWay: boolean;
  origin: PlayerOrigin;
  education: { qualification: string; school: string; schoolTier: string; region: string; pathText: string; history: HistoryEntry[] };
  amateur: { record: AmateurRecord; awards: string[]; draftRank: number; intent?: Intent };
  status: PlayerStatus;
  teamId: TeamId | null;
  contract: Contract | null;
  service: Service;
  hidden: HiddenAbility;
  scouting: ScoutingReport;
  /** First professional season in the league. */
  proSince: number;
  career: SeasonRecord[];
  /** Injuries so far (first team and futures). */
  injuries?: InjuryRecord[];
  /** Uniform number and the club it belongs to (a player who moves gets a new one). */
  number?: number;
  numberTeam?: TeamId;
  /** The club's development plan from spring camp (absent: balanced growth, no change). */
  plan?: PlayerPlan;
}

export interface InjuryRecord {
  date: string;
  days: number;
  part: string;
  /** Hurt in a futures game. */
  futures?: boolean;
}

/** Spring-camp plan (Draft Room planStep, V0.4). */
export interface PlayerPlan {
  /** 'balanced' or the tool the player works on: it grows faster, the others a little slower. */
  focus: string;
  /** Season of a position change: his fielding suffers while he adapts. */
  adaptingIn?: number;
}

export interface Stadium {
  name: string;
  size: StadiumSize;
  capacity: number;
  ownership: StadiumOwnership;
  /** Run factor when it differs from the club's default (fences moved, V0.6). */
  park?: number;
}

export interface Team {
  id: TeamId;
  name: string;
  short: string;
  color: string;
  region: string;
  kind: 'existing' | 'expansion';
  founded: number;
  /** First season in the first-team league; null while it plays futures only. */
  firstTeamFrom: number | null;
  /** Expansion benefits (extra first-team spot and foreign player) last through this season. */
  benefitsUntil?: number;
  parent: { type: ParentCompanyType; name: string };
  /** Numbers the club no longer issues, and whose they were. */
  retiredNumbers?: { number: number; playerId: PlayerId; name: string; year: number }[];
  stadium: Stadium;
}

export type InjuredListLength = 10 | 15 | 30;

export interface Roster {
  teamId: TeamId;
  firstTeam: PlayerId[];
  futures: PlayerId[];
  development: PlayerId[];
  injured: { playerId: PlayerId; list: InjuredListLength; from: string }[];
}

/** Where the game is inside a year (ROADMAP.md, 연간 캘린더). */
export type CalendarPhase = 'founding' | 'regularSeason' | 'rookieDraft' | 'postseason' | 'offseason' | 'springCamp' | 'preseason';

export interface GameDate {
  year: number;
  phase: CalendarPhase;
}
