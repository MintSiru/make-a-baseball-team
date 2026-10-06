/* League balance numbers (this game's own; Draft Room's stay in src/draftroom/tuning.js).
   Targets are the 2025 KBO league averages in docs/CALIBRATION.md; scripts/calibrate.ts measures them.
   The intercepts sit below the real rates because first-team players average about 55, not 50. Changing a number changes
   simulated results: bump SIM_VERSION (src/core/version.ts) and re-record the golden test.

   Ability scale: 20–80 with 50 = average; `z = (grade - 50) / 10`. Rate models are logit-linear:
   logit(p) = logit(base) + Σ coefficient × z. */

export const ENGINE = {
  /** Diminishing returns past this z (see Zr). */
  extremes: { knee: 1, slope: 0.5 },
  /** Per plate appearance, for an average (50) batter against an average pitcher. */
  base: {
    /** 0.7.7: walks 0.074 → 0.076, home runs 0.0162 → 0.0167 and BABIP 0.319 → 0.325, back to the 2025
        league after the stronger foreign pitchers (FOREIGN below, CALIBRATION.md §10). */
    bb: 0.076,
    hbp: 0.016,
    k: 0.181,
    hr: 0.0167,
    /** Hits on balls in play (excludes home runs). 0.316 → 0.319 in 0.7.6: managers field better
        defenders since the lineup is chosen as a whole (manager.ts), so the league average stays put. */
    babip: 0.325,
  },
  batter: {
    bb: { eye: 0.42, contact: 0.05 },
    k: { contact: -0.42, power: 0.1, eye: -0.08 },
    hr: { power: 0.72, contact: 0.06 },
    babip: { contact: 0.16, speed: 0.05 },
  },
  pitcher: {
    bb: { command: -0.42, stuff: 0.04 },
    hbp: { command: -0.18 },
    k: { stuff: 0.28, breaking: 0.21, command: 0.04 },
    hr: { stuff: -0.26, command: -0.12, breaking: -0.06 },
    babip: { stuff: -0.07, breaking: -0.04 },
  },
  /** Team fielding (average of the fielders' defense, weighted by position). */
  fielding: { babip: -0.1, error: -0.35 },
  /** Batter against a pitcher of the same hand (switch hitters never). */
  platoon: { k: 0.12, bb: -0.06, hr: -0.15, babip: -0.045 },
  home: { babip: 0.012, hr: 0.03 },
  /** Extra-base share of non-HR hits: logit(base) + power/speed z. */
  hitTypes: {
    double: { base: 0.16, power: 0.25, speed: 0.08 },
    triple: { base: 0.011, speed: 0.55, power: 0.05 },
  },
  /** Balls in play that are outs. */
  outs: {
    groundShare: 0.46,
    /** Ground ball with a force at second and fewer than two outs. */
    doublePlay: { base: 0.47, speed: -0.3 },
    /** Fly out with a runner on third, fewer than two outs. */
    sacFly: { base: 0.62, speed: 0.2 },
    flyAdvanceSecond: 0.22,
    groundScoreFromThird: 0.52,
  },
  errorPerBip: 0.026,
  advance: {
    // Runner on second scores on a single / runner on first reaches third on a single / scores on a double.
    secondScoresOnSingle: { base: 0.55, speed: 0.12 },
    firstToThirdOnSingle: { base: 0.22, speed: 0.1 },
    firstScoresOnDouble: { base: 0.38, speed: 0.14 },
  },
  steal: {
    /** Chance per plate appearance that a runner on first (second base open) tries to steal. */
    attempt: { base: 0.044, speed: 0.95 },
    minSpeed: 38,
    success: { base: 0.68, speed: 0.45, catcher: -0.25 },
  },
  sacBunt: { rate: 0.3, maxBatterGrade: 57 },
  wildPitch: { base: 0.0115, command: -0.25 },
  pitches: { perPa: 3.5, k: 1.05, bb: 1.95, noise: 1.2 },
  starter: {
    /** Pull when the pitch limit is reached, or earlier after this many runs in the game. */
    runsBeforeHook: 6,
    earlyHookRuns: 4,
    earlyHookInning: 5,
    /** Starters rarely finish: hook in the 9th unless dominant. */
    completeGameChance: 0.12,
  },
  /** A small-ball manager: steal attempts (logit) and bunts (multiplier). */
  smallBall: { steal: 0.35, bunt: 1.6 },
  /** Manager style: starter pitch limit change. */
  hook: { quickHook: -8, patient: 6 },
  /** Lineup score for the platoon side (batValue points); `half` for a player the GM set as a platoon half. */
  platoonLineup: { edge: 2.5, half: 40 },
  reliever: { maxOutsShort: 4, maxOutsMopUp: 6, maxOutsLong: 9, pitchLimitShort: 28, pitchLimitMopUp: 40, pitchLimitLong: 55, lefty: { starterPitches: 85 } },
  /** The manager's pitch count for a starter: base + (stamina − 50) × perStamina, less on short rest and in April. */
  starterLimit: { base: 78, perStamina: 1.2 },
  /** Most innings in a regular-season game before a tie (RULES.md §1, 2025~). */
  maxInnings: 11,
} as const;

/** Scale factor turning a 20–80 grade into a z-score. */
export const Z = (grade: number) => (grade - 50) / 10;

/**
 * The z-score the rate models use for batting and pitching tools: full effect up to `knee`, then
 * diminishing returns (a 70→80 step counts `slope` of a 50→60 step). Keeps the averages and trims the
 * extremes (V0.4: 60-homer hitters and 250-strikeout pitchers every year).
 */
export const Zr = (grade: number) => {
  const z = Z(grade);
  const { knee, slope } = ENGINE.extremes;
  const a = Math.abs(z);
  return a <= knee ? z : Math.sign(z) * (knee + (a - knee) * slope);
};

