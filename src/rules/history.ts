/* The KBO's rules year by year, 1982 on (1.9.4, the 1.9 plan's B; docs/RULES.md §14 with its sources). One table
   of steps — `[from, value]`, the value holding until the next step — read by `rulesFor(year)`.

   Only a league that plays history (era.ts `playsHistory`, the 1982 legacy start) reads the years before 2015;
   every other game reads today's rules in every year, as it always has. From 2015 the table gives what the game
   does today, not what the KBO did (`MODERN_FROM`): the existing games and the history they make must not change
   (the golden file checks it). Where the game simplifies
   2015–2025 (a 28-man first team from 2015, three foreign players in a game, the second draft only from 2023),
   RULES.md §14 says so. The years before 2015 are for the 1982 legacy start (1.9.5). */
import { playsHistory, ruleYear } from '../league/era';
import { KBO_2026 } from './kbo2026';

/** The first year the table hands over to today's game. */
export const MODERN_FROM = 2015;

type Steps<T> = readonly (readonly [number, T])[];

/** The value in force in `year`: the last step from that year or before (the first step before it). */
export function stepAt<T>(steps: Steps<T>, year: number): T {
  let out = steps[0]![1];
  for (const [from, value] of steps) if (year >= from) out = value;
  return out;
}

/** How the postseason is decided (RULES.md §14). */
export type PostseasonFormat =
  /** 1982–1984: the first-half winner against the second-half winner. */
  | 'halves'
  /** 1985: a club with the best record over the year goes to the final too. */
  | 'halvesBest'
  /** 1986–1988: four places from the two halves' first two; a club with two goes straight to the final. */
  | 'halvesTickets'
  /** 1989–1992 and 2001–2014: the top four of one season. */
  | 'four'
  /** 1993–1998: the top four, the semifinal only when the third and fourth are within three games. */
  | 'fourWithin3'
  /** 1999–2000: two leagues, the first two of each across, a third over the other league's second. */
  | 'twoLeagues'
  /** 2015~: the top five, a wild card round. */
  | 'five';

/** Games to win in each round (a best-of-n is n / 2 rounded up); null: no such round. */
export interface SeriesLengths {
  wildCard: number | null;
  semi: number | null;
  playoff: number | null;
  final: number;
}

/** How a tie counts in the standings. */
export type TieRule = 'excluded' | 'half' | 'wins' | 'loss';

export interface ForeignRules {
  /** Foreign players a club may keep (the Asia quota apart), how many may play in a game, the Asia quota. */
  hold: number;
  play: number;
  asia: number;
  /** How they are signed: none yet, the KBO tryout's draft (1998–1999) or free signing (2000~). */
  signing: 'none' | 'tryout' | 'free';
  /** A new player's pay cap in USD, or null. */
  capUsd: number | null;
}

export interface KyopoRules {
  /** Overseas Korean (교포) players may be signed this year. */
  allowed: boolean;
  /** At most this many in a game, or on the entry (null: no limit). */
  maxPlay: number | null;
  maxEntry: number | null;
}

export interface YearRules {
  year: number;
  gamesPerClub: number;
  /** The season in two halves (전·후기, 1982–1988). */
  halves: boolean;
  twoLeagues: boolean;
  postseason: PostseasonFormat;
  series: SeriesLengths;
  /** Extra innings at most (null: no limit, 2008). */
  extraInnings: number | null;
  ties: TieRule;
  firstTeam: { registered: number; active: number };
  rosterLimit: number;
  /** A second-team league exists (1990~); the game plays its games only from 2026. */
  futuresLeague: boolean;
  futuresSimulated: boolean;
  /** Development (신고·육성) players. */
  development: boolean;
  /** Territorial first picks a club may make (Infinity: no limit; 0: none). */
  territorialPicks: number;
  /** 1.9.7: rounds of the (2차) draft. */
  draftRounds: number;
  foreign: ForeignRules;
  kyopo: KyopoRules;
  /** Seasons to free agency (high school entry), null before it began. */
  freeAgencySeasons: number | null;
  /** The second draft is held in the winter after this season. */
  secondDraft: boolean;
  posting: boolean;
  /** Clubs abroad scout the draft class (late 1990s on). */
  overseasDraftInterest: boolean;
  salaryCap: boolean;
}

