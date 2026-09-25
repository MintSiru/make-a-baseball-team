/* League balance numbers (this game's own; Draft Room's stay in src/draftroom/tuning.js).
   Targets are the 2025 KBO league averages in docs/CALIBRATION.md; scripts/calibrate.ts measures them.
   The intercepts sit below the real rates because first-team players average about 55, not 50. Changing a number changes
   simulated results: bump SIM_VERSION (src/core/version.ts) and re-record the golden test.

   Ability scale: 20–80 with 50 = average; `z = (grade - 50) / 10`. Rate models are logit-linear:
   logit(p) = logit(base) + Σ coefficient × z. */

export const ENGINE = {
  /** Per plate appearance, for an average (50) batter against an average pitcher. */
  base: {
    bb: 0.07,
    hbp: 0.016,
    k: 0.17,
    hr: 0.0133,
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
    k: { stuff: 0.32, breaking: 0.24, command: 0.04 },
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
    sangmu: { maxAge: 27, minGrade: 40, perGrade: 0.035, playedBonus: 0.12, min: 0.03, max: 0.6 },
    socialBase: 0.1,
  },
  freeAgency: { minGrade: 50, stayChance: 0.62 },
  developmentSignings: 4,
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