/** Offseason: development, careers and roster turnover. Military numbers follow Draft Room's tuning. */
export const OFFSEASON = {
  /** The decline starts at the growth type's age (GROWTH.types[…].decline; 31 for 보통), steeper three years on. */
  veteranDecline: { perYear: 0.3, steepPerYear: 0.45, speed: 1.4, skill: 0.6 },
  /** Scouts project growth up to the growth type's `zeroAt` (28 for 보통), closing over `window` years. */
  scouting: { window: 7 },
  serviceDecline: { army: [0.8, 1.6] as [number, number], social: [0.3, 0.8] as [number, number] },
  /** Retirement (offseason.ts retirementChance): the chance a year by age from `from`, at `old.age` and over (no
      lower than `old.floor` of it however good he is), times the multiplier of his current grade (`byGrade`, best
      first; `weak` below). V0.11: stars and regulars play longer. `persuade`: the user's club asking him to play on. */
  retirement: {
    from: 33,
    byAge: [0.05, 0.08, 0.14, 0.22, 0.34, 0.48, 0.64, 0.8],
    old: { age: 41, chance: 0.95, floor: 0.4 },
    byGrade: [
      [60, 0.12],
      [55, 0.35],
      [50, 0.8],
      [45, 1.1],
    ] as [number, number][],
    weak: 1.8,
    goodYear: 2.5,
    persuade: { base: 0.85, from: 34, perYear: 0.08, perGrade: 0.01, min: 0.1, max: 0.9 },
  },
  military: {
    mustAge: 28,
    minAge: 20,
    byRoute: { futures: 0.3, cameo: 0.2, backup: 0.12, regular: 0.03, rehab: 0.35 } as Record<string, number>,
    byAge: [
      [20, 0.8],
      [22, 1.2],
      [24, 1.6],
      [25, 2],
      [26, 2.8],
      [27, 4],
    ] as [number, number][],
    holdForGames: 48,
    sangmu: { maxAge: 27, minGrade: 40, perGrade: 0.045, playedBonus: 0.12, min: 0.05, max: 0.7 },
    /** Social service for reasons other than an operation (illness and the like). */
    socialBase: 0.06,
    /** Winter exams after a major operation (military.ts, a game assumption): 5급 chance after one
        operation and after two or more, extra for a knee or Achilles, 4급 otherwise at `four`
        (the rest stay fit for active duty), and a serving agent's operated knee re-graded 5급. */
    exam: { five: 0.06, fiveRepeated: 0.35, kneeBonus: 0.06, four: 0.85, worsening: 0.1 },
    /** An AI club sends a 4급 player in long rehab to serve at once (service and rehab together). */
    socialInRehab: 0.8,
  },
  freeAgency: { minGrade: 50, stayChance: 0.62 },
  /** Development players (육성선수): draft-day signings per club, the AI's target and hard cap, and age limits. */
  development: { signings: 5, aiTarget: 20, cap: 30, perYear: 10, maxAge: 27, convertAge: 25 },
  /** Clubs leave a few roster spots open after the draft. */
  openSpots: 3,
  /** Draftees from these first rounds are kept through their first winter; later picks can be cut like anyone. */
  protectedRounds: 5,
  release: { maxAge: 33, minValue: 45, signChance: 0.5 },
  /** V0.7.8: under the foreign salary cap, an AI club keeps room for each new signing still to come
      (`newReserveUSD`) and pays a new one at least `newFloorUSD`. */
  foreign: { keepWarPitcher: 2.5, keepWarHitter: 2.0, keepChance: 0.85, newReserveUSD: 700_000, newFloorUSD: 400_000 },
} as const;

/** Salaries (만 원) until the market arrives in V0.5; see docs/CALIBRATION.md §2. */
/** 0.7.7: raises per WAR 3300 → 4300 and free-agent value per WAR 13000 → 15500, since the stronger foreign
    players now take their real share of the league's WAR (2026 domestic average about 1억 3천만; real 1억 7,536만). */
export const SALARY = {
  raisePerWar: 5000,
  perServiceYear: 650,
  freeAgentPerWar: 15500,
  freeAgentMax: 250000,
  veteranStar: 32000,
} as const;

/** Futures league and development by playing time (V0.4; game assumptions, docs/CALIBRATION.md). */
export const FUTURES = {
  /** Regulars who stay out of futures games: this much first-team work last season (half of it this season). */
  established: { pa: 350, outs: 270 },
  /** Squad kept for futures games; the rest of the club is in the third squad. */
  squad: { pitchers: 16, catchers: 3, hitters: 17 },
  /** Prospects get playing time: the gap between future and current value counts this much, up to this age. */
  youthAge: 24,
  youthWeight: 0.4,
  /** A short-handed futures side bats pitchers rather than forfeit (상무 after the June discharge). */
  pitchersBat: true,
  /**
   * Yearly growth multiplier for players up to `maxAge`, from last season's playing time (first team
   * and futures, futures counted at `futuresWeight`) and days trained in the third squad.
   */
  growth: { maxAge: 27, base: 0.83, play: 0.3, train: 0.15, max: 1.15, fullPA: 300, fullInnings: 60, futuresWeight: 0.8, trainDays: 180 },
} as const;

/** The free-agent market (V0.5; game assumptions measured against how often KBO free agents stay). */
export const MARKET = {
  /** Yearly pay: 4,000만 + WAR^1.5 × perWar, between these bounds (만 원). */
  perWar: 13000,
  minAnnual: 6000,
  maxAnnual: 250000,
  /** An AI club bids with base + perGain × (grade points over its current player at his spot), up to max; a third of that over the cap. */
  interest: { base: 0.03, perGain: 0.035, max: 0.6, overCap: 0.3 },
  /** Chance his own club makes an offer, and how much he prefers staying. */
  stay: 0.8,
  loyalty: 1.12,
  /** An AI club takes a compensation player only if he is at least this good (keep value). */
  compensationPickValue: 50,
} as const;

/**
 * The free-agent negotiation (V0.8; game assumptions from the 2024–2026 markets, RULES.md §4 and §9).
 * Money in 만 원; "value" is what an offer is worth to the player (bonus a little above salary, incentives
 * at half, a period option by who holds it).
 */