/** The historical table (RULES.md §14). Values from MODERN_FROM on are overwritten by today's game below. */
interface HistoryTable {
  gamesPerClub: Steps<number>;
  halves: Steps<boolean>;
  twoLeagues: Steps<boolean>;
  postseason: Steps<PostseasonFormat>;
  series: Steps<SeriesLengths>;
  extraInnings: Steps<number | null>;
  ties: Steps<TieRule>;
  firstTeam: Steps<{ registered: number; active: number }>;
  rosterLimit: Steps<number>;
  futuresLeague: Steps<boolean>;
  development: Steps<boolean>;
  territorialPicks: Steps<number>;
  draftRounds: Steps<number>;
  foreign: Steps<ForeignRules>;
  kyopo: Steps<KyopoRules>;
  freeAgencySeasons: Steps<number | null>;
  secondDraftYears: readonly number[];
  posting: Steps<boolean>;
  overseasDraftInterest: Steps<boolean>;
}

export const HISTORY: HistoryTable = {
  gamesPerClub: [[1982, 80], [1983, 100], [1985, 110], [1986, 108], [1989, 120], [1991, 126], [1999, 132], [2000, 133], [2005, 126], [2009, 133], [2013, 128], [2015, 144]],
  halves: [[1982, true], [1989, false]],
  twoLeagues: [[1982, false], [1999, true], [2001, false]],
  postseason: [[1982, 'halves'], [1985, 'halvesBest'], [1986, 'halvesTickets'], [1989, 'four'], [1993, 'fourWithin3'], [1999, 'twoLeagues'], [2001, 'four'], [2015, 'five']],
  series: [
    [1982, { wildCard: null, semi: null, playoff: null, final: 7 }],
    [1985, { wildCard: null, semi: null, playoff: 5, final: 7 }],
    [1989, { wildCard: null, semi: 3, playoff: 5, final: 7 }],
    [1999, { wildCard: null, semi: 3, playoff: 7, final: 7 }],
    [2001, { wildCard: null, semi: 3, playoff: 5, final: 7 }],
    [2005, { wildCard: null, semi: 5, playoff: 5, final: 7 }],
    [2006, { wildCard: null, semi: 3, playoff: 5, final: 7 }],
    [2008, { wildCard: null, semi: 5, playoff: 7, final: 7 }],
    [2009, { wildCard: null, semi: 5, playoff: 5, final: 7 }],
    [2015, { wildCard: 2, semi: 5, playoff: 5, final: 7 }],
  ],
  extraInnings: [[1982, 15], [1997, 12], [2008, null], [2009, 12], [2025, 11]],
  ties: [[1982, 'excluded'], [1987, 'half'], [1998, 'excluded'], [2003, 'wins'], [2005, 'excluded'], [2009, 'loss'], [2011, 'excluded']],
  firstTeam: [[1982, { registered: 25, active: 25 }], [1990, { registered: 26, active: 24 }], [2008, { registered: 26, active: 25 }], [2015, { registered: 27, active: 25 }], [2020, { registered: 28, active: 26 }]],
  rosterLimit: [[1982, 45], [1990, 55], [2005, 63]],
  futuresLeague: [[1982, false], [1990, true]],
  development: [[1982, false], [2005, true]],
  // 1.9.7 (the user's request): the draft grows round by round — a game assumption (no yearly count found) from a
  // few rounds when the territorial picks did most of the work to ten in the 2000s; before 1982 (the legacy start's
  // own made-up drafts) as today.
  draftRounds: [[0, 11], [1982, 4], [1986, 6], [1991, 8], [2000, 10]],
  territorialPicks: [[1982, Infinity], [1986, 10], [1987, 3], [1990, 2], [1991, 1], [2010, 0], [2014, 1], [2023, 0]],
  foreign: [
    [1982, { hold: 0, play: 0, asia: 0, signing: 'none', capUsd: null }],
    [1998, { hold: 2, play: 2, asia: 0, signing: 'tryout', capUsd: 120_000 }],
    [2000, { hold: 2, play: 2, asia: 0, signing: 'free', capUsd: 120_000 }],
    [2001, { hold: 3, play: 2, asia: 0, signing: 'free', capUsd: 120_000 }],
    [2003, { hold: 2, play: 2, asia: 0, signing: 'free', capUsd: 120_000 }],
    [2005, { hold: 2, play: 2, asia: 0, signing: 'free', capUsd: 300_000 }],
    [2014, { hold: 3, play: 2, asia: 0, signing: 'free', capUsd: null }],
  ],
  kyopo: [
    [1982, { allowed: false, maxPlay: null, maxEntry: null }],
    [1983, { allowed: true, maxPlay: 2, maxEntry: null }],
    [1992, { allowed: true, maxPlay: null, maxEntry: null }],
    [1995, { allowed: true, maxPlay: null, maxEntry: 2 }],
    [2016, { allowed: false, maxPlay: null, maxEntry: null }],
  ],
  freeAgencySeasons: [[1982, null], [1999, 10], [2001, 9]],
  secondDraftYears: [2011, 2013],
  posting: [[1982, false], [1998, true]],
  overseasDraftInterest: [[1982, false], [1998, true]],
};

