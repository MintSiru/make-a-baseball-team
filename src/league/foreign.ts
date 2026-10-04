/* Foreign players: nationalities, names, where they played before, and what they ask for.

   Names are common given/family names put together at random and written the way KBO rosters spell
   them (every name is fictional). A background decides a small ability shift and the asking price:
   an MLB regular asks the most, an independent-league player the least but is the hardest to read.
   Money here is in US dollars; contracts convert at MANWON_PER_USD (contracts.ts). */
import type { ForeignLevel } from '../model/types';

const split = (s: string) => s.trim().split(/\s+/);

export const NAMES = {
  west: {
    given: split(`제이크 라이언 카일 브랜든 타일러 코디 딜런 에릭 케빈 저스틴 조던 마이클 알렉스 대니얼 트레버 오스틴 네이선 숀 콜 잭 매트 루크 헌터 체이스 가렛
      앤드루 브래들리 케이시 데릭 드루 에반 개빈 그랜트 이언 제임스 재러드 제시 조시 키건 로건 메이슨 닉 패트릭 리드 로비 스콧 스펜서 스티븐 테일러 토머스
      트래비스 웨스 윌 잭슨 브렛 채드 클레이 데인 에이든 파커 헨리 노아 벤 샘 브룩스 코너 데빈 칼렙 캠 마커스 앤서니 브라이스 제이슨 조나단 마일스 오언
      애런 애덤 앨런 앤디 바비 블레이크 보 브래디 브랜트 브록 버크 캘빈 카터 찰리 크리스 콜튼 코리 크레이그 대런 데이비드 딘 더스틴 에디 엘리
      에밋 프랭키 개럿 게이브 그레그 그리핀 헤이든 이선 제드 제프 조이 조엘 키스 켄들 랜스 리오 루이 맥스 미치 넬슨 올리버 피트 퀸 랜디 레지
      라일리 로스 러셀 세스 셰인 스티브 태너 토드 토미 트로이 타이 밴스 웨이드 와이엇 잭 제이든 로니 레이 랜던 쿠퍼 휘트 브렌트`),
    family: split(`밀러 존슨 윌리엄스 브라운 데이비스 윌슨 테일러 앤더슨 토머스 무어 마틴 잭슨 톰프슨 화이트 해리스 클라크 워커 홀 영 앨런 라이트 킹 스콧 그린 베이커
      애덤스 넬슨 캠벨 파커 에번스 에드워즈 콜린스 스튜어트 모리스 머피 쿡 로저스 모건 쿠퍼 피터슨 리드 베일리 벨 켈리 하워드 워드 콕스 리처드슨 우드 왓슨
      브룩스 베넷 그레이 헤이스 마이어스 포드 해밀턴 그레이엄 설리번 월리스 웨스트 로스 헨더슨 콜먼 젱킨스 페리 파월 롱 패터슨 휴스 플린 스틸 라일리 로웰
      맥그리거 오닐 맥도널드 가드너 케인 하퍼 도슨 슐츠 크루거 피셔 호프먼 바우어 레이놀즈 버크 브래디 오코너 해리슨 반스 매슈스 러셀 그리핀 스톤 웰스
      앤드루스 아널드 볼드윈 바넷 배리 베켓 블랙번 보이드 브래드쇼 브레넌 버넷 캘러핸 카펜터 체임버스 크로퍼드 커닝햄 대니얼스 디킨슨 도너번 더피
      엘리엇 패럴 플레처 프랭클린 갤러거 길버트 골드슈미트 그레이브스 해거티 해먼드 해닝 하딩 하트먼 헤인스 히긴스 홀랜드 허드슨 잉그럼 제이컵스
      키팅 켈러 킴브럴 코넬 랭퍼드 로런스 린드블럼 매덕스 맥과이어 맥케이 머서 메릴 몬테로소 무니 노박 오슬런드 페냐 퍼킨스 피어스 포터 퀸런
      래미지 랭킨 리스 로빈슨 로슨 샌더스 슈미트 슬레이터 스나이더 스펜스 스탠턴 스토크스 설리 테일러슨 톰린 터너 밴더빌트 왓킨스 웨버 휘틀리
      윌커슨 윈터스 요크 지머먼 코발스키 노보트니 페트로비치 라르손 닐슨 한센 베르크 브루노 로시 페라리 루카 마르티니 콜롬보 비앙키 리치`),
  },
  latin: {
    given: split(`호세 카를로스 미겔 라파엘 안드레스 헥터 루이스 후안 페드로 라몬 에두아르도 프란시스코 호르헤 다니엘 알베르토 마누엘 헤수스 라울 로베르토
      리카르도 세르히오 빅토르 윌리 엔리케 오스왈도 넬슨 요한 엘비스 프레디 헤르손 아롤디스 앙헬 요르단 에딘손 레난 알렉산데르 크리스티안 로날드 호엘 윌머
      헤레미 다니 에우헤니오 가브리엘 이반 하비에르 오마르 파블로 사무엘 테오스카르 요안 욘데르 케텔 브라이안 윌손
      아드리안 알비스 아메드 안토니오 아리스티데스 베니토 브라이스 세사르 다닐로 다리엘 데이비 디에고 엔데르 에스테반 펠릭스 페르난도 그레고리
      기예르모 하이로 호안 후니오르 레오넬 로렌소 마르셀 마르코 마우리시오 닐로 오를란도 라미로 레이날도 로헬리오 산티아고 세바스티안 토니
      우마르 비니시오 윌프레도 야스마니 율리에스키 지오반니 헤수스 엘리아스 루르데스 마이켈 오닐 프랭클린 아로센 에우리 길레르모 로우르데스`),
    family: split(`로드리게스 곤잘레스 에르난데스 페레스 산체스 라미레스 토레스 플로레스 리베라 고메스 크루스 모랄레스 오르티스 레예스 메디나 디아스 마르티네스
      로페스 가르시아 히메네스 카스티요 바르가스 멘도사 게레로 알바레스 로하스 에스피날 폰세 수아레스 카브레라 벨라스케스 소토 누녜스 아코스타 발데스
      파디야 오르테가 세구라 카스트로 마르테 데헤수스 알몬테 테하다 베탄세스 피네다 모야 비야르 우레냐 파레데스 아브레우 콘트레라스 에스코바르 몬테로
      아길라르 알폰소 아라에스 바르보사 벨트란 카브레라 칼데론 카라스코 세스페데스 시스네로스 도밍게스 두란 에스트라다 파하르도 가예고스 기옌 구스만
      이글레시아스 라라 레온 루고 마차도 말도나도 마르케스 메히아 미란다 나바로 오수나 팔라시오스 파체코 퀸테로 라모스 렌기포 로블레스 로사리오
      살라사르 세라노 시에라 솔라노 수베로 타피아 토바르 우리아스 바예 비스카이노 사모라 아스투디요 페냐 디아스 그리할바 아로요 알카라`),
  },
  /** Curaçao, Aruba and the Netherlands (V0.12). */
  dutch: {
    given: split(`주릭슨 디디 잰더 켄리 안드렐톤 셰들런 체드윅 레이마르 저메인 시드니 롤런드 웬델 듀레인 커트니 엘리아스 레인델 엘리셔 라이언 주니어 랜디
      샤를로 지오바니 레이믈 장데르 시더릭 로저 하이트 에드윈 저스틴 다샤 브랜던 레나르트 웨슬리 케빈 데니스`),
    family: split(`시몬스 그레고리우스 보하르츠 얀선 스홉 프로파르 오두버르 마르티스 레이스 플로렌시아 판헤이스 페르보르트 데용 판데르베르 코르넬리아 하위스만
      마르티나 베르나디나 리엘스 알벤토사 존스 발렌티나 세실리아 콜로니아 판다이크 바커르 펠트하위스 메이르 스밋 페이터르스`),
  },
  /** Brazil (V0.12). */
  brazil: {
    given: split('치아구 루카스 가브리에우 마테우스 이고르 하파에우 레오나르두 에리키 브루누 지에구 비토르 다니에우 엔히키 펠리피 안드레 조나탕 무릴루 오타비우 파울루 히카르두'),
    family: split('비에이라 실바 산투스 올리베이라 소자 페헤이라 코스타 히베이루 알메이다 카르발류 고메스 마르칭스 아라우주 바르보자 핀투 모레이라 카바우칸치 멘지스'),
  },
  japan: {
    given: split(`쇼타 다이키 유토 가이토 료 하야토 겐타 소마 다쿠야 유마 렌 하루토 고헤이 쇼 겐지 슌스케 료타 다이치 유키 아쓰시 가즈키 류세이 신야 도모야 히로토
      마사키 준 게이타 요시키 다이스케 고키 소타 하루키 나오키 유다이 아키라 다케루 쓰바사 고타 신노스케 유스케 히데키 가쓰야 마코토 다이고 쇼헤이
      류타 고이치 와타루 다쓰야 히로키 겐토 슈토 아유무 요시노부`),
    family: split(`다나카 사토 스즈키 다카하시 와타나베 이토 야마모토 나카무라 고바야시 가토 요시다 야마다 마쓰모토 이노우에 기무라 하야시 사이토 시미즈 야마구치 모리
      이케다 하시모토 아베 이시카와 오가와 마에다 후지타 오카다 곤도 무라카미 엔도 아오키 사카모토 니시무라 후쿠다 오타 미우라 후지이 오카모토 마쓰다
      나카지마 나카가와 하라다 오노 다무라 다케우치 가네코 와다 나카노 이시이 우에다 모리타 하라 시바타 사카이 구도 요코야마 미야자키 미야모토 오시마`),
  },
  taiwan: {
    given: split('즈웨이 위안 하오 청 쥔 이팅 원제 자하오 웨이룬 쯔캉 청위 보원 유싱 옌팅 즈하오 궈화 젠밍 톈위 자오위 쥔제 보쉬안 이항 핀하오 웨이제 성허 둥린 자웨이 쿤이'),
    family: split('린 천 황 장 리우 우 차이 양 왕 셰 궈 쩡 쑤 저우 뤄 쉬 정 훙 쩡 랴오 판 펑 뤼 쑹 리 주 예'),
  },
};