export const FA = {
  /** Market days after the list is published: 0 is 11월 9일, the last (2월 1일, camp) settles everyone left. */
  opens: '11-09',
  rounds: [0, 3, 6, 9, 12, 16, 20, 25, 30, 37, 44, 52, 60, 68, 76, 84],
  /** A season's worth (bonus spread, salary and incentives): base + perWar × recent WAR, less 5% a year after 32, at most max. */
  price: { base: 10000, perWar: 50000, max: 300000, min: 5000, ageFrom: 32, perAge: 0.05 },
  /** Signing bonus as a share of the guaranteed money, by the guaranteed total (40억+, 15억+, smaller). */
  bonus: [
    { from: 400000, share: [0.45, 0.6] },
    { from: 150000, share: [0.3, 0.5] },
    { from: 0, share: [0, 0.3] },
  ] as { from: number; share: [number, number] }[],
  /** Incentives on top of the guaranteed money, as a share of it. */
  options: [0.03, 0.2] as [number, number],
  /** How a player values each part of an offer (see above). */
  value: { bonus: 1.1, options: 0.5, playerOption: 0.35, clubOption: 0.1 },
  /** He asks the market price × greed; accepts from floorStart of that; with no acceptable offer the floor
      falls this much a week (faster from 33) and closes this share of the gap to his best offer each round,
      never under floorMin. */
  greed: [1.02, 1.22] as [number, number],
  floorStart: 0.92,
  coolPerWeek: 0.03,
  coolOld: 0.05,
  meet: 0.15,
  floorMin: 0.6,
  /** Days he weighs an acceptable offer before he signs; an offer this far over his floor he takes at once. */
  patience: [2, 9] as [number, number],
  overwhelm: 1.12,
  /** How much more his own club's offer is worth to him. */
  loyalty: [0.02, 0.12] as [number, number],
  /** Offers that miss a demand lose this share of their value; a contender gains or loses by last season's rank. */
  demand: { yearShort: 0.07, bonusShort: 0.45, starter: 0.12, reinforce: 0.08, contender: { top: 0.06, low: -0.12 }, hometown: 0.08, optOut: 0.1 },
  /** AI clubs: first offer and most they pay (× the market's guaranteed money and their need), the chance they
      raise for a player weighing a better offer, what compensation takes off an outside club's price, and how
      far over the salary cap an offer may take them (renewal estimates are rough). */
  ai: {
    open: [0.86, 0.97] as [number, number],
    most: [1.02, 1.14] as [number, number],
    raise: 0.6,
    /** The chance a club improves its offer a step while he likes none. */
    nudge: 0.35,
    step: [0.03, 0.07] as [number, number],
    compensation: { A: 0.88, B: 0.94, C: 1 },
    clubOption: 0.5,
    /** Room an AI club keeps under the cap when it bids (V0.16: it used to go 5억 over, and with money held
        in today's terms raises then pushed three or four clubs a year over the cap). */
    capSlack: -50000,
    /** His own club talks to a free agent worth keeping (keep value) almost always. */
    keepOwn: { value: 45, chance: 0.95 },
  },
  /** A broken promise costs this much of every later free agent's trust in the club, for this many winters. */
  promise: { trust: 0.04, winters: 4, starterGames: 90, starterStarts: 18, reliefGames: 40, reinforceValue: 55 },
  /** Incentives earned in full (and in half) by games, innings or relief appearances. */
  incentive: { games: [100, 70], innings: [130, 90], relief: [50, 35] } as Record<'games' | 'innings' | 'relief', [number, number]>,
} as const;

/** The salary cut for players sent down (KBO 규약, RULES.md §2): from 3억, half of 1/300 a day. */
export const DEMOTION = { from: 30000, share: 0.5 } as const;

/** Winter salary talks for the user's club (V0.5; game assumptions). */
export const TALKS = {
  /** A player asks for his merit figure plus base + perWar × WAR (up to max). */
  ask: { base: 0.05, perWar: 0.03, max: 0.3 },
  /** Chance he signs for less than he asked (merit), and for last year's salary. */
  acceptMerit: 0.75,
  acceptFreeze: 0.3,
  /** Chance a player still unhappy files for arbitration; the committee takes his figure when it is within this of the club's. */
  arbitrationChance: 0.12,
  arbitrationWithin: 0.08,
  /** Multi-year deals before free agency: offered up to this many seasons before it, at this share of his market value. */
  extension: { seasonsBefore: 2, share: 0.9, years: 4, accept: 0.7, maxAge: 33, minValue: 50 },
} as const;

/** Trades, waivers and mid-season foreign changes (V0.5; game assumptions). */
export const TRADES = {
  /** Trade value: (keep value − replacement)^power × control share × age factor − salary (억) × perEok. */
  value: { replacement: 44, power: 1.35, controlBase: 0.4, controlPerYear: 0.15, oldFrom: 33, oldFactor: 0.7, perEok: 0.6 },
  /** An AI club says yes when what it gets beats what it gives × premium + fixed. */
  accept: { premium: 1.1, fixed: 1 },
  /** AI-to-AI trades: tries per season and the chance each goes ahead; a gap up to `evenOut` of the value
      can be made up with cash or a pick (V0.7.8). */
  ai: { perSeason: 6, chance: 0.5, evenOut: 0.45 },
  /** Cash in a trade (V0.7.8): value per 억 (1 = a club takes 1억 as one point of value), the most in one
      trade (만 원, a game limit; real deals: 손아섭 3억 + a pick, 2025; 박동원 10억 + a pick, 2022). */
  cash: { perEok: 1, max: 200_000, step: 10_000 },
  /** Draft picks in a trade (V0.7.8): value by round for a mid-order pick, how much the club's place in the
      order moves it (the worst club's pick × (1 + spread), the best's × (1 − spread)), and the KBO limit of
      two picks of one draft given away per club, only in trades with players (2019 rule). */
  picks: { value: [12, 6, 4, 2.6, 1.8, 1.3, 1, 0.8, 0.6, 0.5, 0.4], spread: 0.3, perClub: 2 },
  /** A club claims a waived player who is this much better than its weakest registered player. */
  waiverMargin: 3,
  /** AI clubs replace a foreign player with an ERA or OPS this bad by July (or out six weeks), with this chance. */
  foreign: { badEra: 6.2, badOps: 0.66, chance: 0.6 },
  logSize: 300,
} as const;

