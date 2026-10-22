/* 2.0.39 (the user's report: a club on 울릉도 never had a territorial pick): a founded club's home is a city, while
   the draft's amateurs grow up in one of eight regions (the north's seven in a unified game). A territorial (1차) pick
   looked for prospects from the city itself, so a small city (울릉, or most of the north's) found almost no one, and
   the pick passed every year. Each city now lies in its region (울릉 in 대구·경북, 함흥 in 함경남도), whose high
   schools it shares with any other club there. */
import { CITIES, REAL_CLUB_CITIES, SCENARIO_CITIES } from '../club/cities';
import { DRAFT_REGIONS } from '../draftroom';
import type { TeamId } from '../model/types';
import { NORTH_CITIES, NORTH_REGIONS } from './north';
import type { LeagueState } from './state';

/** The draft region of each city (an index into DRAFT_REGIONS: 서울, 경남, 대전·충청·전북, 부산·울산, 인천, 경기·강원,
    대구·경북, 광주·전남·제주). */
const SOUTH: Record<string, number> = {
  seoul: 0,
  gimhae: 1,
  jinju: 1,
  changwon: 1,
  cheongju: 2,
  jeonju: 2,
  cheonan: 2,
  gunsan: 2,
  sejong: 2,
  daejeon: 2,
  ulsan: 3,
  busan: 3,
  incheon: 4,
  'incheon-new': 4,
  goyang: 5,
  seongnam: 5,
  hwaseong: 5,
  chuncheon: 5,
  yongin: 5,
  bucheon: 5,
  pyeongtaek: 5,
  wonju: 5,
  suwon: 5,
  pohang: 6,
  gyeongju: 6,
  ulleung: 6,
  daegu: 6,
  jeju: 7,
  yeosu: 7,
  gwangju: 7,
};

/** The north's cities (an index into NORTH_REGIONS: 평양·남포, 평안남도, 평안북도·자강도, 황해도, 함경남도, 함경북도,
    강원도 북부·양강도). */
const NORTH: Record<string, number> = {
  pyongyang: 0,
  nampo: 0,
  sinuiju: 2,
  kaesong: 3,
  sariwon: 3,
  hamhung: 4,
  chongjin: 5,
  songjin: 5,
  wonsan: 6,
};

/** The draft region a club's home city lies in, or null (a club of the original ten, whose region is one already). */
export function draftRegionOf(s: LeagueState, teamId: TeamId): string | null {
  const home = s.teams.find((t) => t.id === teamId)?.region;
  if (!home) return null;
  const south = [...CITIES, ...SCENARIO_CITIES, ...REAL_CLUB_CITIES].find((c) => c.name === home);
  if (south && SOUTH[south.id] !== undefined) return DRAFT_REGIONS[SOUTH[south.id]!] ?? null;
  const north = NORTH_CITIES.find((c) => c.name === home);
  if (north && NORTH[north.id] !== undefined) return NORTH_REGIONS[NORTH[north.id]!] ?? null;
  return null;
}
