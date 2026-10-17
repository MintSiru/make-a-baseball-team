import { k as __i18n_k } from '../i18n/index';
/* 통일 한국 (1.9.2, the 1.9 plan's third stage): the north's cities, clubs, schools and names. Game fiction: a league
   after a peaceful unification, told as a baseball story only. The rule for names (from the plan's 3rd edition): no
   real person, and a place whose name was given for a political figure goes by its name from before (김책 → 성진, a
   stadium named for a leader is not used at all); everything else is made up. Populations are the 2008 census
   (docs/RULES.md S84); markets and seats are the game's own estimates. */
import { rng } from '../draftroom';
import type { City } from '../club/cities';
import type { Player } from '../model/types';

/** The north's homes for a club. A new ballpark in each (game fiction), smaller where the city is. */
export const NORTH_CITIES: City[] = [
  { id: 'pyongyang', name: __i18n_k("league.north.text.8c71272a"), province: __i18n_k("league.north.text.8c71272a"), population: 2_581_000, stadium: { name: __i18n_k("league.north.text.a650dfd6"), seats: 18_000, real: false }, market: 76, competition: __i18n_k("league.north.text.44da6b02"), note: __i18n_k("league.north.text.b983782b") },
  { id: 'hamhung', name: __i18n_k("league.north.text.93064df0"), province: __i18n_k("league.north.text.6fdf4f5a"), population: 769_000, stadium: { name: __i18n_k("league.north.text.78b95b95"), seats: 14_000, real: false }, market: 58, competition: __i18n_k("league.north.text.d58fa73a"), note: __i18n_k("league.north.text.23d2cad6") },
  { id: 'chongjin', name: __i18n_k("league.north.text.44627941"), province: __i18n_k("league.north.text.cc7167d9"), population: 668_000, stadium: { name: __i18n_k("league.north.text.19dacaaa"), seats: 12_000, real: false }, market: 54, competition: __i18n_k("league.north.text.1e6df76f"), note: __i18n_k("league.north.text.7a57f2c8") },
  { id: 'kaesong', name: __i18n_k("league.north.text.42b11105"), province: __i18n_k("league.north.text.edbcbce4"), population: 308_000, stadium: { name: __i18n_k("league.north.text.f1c02980"), seats: 12_000, real: false }, market: 52, competition: __i18n_k("league.north.text.cb62cffa"), note: __i18n_k("league.north.text.f261557a") },
  { id: 'nampo', name: __i18n_k("league.north.text.40a80fb4"), province: __i18n_k("league.north.text.e2327ca4"), population: 366_000, stadium: { name: __i18n_k("league.north.text.6d9f0c85"), seats: 10_000, real: false }, market: 46, competition: __i18n_k("league.north.text.8a167a9b"), note: __i18n_k("league.north.text.9a2705fb") },
  { id: 'wonsan', name: __i18n_k("league.north.text.f264380b"), province: __i18n_k("league.north.text.2d3472a3"), population: 363_000, stadium: { name: __i18n_k("league.north.text.0dd81843"), seats: 10_000, real: false }, market: 45, competition: __i18n_k("league.north.text.d58fa73a"), note: __i18n_k("league.north.text.2dddeb68") },
  { id: 'sinuiju', name: __i18n_k("league.north.text.aa778c35"), province: __i18n_k("league.north.text.e180f15b"), population: 359_000, stadium: { name: __i18n_k("league.north.text.92ce5bdf"), seats: 10_000, real: false }, market: 43, competition: __i18n_k("league.north.text.d58fa73a"), note: __i18n_k("league.north.text.bb2a3780") },
  { id: 'sariwon', name: __i18n_k("league.north.text.6c3364e2"), province: __i18n_k("league.north.text.edbcbce4"), population: 308_000, stadium: { name: __i18n_k("league.north.text.bdd683c7"), seats: 8_000, real: false }, market: 38, competition: __i18n_k("league.north.text.5d371ccf"), note: __i18n_k("league.north.text.77d37f52") },
  { id: 'songjin', name: __i18n_k("league.north.text.11984fee"), province: __i18n_k("league.north.text.cc7167d9"), population: 207_000, stadium: { name: __i18n_k("league.north.text.f43e1b18"), seats: 7_000, real: false }, market: 28, competition: __i18n_k("league.north.text.d58fa73a"), note: __i18n_k("league.north.text.01c36ba2") },
];