/** The second draft (V0.5): an AI club picks only players at least this good (keep value), else passes. */
export const SECOND = { minValue: 49 } as const;

/**
 * Posting (game assumptions): who asks to go, and how the majors value him from his public grade and
 * age. Average salary at grade 60 is $2.5M and grows 22% per grade point (grade 65 ≈ $7.5M, 70 ≈ $22M),
 * close to recent Korean signings.
 */
export const POSTING = { minGrade: 62, maxAge: 30, wants: 0.5, baseChance: 0.45, chancePerGrade: 0.07, agePenalty: 0.1, aavAt60: 2_500_000, aavGrowth: 0.22, aiAllows: 0.55 } as const;

/** Fans and attendance (V0.6, fans.ts). Calibrated to 2025: 17,103 a game (CALIBRATION.md §8). */
export const FANS = {
  /** Average ticket price in 2025 (만 원): 2,046억 / 1,231만 명. */
  price2025: 1.66,
  priceGrowth: 0.03,
  /** The last year prices rise (V0.16): money stays in 2026 terms after it. */
  priceUntil: 2026,
  averagePopularity: 19_000,
  visitorWeight: 0.15,
  elasticity: 0.9,
  inSeasonWin: 0.9,
  seasonWin: 1.0,
  /** How strongly the mood moves a crowd. */
  moodWeight: 0.7,
  playoff: 0.08,
  champion: 0.15,
  starWar: 4,
  perStar: 0.03,
  perHomeGrown: 0.015,
  perYoungStar: 0.02,
  memory: 0.5,
  growth: 0.04,
  interestMin: -0.45,
  interestMax: 0.8,
  popularityMin: 5_000,
  priceMin: 0.7,
  priceMax: 1.6,
  marketing: { base: 200_000, effect: 0.08, min: 0, max: 800_000 },
  newClub: { base: 6_000, perMarket: 100, novelty: 0.3 },
  /** Postseason tickets cost about three times a regular-season seat. */
  postseasonPrice: 3,
} as const;

/** Club accounts (V0.6, finance.ts), 만 원 a year unless noted. */
export const FINANCE = {
  sponsor: { base: 350_000, perThousandFans: 30_000 },
  naming: { base: 800_000 },
  /** Merchandise margin per fan (V0.12: 0.3 → 0.45 for the 2024–25 goods boom, docs/FINANCE.md ④), and
      concessions per fan (the ballpark operator keeps more). */
  merchPerFan: 0.45,
  concessions: { operator: 0.25, tenant: 0.08 },
  /** The front office (V0.12: by the size of the fan base, docs/FINANCE.md ②; 180억 for every club before). */
  frontOffice: { base: 1_500_000, perThousandFans: 16_000 },
  /** V0.12 (docs/FINANCE.md ①, ⑧): a winter's emergency support costs the owner's trust, `base` and a point per
      `per` of it, at most `most`. */
  emergency: { base: 4, per: 100_000, most: 15 },
  /** Season tickets (V0.12, ③): the share of the fan base (times the mood) that buys at each discount, at most
      `maxShare` of the seats; holders come to `show` of the games. */
  seasonTickets: { share: { 0: 0.08, 0.1: 0.15, 0.2: 0.22, 0.3: 0.28 } as Record<number, number>, maxShare: 0.4, show: 0.9 },
  perHomeGame: 6_000,
  ballpark: { operator: 250_000, tenant: 150_000, dome: 400_000, perSeat: 5 },
  farm: 350_000,
  /** A club in its futures year: sponsors and front office at this share. */
  futuresYear: 0.5,
  keepReports: 30,
} as const;

/** Staff (V0.6, staff.ts). */
export const STAFF = {
  salary: { manager: 50_000, head: 15_000 },
  /** Assistants' payroll per department. */
  departments: 30_000,
  candidates: 3,
  aiRenew: 0.7,
  aiFireManager: 0.4,
  growth: 0.08,
  farmGrowth: 0.1,
  injury: 0.15,
  injuryDays: 0.1,
  fielding: 0.12,
  managerInsight: 0.3,
  scoutBase: 0.35,
  scoutSpan: 0.25,
  scoutMax: 0.6,
} as const;