type Pool = keyof typeof NAMES;

/** Nationality for a regular foreign player: mostly American, then the Caribbean and Latin America. */
const REGULAR_NATIONS: [string, number, Pool][] = [
  ['미국', 0.52, 'west'],
  ['도미니카공화국', 0.15, 'latin'],
  ['베네수엘라', 0.1, 'latin'],
  ['쿠바', 0.04, 'latin'],
  ['멕시코', 0.04, 'latin'],
  ['푸에르토리코', 0.03, 'latin'],
  ['캐나다', 0.03, 'west'],
  ['파나마', 0.02, 'latin'],
  ['콜롬비아', 0.02, 'latin'],
  // V0.12: the rest of the baseball world sends a few.
  ['퀴라소', 0.02, 'dutch'],
  ['니카라과', 0.01, 'latin'],
  ['네덜란드', 0.01, 'dutch'],
  ['브라질', 0.01, 'brazil'],
];

const pick = <T>(xs: readonly T[], r: () => number) => xs[Math.floor(r() * xs.length)]!;
function weighted<T extends [string, number, ...unknown[]]>(rows: T[], r: () => number): T {
  let x = r();
  for (const row of rows) if ((x -= row[1]) < 0) return row;
  return rows[rows.length - 1]!;
}

export function foreignName(pool: Pool, r: () => number): string {
  const n = NAMES[pool];
  if (pool === 'taiwan') return `${pick(n.family, r)}${pick(n.given, r)}`;
  // Japanese names keep their own order in Korean (V0.12): family name first, as 시라카와 게이쇼.
  if (pool === 'japan') return `${pick(n.family, r)} ${pick(n.given, r)}`;
  // Some Latin American players go by two given names.
  const given = pool === 'latin' && r() < 0.15 ? `${pick(n.given, r)} ${pick(n.given, r)}` : pick(n.given, r);
  let family = pick(n.family, r);
  while (given.split(' ').includes(family)) family = pick(n.family, r);
  // A son named for his father (V0.12): the KBO writes it out, as with 멜 로하스 주니어.
  const junior = (pool === 'west' || pool === 'latin' || pool === 'dutch') && r() < 0.04 ? ' 주니어' : '';
  return `${given} ${family}${junior}`;
}