export const northCityById = (id: string) => NORTH_CITIES.find((c) => c.id === id);
export const isNorthCity = (id: string | undefined) => !!id && NORTH_CITIES.some((c) => c.id === id);

/** The AI clubs' nicknames, colours and owners (fictional companies). */
export const NORTH_NICKNAMES = [__i18n_k("league.north.text.4bd0d648"), __i18n_k("league.north.text.1638474c"), __i18n_k("league.north.text.6b9d548f"), __i18n_k("league.north.text.508f5f0a"), __i18n_k("league.north.text.82f7bb68"), __i18n_k("league.north.text.0b21b962"), __i18n_k("league.north.text.986a7654"), __i18n_k("league.north.text.ebdf4f1b"), __i18n_k("league.north.text.189cc19d")];
export const NORTH_COLORS = ['#b71c1c', '#0d47a1', '#00695c', '#4a148c', '#e65100', '#1b5e20', '#37474f', '#ad1457', '#5d4037'];
export const NORTH_COMPANIES = [__i18n_k("league.north.text.d45fbb7c"), __i18n_k("league.north.text.5b499ab7"), __i18n_k("league.north.text.ae237fb0"), __i18n_k("league.north.text.df2dd167"), __i18n_k("league.north.text.38a5e8f0"), __i18n_k("league.north.text.0565f46c"), __i18n_k("league.north.text.393f57e2"), __i18n_k("league.north.text.a9b348c4"), __i18n_k("league.north.text.57a88266")];

/** The regions northern amateurs grow up in (1.9.3: seven, weighted by how many people live there), the towns they
    come from and their schools (all made up, no political names). */