/** Owners (V0.6, parent.ts). Support in 만 원 a year before difficulty. */
export const PARENT = {
  /** Support limits. V0.16 raised the mid-size, naming-rights and citizen ones (120·40·100억): a new club spending its
      budget ran 30~50억 a year past them whatever it did, so the money goal could never be met. */
  support: { conglomerate: 1_600_000, midsize: 1_500_000, namingRights: 600_000, citizen: 1_400_000 },
  rankGoal: { conglomerate: 5, midsize: 7, namingRights: 8, citizen: 8 },
  crowdGoal: 1.0,
  weights: {
    conglomerate: { rank: 0.5, fans: 0.2, money: 0.3 },
    midsize: { rank: 0.35, fans: 0.25, money: 0.4 },
    namingRights: { rank: 0.3, fans: 0.3, money: 0.4 },
    citizen: { rank: 0.3, fans: 0.45, money: 0.25 },
  },
  maxChange: 0.1,
  startTrust: 60,
  trustStep: { conglomerate: 25, midsize: 15, namingRights: 12, citizen: 15 },
  fireBelow: 15,
  scaleMin: 0.6,
  scaleMax: 1.6,
  /** The payroll budget never goes under the league's floor × this (V0.16). */
  payrollFloor: 1.2,
  groupSwing: { chance: 0.15, size: 0.1 },
  midsizeReward: 0.05,
  /** Citizen clubs (V0.7.7): the mayor's stance (support factor every year, a budget shift when elected,
      how surely deficits bring trouble), election odds, and what the council does about deficits. */
  citizen: {
    stance: {
      friendly: { support: 1.15, election: 0.05, eventChance: 0.3 },
      neutral: { support: 1, election: 0, eventChance: 0.55 },
      hostile: { support: 0.85, election: -0.05, eventChance: 0.85 },
    },
    foundingOdds: { friendly: 0.6, neutral: 0.3, hostile: 0.1 },
    odds: { friendly: 0.3, neutral: 0.45, hostile: 0.25 },
    deficitHostile: 0.2,
    reelect: 0.45,
    /** A lasting deficit: over this share of the approved support, this many winters in a row. */
    lastingShare: 0.5,
    lastingYears: 3,
    events: [
      { title: '시의회 예산 삭감', text: '시의회가 내년 구단 예산을 깎았습니다.', budget: 0.08 },
      { title: '행정사무감사', text: '시의회 감사에서 구단 운영이 도마에 올랐습니다. 모기업(시) 신뢰도가 떨어집니다.', trust: 12 },
      { title: '운영비 지원 동결', text: '시가 내년 운영비 지원을 줄이기로 했습니다.', support: 0.12 },
      { title: '대표이사 교체 압박', text: '시와 시의회가 구단 경영진 교체를 요구합니다. 단장 신뢰도도 흔들립니다.', trust: 8, budget: 0.04 },
      { title: '혈세 논란', text: '"세금 먹는 하마" 여론이 일어 팬심도 식었습니다.', fans: 0.04, trust: 5 },
    ] as { title: string; text: string; budget?: number; support?: number; trust?: number; fans?: number }[],
  },
  naming: {
    base: 900_000,
    /** Sponsor kinds (V0.7.7): fee range against the club's worth, goal, and the chance of walking out after a miss. */
    profiles: [
      { goal: 'none', pay: [0.82, 0.92], risk: 0, stretch: 0 },
      { goal: 'fans', pay: [0.95, 1.08], risk: 0.3, stretch: 0.05 },
      { goal: 'rank', pay: [1.0, 1.15], risk: 0.35, stretch: 0 },
      { goal: 'postseason', pay: [1.12, 1.3], risk: 0.5, stretch: 0 },
    ] as { goal: 'none' | 'fans' | 'rank' | 'postseason'; pay: [number, number]; risk: number; stretch: number }[],
    missedTwice: 1.6,
  },
  /** A conglomerate or mid-size owner pays for a free agent this winter (market.ts parentGift). */
  faGift: { conglomerate: 0.12, midsize: 0.05, namingRights: 0, citizen: 0, premium: 1.2, maxAge: 33 },
} as const;

/** Ballpark projects (V0.6, ballpark.ts), 만 원. */
export const BALLPARK = {
  expandSeats: 3_000,
  expandCost: 1_500_000,
  maxSeats: 25_000,
  fencesCost: 150_000,
  fencesStep: 0.04,
  parkMin: 0.9,
  parkMax: 1.12,
  newSeats: 22_000,
  newCost: 4_000_000,
  newYears: 3,
  newParkBuzz: 0.25,
  expandBuzz: 0.05,
} as const;

/** Injuries (V0.7.7, injuries.ts). Chances per game appearance for a player of average hidden risk
    (`riskScale`); a KBO first team loses about 15 players a season for a week or more and many more for a
    day or two (RULES.md §7, S51). */
export const INJURY = {
  perGame: { hitter: 0.0055, starter: 0.022, reliever: 0.009 },
  knock: { hitter: 0.012, pitcher: 0.004, days: [1, 5] as [number, number] },
  riskScale: 0.1,
  ageFrom: 30,
  perYearOver: 0.06,
  /** Futures games, relative to the first team (V0.11: 0.7 → 0.55, fewer operations on the farm). */
  futures: 0.55,
  riskAfterSurgery: 0.015,
  maxRisk: 0.2,
  /** The same major operation again (V0.11, injuries.ts injuryWeight): its weight within `within` years of the
      last one (`soon`) and after (`later`), times `again` for each earlier one beyond the first. */
  repeat: { within: 2, soon: 0.08, later: 0.45, again: 0.3 },
  /** The user's player out this long makes the news. */
  newsFrom: 21,
};

/** Foreign players' hidden ability when they sign (players.ts makeForeign, before the background's shift).
    V0.7.7: raised so they play like the KBO's real imports (CALIBRATION.md §10). */
/** The twelfth club (V0.9, rival.ts; game assumptions). `fill`: registered players it signs up to from the
    players other clubs let go, in its founding winter and before its first first-team season. `event`: offered
    by the board from the user's club's third first-team winter, at this chance a winter, and again three winters
    after a no. `rivalry`: the gate of a rivalry game, and the fans' mood per game won or lost over .500 in the
    season series (to a limit), and when a well-liked player crosses over. */
export const RIVAL = {
  tryout: 20,
  fill: { founding: 50, entering: 58, minValue: 38, maxAge: 35 },
  event: { after: 2, chance: 0.3, again: 3 },
  minSeats: 12_000,
  rivalry: { gate: 1.15, perGame: 0.006, most: 0.05, crossing: 0.03 },
} as const;

/** Programmes at private training centres abroad (V0.10, training.ts; game assumptions from KIA's 2023–24 Driveline
    trip, 34 days, "3–5 km/h for some", and its 2026 NEXTBASE trips, 19 days, one in June). `gain`: grade points
    on the main tool for a 23-year-old with room to grow (the second tool gets `secondary` of it), × 0.25–1.35 by
    luck; older players gain less (`age`: up to that age, the factor). A gain may pass his potential by
    `overPotential` (a fixed motion lifts the ceiling). `analytics`: the analytics staff's edge. At most
    `winterMax` players a winter and `seasonMax` abroad at once in the season, which starts no later than
    `lastStart`. `conditioned`: the injury chance that season after a conditioning programme. */