/** Today's game, as it plays 2015 on (the same values as the code that reads them: manager.ts, offseason.ts,
    futures.ts, seconddraft.ts, the free-agency and foreign rules). */
function modern(year: number): Pick<YearRules, 'firstTeam' | 'rosterLimit' | 'futuresSimulated' | 'foreign' | 'freeAgencySeasons' | 'secondDraft' | 'salaryCap' | 'draftRounds'> {
  const now = year >= 2026;
  const sd = KBO_2026.secondaryDraft.firstYear;
  return {
    firstTeam: now ? { ...KBO_2026.league.firstTeam } : { registered: 28, active: 26 },
    rosterLimit: now ? KBO_2026.league.rosterLimit : 65,
    futuresSimulated: now,
    foreign: { hold: KBO_2026.foreign.regular, play: KBO_2026.foreign.regular, asia: now ? KBO_2026.foreign.asiaQuota : 0, signing: 'free', capUsd: KBO_2026.foreign.newContractCapUSD },
    freeAgencySeasons: KBO_2026.freeAgency.seasonsHighSchool,
    secondDraft: year >= sd && (year - sd) % 2 === 0,
    salaryCap: year >= KBO_2026.salaryCap.from,
    draftRounds: KBO_2026.draft.rounds,
  };
}

/** The rules of a year as the table knows it (a year on the rules' calendar: `ruleYear` already applied); with
    `history` false (a game that does not play the KBO's history) today's game in every year. */
export function rulesOfYear(year: number, history = true): YearRules {
  const H = HISTORY;
  const base: YearRules = {
    year,
    gamesPerClub: stepAt(H.gamesPerClub, year),
    halves: stepAt(H.halves, year),
    twoLeagues: stepAt(H.twoLeagues, year),
    postseason: stepAt(H.postseason, year),
    series: { ...stepAt(H.series, year) },
    extraInnings: stepAt(H.extraInnings, year),
    ties: stepAt(H.ties, year),
    firstTeam: { ...stepAt(H.firstTeam, year) },
    rosterLimit: stepAt(H.rosterLimit, year),
    futuresLeague: stepAt(H.futuresLeague, year),
    futuresSimulated: false,
    development: stepAt(H.development, year),
    territorialPicks: stepAt(H.territorialPicks, year),
    draftRounds: stepAt(H.draftRounds, year),
    foreign: { ...stepAt(H.foreign, year) },
    kyopo: { ...stepAt(H.kyopo, year) },
    freeAgencySeasons: stepAt(H.freeAgencySeasons, year),
    secondDraft: H.secondDraftYears.includes(year),
    posting: stepAt(H.posting, year),
    overseasDraftInterest: stepAt(H.overseasDraftInterest, year),
    salaryCap: false,
  };
  return year >= MODERN_FROM || !history ? { ...base, ...modern(year) } : base;
}

/** The rules in force in a calendar year of this game (a game started in 2016 reads 2026's in 2016: era.ts). A league
    that plays history (1.9.5, the 1982 legacy start) reads the KBO's own year: its era shift keeps only the money in
    today's terms. */
export const rulesFor = (calendarYear: number) => (playsHistory() ? rulesOfYear(calendarYear, true) : rulesOfYear(ruleYear(calendarYear), false));

/** 1.9.6: the cap on a foreign player's pay in a game that plays history (12만 달러 1998–2004, 30만 2005–2013), or
    null for today's caps (every other game, and a history game from 2014). */
export const historicForeignCap = (calendarYear: number) => (playsHistory() ? rulesFor(calendarYear).foreign.capUsd : null);

/** What changed from one season to the next, for the winter's notice (1.9.5): the fields that differ. */
export function ruleChanges(from: YearRules, to: YearRules): (keyof YearRules)[] {
  const keys = Object.keys(to) as (keyof YearRules)[];
  return keys.filter((k) => k !== 'year' && JSON.stringify(from[k]) !== JSON.stringify(to[k]));
}
