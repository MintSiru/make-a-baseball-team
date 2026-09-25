/* Balance knobs for seasons, careers and evaluations, in one place.
   These are fictional tuning values, not an empirical KBO model.

   Changing any number here changes simulated results, which changes what old saves replay into.
   After a change: bump SIM_VERSION in engine.js, then re-record tests/golden.cjs with --write.

   Conventions: a `[base, span]` pair means base + floor(r() * span); `byYear` arrays are indexed by
   pro year (0 = rookie season) and the last entry applies to every later year. */
// Ported from KBO-Draft-Room df4faad src/core/tuning.js. See docs/UPSTREAM.md.

const freeze = (o) => (Object.values(o).forEach((v) => v && typeof v === 'object' && freeze(v)), Object.freeze(o));

const TUNING = {
  generation: {
    // Pitchers get an arm-strength roll (mean 0, sd 1). It lifts stuff (potential and current) and velocity;
    // command and breaking balls do not depend on it, so a hard thrower with poor command still grades low.
    // Top velocity = base + (true stuff - pivot) × perStuff + arm × perArm (+ adultBonus if not a high-schooler).
    // Share of players whose childhood favourite is a club from the region they grew up in.
    localFavorite: 0.45,
    velocity: { base: 146, pivot: 40, perStuff: 0.35, perArm: 3.2, armToStuff: 4, adultBonus: 1, noise: 1.5, min: 132, max: 161 },
  },

  // Development ("육성") contracts after the draft. They cannot hold a regular role in their first season.
  devContracts: { max: 5, cpuMin: 3, cpuMax: 5 },

  // The other side of every player (a pitcher's bat, a hitter's arm), generated on its own stream.
  // Mostly weak; a few prospects per pool are genuine two-way talents.
  altTalent: {
    base: [22, 18], // [min, span] of the other side's potential centre
    athleticism: 0.4, // share of (main potential − 45) that carries over
    gap: { young: [8, 6], older: [5, 4] }, // how far current is below potential, [base, span]
    twoWay: { chances: [0.35, 0.1], maxRank: 40, below: [0, 4] }, // per pool: first and second two-way prospect; side sits `below` the main one
    publicMinFV: 45, // scouts mention the other side from this future value
  },

  // Position changes, two-way players and development focus (user plans and CPU habits).
  positions: {
    // Defence change when a hitter moves: from → to → grade points (current and potential).
    defenseShift: { C: { IF: -3, OF: 2 }, IF: { OF: 3 }, OF: { IF: -5 } },
    toReliever: { stuff: 2 }, // short outings add a little velocity
    toStarter: { stuff: -1 },
    sideSwitchMaxAge: 26, // pitcher ↔ hitter only until this age (end of the coming season)
    adaptImpact: 2, // role-decision penalty in the first season at a new position
    adaptGrowth: 0.8, // growth rate in that season
    // CPU clubs: yearly chance to move a player when the rule applies (from the second season).
    cpu: { starterToRelief: { maxStamina: 40, chance: 0.25 }, catcherToInfield: { maxDefense: 38, chance: 0.2 }, switchSide: { margin: 5, maxAge: 24, chance: 0.5 } },
  },
  twoWay: {
    growthScale: 0.75, // each side grows more slowly while he does both
    secondaryGames: 0.55, // first-team games on the second side, relative to a normal role
    dropGap: 10, // CPU clubs end two-way play when one side trails the other by this much (public grades)...
    dropFromYear: 2, // ...from this season on
  },
  // Development focus: the chosen tool closes its gap faster, the others a little slower.
  focus: { chosen: 1.6, others: 0.85 },

  // Signing bonuses and club budgets. Amounts are in 백만 원 (100 = 1억).
  contracts: {
    budget: { base: 1350, spread: 300, local: 300 }, // base + (roll - 0.5) × spread, + local when the regional round is on
    // Slot value by pick: the regional round, then first round from the 1st to the 10th pick, and so on.
    slot: { regional: 300, first: [450, 25], second: [150, 3], third: [110, 2], later: [85, 75, 65, 55, 50, 45, 40, 35] },
    rankWeight: 0.6, // demand blends the slot of the pick with the slot a player of his public rank would get
    intentMult: { none: 1, college: 1.35, abroad: 2.2 },
    favouriteMult: 0.85, // asks less from the club he grew up supporting
    step: 5, // amounts are rounded to 500만 원
    // Chance to sign at the first offer: base by intent + (offer / demand - 1) × perRatio (+ favourite, difficulty).
    accept: { base: { none: 0.82, college: 0.5, abroad: 0.2 }, perRatio: 2.5, favourite: 0.15, lowball: 0.7, lowballPenalty: 0.3, max: 0.98 },
    difficulty: { easy: 0.05, normal: 0, hard: -0.05 },
    // Otherwise the player counters (asking `raise` × the larger of demand and offer) or walks away.
    counter: { none: 1, college: 0.65, abroad: 0.35, raise: 1.1 },
    cpuOffer: 1, // CPU clubs offer the demand when the budget allows
    cpuReserve: 0.85, // share of later picks' slot values a CPU club keeps in hand
    devCost: 30, // a development contract (first-year salary and a small bonus)
    // Leftover budget becomes development support: growth rate × (1 + boost) for three seasons.
    growthBoost: { perShare: 0.5, max: 0.15, seasons: 3 },
    // Public intentions announced before the draft.
    intent: { collegeShare: 0.12, collegeMinFV: 50, abroadMaxRank: 15, abroadMinFV: 60, abroadChance: 0.25, abroadMax: 2 },
    aiIntentPenalty: { easy: { college: 0, abroad: 0 }, normal: { college: 2, abroad: 6 }, hard: { college: 3, abroad: 9 } },
    refusalFan: -3,
  },

  health: {
    longInjuryShare: 0.22, // share of injuries that are long
    longDays: [65, 66],
    shortDays: [7, 28],
    rehabDays: 105, // this many lost days means the season is spent in rehab
    playingDays: 165, // games played scale by (1 - daysLost / playingDays)
    growthDays: 210, // growth scales by (1 - daysLost / growthDays)
    heavyInjuryDays: 100,
    heavyInjuryGrowthPenalty: 0.6,
    planPenaltyDays: 60,
    planPenalty: 4,
  },

  roles: {
    impactNoise: 3, // season-to-season noise on the ability used for role decisions
    // Extra call-up chance for early picks: byRound (round 0/1, 2, 3; later rounds get 0) × byYear.
    draftInvestment: { byRound: [0.18, 0.18, 0.1, 0.04], byYear: [1, 0.2, 0] },
    // Last year's regular keeps the job with base + (ability - pivot) × perAbility + form × perForm.
    retention: { base: 0.85, pivot: 50, perAbility: 0.02, perForm: 0.018, min: 0.66, max: 0.97 },
    // A regular who loses the job drops to the futures only when both ability and form are this low.
    demotion: { maxAbility: 38, maxForm: -0.8, poorForm: -0.5 },
    // Call-up: base + sigmoid((ability - pivot) / scale) × weight + bonuses.
    callUp: { base: 0.008, pivot: 46.5, scale: 1.6, weight: 0.85, afterBackup: 0.08, needFit: 80, needBonus: 0.045, min: 0.015, max: 0.98 },
    // Once called up, the chance the role is a regular one.
    regular: { pivotByYear: [52.5, 51], scale: 2, weightByYear: [0.55, 0.8], afterBackup: 0.08, min: 0.01, max: 0.95 },
    // Otherwise backup rather than a short cameo: clamp((ability - pivot) / scale).
    backupOverCameo: { pivot: 38, scale: 12, min: 0.2, max: 0.83 },
    core: { minAbility: 55, fromYear: 1 }, // "핵심" regulars
    // Regular slots per club and position among this draft class; beyond it a regular becomes backup.
    cohortCapacity: { SP: 2, RP: 3, C: 1, IF: 2, OF: 2 },
    closer: { minAbility: 52, fromYear: 1 },
  },

  games: {
    regular: {
      SP: { baseByYear: [20, 24, 26], spanByYear: [5, 5, 6] },
      RP: { baseByYear: [44], spanByYear: [21] },
      hitter: { baseByYear: [88, 105, 120], spanByYear: [25, 25, 21] },
    },
    backup: { SP: [9, 11], RP: [22, 19], hitter: [40, 36] },
    cameo: { pitcher: [2, 7], hitter: [5, 15] },
    // Futures games alongside each role; the development route gets a [base, span] range.
    futures: { regular: { pitcher: 2, hitter: 5 }, backup: { pitcher: 9, hitter: 35 }, development: { pitcher: [20, 8], hitter: [80, 25] } },
    hitterSeasonCap: 144, // first-team + futures games for a hitter
  },

  hitting: {
    paPerGame: { core: 4.25, regular: 3.95, futures: 3.6, cameo: 1.8, bench: 2.55 },
    avg: { base: 0.207, pivot: 30, perContact: 0.0027, futuresBonus: 0.035, noise: 0.018, min: 0.16, max: 0.355 },
    hr: { base: 0.007, pivot: 32, perPower: 0.00145, futuresBonus: 0.004, min: 0.001, max: 0.072 },
    walk: { base: 0.04, pivot: 30, perEye: 0.002, min: 0.025, max: 0.16 },
    strikeout: { base: 0.3, pivot: 30, perContact: 0.003, min: 0.1, max: 0.36, minNonHitShare: 0.5 },
    hitShare: { min: 0.08, max: 0.38 }, // per-AB non-HR hit chance bounds
    triple: { pivot: 30, perSpeed: 0.0009, max: 0.035 },
    double: { base: 0.18, pivot: 40, perPower: 0.0025 },
    rbi: { perHit: 0.32, perHR: 1.65 },
    steal: { pivot: 25, gamesPerUnit: 205, base: 0.6, spread: 0.6 },
  },

  pitching: {
    era: { base: 7.75, perStuff: 0.025, perCommand: 0.029, perBreaking: 0.016, futuresBonus: 0.95, noise: 0.45, min: 1.9, max: 8.5 },
    startIP: { base: 3.2, perStamina: 0.047, regular: 0.05, other: -0.45, noise: 1.1, min: 2.5, max: 7.6 },
    reliefIP: { base: 0.85, noise: 0.7, min: 0.33, max: 2 },
    spotStartShare: 0.65, // share of a non-regular SP's games that are starts
    k9: { base: 0.2, pivot: 20, perStuff: 0.18, perBreaking: 0.02, reliefBonus: 1.2, min: 3.5, max: 13 },
    bb9: { base: 6.9, perCommand: 0.066, min: 1.1, max: 5.6 },
    qualityStart: { minOuts: 18, maxRuns: 3 },
    // Starter win: at least minOuts, then base + (pivotRuns - runs) × perRun + team strength, then bullpen holds.
    startWin: { minOuts: 15, base: 0.24, pivotRuns: 5, perRun: 0.075, rankPivot: 11, perRank: 0.01, defaultRank: 6, min: 0.08, max: 0.78, bullpenHold: 0.86 },
    relief: { win: 0.045, save: 0.57, hold: 0.29 }, // cumulative thresholds on one roll
  },

  growth: {
    rateByCurve: {
      early: { start: 0.43, perYear: 0.045, min: 0.2 },
      late: { firstYears: 0.14, later: 0.44, switchYear: 2 },
      normal: 0.32,
    },
    speedShare: 0.6, // speed closes its gap more slowly
    noise: 0.65,
    minGain: -2.5,
    maxGain: 8,
    // Growth toward the ceiling fades with age: full until `fullUntil`, down to `floor` by `zeroAt`
    // (late developers get `lateShift` more years). Older draftees therefore reach less of their ceiling.
    ageTaper: { fullUntil: 22, zeroAt: 28, lateShift: 2, floor: 0.08 },
    agingFrom: { speed: 26, other: 29 },
    agingPerYear: { speed: 0.38, other: 0.28 },
  },

  // Public future value re-estimated after each season (see season.fvUpdate).
  // weight: share of the new estimate in the blend; room to grow closes linearly over `window` years before matureAge.
  futureValue: { weight: 0.4, matureAge: 28, lateShift: 2, window: 7, noise: 2 },

  // WAR estimate shown in the records. League levels are set so an average regular is about 2 WAR.
  war: {
    runsPerWin: 10,
    hitting: {
      weights: { bb: 0.72, single: 0.9, double: 1.25, triple: 1.58, hr: 2.05 },
      league: 0.335, // league wOBA
      scale: 1.2,
      replacementPer600: 20,
      position: { C: 10, IF: 2.5, OF: -4 }, // runs per full season
      perDefense: 0.25, // fielding runs per grade point above 50, per full season
      perSB: 0.15,
      seasonGames: 144,
    },
    pitching: { leagueRA9: 5.3, eraToRA: 1.08, replacement: { SP: 0.6, RP: 0.3 } },
  },

  // Descriptive only: each season's top velocity follows the change in true stuff
  // (same slope as generation.velocity.perStuff).
  velocity: { noise: 0.8, min: 128, max: 163 },

  scores: {
    // Last season's form, fed into next year's retention.
    performance: { eraPivot: 4.5, eraScale: 1.3, opsPivot: 0.72, opsScale: 0.12, limit: 2 },
    // 0–100 first-team contribution index (not WAR).
    contribution: { perInning: 0.42, eraPivot: 4.7, perEra: 7, perPA: 0.095, opsPivot: 0.7, perOps: 45, defensePivot: 45, perDefense: 0.15 },
    // Plan score: base + progress × perProgress + bonuses; progress = growth / expected growth.
    plan: { base: 28, perProgress: 43, played: 8, regular: 8, min: 10, max: 100 },
    expectedGrowth: { min: 0.65, share: 0.2, projectShare: 0.13, projectGap: 20, projectYears: 2 },
    progress: { nearCeiling: 2, max: 1.3 },
    growthLabels: [[3, '뚜렷한 성장'], [1.4, '꾸준한 발전'], [0.3, '기술 발전'], [0, '완성도 유지']],
  },

  firstYear: {
    weights: { need: 0.4, plan: 0.25, future: 0.35 },
    future: { base: 50, fvPivot: 45, perFV: 3, perGrowth: 4 },
    gradeCuts: [89, 77, 63], // A, B, C; below is D
  },

  league: {
    gamesPerPair: 16, // 9 opponents × 16 = 144 games
    rating: { base: 50, rankPivot: 11, perRank: 2.2, noise: 12, rookieScale: 35, rookieMax: 9 },
    logisticScale: 23, // win chance = 1 / (1 + exp(ratingGap / scale))
  },

  awards: {
    hitter: { minPA: 60, perPA: 0.055, opsPivot: 0.65, perOps: 50, perHR: 0.7 },
    pitcher: { minOuts: 60, perOut: 0.12, eraPivot: 5.5, perEra: 6, perK: 0.05 },
  },

  offseason: {
    release: { minClubSize: 3, fromYear: 2, minAge: 22, maxGrade: 42, base: 0.2, perGrade: 0.03, perAge: 0.03, max: 0.6 },
    trade: {
      chance: 0.68,
      protectContribution: 50, // regulars at or above this are never traded
      minCombinedGain: 30,
      maxValueGap: 8,
      value: { perReady: 0.65, perFV: 0.25, agePivot: 22, perAge: 1.1, perContribution: 0.08 },
      gapWeight: 2,
      noise: 25,
    },
  },

  // Fan mood after each season (display only).
  fans: { fade: 0.15, byRank: [5, 3, 2, 1, 0, -1, -2, -3, -4, -5], champion: 3, perRegular: 1, maxRegulars: 3, maxMedals: 2 },

  // Military service. Every player without service or an exemption must enlist before `mustAge`
  // (age at the end of the coming season). Decisions happen in the offseason, from the second pro season on.
  service: {
    mustAge: 28,
    firstYear: 1,
    // Seasons away and the share of the return season still available (18 months: back by June).
    terms: { sangmu: { seasons: 1, returnShare: 0.45 }, army: { seasons: 1, returnShare: 0.45 }, social: { seasons: 2, returnShare: 1 } },
    // Club default: yearly chance to send a player, by last season's role, times an age factor.
    enlistByRoute: { futures: 0.3, cameo: 0.2, backup: 0.12, regular: 0.03, rehab: 0.35 },
    enlistByAge: [[20, 0.8], [22, 1.2], [24, 1.6], [25, 2], [26, 2.8], [27, 4]], // [max age, factor]
    // Sangmu selection chance: (grade - minGrade) × perGrade (+ playedBonus with first-team games), clamped.
    sangmu: { maxAge: 27, minGrade: 40, perGrade: 0.035, playedBonus: 0.12, min: 0.03, max: 0.6, clubMinGrade: 42 },
    // Social-service (공익) classification: base + injury days so far × perInjuryDay.
    social: { base: 0.1, perInjuryDay: 0.0012, max: 0.4 },
    decline: { army: [0.8, 1.6], social: [0.3, 0.8] }, // per tool per season: [base, span]
    declineHeavy: 1.35, // stuff and speed fade faster
    // Share of each pathway that has already served when drafted.
    servedAtDraft: { 독립구단: 0.55, '해외독립 복귀': 0.5, '마이너 복귀': 0.25, '해외리그 복귀': 0.3, 'MLB 경험 복귀': 0.2, 대졸: 0.04 },
    // Clubs hold back likely Asian Games picks (age limit, grade at least this) when the Games are this year or next.
    holdForGames: 48,
  },

  // National-team events in the ten seasons. Medals give the 예술체육요원 exemption.
  // A class supplies at most `max` players (the rest of the roster comes from other classes).
  international: [
    { year: 2028, name: 'LA 올림픽', ageLimit: null, minGrade: 57, max: 3, results: [[0.1, '금메달'], [0.2, '은메달'], [0.42, '동메달']], exempt: ['금메달', '은메달', '동메달'] },
    { year: 2030, name: '도하 아시안게임', ageLimit: 25, minGrade: 50, max: 6, wildcard: { maxAge: 29, minGrade: 57, count: 1 }, results: [[0.78, '금메달'], [0.9, '은메달'], [1, '동메달']], exempt: ['금메달'] },
    { year: 2034, name: '리야드 아시안게임', ageLimit: 25, minGrade: 50, max: 6, wildcard: { maxAge: 29, minGrade: 57, count: 1 }, results: [[0.78, '금메달'], [0.9, '은메달'], [1, '동메달']], exempt: ['금메달'] },
  ],

  retirement: {
    // A released player signs with another club with (grade - minGrade) × perGrade, up to max, if young enough.
    claim: { minGrade: 36, perGrade: 0.05, max: 0.6, maxAge: 30 },
    stalled: { minAge: 24, seasons: 3, maxGrade: 42, chance: 0.3 }, // no first-team game for `seasons` years
    veteran: { minAge: 31, maxGrade: 45, chance: 0.3 },
    rehab: 0.25, // two straight seasons lost to rehab
    afterService: { maxGrade: 35, chance: 0.3 }, // does not come back from service
  },

  review: {
    weights: { need: 0.2, production: 0.5, growth: 0.3 },
    warPerSeason: 0.5, // WAR per player-season for 100 production points
    growth: { base: 35, perPoint: 3.5 },
    gradeCuts: [85, 70, 55],
    pendingMaxAge: 25,
  },
};

/** Value for pro year `yearIndex` from a byYear array (the last entry covers later years). */
const byYear = (list, yearIndex) => list[Math.min(yearIndex, list.length - 1)];
const letter = (score, cuts) => (score >= cuts[0] ? 'A' : score >= cuts[1] ? 'B' : score >= cuts[2] ? 'C' : 'D');

const api = { TUNING: freeze(TUNING), byYear, letter };
export default api;