export const NORTH_REGIONS = [__i18n_k("league.north.text.55051eea"), __i18n_k("league.north.text.e2327ca4"), __i18n_k("league.north.text.8fd755b9"), __i18n_k("league.north.text.4ff21820"), __i18n_k("league.north.text.6fdf4f5a"), __i18n_k("league.north.text.cc7167d9"), __i18n_k("league.north.text.fd242584")] as const;
const REGION_WEIGHT = [3, 2, 2, 2, 2, 1.5, 1];
/** 1.9.2's two regions, still on the players of a 1.9.2 game. */
export const NORTH_REGIONS_1_9_2 = [__i18n_k("league.north.text.3021b1cf"), __i18n_k("league.north.text.cade0157")] as const;
const NORTH_TOWNS: string[][] = [
  [__i18n_k("league.north.text.8c71272a"), __i18n_k("league.north.text.40a80fb4"), __i18n_k("league.north.text.a44dd090"), __i18n_k("league.north.text.3f990bdf"), __i18n_k("league.north.text.ffcdf1e4"), __i18n_k("league.north.text.74ad9595"), __i18n_k("league.north.text.758ba560"), __i18n_k("league.north.text.79f6f16a")],
  [__i18n_k("league.north.text.9ab745ec"), __i18n_k("league.north.text.1d78e09b"), __i18n_k("league.north.text.f9e005c2"), __i18n_k("league.north.text.dc7d5150"), __i18n_k("league.north.text.8a4fea60"), __i18n_k("league.north.text.b2475acc"), __i18n_k("league.north.text.d9278627")],
  [__i18n_k("league.north.text.aa778c35"), __i18n_k("league.north.text.a492454c"), __i18n_k("league.north.text.a0a7b7b4"), __i18n_k("league.north.text.2c677e09"), __i18n_k("league.north.text.42477cf6"), __i18n_k("league.north.text.f31e08f8"), __i18n_k("league.north.text.db2efe68"), __i18n_k("league.north.text.9e633686"), __i18n_k("league.north.text.989927bb")],
  [__i18n_k("league.north.text.178afbb6"), __i18n_k("league.north.text.6c3364e2"), __i18n_k("league.north.text.cd12819b"), __i18n_k("league.north.text.dc422070"), __i18n_k("league.north.text.c2ca9497"), __i18n_k("league.north.text.6cf81318"), __i18n_k("league.north.text.42b11105"), __i18n_k("league.north.text.e70cb18d"), __i18n_k("league.north.text.0d170e90")],
  [__i18n_k("league.north.text.93064df0"), __i18n_k("league.north.text.ba00457c"), __i18n_k("league.north.text.608b7ba8"), __i18n_k("league.north.text.c0a5da15"), __i18n_k("league.north.text.10a041c0"), __i18n_k("league.north.text.0f1a13a3"), __i18n_k("league.north.text.3fa79380"), __i18n_k("league.north.text.887b5d65")],
  [__i18n_k("league.north.text.44627941"), __i18n_k("league.north.text.a9371c39"), __i18n_k("league.north.text.c983de74"), __i18n_k("league.north.text.476d6526"), __i18n_k("league.north.text.8ae98176"), __i18n_k("league.north.text.a6e1abf9"), __i18n_k("league.north.text.729fe890"), __i18n_k("league.north.text.09220bb4"), __i18n_k("league.north.text.11984fee")],
  [__i18n_k("league.north.text.f264380b"), __i18n_k("league.north.text.55a16fbe"), __i18n_k("league.north.text.43e23c90"), __i18n_k("league.north.text.04236bbd"), __i18n_k("league.north.text.056ac19f"), __i18n_k("league.north.text.53e7ff26"), __i18n_k("league.north.text.45fbe848"), __i18n_k("league.north.text.aa748b61"), __i18n_k("league.north.text.68779414")],
];
const NORTH_HIGH_SCHOOLS: string[][] = [
  [__i18n_k("league.north.text.88b4d779"), __i18n_k("league.north.text.a35cb17d"), __i18n_k("league.north.text.b236a900"), __i18n_k("league.north.text.26e739be"), __i18n_k("league.north.text.344b7530"), __i18n_k("league.north.text.7d796f27"), __i18n_k("league.north.text.7ff600d8"), __i18n_k("league.north.text.94dd8d8d"), __i18n_k("league.north.text.e68d9cd9"), __i18n_k("league.north.text.6f54889b")],
  [__i18n_k("league.north.text.1da6dae9"), __i18n_k("league.north.text.3412f3c7"), __i18n_k("league.north.text.49b92c11"), __i18n_k("league.north.text.a9747a15"), __i18n_k("league.north.text.da4e743c"), __i18n_k("league.north.text.d688e69e"), __i18n_k("league.north.text.0901968d")],
  [__i18n_k("league.north.text.e3a2244a"), __i18n_k("league.north.text.281e4ea7"), __i18n_k("league.north.text.16fc51a9"), __i18n_k("league.north.text.8469cf1c"), __i18n_k("league.north.text.9c011fd4"), __i18n_k("league.north.text.dcdcf14e"), __i18n_k("league.north.text.7de0fcd7"), __i18n_k("league.north.text.f011e3f1")],
  [__i18n_k("league.north.text.61d57dec"), __i18n_k("league.north.text.dba3702c"), __i18n_k("league.north.text.a72eecb9"), __i18n_k("league.north.text.d366e08b"), __i18n_k("league.north.text.f2963271"), __i18n_k("league.north.text.fd9a64c9"), __i18n_k("league.north.text.1d52e7b2"), __i18n_k("league.north.text.725b6dbe"), __i18n_k("league.north.text.878d87e9"), __i18n_k("league.north.text.5fda0b7b")],
  [__i18n_k("league.north.text.cdcba86a"), __i18n_k("league.north.text.1f7b40a5"), __i18n_k("league.north.text.d68494e2"), __i18n_k("league.north.text.7026265a"), __i18n_k("league.north.text.f25d2e32"), __i18n_k("league.north.text.c56359c4"), __i18n_k("league.north.text.5f0a7f3e"), __i18n_k("league.north.text.40dde0a6"), __i18n_k("league.north.text.8e01189f")],
  [__i18n_k("league.north.text.65d98dca"), __i18n_k("league.north.text.7aa3fe24"), __i18n_k("league.north.text.2f3d80e2"), __i18n_k("league.north.text.51322e16"), __i18n_k("league.north.text.700e6c88"), __i18n_k("league.north.text.2efdd5a8"), __i18n_k("league.north.text.c01dd042"), __i18n_k("league.north.text.da66cfe1")],
  [__i18n_k("league.north.text.018f0c4d"), __i18n_k("league.north.text.a0c594a6"), __i18n_k("league.north.text.f88efd4f"), __i18n_k("league.north.text.93863434"), __i18n_k("league.north.text.d7a2056d"), __i18n_k("league.north.text.7d79e9b3"), __i18n_k("league.north.text.05adafef")],
];
const NORTH_COLLEGES = [__i18n_k("league.north.text.9f01a2e6"), __i18n_k("league.north.text.3b6d0ace"), __i18n_k("league.north.text.be237d6b"), __i18n_k("league.north.text.060b4802"), __i18n_k("league.north.text.47eca877"), __i18n_k("league.north.text.267f7ad2"), __i18n_k("league.north.text.4112652f"), __i18n_k("league.north.text.47f00a04"), __i18n_k("league.north.text.34ef952c"), __i18n_k("league.north.text.63f09dd6"), __i18n_k("league.north.text.1095cebc"), __i18n_k("league.north.text.e2afc564"), __i18n_k("league.north.text.e95732b4"), __i18n_k("league.north.text.d089c362"), __i18n_k("league.north.text.d01266a4"), __i18n_k("league.north.text.3fd7d397")];

