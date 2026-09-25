/* National-team events that decide military exemptions (예술체육요원). Past results are real; later
   ones are decided by the seed. Selection limits follow the 2023 Hangzhou rule (age 25 or under, or
   in the first four pro years, plus three wildcards aged 29 or under) and are assumed for later
   Asian Games (docs/RULES.md §11). Events held during the season take the squad away from its clubs
   between the dates (the league keeps playing; game assumption, dates in RULES.md §11). */

export interface InternationalEvent {
  year: number;
  name: string;
  kind: 'asianGames' | 'olympics';
  squad: number;
  /** Selection limit: maximum age in the event year, or pro years; null for no limit. */
  limit: { maxAge: number; maxProYears: number; wildcards: number; wildcardMaxAge: number } | null;
  /** Real outcome: 'medal' gives the exemption (Asian Games gold, Olympic bronze or better). null = simulated. */
  result: 'medal' | 'none' | null;
  medalChance: number;
  /** In-season events: the squad leaves on `from` and is back after `to`, missing league games meanwhile. */
  dates?: { from: string; to: string };
}

const HANGZHOU_RULE = { maxAge: 25, maxProYears: 4, wildcards: 3, wildcardMaxAge: 29 };

export const INTERNATIONAL: InternationalEvent[] = [
  { year: 2014, name: '인천 아시안게임', kind: 'asianGames', squad: 24, limit: null, result: 'medal', medalChance: 0 },
  { year: 2018, name: '자카르타·팔렘방 아시안게임', kind: 'asianGames', squad: 24, limit: null, result: 'medal', medalChance: 0, dates: { from: '2018-08-18', to: '2018-09-01' } },
  { year: 2021, name: '도쿄 올림픽', kind: 'olympics', squad: 24, limit: null, result: 'none', medalChance: 0, dates: { from: '2021-07-19', to: '2021-08-07' } },
  { year: 2023, name: '항저우 아시안게임', kind: 'asianGames', squad: 24, limit: HANGZHOU_RULE, result: 'medal', medalChance: 0, dates: { from: '2023-09-23', to: '2023-10-07' } },
  { year: 2026, name: '아이치·나고야 아시안게임', kind: 'asianGames', squad: 24, limit: HANGZHOU_RULE, result: null, medalChance: 0.55, dates: { from: '2026-09-14', to: '2026-09-27' } },
  { year: 2028, name: 'LA 올림픽', kind: 'olympics', squad: 24, limit: null, result: null, medalChance: 0.35, dates: { from: '2028-07-06', to: '2028-07-30' } },
  { year: 2030, name: '도하 아시안게임', kind: 'asianGames', squad: 24, limit: HANGZHOU_RULE, result: null, medalChance: 0.55 },
  { year: 2034, name: '리야드 아시안게임', kind: 'asianGames', squad: 24, limit: HANGZHOU_RULE, result: null, medalChance: 0.55 },
];