export interface Background {
  level: ForeignLevel;
  nationality: string;
  pool: Pool;
  /** Ability shift (grade points) and extra spread from the background. */
  shift: number;
  spread: number;
  /** Price adjustment in US dollars. */
  premium: number;
}

const REGULAR_LEVELS: [ForeignLevel, number, number, number, number][] = [
  // level, share, shift, spread, premium
  ['mlb', 0.12, 3, 0, 180_000],
  ['mlbCup', 0.45, 0, 0, 40_000],
  ['aaa', 0.25, -1, 0, -40_000],
  ['npb', 0.08, 1, 0, 60_000],
  ['indie', 0.1, -3, 5, -200_000],
];
const ASIA_LEVELS: [ForeignLevel, number, number, number, number, string, Pool][] = [
  ['npb', 0.35, 1, 0, 30_000, '일본', 'japan'],
  ['npbFarm', 0.2, -1, 1, -10_000, '일본', 'japan'],
  ['jpIndie', 0.15, -3, 5, -50_000, '일본', 'japan'],
  ['cpbl', 0.15, 0, 0, 0, '대만', 'taiwan'],
  ['abl', 0.15, -1, 1, -20_000, '호주', 'west'],
];

export function background(asiaQuota: boolean, r: () => number): Background {
  if (asiaQuota) {
    const [level, , shift, spread, premium, nationality, pool] = weighted(ASIA_LEVELS, r);
    return { level, nationality, pool, shift, spread, premium };
  }
  const [level, , shift, spread, premium] = weighted(REGULAR_LEVELS, r);
  const [nationality, , pool] = level === 'npb' && r() < 0.2 ? (['미국', 0, 'west'] as [string, number, Pool]) : weighted(REGULAR_NATIONS, r);
  return { level, nationality, pool, shift, spread, premium };
}

