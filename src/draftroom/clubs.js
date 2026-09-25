/* The ten KBO clubs. Club names are real; every rating and record here is fictional.
   `rank` is the fictional previous-season finish and sets the draft order (worst first).
   `needs` lists the three priority positions, most urgent first. */
// Ported from KBO-Draft-Room df4faad src/core/clubs.js. See docs/UPSTREAM.md.

// prettier-ignore
const TEAMS = [
  {id: 'kiwoom', name: '키움 히어로즈', short: '키움', color: '#821734', rank: 10, region: '서울', needs: ['SP', 'C', 'OF'],
    strong: '젊은 야수진 · 빠른 발', weak: '선발 이닝 · 차세대 포수', goal: '미래의 주축이 될 유망주를 확보해야 합니다.', record: '48승 94패 2무'},
  {id: 'nc', name: 'NC 다이노스', short: 'NC', color: '#255581', rank: 9, region: '경남', needs: ['RP', 'IF', 'SP'],
    strong: '중심 타선 · 외야 수비', weak: '불펜 뎁스 · 내야 세대교체', goal: '불펜을 두껍게 하고 내야의 미래를 준비해야 합니다.', record: '58승 84패 2무'},
  {id: 'hanwha', name: '한화 이글스', short: '한화', color: '#d9541f', rank: 8, region: '대전·충청·전북', needs: ['OF', 'C', 'IF'],
    strong: '강속구 투수진', weak: '외야 공격력 · 포수 뎁스', goal: '투수진을 뒷받침할 야수를 찾아야 합니다.', record: '62승 79패 3무'},
  {id: 'lotte', name: '롯데 자이언츠', short: '롯데', color: '#bf293d', rank: 7, region: '부산·울산', needs: ['SP', 'RP', 'C'],
    strong: '콘택트 · 기동력', weak: '선발 안정감 · 불펜 소모', goal: '마운드에 새 힘을 불어넣어야 합니다.', record: '66승 76패 2무'},
  {id: 'ssg', name: 'SSG 랜더스', short: 'SSG', color: '#b8243a', rank: 6, region: '인천', needs: ['IF', 'SP', 'OF'],
    strong: '장타력 · 베테랑 경험', weak: '내야 고령화 · 선발 유망주', goal: '다음 세대의 센터라인을 준비해야 합니다.', record: '69승 72패 3무'},
  {id: 'kt', name: 'KT 위즈', short: 'KT', color: '#343b48', rank: 5, region: '경기·강원', needs: ['C', 'RP', 'OF'],
    strong: '선발 로테이션 · 경기 운영', weak: '후계 포수 · 좌완 불펜', goal: '바로 기여할 자원과 후계 포수를 확보해야 합니다.', record: '73승 68패 3무'},
  {id: 'doosan', name: '두산 베어스', short: '두산', color: '#243556', rank: 4, region: '서울', needs: ['SP', 'IF', 'RP'],
    strong: '내야 수비 · 주루', weak: '차세대 에이스 · 내야 공격력', goal: '수비를 믿고 성장할 투수와 내야수를 찾아야 합니다.', record: '76승 65패 3무'},
  {id: 'lg', name: 'LG 트윈스', short: 'LG', color: '#a51f4f', rank: 3, region: '서울', needs: ['RP', 'C', 'SP'],
    strong: '타선의 깊이 · 외야진', weak: '승리조 피로 · 포수 후계자', goal: '우승 경쟁을 이어갈 즉시전력을 확보해야 합니다.', record: '80승 61패 3무'},
  {id: 'samsung', name: '삼성 라이온즈', short: '삼성', color: '#2865b7', rank: 2, region: '대구·경북', needs: ['RP', 'OF', 'IF'],
    strong: '거포 유망주 · 선발진', weak: '좌완 불펜 · 외야 수비', goal: '불펜과 수비를 보완해 마지막 한 걸음을 내디뎌야 합니다.', record: '85승 57패 2무'},
  {id: 'kia', name: 'KIA 타이거즈', short: 'KIA', color: '#b52a3e', rank: 1, region: '광주·전남·제주', needs: ['C', 'SP', 'IF'],
    strong: '타선의 균형 · 공격적 주루', weak: '포수 세대교체 · 선발 뎁스', goal: '현재의 경쟁력과 다음 세대를 함께 지켜야 합니다.', record: '90승 51패 3무'},
];
export default TEAMS;
