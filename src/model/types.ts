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
  /** 1.1.0 (league/traits.ts): growth type and character, 1–99 each. */
  traits?: Traits;
}

/** 초조숙 · 조숙 · 보통 · 만성 · 초만성. */
export type GrowthType = 'veryEarly' | 'early' | 'normal' | 'late' | 'veryLate';

export interface Traits {
  growth: GrowthType;
  /** 천재성: how fast he learns. */
  genius: number;
  /** 성실성: work ethic. */
  work: number;
  /** 멘탈: composure on the big stage. */
  mental: number;
  /** 리더십. */
  leadership: number;
  /** 충성심: to his own club in free agency. */
  loyalty: number;
  /** 논란성: trouble off the field. */
  controversy: number;
  /** 2.0.28 클러치: better (or worse) with runners in scoring position. Absent on a player from before (traits.ts
      clutchOf draws it). */
  clutch?: number;
  /** 2.0.28 논쟁성: a quarrelsome temper on the field — the benches clear more around him, he argues the calls and is
      thrown out more often. Absent on a player from before (traits.ts temperOf draws it). */
  temper?: number;
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
  /** The winter's future grade the season's revisions start from (V0.12, scouting.ts). */
  base?: number;
  /** The latest revision during the season. */
  moved?: { date: string; from: number; to: number };
  /** 1.3.0: the draft combine already moved this report (combine.ts). */
  combine?: boolean;
}

/** One season's public report (1.7.0): [season, overall, then each ability in the order of `GRADE_KEYS`]. */
export type GradeLogEntry = number[];

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
  /** The winter his free-agent deal's period option was declined or he opted out (V0.8): he is free that
      winter whatever his service, and the club that signs him owes no compensation. */
  optionFree?: number;
  /** The latest military medical grade after an operation (V0.7.7, military.ts): 3 active duty, 4 social
      service only, 5 no peacetime service. `surgeries` counts the major operations it looked at. */
  exam?: { year: number; grade: number; reason: string; surgeries: number };
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
  /** US dollars; `fee`: the transfer fee paid to his old club (1.3.0; part of the foreign caps, never his pay). */
  usd?: { bonus: number; salary: number; options: number; fee?: number };
  /** Domestic free-agent deals (V0.8): incentives, a period option and promises beyond the money. */
  fa?: FaTerms;
  /** 2.0.18 (tempforeign.ts): a stand-in's contract, for the injured foreign player with this id. */
  temp?: PlayerId;
}

/** How a free-agent deal's incentives are earned each season: games for a hitter, innings for a starter, games for a reliever. */
export type IncentiveKind = 'games' | 'innings' | 'relief';

/** Promises a club makes a free agent (V0.8): a starting job, or reinforcing a weak spot before opening day. */
export type FaPromise = 'starter' | 'reinforce';
export type FaSpot = 'SP' | 'RP' | 'C' | 'IF' | 'OF';

/** The parts of a free-agent deal beyond bonus and salaries (만 원). */
export interface FaTerms {
  /** Guaranteed seasons (the bonus counts against the salary cap spread over them). */
  years: number;
  /** The bonus was paid at once from the club's fund (V0.8.1, the user's club): it stays out of the payroll budget. */
  prepaid?: boolean;
  /** Incentives over the guaranteed seasons, earned season by season (출장·이닝 옵션), and what was paid. */
  options: number;
  incentive: IncentiveKind;
  paid: { season: number; amount: number }[];
  /** A period option after the guaranteed seasons ("4+2"): the club's to take up, or the player's (an opt-out). */
  extra?: { years: number; holder: 'club' | 'player'; annual: number };
  /** What the club promised, the spot it said it would reinforce, and how each promise ended. */
  promises?: FaPromise[];
  spot?: FaSpot;
  kept?: Partial<Record<FaPromise, boolean>>;
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
  /** 1.9.7 (a legacy game): a territorial (1차) pick, or his number among the other picks (2차) in a draft that had
      territorial picks first. */
  territorial?: boolean;
  secondPick?: number;
  /** 1.9.7: in the league before the KBO began (the legacy start's first players): no draft of his on record. */
  preLeague?: boolean;
  /** 1.7.0: the public future grade when he was drafted (the draft-day expectation). */
  draftGrade?: number;
  /** Drafted with a pick another club traded away (V0.7.8): he cannot be traded in his first season. */
  pickVia?: string;
  /** Nationality for foreign players. */
  nationality?: string;
  asiaQuota?: boolean;
  /** 2.0.37 (devforeign.ts): signed as a development foreign player (육성형 외국인); still one while on a development contract. */
  devForeign?: boolean;
  /** 1.9.6 (kyopo.ts): an overseas Korean player (재일교포), a domestic player with a Japanese-league past. */
  kyopo?: boolean;
  /** 2.0.41 (abroadvets.ts): a Korean veteran home from a career abroad, never in the KBO before. */
  abroadVet?: boolean;
  /** 2.0.42 (naturalize.ts): a foreign player who took Korean nationality — the winter, and his country before. */
  naturalized?: { year: number; from: string };
  /** Foreign players: where he played before and what he asked for when he came (US dollars). */
  background?: { level: ForeignLevel; text: string; ask: number; /** 1.7.0: an old big-league name. */ veteran?: boolean };
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
  /** Games started at each position (V0.7). */
  posG?: Partial<Record<FieldPos, number>>;
  /** 2.0.1: his balls in play (battedball.ts); absent in records from before. */
  bip?: import('../league/battedball').BattedTotals;
  /** 2.0.3: his fielding (fielding.ts); absent in records from before. */
  fld?: import('../league/fielding').FieldTotals;
  /** 2.0.4: this season's hits for his spray chart (engine/types.ts BattingLine.spray); dropped when the season is
      archived. */
  spray?: number[];
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
  /** 1.9.8: complete games (absent in records from before). */
  cg?: number;
  pitches: number;
  /** First team only: against left- and right-handed batters. */
  split?: Splits;
  /** 2.0.1: the balls put in play against him. */
  bip?: import('../league/battedball').BattedTotals;
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
  /** 2.0.4: a pitcher's mix that season (each pitch and the share thrown, percent) and his average velocity. */
  mix?: [string, number][];
  velo?: number;
}

