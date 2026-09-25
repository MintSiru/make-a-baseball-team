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
    bb: 0.074,
    hbp: 0.016,
    k: 0.181,
    hr: 0.0162,
    /** Hits on balls in play (excludes home runs). */
    babip: 0.316,
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
  platoon: { k: 0.08, bb: -0.04, hr: -0.1, babip: -0.03 },
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
  reliever: { maxOutsShort: 4, maxOutsLong: 9, pitchLimitShort: 28, pitchLimitLong: 55 },
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
  veteranDecline: { from: 31, perYear: 0.3, steepFrom: 34, steepPerYear: 0.45, speed: 1.4, skill: 0.6 },
  scouting: { matureAge: 28, window: 7 },
  serviceDecline: { army: [0.8, 1.6] as [number, number], social: [0.3, 0.8] as [number, number] },
  retirement: { from: 33, byAge: [0.05, 0.08, 0.14, 0.22, 0.34, 0.48, 0.64, 0.8] },
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
    socialBase: 0.1,
  },
  freeAgency: { minGrade: 50, stayChance: 0.62 },
  /** Development players (육성선수): draft-day signings per club, the AI's target and hard cap, and age limits. */
  development: { signings: 5, aiTarget: 20, cap: 30, perYear: 10, maxAge: 27, convertAge: 25 },
  /** Clubs leave a few roster spots open after the draft. */
  openSpots: 3,
  /** Draftees from these first rounds are kept through their first winter; later picks can be cut like anyone. */
  protectedRounds: 5,
  release: { maxAge: 33, minValue: 45, signChance: 0.5 },
  foreign: { keepWarPitcher: 2.5, keepWarHitter: 2.0, keepChance: 0.85 },
} as const;

/** Salaries (만 원) until the market arrives in V0.5; see docs/CALIBRATION.md §2. */
export const SALARY = {
  raisePerWar: 3300,
  perServiceYear: 450,
  freeAgentPerWar: 13000,
  freeAgentMax: 250000,
  veteranStar: 32000,
} as const;

/** Futures league and development by playing time (V0.4; game assumptions, docs/CALIBRATION.md). */
export const FUTURES = {
  /** Squad kept for futures games; the rest of the club is in the third squad. */
  squad: { pitchers: 16, catchers: 3, hitters: 17 },
  /** Prospects get playing time: the gap between future and current value counts this much, up to this age. */
  youthAge: 24,
  youthWeight: 0.4,
  /** A short-handed futures side bats pitchers rather than forfeit (상무 after the June discharge). */
  pitchersBat: true,
  /** Injury chance per futures appearance, relative to the first team. */
  injuryFactor: 0.5,
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
