import { k as __i18n_k } from '../i18n/index';
/* 1.9.7 (the user's request): in a league that plays history (the 1982 legacy start), what the game offers comes when
   the KBO had it — a private training trip abroad, a non-FA multi-year deal, a draft pick in a trade, the draft
   combine, a naming-rights owner, the newer ballpark facilities. The years are the KBO's firsts as far as found, else
   game assumptions (RULES.md §9). Every other game has everything from the start. */
import { playsHistory } from './era';

export type Feature = 'trip' | 'extension' | 'pickTrade' | 'combine' | 'namingRights' | 'premium' | 'scoreboard' | 'analytics' | 'futuresPark';

/** The first season each is there in a history game. */
export const FEATURE_FROM: Record<Feature, number> = {
  // Private training centres abroad (Driveline and the like): KBO players from the mid-2010s.
  trip: 2014,
  // Non-FA multi-year deals: the first ones were signed in the winter before 2022.
  extension: 2022,
  // Draft picks in trades.
  pickTrade: 2019,
  // The draft combine and private workouts.
  combine: 2023,
  // A naming-rights club (히어로즈, 2008).
  namingRights: 2008,
  // Ballpark: premium seats and sky boxes, an HD video board, a data room, a second-team park.
  premium: 2008,
  scoreboard: 2009,
  analytics: 2012,
  futuresPark: 1990,
};

/** Whether `feature` is there in `year` (always, unless the league plays history). */
export const featureOpen = (feature: Feature, year: number) => !playsHistory() || year >= FEATURE_FROM[feature];

/** Why it cannot be used yet, or null. */
export const featureClosed = (feature: Feature, year: number): string | null => (featureOpen(feature, year) ? null : __i18n_k("league.features.text.22c45d53", { year: FEATURE_FROM[feature] }));
