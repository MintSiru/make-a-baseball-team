/* National-team events (V0.7, reworked in V0.12). The Asian Games and the Olympics decide military exemptions
   (예술체육요원: Asian Games gold, an Olympic medal); the World Baseball Classic (March, before the season), the
   WBSC Premier12 and the Asia Professional Baseball Championship (APBC, under-24s; both in November) are for
   glory and the fans. Past results are real; later ones are decided by the seed. Selection limits follow the
   2023 Hangzhou rule for the Asian Games (age 25 or under, or in the first four pro years, plus three wildcards
   aged 29 or under, one to three players a club) and the 2023 APBC rule (24 or under, or in the first three pro
   years, plus three wildcards aged 29 or under). Events held during the season take the squad away from its
   clubs between the dates (the league keeps playing); the squad is named some weeks before (RULES.md §11). */

export type EventKind = 'asianGames' | 'olympics' | 'wbc' | 'premier12' | 'apbc';
/** How far the team went: champion, runner-up, third (an Olympic or Asian Games bronze; a WBC semifinal), fourth,
    out in the second round, out in the first. */
export type Finish = 'champion' | 'runnerUp' | 'third' | 'fourth' | 'second' | 'first';

export interface InternationalEvent {
  /** `${year}-${kind}`: several events can fall in one year (V0.12). */
  id: string;
  year: number;
  name: string;
  kind: EventKind;
  squad: number;
  /** Selection limit: maximum age in the event year, or pro years; null for no limit. */
  limit: { maxAge: number; maxProYears: number; wildcards: number; wildcardMaxAge: number } | null;
  /** At most this many players from one club. */
  perClub?: number;
  /** The real result, or null to draw it from `odds`. */
  finish: Finish | null;
  dates: { from: string; to: string };
}

const HANGZHOU_RULE = { maxAge: 25, maxProYears: 4, wildcards: 3, wildcardMaxAge: 29 };
const APBC_RULE = { maxAge: 24, maxProYears: 3, wildcards: 3, wildcardMaxAge: 29 };
const SQUAD: Record<EventKind, number> = { asianGames: 24, olympics: 24, wbc: 30, premier12: 28, apbc: 26 };

/** Chances of each finish for an event without a real result (game assumption from Korea's recent record). */
export const ODDS: Record<EventKind, [Finish, number][]> = {
  asianGames: [
    ['champion', 0.55],
    ['runnerUp', 0.25],
    ['third', 0.15],
    ['fourth', 0.05],
  ],
  olympics: [
    ['champion', 0.1],
    ['runnerUp', 0.1],
    ['third', 0.15],
    ['fourth', 0.3],
    ['first', 0.35],
  ],
  wbc: [
    ['champion', 0.04],
    ['runnerUp', 0.05],
    ['third', 0.1],
    ['second', 0.26],
    ['first', 0.55],
  ],
  premier12: [
    ['champion', 0.15],
    ['runnerUp', 0.15],
    ['third', 0.15],
    ['fourth', 0.15],
    ['second', 0.15],
    ['first', 0.25],
  ],
  apbc: [
    ['champion', 0.25],
    ['runnerUp', 0.4],
    ['third', 0.25],
    ['fourth', 0.1],
  ],
};

const ev = (year: number, kind: EventKind, name: string, finish: Finish | null, from: string, to: string, extra: Partial<InternationalEvent> = {}): InternationalEvent => ({
  id: `${year}-${kind}`,
  year,
  name,
  kind,
  squad: SQUAD[kind],
  limit: kind === 'apbc' ? APBC_RULE : null,
  finish,
  dates: { from, to },
  ...extra,
});
const ag = { limit: HANGZHOU_RULE, perClub: 3 };

