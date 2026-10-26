import { k as __i18n_k } from '../i18n/index';
/* 1.9.7 (the user's request): in a league that plays history (the 1982 legacy start), what the game offers comes when
   the KBO had it — a private training trip abroad, a non-FA multi-year deal, a draft pick in a trade, the draft
   combine, a naming-rights owner, the newer ballpark facilities. The years are the KBO's firsts as far as found, else
   game assumptions (RULES.md §9). Every other game has everything from the start. */
import { playsHistory } from './era';
import { rulesFor } from '../rules/history';

export type Feature = 'trip' | 'extension' | 'pickTrade' | 'combine' | 'namingRights' | 'premium' | 'scoreboard' | 'analytics' | 'futuresPark' | 'tempForeign' | 'foreignCap' | 'faGrades' | 'asiaSeries';

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
  // 2.0.50 (the user's request: check again what the legacy start must keep shut): the injury replacement foreign
  // player (tempforeign.ts, 2024), the foreign players' salary cap (foreigncap.ts, 2023), the free agents' grades
  // (A·B·C, 2021; before, every free agent cost the same — as an A does), the Asia Series (asiaseries.ts, from 2005).
  tempForeign: 2024,
  foreignCap: 2023,
  faGrades: 2021,
  asiaSeries: 2005,
};

/** Whether `feature` is there in `year` (always, unless the league plays history). */
export const featureOpen = (feature: Feature, year: number) => !playsHistory() || year >= FEATURE_FROM[feature];

/** Why it cannot be used yet, or null. */
export const featureClosed = (feature: Feature, year: number): string | null => (featureOpen(feature, year) ? null : __i18n_k("league.features.text.22c45d53", { year: FEATURE_FROM[feature] }));

/** 2.0.50: development contracts (육성선수; 신고선수 until 2014) in `season` — in a league that plays history from 2005
    (rules/history.ts), the KBO's year; every other game always (its made-up past included). */
export const developmentOpen = (season: number) => !playsHistory() || rulesFor(season).development;
/** Why there are none yet, or null. */
export const developmentClosed = (season: number): string | null => (developmentOpen(season) ? null : __i18n_k("league.features.text.22c45d53", { year: 2005 }));
/** 2.0.50: foreign players at all in `season` (a league that plays history: from 1998). */
export const foreignOpen = (season: number) => !playsHistory() || rulesFor(season).foreign.hold > 0;
/** Why there are none yet, or null. */
export const foreignClosed = (season: number): string | null => (foreignOpen(season) ? null : __i18n_k("league.features.text.22c45d53", { year: 1998 }));
/** 2.0.50: the salary cap in `season` (a league that plays history: from 2023). */
export const salaryCapOn = (season: number) => !playsHistory() || rulesFor(season).salaryCap;
/** 2.0.50: why there can be no development foreign players (devforeign.ts) in `season` yet — no foreign players, or
    no development contracts — or null. */
export const devForeignClosed = (season: number) => foreignClosed(season) ?? developmentClosed(season);
