/* 1.9.6: names by birth decade, for a league that plays the KBO's own history (the 1982 legacy start). The draft
   generator's given names (draftroom/names.js) are today's (민준, 서준, 도윤); a player born in 1958 is more likely
   an 영수 or a 상철. Each decade's list is a game list in the spirit of the court's birth-registration rankings
   (영수·영호·영식 in the 1950s, 영수·영철·성호 in the 1960s, 정훈 in the 1970s, 지훈 in the 1980s, 정훈·성호·지훈·동현
   in the 1990s: RULES.md S109), with no given name tied to one famous player of the time. A player born near a
   decade's turn draws from either side; one born 2000 on keeps the generator's name. The surname stays. Only a
   game that plays history uses these (every other game keeps its names, and its results). */
import { rng } from '../draftroom';

/** Given names of men born in each decade: the common ones (drawn three times as often), then the rest. */
const DECADES: { from: number; common: string; rest: string }[] = [
  {
    from: 1950,
    common: '영수 영호 영식 영철 정수 정호 상철 성수 광수 종수 용수 재호 병철 성호 정남 순철 동수 진호 명수 철수',
    rest: '영길 영일 영남 영배 영환 정식 정길 정웅 상호 상수 상국 성태 광호 종호 용호 용석 용철 재석 재수 병수 병호 동원 동진 진수 명철 춘식 기철 기호 기석 만수 봉수 봉근 경수 경호 인호 인수 대식 대진 원식 원호 태식 태호 학수 덕수 문수 창수 길수 한수 형석 홍식 희수 무남 수철 석규 진국 승호 준식 갑수 규식 남수 근수 정배 해수 우석',
  },
  {
    from: 1960,
    common: '영수 영철 영호 성호 성수 정호 종호 상호 진호 재호 성훈 정훈 상훈 경수 정수 상철 병철 승호 용호 성진',
    rest: '영훈 영민 성철 성일 성우 성욱 성규 정일 정환 정석 정민 종훈 종규 상민 상우 상욱 상규 진수 재훈 재석 재영 재웅 동훈 동철 동일 동욱 동환 경환 경문 승환 용수 기호 기태 기석 태호 태성 민호 준호 명수 명석 광수 인수 대성 형석 순철 진우 철호 문규 덕근 병규 영조 창호 석진 일호 윤호 정길 한규 근호',
  },
  {
    from: 1970,
    common: '정훈 성훈 지훈 상훈 동훈 재훈 성민 정민 준호 성호 재호 민호 성진 현철 동현 성현 재현 상현 정우 민수',
    rest: '영훈 상민 재민 동민 종민 진호 영호 성철 상철 영철 정현 준혁 성준 상우 현우 성수 진수 경수 재석 성욱 동욱 진욱 승현 경환 정환 병규 동주 진영 경완 재원 동원 성원 용준 기현 윤석 형준 종국 상진 재성 현수 대진 성용 상문 종석 원석 성규 대성 정근 준석 민철 태진 홍석 기훈 세훈 태훈 윤호 상욱 진성 인석',
  },
  {
    from: 1980,
    common: '지훈 성민 현우 준호 동현 민수 성현 정훈 상훈 준영 성훈 상현 재현 준혁 승현 재훈 진우 현준 성진 민석',
    rest: '상민 종민 재민 태현 영민 진호 성우 동욱 재웅 우진 민호 경민 태훈 상우 정민 준석 현석 현수 정근 병호 석민 원석 민우 지환 승환 동건 성환 진혁 민규 재영 형우 병현 태양 용준 상진 대현 경훈 현진 승민 재원 정우 동민 영훈 은성 재성 희성 정현 수현 주현 태호 준희 인성 승우',
  },
  {
    from: 1990,
    common: '동현 지훈 현우 준호 민수 성민 준영 승현 민재 상현 민혁 태현 지민 승민 성현 재현 우진 현준 정민 민규',
    rest: '준혁 건우 동민 진우 준수 승우 재민 지환 도현 동건 원준 건희 재원 성범 영준 세웅 정우 우석 상우 민성 승훈 준형 재윤 태윤 동욱 시환 민석 경민 형준 현수 진혁 주환 재혁 승호 상훈 성훈 대현 영민 태훈 지원 주원 동훈 민호 재훈 영현 수민 한결 윤성 태영 현종 석민 동규',
  },
];

const split = (x: string) => x.split(' ');
const LISTS = DECADES.map((d) => ({ from: d.from, names: [...split(d.common), ...split(d.common), ...split(d.common), ...split(d.rest)] }));

/** Every given name the lists hold (for the name tables, i18n). */
export const ERA_GIVEN_NAMES = [...new Set(DECADES.flatMap((d) => [...split(d.common), ...split(d.rest)]))];

/** Two-letter surnames (the rest are one letter). */
const TWO_LETTER = '남궁 황보 제갈 선우 독고 사공 서문 동방'.split(' ');
export const surnameOf = (name: string) => (name.length >= 3 && TWO_LETTER.includes(name.slice(0, 2)) ? name.slice(0, 2) : name.slice(0, 1));

/** The decade list a player born in `year` draws from: each list centred on its decade's middle, a year between two
    centres going to either by how near it is; null for the generator's own (born about 2000 on). */
export function eraList(year: number, u: number): readonly string[] | null {
  const t = Math.max(0, (year - (LISTS[0]!.from + 5)) / 10);
  const i = Math.floor(t);
  const k = u < t - i ? i + 1 : i;
  return LISTS[k]?.names ?? null;
}

/** The name of a man born in `birthYear` under this surname, or the one he has when his decade keeps today's names
    (or no free name is found). `used` holds the names taken (the new one is added). */
export function eraName(name: string, birthYear: number, key: string, used: Set<string>): string {
  const r = rng(`${key}|eraname`);
  const list = eraList(birthYear, r());
  if (!list) return name;
  const sur = surnameOf(name);
  for (let i = 0; i < 30; i++) {
    const given = list[Math.floor(r() * list.length)]!;
    if (given[0] === sur.at(-1)) continue;
    const out = sur + given;
    if (out === name || !used.has(out)) {
      used.add(out);
      return out;
    }
  }
  return name;
}