const REAL: InternationalEvent[] = [
  // The 2014 Incheon Games and the 2030s Games in the Gulf are held in the autumn break or after the season.
  ev(2014, 'asianGames', '인천 아시안게임', 'champion', '2014-09-22', '2014-09-28', { limit: null }),
  ev(2015, 'premier12', 'WBSC 프리미어12', 'champion', '2015-11-08', '2015-11-21'),
  ev(2017, 'wbc', '월드 베이스볼 클래식', 'first', '2017-03-06', '2017-03-09'),
  ev(2017, 'apbc', '아시아 프로야구 챔피언십', 'runnerUp', '2017-11-16', '2017-11-19'),
  ev(2018, 'asianGames', '자카르타·팔렘방 아시안게임', 'champion', '2018-08-18', '2018-09-01', { limit: null }),
  ev(2019, 'premier12', 'WBSC 프리미어12', 'runnerUp', '2019-11-06', '2019-11-17'),
  ev(2021, 'olympics', '도쿄 올림픽', 'fourth', '2021-07-19', '2021-08-07'),
  ev(2023, 'wbc', '월드 베이스볼 클래식', 'first', '2023-03-09', '2023-03-13'),
  ev(2023, 'asianGames', '항저우 아시안게임', 'champion', '2023-09-23', '2023-10-07', ag),
  ev(2023, 'apbc', '아시아 프로야구 챔피언십', 'runnerUp', '2023-11-16', '2023-11-19'),
  ev(2024, 'premier12', 'WBSC 프리미어12', 'first', '2024-11-13', '2024-11-24'),
  ev(2026, 'wbc', '월드 베이스볼 클래식', null, '2026-03-05', '2026-03-17'),
  ev(2026, 'asianGames', '아이치·나고야 아시안게임', null, '2026-09-14', '2026-09-27', ag),
  ev(2027, 'premier12', 'WBSC 프리미어12', null, '2027-11-08', '2027-11-21'),
  ev(2028, 'olympics', 'LA 올림픽', null, '2028-07-06', '2028-07-30'),
  ev(2030, 'asianGames', '도하 아시안게임', null, '2030-11-30', '2030-12-15', ag),
  ev(2034, 'asianGames', '리야드 아시안게임', null, '2034-11-29', '2034-12-14', ag),
];

/**
 * After the scheduled events (game assumption): the Olympics every four years from 2032 (Brisbane; baseball is not
 * confirmed there) late July to early August, the Asian Games from 2038 in the second half of September, the WBC
 * every four years from 2029 in March, the Premier12 from 2031 and the APBC from 2029 every four years in November.
 */
function later(until: number): InternationalEvent[] {
  const out: InternationalEvent[] = [];
  for (let y = 2032; y <= until; y += 4) out.push(ev(y, 'olympics', y === 2032 ? '브리즈번 올림픽' : `${y} 하계 올림픽`, null, `${y}-07-24`, `${y}-08-09`));
  for (let y = 2038; y <= until; y += 4) out.push(ev(y, 'asianGames', `${y} 아시안게임`, null, `${y}-09-15`, `${y}-09-29`, ag));
  for (let y = 2029; y <= until; y += 4) out.push(ev(y, 'wbc', '월드 베이스볼 클래식', null, `${y}-03-06`, `${y}-03-18`));
  for (let y = 2031; y <= until; y += 4) out.push(ev(y, 'premier12', 'WBSC 프리미어12', null, `${y}-11-08`, `${y}-11-21`));
  for (let y = 2029; y <= until; y += 4) out.push(ev(y, 'apbc', '아시아 프로야구 챔피언십', null, `${y}-11-16`, `${y}-11-19`));
  return out;
}

/** Every national-team event the game knows, in date order, far beyond any career. */
export const INTERNATIONAL: InternationalEvent[] = [...REAL, ...later(2400)].sort((a, b) => a.dates.from.localeCompare(b.dates.from));

export const eventById = (id: string) => INTERNATIONAL.find((e) => e.id === id);
export const eventsIn = (year: number) => INTERNATIONAL.filter((e) => e.year === year);

/** When the event falls: before the season (March), in it (the squad leaves its clubs), or after it. */
export const timing = (e: InternationalEvent): 'spring' | 'season' | 'winter' => (e.dates.from.slice(5) < '03-25' ? 'spring' : e.dates.from.slice(5) < '10-15' ? 'season' : 'winter');

/** The day an in-season squad is named (about two months ahead; the 2023 Asian Games squad was named in June). */
export const announceDate = (e: InternationalEvent) => new Date(Date.parse(e.dates.from) - 60 * 86400000).toISOString().slice(0, 10);

/** Whether the result exempts the squad from military service (Asian Games gold, an Olympic medal). */
export const exempts = (e: Pick<InternationalEvent, 'kind'>, finish: Finish) =>
  e.kind === 'asianGames' ? finish === 'champion' : e.kind === 'olympics' ? ['champion', 'runnerUp', 'third'].includes(finish) : false;

/** The result in words, the way the papers put it. */
export function finishText(e: Pick<InternationalEvent, 'kind'>, f: Finish): string {
  const medals = e.kind === 'asianGames' || e.kind === 'olympics';
  switch (f) {
    case 'champion':
      return medals ? '금메달' : '우승';
    case 'runnerUp':
      return medals ? '은메달' : '준우승';
    case 'third':
      return medals ? '동메달' : e.kind === 'wbc' ? '4강' : '3위';
    case 'fourth':
      return '4위';
    case 'second':
      return e.kind === 'wbc' ? '8강 탈락' : '슈퍼라운드 진출 실패';
    case 'first':
      return '1라운드 탈락';
  }
}