export const TRAINING = {
  gain: 3.2,
  secondary: 0.6,
  overPotential: 1,
  age: [
    [23, 1.2],
    [26, 1],
    [29, 0.7],
    [32, 0.45],
    [99, 0.25],
  ] as [number, number][],
  analytics: 0.2,
  winterMax: 8,
  seasonMax: 3,
  lastStart: '08-15',
  winterStart: '12-01',
  conditioned: 0.85,
} as const;

/** Life off the field (V0.10, life.ts; game assumptions). In the season about one event a game day comes up at
    `daily`, for one of the club's players; `form` is the grade points a hot or cold spell, a newborn or a loss
    moves his main tools. Family leave (경조사 휴가) is at most five days, counted as registered days (KBO 규정,
    2019~). Winter: marriage, charity and work on his own at these chances. `fans`: the fans' fondness, 0–100. */
export const LIFE = {
  daily: 0.14,
  /** How often each kind comes up when something happens (0.10.1: births and deaths in the family made rarer,
      about 1–1.5 a season for the club, a loss about one season in three; 1.2.0 added the last seven). */
  weights: {
    birth: 1,
    loss: 0.3,
    hot: 4,
    cold: 4,
    fanService: 3,
    charity: 2,
    row: 1.5,
    accident: 0.5,
    extraWork: 1.5,
    mentor: 1.2,
    commercial: 0.8,
    variety: 0.8,
    hometownCheer: 0.8,
    feud: 0.8,
    grumble: 0.6,
  },
  form: { hot: 2.5, cold: -2.5, baby: 2, loss: -2, row: -1 },
  leave: { birth: [2, 3], loss: [3, 5] } as Record<'birth' | 'loss', [number, number]>,
  winter: { marry: 0.12, charity: 0.08, selfWork: 0.1 },
  fans: { base: 20, perSeason: 3, seasons: 25, perWar: 4, war: [-10, 30] as [number, number], homeGrown: 10, hometown: 8, perHonor: 2, honors: 10 },
  /** Fondness from which fans feel a departure, and how much the club's mood drops for a 100. */
  farewell: { from: 60, most: 0.04 },
  /** Merchandise: up to this share more when the three best-loved players average 100. */
  merch: 0.25,
} as const;

/** An investor's claim on a club without a parent (V0.12, dispute.ts; an easter egg): its chance a winter, the
    settlement, the lawyers' fee, what losing costs (buying the 40 percent back), the chance the club wins, the trust
    it moves and the fans' mood a loss costs. Money in 만 원. */
export const DISPUTE = { chance: 0.006, settle: 250_000, legal: 30_000, loss: 800_000, win: 0.3, trust: { settle: 5, win: 5, loss: 15 }, fans: 0.03 };

/** The dark side (V0.12, scandals.ts). Chances a season for our club (spread over `gameDays`), the KBO's penalties
    (RULES.md §9, S73–S75; the fight's games are a game assumption), the fans' fondness for the player and the club's
    mood it costs, and what the club's answer does to the mood. Doping: a clean player's rumours a season, the days
    to the first sign and between signs, the signs a rumour shows at most and how long it lasts, the days before the
    KBO's testers can find him and their chance a game day, the ability it lends, and the club's own test. */
export const SCANDAL = {
  gameDays: 170,
  rates: { dui: 0.1, assault: 0.04, fixing: 0.003, doping: 0.05 } as Record<'dui' | 'assault' | 'fixing' | 'doping', number>,
  dui: { games: 70, revoked: 0.35, hidden: 0.2, hidingGames: 10, foundAfter: [10, 40] as [number, number] },
  assault: { games: 30, bad: 0.25, badGames: 50 },
  doping: {
    rumours: 0.08,
    firstSign: [5, 12] as [number, number],
    between: [7, 15] as [number, number],
    rumourSigns: 2,
    rumourDays: 45,
    graceDays: 21,
    test: 0.012,
    boost: 3,
    inspectCost: 500,
    caughtGrudge: 6,
    cleanGrudge: 3,
  },
  fans: { dui: 25, doping: 25, assault: 20, fixing: 30 } as Record<'dui' | 'assault' | 'fixing' | 'doping', number>,
  clubMood: { dui: 0.03, doping: 0.03, assault: 0.02, fixing: 0.08 } as Record<'dui' | 'assault' | 'fixing' | 'doping', number>,
  answer: { release: 0.02, extra: 0.01, none: -0.02 } as Record<'release' | 'extra' | 'none', number>,
  extraGames: 20,
};

/** The national team (V0.12, national.ts; game assumptions). Fans' fondness for a player called up (more for a
    title), a club's lift from a title, the March tournament's injuries (chance per player, days after the last game),
    and a club's request to keep a player home: the chance a healthy player is let off, the fans' mood it costs, and
    his own grudge (more when a medal would have spared him the army). */
export const NATIONAL = {
  fans: { called: 2, champion: 4 },
  titleBuzz: 0.02,
  springInjury: {
    chance: 0.03,
    days: [14, 35] as [number, number],
    pitcher: ['팔꿈치 염증', '어깨 뭉침', '옆구리 근육 손상'],
    hitter: ['햄스트링 손상', '옆구리 근육 손상', '손가락 인대 손상'],
  },
  excuse: { healthy: 0.4, fans: 0.01, grudge: 4, exemptionGrudge: 12 },
};

/** A future that moves (V0.12, scouting.ts; game assumptions). Players up to `maxAge`. Winter: chance of a breakout
    or a stall of one or two abilities' ceilings (`jump` grade points), times `signalBoost` after a season that
    points that way (first-team WAR, or futures OPS / ERA with enough play), and a drift of every ceiling (sd).
    Month: the step on the winter's future grade from his numbers against his level (z in standard deviations;
    OPS sd .09, ERA sd 1.3), with enough play; two steps for the youngest who tear up the first team. */