/** A postseason's line (1.4.0). */
export interface PostRecord {
  year: number;
  teamId: TeamId;
  bat: BatTotals | null;
  pit: PitTotals | null;
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
  /** Other positions he handles (V0.11, up to three; hitters only). Anywhere else costs him more in the field. */
  alt?: Exclude<FieldPos, 'DH'>[];
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
  /** 1.7.0: the public report at the start of each season since 1.7.0 (season, overall, each ability), for the
      graph on his screen. */
  gradeLog?: GradeLogEntry[];
  /** 2.0.6 (pitches.ts developPitches): how far each secondary pitch has gone its own way, and the grades of his
      pitches a season ago (for the change on his screen). */
  pitchDev?: Record<string, number>;
  pitchLast?: { season: number; grades: Record<string, number> };
  /** 2.0.7 (feats.ts): his great single-game feats (perfect game, no-hitter, cycle, home runs in a row…). */
  feats?: import('../league/feats').Feat[];
  /** 2.0.8 (newpitch.ts): pitches he learned over a winter — the winter, and the grade against his 변화구 (rising for a
      few winters). */
  learned?: { type: import('../league/pitches').PitchType; year: number; offset: number }[];
  /** 2.0.12 (twoway.ts): his other side (a pitcher's bat, a hitter's arm), kept once known, and the winters he was
      turned around. */
  other?: import('../league/twoway').OtherSide;
  switched?: { year: number; to: 'pitcher' | 'hitter' }[];
  /** 2.0.28 (development.ts): his fall instructional league and Australian winters. */
  devLog?: import('../league/development').DevLine[];
  /** 2.0.28 (league/moves.ts): his moves from club to club, as they happened. */
  moves?: import('../league/moves').MoveEntry[];
  /** 2.0.15 (venues.ts): his career at home and on the road, and at each ballpark (from 2.0.15). */
  venues?: import('../league/venues').Venues;
  /** 2.0.30: his first-team plate appearances by situation, the seasons gone by (engine/situation.ts). */
  situ?: { bat?: Record<string, number[]>; pit?: Record<string, number[]> };
  career: SeasonRecord[];
  /** 1.4.0: postseason lines, one a year he played in it (not in `career`, so season totals stay as they were). */
  post?: PostRecord[];
  /** Awards and titles ("2027 MVP", "2027 홈런 1위 (38개)"). */
  honors?: string[];
  /** 1.9.3 (nicknames.ts): the fans' nickname — which one (code, index into its names), the winter it came and the
      club a "{club}" in it names — and the general manager's own for our player, which shows instead. */
  nickname?: { code: string; i: number; year: number; team?: TeamId; /** 2.0.22: from the foreign players' names (nicknames.ts FOREIGN_NAMES). */ foreign?: boolean };
  nicknameOwn?: string;
  /** 2.0.24 (the user's request): a foreign player's full name when the club registered him under a shorter one
      (`name` is then the registered name, 등록명). */
  fullName?: string;
  /** Injuries so far (first team and futures). */
  injuries?: InjuryRecord[];
  /** 1.7.0 (adapt.ts): the season he failed to adapt to the KBO, and the grade points his main tools lose in games. */
  adaptFail?: { year: number; date: string; delta: number };
  /** Uniform number and the club it belongs to (a player who moves gets a new one). */
  number?: number;
  numberTeam?: TeamId;
  /** The club's development plan from spring camp (absent: balanced growth, no change). */
  plan?: PlayerPlan;
  /** A draftee who refused to sign and went abroad (V0.7.3): when, and the draft he comes back through
      after the KBO's two-year wait (null: he stays abroad). */
  abroad?: { left: number; draft: number | null };
  /** 1.7.0 (mlb.ts): a posted player's major league career — the deal, the club and each season abroad. */
  mlb?: MlbCareer;
  /** Life off the field (V0.10, the user's players only): family, form, what fans think, what happened. */
  life?: PlayerLife;
  /** 2.0.35 (league/abilityedit.ts): what the ability editor set in place of the draws from his id — his batting
      tendencies (pull, lift: −2 … 2), a pitcher's (pitchLift), fastball and pitches (offsets from his 변화구, shares),
      and his fielding parts. */
  custom?: {
    pull?: number;
    lift?: number;
    pitchLift?: number;
    /** 2.0.36: a knuckleballer's top velocity. */
    top?: number;
    fastball?: import('../league/pitches').FastballType;
    pitches?: import('../league/pitches').Pitch[];
    field?: Partial<Record<import('../league/abilityedit').FieldPart, number>>;
  };
}

