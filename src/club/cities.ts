/* Candidate homes for the expansion club. Population is the 2022-11 resident count (Korean Wikipedia
   city list), stadium seats are real (docs/RULES.md §10), and the cities are the ones actually
   bidding for an 11th club or a futures club in 2026 (RULES.md §12). `market` (0–100) and
   `competition` are the game's own estimates of catchment and nearby clubs. */

export interface City {
  id: string;
  name: string;
  province: string;
  population: number;
  /** Existing stadium the club can use at once; `null` seats means a temporary ground (game assumption). */
  stadium: { name: string; seats: number; real: boolean };
  market: number;
  competition: string;
  note: string;
}

export const CITIES: City[] = [
  { id: 'ulsan', name: '울산', province: '울산광역시', population: 1_135_423, stadium: { name: '울산문수야구장', seats: 12_088, real: true }, market: 80, competition: '부산 롯데와 가깝지만 광역시 단독 시장', note: '2026 퓨처스리그 시민구단 울산 웨일즈의 연고지' },
  { id: 'goyang', name: '고양', province: '경기도', population: 1_045_497, stadium: { name: '고양 국가대표 야구훈련장', seats: 7_000, real: false }, market: 72, competition: '서울 3개 구단과 수도권을 나눔', note: '키움 퓨처스(고양 히어로즈) 훈련장. 좌석 수는 게임 가정' },
  { id: 'cheongju', name: '청주', province: '충청북도', population: 855_326, stadium: { name: '청주야구장', seats: 10_500, real: true }, market: 70, competition: '대전 한화와 충청권을 나눔', note: '충북 돔구장·프로구단 유치 공약(2026 지방선거)' },
  { id: 'seongnam', name: '성남', province: '경기도', population: 922_025, stadium: { name: '성남 임시 구장', seats: 7_000, real: false }, market: 66, competition: '서울·수원 구단과 가까움', note: '종합운동장 리모델링·돔구장 유치 공약. 야구장이 없어 임시 구장(게임 가정)' },
  { id: 'jeonju', name: '전주', province: '전북특별자치도', population: 666_517, stadium: { name: '전주 임시 구장', seats: 7_000, real: false }, market: 64, competition: '전북에 연고 구단이 없음 (쌍방울 레이더스 이후)', note: '신축 야구장 2027년 말 완공 예정(규모 미확인). 그 전까지 임시 구장(게임 가정)' },
  { id: 'hwaseong', name: '화성', province: '경기도', population: 880_859, stadium: { name: '화성 임시 구장', seats: 7_000, real: false }, market: 60, competition: '수원 KT와 가까움', note: '프로구단 유치 추진. 임시 구장(게임 가정)' },
  { id: 'cheonan', name: '천안', province: '충청남도', population: 682_199, stadium: { name: '천안 임시 구장', seats: 7_000, real: false }, market: 56, competition: '대전 한화와 가까움', note: '임시 구장(게임 가정)' },
  { id: 'pohang', name: '포항', province: '경상북도', population: 501_109, stadium: { name: '포항야구장', seats: 12_247, real: true }, market: 46, competition: '대구 삼성의 제2 홈구장', note: '' },
  { id: 'jeju', name: '제주', province: '제주특별자치도', population: 492_306, stadium: { name: '제주오라종합경기장 야구장', seats: 8_500, real: true }, market: 42, competition: '경쟁 구단 없음, 원정 이동 부담', note: '' },
  { id: 'gunsan', name: '군산', province: '전북특별자치도', population: 269_023, stadium: { name: '월명종합경기장 야구장', seats: 11_000, real: true }, market: 34, competition: '전북 야구 열기(군산상일고)', note: 'KIA 제2 홈구장' },
  { id: 'chuncheon', name: '춘천', province: '강원특별자치도', population: 284_645, stadium: { name: '의암야구장', seats: 8_160, real: true }, market: 32, competition: '강원에 연고 구단 없음', note: '' },
];

export const cityById = (id: string) => CITIES.find((c) => c.id === id);