export const SCOUTING = {
  maxAge: 27,
  winter: {
    breakout: 0.04,
    stall: 0.04,
    signalBoost: 2.5,
    jump: [4, 8] as [number, number],
    drift: 1.2,
    majorPA: 150,
    majorOuts: 120,
    goodWar: 2,
    badWar: -0.5,
    minorPA: 150,
    goodOps: 0.85,
    badOps: 0.6,
    minorOuts: 120,
    goodEra: 3.0,
    badEra: 6.0,
  },
  month: { majorPA: 80, majorOuts: 60, minorPA: 100, minorOuts: 75, opsSd: 0.09, eraSd: 1.3, majorUp: 1.2, majorDown: 1.3, minorUp: 1.6, minorDown: 1.8, twoSteps: 2.2, twoStepsAge: 24 },
};

/** Fielding away from the main position (V0.11, positions.ts): extra grade points lost at a position he does not
    list, games that make one his anyway (`experienced`, career) or add it to his list (`learn`, one season, up to
    `most`), and games that show it on his profile. */
export const POSITION_FIT = {
  unlisted: 6,
  experienced: 30,
  learn: 40,
  most: 3,
  shown: 10,
  /** V0.12: what a position asks of his public grades before he moves down the spectrum (positions.ts positionMove). */
  move: { ss: { defense: 45, speed: 40 }, cf: { defense: 45, speed: 45 }, corner: 40, left: 35 },
  /** V0.12: an AI club's spread of its non-catcher hitters (positions.ts balanceDepth), and moves a winter at most. */
  depth: { shares: { '1B': 0.13, '2B': 0.14, '3B': 0.14, SS: 0.14, LF: 0.14, CF: 0.15, RF: 0.16 }, moves: 10 },
};

export const FOREIGN = {
  hitter: { contact: 62, power: 70, eye: 58 },
  pitcher: { stuff: 65, command: 60, breaking: 60, stamina: 64 },
  asiaShift: -4,
  /** V0.11: a regular (not Asia-quota) signing is now and then a star, `shift` grade points better (the 70s). */
  star: { chance: 0.07, shift: 7 },
  /** V0.11: where foreign hitters play (share), with the fielding and speed that go with it and a shift to the bat
      (a centre fielder or shortstop hits for less power). Shares follow recent KBO imports (RULES.md S72). */
  hitterPositions: [
    { pos: '1B', share: 0.24, defense: 42, speed: 38, power: 3, contact: 0 },
    { pos: 'LF', share: 0.13, defense: 46, speed: 45, power: 1, contact: 0 },
    { pos: 'RF', share: 0.2, defense: 49, speed: 46, power: 1, contact: 0 },
    { pos: 'CF', share: 0.18, defense: 56, speed: 57, power: -5, contact: 1 },
    { pos: '3B', share: 0.13, defense: 51, speed: 42, power: 0, contact: 0 },
    { pos: '2B', share: 0.06, defense: 55, speed: 50, power: -6, contact: 2 },
    { pos: 'SS', share: 0.06, defense: 58, speed: 52, power: -7, contact: 1 },
  ] as { pos: import('../model/position').Position; share: number; defense: number; speed: number; power: number; contact: number }[],
  /** 1.1.0: foreign players come in types (the 1.0 feedback), each a few grade points up on what its name says and
      down elsewhere (`shift`), so a club shops for what it lacks. Pitchers by role; hitters by the position drawn, so
      the V0.11 position mix stays. Weights within each list. A utility man also handles two or more positions. */
  types: {
    SP: { 구위형: 3, 제구형: 3, 변화구형: 2.5, 이닝이터: 2.5 },
    RP: { 구위형: 5, 제구형: 2, 변화구형: 3 },
    hitter: {
      '1B': { 거포형: 6, 교타형: 2, 선구안형: 2 },
      LF: { 거포형: 4, 교타형: 2, 선구안형: 2, 호타준족: 2 },
      RF: { 거포형: 4, 교타형: 2, 선구안형: 1, 호타준족: 3 },
      CF: { 호타준족: 4, 수비형: 3, 교타형: 2, 유틸리티: 1 },
      '3B': { 거포형: 4, 교타형: 2, 수비형: 2, 유틸리티: 2 },
      '2B': { 수비형: 3, 유틸리티: 4, 교타형: 3 },
      SS: { 수비형: 5, 유틸리티: 3, 교타형: 2 },
    } as Record<string, Record<string, number>>,
    shift: {
      구위형: { stuff: 6, command: -4, breaking: -1 },
      제구형: { command: 6, stuff: -3, breaking: -1 },
      변화구형: { breaking: 6, stuff: -2, command: -2 },
      이닝이터: { stamina: 8, stuff: -2, breaking: -1, command: 1 },
      거포형: { power: 6, contact: -3, eye: -1, speed: -2 },
      교타형: { contact: 6, power: -5, eye: 1 },
      선구안형: { eye: 7, contact: 1, power: -3 },
      호타준족: { speed: 7, power: 1, contact: -1, eye: -2 },
      수비형: { defense: 7, speed: 2, power: -5, contact: -1 },
      유틸리티: { defense: 3, speed: 2, power: -3, contact: 1 },
    } as Record<string, Partial<Record<import('../draftroom').ToolKey, number>>>,
  },
};

/** Basic difficulty beyond money (V0.14, docs/PLAN-1.0.md §4 C). Only the user's club feels it, so the
    league alone and the golden master do not move; normal changes nothing. Game assumptions. */
export const DIFFICULTY = {
  /** The owner's money (founding fund, payroll budget, support limit and the budget's floor), × this. V0.16 widened
      it from ±10%: in the paired runs ±10% was lost in the luck of the league. */
  money: { easy: 1.25, normal: 1, hard: 0.85 },
  /** Added to how much a free agent likes our offer (his fit, 1 = as offered). */
  faFit: { easy: 0.05, normal: 0, hard: -0.05 },
  /** Added to the chance a player takes our salary figure, a freeze or an extension. */
  salaryAccept: { easy: 0.1, normal: 0, hard: -0.1 },
  /** Our scouts' read of the future: added to their accuracy (0 = the public grade, 1 = the truth). */
  scoutEdge: { easy: 0.2, normal: 0, hard: -0.2 },
  /** The premium an AI club wants on top before it says yes to our trade. */
  tradePremium: { easy: 0.94, normal: 1, hard: 1.08 },
  /** The owner's trust: what it loses after a bad season or an event, × this. */
  trustLoss: { easy: 0.75, normal: 1, hard: 1.25 },
} as const;

