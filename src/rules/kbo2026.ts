/* KBO rules for the 2026 season, the game's starting year.
   Every value comes from docs/RULES.md; the section number is noted beside each group. Values marked
   `assumed` are the game's own choices where real KBO has no precedent (RULES.md §9). Money is in
   만 원 (10,000 KRW) unless the name says USD. */

export interface SalaryCapYear {
  year: number;
  cap: number;
}

export const KBO_2026 = {
  season: 2026,

  // §1 League structure
  league: {
    clubs: 10,
    gamesPerClub: 144,
    postseasonClubs: 5,
    firstTeam: { registered: 29, active: 28 },
    rosterLimit: 68,
  },

  // §1 Futures league: games per club (116 in 2026, 121 from 2027; S30)
  futuresGames: [
    { from: 2026, games: 116 },
    { from: 2027, games: 121 },
  ],

  // §6 Development players (육성선수): registrable from May 1 (S28)
  development: { registerFrom: '05-01' },

  // §2 Contracts
  minimumSalary: [
    { from: 2021, amount: 3000 },
    { from: 2027, amount: 3300 },
  ],

  // §3 Competitive balance tax, on each club's top-40 total pay
  salaryCap: {
    from: 2023, // the cap began with the 2023 season
    topPlayers: 40,
    years: [
      { year: 2025, cap: 1371165 },
      { year: 2026, cap: 1439723 },
      { year: 2027, cap: 1511709 },
      { year: 2028, cap: 1587294 },
    ] satisfies SalaryCapYear[],
    growthAfter2028: 0.05, // assumed: the announced 5% steps continue
    firstOverageLevy: 0.3,
    /** Levy by consecutive seasons over the cap (1st, 2nd, 3rd+), and the 1st-round pick drop from the 3rd (S37). */
    levies: [0.3, 0.5, 1.0],
    pickDropFrom: 3,
    pickDrop: 9,
    floor: { from: 2027, amount: 606538, growth: 0.05 },
    exceptionPlayerShare: 0.5,
  },

  // §4 Free agency
  freeAgency: {
    seasonsHighSchool: 8,
    seasonsCollege: 7,
    seasonsOverseas: 8,
    seasonsToRequalify: 4,
    daysPerSeason: 145,
    compensation: {
      A: { protected: 20, withPlayer: 2.0, cashOnly: 3.0 },
      B: { protected: 25, withPlayer: 1.0, cashOnly: 2.0 },
      C: { protected: null, withPlayer: null, cashOnly: 1.5 },
    },
    // Grades from the last three seasons' salary rank (S34): A = club top 3 and league top 30, B = club top 10 and league top 60.
    grade: { clubTop: [3, 10], leagueTop: [30, 60], cFromAge: 35 },
    /** Outside free agents a club may sign, by the number of free agents that winter (S35). */
    externalLimit: [
      { upTo: 10, signs: 1 },
      { upTo: 20, signs: 2 },
      { upTo: 30, signs: 3 },
      { upTo: Infinity, signs: 4 },
    ],
  },

  // §2 Salary arbitration (S33)
  arbitration: { minProYears: 3, deadline: '01-10' },

  // §6 Trades and waivers (S36)
  trade: { deadline: '07-31' },
  waiver: { days: 7 },

  // §5 Foreign players
  foreign: {
    regular: 3,
    asiaQuota: 1,
    allMayPlay: true,
    maxPitchersInGame: 2,
    newContractCapUSD: 1_000_000,
    clubTotalCapUSD: 4_000_000,
    asiaQuotaCapUSD: 200_000,
    asiaQuotaRaisePerYearUSD: 100_000,
    asiaQuotaReplacementsPerYear: 1,
    replacementsPerSeason: 2, // S38 (practice)
    replacementDeadline: '08-15', // game assumption
  },

  // §6 Draft and player movement
  draft: {
    rounds: 11,
    month: 9,
    order: 'reverse-standings' as const,
  },
  secondaryDraft: {
    protected: 35,
    rounds: 3,
    extraPicksBottomClubs: { clubs: 3, picks: 2 },
    fees: [40000, 30000, 20000], // then 10000 from round 4
    laterRoundFee: 10000,
    exemptProYears: 3,
    maxLossPerClub: 4, // game assumption
    firstYear: 2023, // held every other year since 2023
  },

  // §7 Injured list
  injuredList: { lengths: [10, 15, 30], countsAsRegistered: true, retroactiveClaimsPerYear: 3 },
} as const;

/* Expansion club terms (RULES.md §8 precedents, §9 assumptions). Every number is a setting. */
export const EXPANSION_DEFAULTS = {
  entryFee: 300_000, // 30억, NC and KT
  deposit: 1_000_000, // 100억 deposit, NC and KT
  developmentFund: { min: 200_000, max: 2_000_000 }, // NC 20억, KT 200억
  specialDraft: { protected: 20, perClub: 1, feePerPlayer: 100_000 }, // 10억 each
  rookiePriorityPicks: 2, // NC precedent
  extraPicksAfterRound2: 5, // NC precedent (special picks after round two of its first draft)
  freeAgentSigns: 3, // NC precedent: up to three free agents without compensation players
  extraForeignPlayers: 1, // assumed: +1 on top of 3 + Asia quota, first two first-team seasons
  extraFirstTeamSpots: 1, // assumed, first two first-team seasons
  benefitSeasons: 2, // assumed
  promotion: 'afterFutures' as 'afterFutures' | 'immediate',
} as const;

/* 11-club schedule (RULES.md §9, assumed): 144 games = 15 against four opponents + 14 against six. */
export const ELEVEN_CLUB_SCHEDULE = { gamesPerClub: 144, heavyOpponents: 4, heavyGames: 15, lightGames: 14 } as const;

export function salaryCapFor(year: number): number {
  const years = KBO_2026.salaryCap.years;
  const known = years.find((y) => y.year === year);
  if (known) return known.cap;
  const first = years[0]!,
    last = years[years.length - 1]!;
  if (year < first.year) return first.cap;
  return Math.round(last.cap * (1 + KBO_2026.salaryCap.growthAfter2028) ** (year - last.year));
}

export function minimumSalaryFor(year: number): number {
  let amount: number = KBO_2026.minimumSalary[0].amount;
  for (const step of KBO_2026.minimumSalary) if (year >= step.from) amount = step.amount;
  return amount;
}

export function futuresGamesFor(year: number): number {
  let games: number = KBO_2026.futuresGames[0].games;
  for (const step of KBO_2026.futuresGames) if (year >= step.from) games = step.games;
  return games;
}