/** Surnames as the north writes them (no initial-sound rule), for the ones that differ. */
const NORTH_SURNAME: Record<string, string> = Object.fromEntries('이리 임림 유류 노로 양량 나라 여려 염렴 용룡 육륙'.split(' ').map((x) => [x[0]!, x[1]!]));
/** Given names common in the north (men): no leader's or his family's name among them (1.9.3: about 150). */
const NORTH_GIVEN = '철진 성철 영철 광혁 명철 은철 혁철 일남 정혁 광철 국철 성룡 진혁 철룡 명일 춘일 학철 경철 영남 광명 일혁 성혁 은혁 금철 충혁 룡철 철수 명수 성국 광일 진철 영호 경일 혁남 명혁 철호 광남 일철 성진 남혁 충성 강철 혁진 룡남 은성 광진 철웅 명남 영혁 국혁 경호 경남 금성 기철 남철 대혁 동혁 동철 룡수 룡일 명길 명국 문혁 범철 봉철 상혁 상철 석진 성길 성남 성일 송철 수남 수혁 순철 승혁 승철 원철 영길 영수 영일 영진 용남 용수 용철 운철 웅철 원혁 윤혁 은남 의철 인철 인혁 일룡 장혁 재혁 정룡 종혁 주혁 주성 준철 진국 진남 진성 창혁 창일 창호 천명 천혁 춘혁 충남 충일 태혁 태성 학남 학진 한철 해철 현철 현혁 홍철 효철 흥철 대성 진명 상룡 광룡 국진 금혁 위혁 송혁 덕철 덕수 만철 명호 문철 복남 봉남 세혁 세철 철민 철준 혁민 경수 광수 금룡 남수 동일 룡진 명성 성호 일진 청송 춘남 학룡'.split(' ');

/** Two-letter surnames (the rest are one letter). */
const TWO_LETTER = '남궁 황보 제갈 선우 독고 사공 서문 동방'.split(' ');

const pick = <T>(xs: readonly T[], r: () => number) => xs[Math.floor(r() * xs.length)]!;
/** An index drawn by weight. */
function weighted(w: readonly number[], r: () => number): number {
  let x = r() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) if ((x -= w[i]!) < 0) return i;
  return w.length - 1;
}

/** A northern name for a player born in the north: the north's spelling of his surname and a northern given name. */
export function northName(name: string, r: () => number, used: Set<string>): string {
  for (const len of [2, 1]) {
    const sur = name.slice(0, len);
    if (len === 2 && !TWO_LETTER.includes(sur)) continue;
    for (let i = 0; i < 40; i++) {
      const out = (NORTH_SURNAME[sur] ?? sur) + pick(NORTH_GIVEN, r);
      if (!used.has(out)) {
        used.add(out);
        return out;
      }
    }
  }
  return name;
}

/** Remakes a prospect as one who grew up in the north: his region, town, school (same kind of school) and name. */
export function makeNorthern(p: Player, seed: string, used: Set<string>): Player {
  const r = rng(`${seed}|north|${p.id}`);
  const ri = weighted(REGION_WEIGHT, r);
  const region = NORTH_REGIONS[ri]!;
  const town = pick(NORTH_TOWNS[ri]!, r);
  const old = p.education.school;
  const college = p.origin.entryCategory === 'college';
  const school = college ? pick(NORTH_COLLEGES, r) : pick(NORTH_HIGH_SCHOOLS[ri]!, r);
  const swap = (text: string) => (old ? text.split(old).join(school) : text);
  return {
    ...p,
    name: northName(p.name, r, used),
    birthplace: town,
    education: {
      ...p.education,
      region,
      school,
      pathText: swap(p.education.pathText),
      history: p.education.history.map((h) => JSON.parse(swap(JSON.stringify(h)))),
    },
  };
}