/** Growth types and hidden traits (1.1.0, league/traits.ts; game assumptions). Each growth type sets when a player's
    growth starts in earnest (`start`; before it he closes `before` of his usual share), how long it runs at full
    speed (`fullUntil`), the age by which it has stopped (`zeroAt`, down to Draft Room's floor), when aging sets in
    (`aging`; speed three years sooner) and when the late-career decline starts (`decline`, steeper three years on).
    Ages on 1 April. `rate` is the share of the gap to his ceiling closed in a full year, at most `cap` grade points
    (Draft Room's 8 held a fast developer back). 보통 is the 1.0 growth. Tuned so that a draft class's first-team
    value over a career (overall above 45, ages 21–37) comes within 4% of what the same players would have as 보통,
    and a high-school draftee peaks near the same grade whatever his type: the types move when, not how much. */
export const GROWTH = {
  types: {
    veryEarly: { rate: 0.58, start: 0, fullUntil: 20, zeroAt: 25, aging: 27, decline: 29, cap: 12.5 },
    early: { rate: 0.43, start: 0, fullUntil: 21, zeroAt: 27, aging: 28, decline: 30, cap: 10 },
    normal: { rate: 0.32, start: 0, fullUntil: 22, zeroAt: 28, aging: 29, decline: 31, cap: 8 },
    late: { rate: 0.34, start: 22, fullUntil: 24, zeroAt: 29, aging: 30, decline: 32, cap: 8.5 },
    veryLate: { rate: 0.34, start: 24, fullUntil: 26, zeroAt: 30, aging: 31, decline: 33, cap: 9 },
  },
  before: 0.4,
  /** Share of Draft Room's early and late developers who are the extreme kind. */
  extreme: 0.35,
  /** Growth × (1 + (trait − 50) / 100 × this): 천재성 and 성실성. */
  genius: 0.6,
  work: 0.3,
  /** The late-career decline × (1 − (성실성 − 50) / 100 × this). */
  workDecline: 0.6,
  /** A breakout winter is likelier for a genius: × (1 + max(0, 천재성 − 60) / 40). */
  geniusBreakout: 1,
  /** Grade points on his main tools in the postseason per point of 멘탈 over 50. */
  mental: 0.05,
  /** Who gets into trouble: × 2^((논란성 − pivot) / doubling); a club's chance × its players' average of that over
      the league's (`mean`), so the league sees as much trouble as before. */
  controversy: { pivot: 30, doubling: 15, mean: 1.35 },
} as const;

/** Pitch mix (1.1.0, league/pitches.ts; game assumptions). `count`: shares of pitchers with one, two, three and four
    secondary pitches (a third of relievers are two-pitch pitchers). `share`: the part of his pitches that are not
    fastballs — by role, by how many pitches he has and by his type, ± `spread` of his own. `decay` splits it between
    his pitches, best first, each ± `jitter`. `signature`: the pitch his type makes likelier as his best (weight on
    top of the usual mix). */
export const PITCH_MIX = {
  count: { SP: [0.05, 0.3, 0.43, 0.22], RP: [0.33, 0.45, 0.22] },
  share: {
    SP: 0.4,
    RP: 0.36,
    byCount: [-0.06, 0, 0.02, 0.05],
    byType: {
      '강속구 선발': -0.07,
      '파워 불펜': -0.06,
      '커맨드형 선발': 0.02,
      '장신 커브볼러': 0.05,
      '포크볼 불펜': 0.08,
      '체인지업 좌완': 0.05,
      구위형: -0.08,
      변화구형: 0.12,
      제구형: 0.03,
    } as Record<string, number>,
    spread: 0.1,
    min: 0.18,
    max: 0.66,
  },
  decay: 0.5,
  jitter: 0.3,
  signature: {
    '장신 커브볼러': { pitch: 'CB', weight: 60 },
    '포크볼 불펜': { pitch: 'FO', weight: 110 },
    '체인지업 좌완': { pitch: 'CH', weight: 60 },
    '땅볼 유도형 선발': { pitch: 'SI', weight: 40 },
    '좌완 스페셜리스트': { pitch: 'SL', weight: 30 },
    '파워 불펜': { pitch: 'SL', weight: 20 },
    변화구형: { pitch: 'SL', weight: 10 },
  } as Record<string, { pitch: import('./pitches').PitchType; weight: number }>,
};

/** The All-Star game (1.2.0, league/allstar.ts). KBO practice: fans 70% and players 30% of the vote, 베스트12 a side,
    the managers' picks to fill the squads; the dates and ballot sizes are game assumptions (the voting runs about four
    weeks from early June, the game in the break). Fan ballots a day for a candidate: `fanBase` × his club's fans
    against the league's (^ `clubPower`) × (base + WAR so far·war + fondness·loved + grade over 45·star); the players'
    the same way, on how he plays. `campaign`: what our club's voting drive costs (만 원) and adds to our candidates'
    fan ballots. The 홈런 레이스: the field, outs a round and a swing's home run chance by 장타 (hidden). */
export const ALL_STAR = {
  dates: { open: '06-08', tallies: ['06-15', '06-22', '06-29'], close: '07-05', game: '07-12' },
  fanShare: 0.7,
  fanBase: 22000,
  clubPower: 1.1,
  fan: { base: 0.35, war: 0.35, loved: 0.6, star: 0.35 },
  playerBase: 3,
  player: { base: 0.2, war: 0.8, star: 0.5 },
  squad: 24,
  pitchLimit: { starter: 35, reliever: 22 },
  derby: { field: 8, outs: 7, base: 0.12, perPower: 0.008, min: 0.04, max: 0.42 },
  campaign: { cost: 10_000, boost: 0.25 },
};