const fmt3 = (x: number) => x.toFixed(3).replace(/^0/, '');

/** A line about where he played, e.g. "MLB 3시즌 142경기 타율 .231 12홈런 · 트리플A 5시즌". */
export function careerText(level: ForeignLevel, pitcher: boolean, age: number, grade: number, r: () => number): string {
  const years = Math.max(1, Math.min(age - 20, 3 + Math.floor(r() * 6)));
  const mlbLine = (seasons: number, games: number) => {
    if (pitcher) {
      const w = Math.floor(games * (0.05 + r() * 0.1)),
        l = Math.floor(games * (0.06 + r() * 0.1));
      const eraV = 4.3 + (55 - grade) * 0.08 + r() * 1.2;
      return `MLB ${seasons}시즌 ${games}경기 ${w}승 ${l}패 평균자책점 ${eraV.toFixed(2)}`;
    }
    const avgV = 0.215 + (grade - 50) * 0.003 + r() * 0.03;
    const hr = Math.round(games * (0.02 + (grade - 50) * 0.004 + r() * 0.02));
    return `MLB ${seasons}시즌 ${games}경기 타율 ${fmt3(avgV)} ${Math.max(0, hr)}홈런`;
  };
  switch (level) {
    case 'mlb': {
      const seasons = 3 + Math.floor(r() * 5);
      return mlbLine(seasons, pitcher ? 60 + Math.floor(r() * 140) : 200 + Math.floor(r() * 450));
    }
    case 'mlbCup': {
      const seasons = 1 + Math.floor(r() * 3);
      return `${mlbLine(seasons, pitcher ? 5 + Math.floor(r() * 45) : 10 + Math.floor(r() * 110))} · 트리플A ${years}시즌`;
    }
    case 'aaa':
      return `트리플A ${years}시즌 · MLB 경력 없음`;
    case 'npb':
      return `일본 NPB ${Math.min(years, 5)}시즌 1군 ${pitcher ? 15 + Math.floor(r() * 70) : 40 + Math.floor(r() * 200)}경기`;
    case 'npbFarm':
      return `일본 NPB ${Math.min(years, 5)}시즌, 주로 2군 (1군 ${Math.floor(r() * 20)}경기)`;
    case 'jpIndie':
      return `일본 독립리그 ${Math.min(years, 4)}시즌`;
    case 'cpbl':
      return `대만 CPBL ${Math.min(years, 6)}시즌`;
    case 'abl':
      return `호주 ABL ${Math.min(years, 6)}시즌`;
    case 'indie':
      return `미국 독립리그 ${Math.min(years, 4)}시즌${r() < 0.5 ? ` · 트리플A ${1 + Math.floor(r() * 2)}시즌` : ''}`;
  }
}

export const LEVEL_LABELS: Record<ForeignLevel, string> = {
  mlb: 'MLB',
  mlbCup: 'MLB·트리플A',
  aaa: '트리플A',
  npb: 'NPB',
  npbFarm: 'NPB 2군',
  jpIndie: '일본 독립리그',
  cpbl: 'CPBL',
  abl: 'ABL',
  indie: '미국 독립리그',
};

/** What a new foreign player asks for in total (US dollars): grade and background, under the caps (RULES.md §5). */
export function foreignAsk(grade: number, asiaQuota: boolean, premium: number, r: () => number): number {
  const round = (n: number) => Math.round(n / 10_000) * 10_000;
  if (asiaQuota) return round(Math.max(70_000, Math.min(200_000, 90_000 + (grade - 45) * 5_000 + premium + r() * 30_000)));
  return round(Math.max(300_000, Math.min(1_000_000, 450_000 + (grade - 50) * 45_000 + premium + r() * 80_000)));
}

/** Guaranteed signing bonus and salary plus performance options, summing to `total` (new signings). */
export function splitContract(total: number, r: () => number): { bonus: number; salary: number; options: number } {
  const round = (n: number) => Math.round(n / 10_000) * 10_000;
  const bonus = round(total * (0.1 + r() * 0.15));
  const options = round(total * r() * 0.2);
  return { bonus, salary: total - bonus - options, options };
}

/** US dollars the way Korean baseball news writes them: "85만 달러", "120만 달러". */
export const usd = (n: number) => `${(Math.round(n / 1000) / 10).toLocaleString('ko-KR')}만 달러`;