export interface MlbCareer {
  /** The winter he was posted, his guaranteed deal (years, US dollars) and his club. */
  posted: number;
  years: number;
  total: number;
  club: string;
  seasons: MlbSeason[];
  /** The winter he came home to the KBO, or ended his career abroad. */
  back?: number;
  ended?: number;
  /** 1.9.3: the league abroad — the majors (missing) or Japan's NPB — and how he went (posting when missing). */
  league?: 'npb';
  via?: 'fa';
}

/** One season abroad: top-league games (the rest of it in triple-A — or NPB's 2군 — when `aaa`). */
export interface MlbSeason {
  year: number;
  club: string;
  aaa?: boolean;
  bat?: OverseasBat;
  pit?: OverseasPit;
  war: number;
  /** 1.9.3: his line in the minors (triple-A, or NPB's farm) for the part of the year he spent there. */
  minors?: { bat?: OverseasBat; pit?: OverseasPit };
}

export interface OverseasBat {
  g: number;
  pa: number;
  avg: number;
  obp: number;
  slg: number;
  hr: number;
  rbi: number;
  sb: number;
}

export interface OverseasPit {
  g: number;
  gs: number;
  ip: number;
  w: number;
  l: number;
  sv: number;
  era: number;
  k: number;
}

/** V0.10. Kept only for the user's club's players, so the shared simulation never reads it for others. */
export interface PlayerLife {
  /** Year he married, and children. */
  married?: number;
  kids?: number;
  /** Season of his latest child (0.10.1: no other within two years). */
  lastBirth?: number;
  /** A spell of good or bad form: grade points on his main tools in games until `until`. */
  form?: { delta: number; until: string; why: string };
  /** What events added to or took from the fans' fondness (−30 … +30). */
  fans?: number;
  /** A conditioning programme abroad lowers his injury chance this season. */
  conditioned?: number;
  /** What happened, newest last. */
  events?: { date: string; text: string; tone?: 'good' | 'bad' }[];
  /** 2.0.28 (protests.ts): the times he argued a call, and was thrown out for it. */
  protests?: number;
  ejections?: number;
  /** V0.12 (scandals.ts): offenses so far, drunk driving not yet known, a doping suspicion (real or a rumour; the
      ability it lends while it lasts) and the season the club last tested him. */
  offenses?: Partial<Record<import('../league/scandals').Offense, number>>;
  hiding?: { date: string; found: string };
  /** 1.6.0: a free agent nobody signed that winter (FA 미아), waiting in the unattached pool. */
  unsigned?: number;
  /** 2.0.27: what he asked a year in the market (만원, ×0.7) — the least he signs for as an unattached player. */
  unsignedAsk?: number;
  /** 1.6.0: an injury that ended his career (the date): he retires after the season, however he is asked. */
  careerOver?: string;
  suspicion?: { since: string; signs: number; real: boolean; next: string; boost?: { tool: 'stuff' | 'power'; delta: number }; /** 2.0.41: a broker's program (broker.ts). */ broker?: boolean };
  inspected?: number;
}

export interface InjuryRecord {
  date: string;
  days: number;
  part: string;
  /** Hurt in a futures game. */
  futures?: boolean;
  /** An operation (V0.7.7): a major one is the usual ground for a 4급 military grade. */
  surgery?: 'minor' | 'major';
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
  /** Run factor when it differs from the club's default (fences moved, V0.6; an old park of a league that plays
      history, 1.9.7). */
  park?: number;
  /** 2.0.2: the layout our club built in the editor (layout.ts); absent: the park's own. */
  layout?: import('../league/layout').ParkLayout;
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
