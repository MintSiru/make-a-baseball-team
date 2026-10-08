/* Tutorial mode (V0.7.5): the "start in the futures league" game, with a guide from the founding
   (July 2026) through the futures year (2027) to the first-team debut. Each lesson shows once, when its
   moment comes (a decision, the season's stage, a screen opened for the first time); the player reads
   it and moves on, or turns the guide off. Progress is saved with the club. */
import { regularOver } from '../league/actions';
import type { Decision, LeagueState } from '../league/state';

export interface Lesson {
  id: string;
  title: string;
  body: string[];
}

interface Ctx {
  /** The screen (tab) open now. */
  tab: string;
  /** Which part of "우리 구단" is open (V0.16), when that tab is. */
  view?: string;
}

type Rule = Omit<Lesson, 'body'> & { when: (s: LeagueState, ctx: Ctx) => boolean; body: string[] | ((s: LeagueState) => string[]) };
/** 1.5.0: the guide is a choice of its own, so a club going straight to the first team can have it too — without the
    futures-year lessons. */
const futuresYear = (s: LeagueState) => s.user!.settings.promotion !== 'immediate';

/** One short tip for each decision, the first time it comes up. */
const DECISION_TIPS: Partial<Record<Decision['kind'], { title: string; body: string[] }>> = {
  tryout: {
    title: '창단 트라이아웃',
    body: [
      '독립리그·해외 복귀·대졸 미지명·최근 방출 선수 가운데 최대 20명과 계약합니다.',
      '당장의 1군 전력보다 2027년 퓨처스리그를 함께 뛸 선수단의 뼈대입니다. 어리고 미래 등급이 높은 선수를 중심으로, 포지션을 고루 채우세요.',
    ],
  },
  draftPick: {
    title: '신인 드래프트',
    body: [
      '신생구단은 우선지명으로 먼저 뽑습니다. 표의 머리글을 누르면 정렬되고, 스카우트가 꼽은 상위 3명에 표시가 붙습니다.',
      '고졸은 오래 키워야 하지만 성장 폭이 크고, 대졸은 빨리 쓸 수 있습니다. 직접 뽑거나 "스카우트에게 맡기기"로 남은 지명을 맡기세요.',
    ],
  },
  rookieBonus: {
    title: '신인 계약금 협상',
    body: [
      '지명한 신인에게 계약금을 제시합니다. 요구액을 주면 바로 계약하고, 적게 부르면 다시 요구하거나 거부할 수 있습니다.',
      '"진학 희망"이나 "해외 구단 관심"이 붙은 선수는 거부하기 쉽습니다. 계약금은 창단 자금에서 나갑니다.',
    ],
  },
  development: {
    title: '육성선수 계약',
    body: ['지명받지 못한 선수와 소속선수 정원(68명) 밖에서 계약합니다. 연봉이 최저라 부담이 적고, 5월 1일부터 정식선수로 등록할 수 있습니다.'],
  },
  released: {
    title: '방출선수 영입',
    body: ['다른 구단이 정리한 선수를 가장 먼저 볼 수 있습니다. 싼 값에 경험 있는 선수로 빈자리를 채울 기회입니다.'],
  },
  camp: {
    title: '스프링캠프',
    body: ['선수마다 한 해의 훈련 초점(능력 하나에 집중)을 정하거나, 투수의 선발·불펜 전환, 야수의 포지션 변경을 계획합니다. 비워 두면 고르게 성장합니다.'],
  },
  staff: {
    title: '코칭스태프 · 프런트',
    body: ['감독·코치·스카우트·트레이너·전력분석원을 뽑습니다. 코치는 선수 성장, 스카우트는 등급의 정확도, 트레이너는 부상에 영향을 줍니다. 좋은 사람일수록 연봉이 비쌉니다.'],
  },
  retire: {
    title: '은퇴 의사',
    body: ['은퇴하겠다는 우리 선수들입니다. 아직 쓸 만한 선수는 골라서 한 시즌 더 뛰어 달라고 설득할 수 있습니다. 젊고 잘하는 선수일수록 마음을 돌리기 쉽습니다.'],
  },
  military: {
    title: '병역',
    body: [
      '미필 선수는 만 28세가 되기 전에 입대해야 합니다. 상무는 퓨처스리그에서 뛰며 기량을 지키지만 뽑히기 어렵고, 현역·사회복무는 실력이 떨어집니다.',
      '아시안게임 금메달이나 올림픽 메달을 따면 대표팀의 미필 선수는 병역 특례를 받습니다.',
    ],
  },
  faRound: {
    title: 'FA 시장',
    body: [
      'FA 공시 다음 날부터 모든 구단이 모든 FA와 협상합니다. 선수마다 계약금·연봉·옵션·기간을 정해 제안하고, 며칠씩 라운드를 넘기며 조건을 고칩니다. 선수는 받아들일 만한 제안이 오면 며칠 고민하며 다른 구단에 알리고, 가장 좋은 곳과 계약합니다.',
      '선수마다 요구가 다릅니다: 보장 기간, 계약금 비중, 주전 보장, 약한 포지션 보강, 우승 전력, 고향 팀, 옵트아웃. 주전·보강은 약속으로 채울 수 있지만, 어기면 몇 년 동안 FA들이 우리를 덜 믿습니다.',
      '외국인 선수는 FA 다음, 겨울 끝에 같은 연봉 예산으로 계약합니다. 시장 화면의 "외국인 몫"만큼은 남겨 두세요. 예산을 FA에 다 쓰면 외국인을 데려올 수 없습니다.',
      '계약금은 샐러리캡처럼 계약 기간에 나눠 연봉 예산에 들어갑니다. 선수는 계약금을 좋아하지만, 연봉 3억 이상 선수가 부진으로 2군에 가면 연봉이 깎이니(2군 감액) 구단은 연봉 비중이 높은 편이 안전합니다. 옵션은 출장·이닝 조건을 채울 때만 줍니다.',
      'A·B등급 선수를 데려오면 원소속 구단에 보상선수나 보상금을 줍니다. 1군 진입 직전 겨울에는 3명까지 보상 없이 데려올 수 있습니다.',
    ],
  },
  faOptions: {
    title: 'FA 구단 옵션',
    body: ['보장 기간이 끝난 FA 계약에 구단 옵션이 있습니다. 실행하면 정해 둔 연봉으로 계약이 늘고, 포기하면 선수는 보상 없이 FA 시장에 나갑니다.'],
  },
  salaries: {
    title: '연봉 협상',
    body: ['선수의 요구액, 기록으로 매긴 구단 고과, 동결 가운데 고릅니다. 3년 차 이상은 연봉 조정을 신청할 수 있고, 좋은 선수에게는 다년 계약을 제안할 수 있습니다.'],
  },
  specialDraft: {
    title: '특별지명',
    body: ['기존 구단들이 보호선수를 묶으면, 신생구단은 구단마다 보호되지 않은 선수 1명씩 데려옵니다 (1명당 보상금). 1군 첫해 전력을 채우는 가장 큰 기회입니다.'],
  },
  foreign: {
    title: '외국인 선수 계약',
    body: [
      '외국인 3명과 아시아쿼터 1명을 둘 수 있고, 신생구단은 1군 초반에 1명을 더 씁니다. 한 경기에 외국인 투수는 2명까지 나섭니다.',
      '새 외국인은 총액 100만 달러(아시아쿼터 20만 달러)까지입니다. 경력 칸에서 MLB·트리플A·일본·독립리그 이력을 보세요.',
    ],
  },
  foreignRenew: {
    title: '외국인 재계약',
    body: ['한 시즌을 함께한 외국인 선수를 붙잡을지 정합니다. 요구액은 성적(WAR)으로 정해지고, 뛰어난 선수는 MLB·일본으로 떠나기도 합니다.'],
  },
  roster: {
    title: '소속선수 정리',
    body: ['정원(68명)을 넘으면 선수를 정리해야 합니다. 정리한 선수 가운데 원하는 선수는 육성선수로 다시 계약해 남길 수 있습니다.'],
  },
  sponsor: { title: '명명권 스폰서', body: ['구단 이름에 스폰서 이름이 붙는 대신 해마다 후원금을 받습니다. 금액과 기간을 비교해 고르세요.'] },
  secondProtect: { title: '2차 드래프트 보호선수', body: ['2년마다 열리는 2차 드래프트에서 다른 구단이 데려가지 못하게 묶을 선수를 고릅니다.'] },
  secondPick: { title: '2차 드래프트', body: ['다른 구단의 보호선수 명단 밖에서 선수를 지명합니다. 라운드마다 양도금을 냅니다.'] },
  posting: { title: '포스팅', body: ['7시즌을 채운 선수가 메이저리그 진출을 원합니다. 한 겨울에 1명만 보낼 수 있고, 계약하면 이적료를 받습니다.'] },
  // V0.15: the decisions that come after the first-team debut (or rarely) get a tip too; every decision screen
  // also shows its tip folded away ("이 결정은?"), tutorial or not.
  faProtect: {
    title: 'FA 보상 보호명단',
    body: [
      '다른 구단의 A·B등급 FA를 영입하면 원 소속 구단에 보상선수를 내줘야 합니다. 지킬 선수를 고르세요 (A등급 20명, B등급 25명). 명단 밖에서 한 명을 데려가거나, 대신 돈만 받을 수 있습니다.',
      '외국인 선수, 이번 겨울 FA로 온 선수, 새 신인, 군 복무 중인 선수는 명단에 넣지 않아도 보호됩니다. 핵심 유망주를 빠뜨리지 마세요.',
    ],
  },
  faCompensation: {
    title: 'FA 보상선수 지명',
    body: [
      '우리 FA가 다른 구단과 계약했습니다. 그 구단의 보호명단 밖에서 보상선수 한 명을 고르거나, 선수 없이 돈만 받을 수 있습니다.',
      'A등급은 선수 + 직전 연봉 200%(돈만이면 300%), B등급은 선수 + 100%(돈만이면 200%)입니다. C등급은 선수 없이 150%만 받습니다.',
    ],
  },
  returnee: {
    title: '해외 복귀 선수',
    body: ['우리가 포스팅으로 보낸 선수가 KBO로 돌아오려 합니다. 우리 구단이 보류권을 갖고 있어 데려올지 정할 수 있습니다. 고르지 않으면 보류권을 풀어 주고, 다른 구단이 데려갈 수 있습니다.'],
  },
  rival: {
    title: '12구단 창단 논의',
    body: ['KBO 이사회가 12번째 구단 창단을 논의합니다. 찬성하면 라이벌이 될 구단의 이름·연고지·성향을 직접 정하고, 반대하면 몇 해 뒤 다시 논의됩니다.', '새 구단은 특별지명으로 기존 구단마다 한 명씩 데려가니, 다음 결정에서 우리 선수를 지켜야 합니다.'],
  },
  rivalProtect: {
    title: '특별지명 보호명단 (12구단)',
    body: ['새 12번째 구단이 기존 구단마다 보호명단 밖에서 한 명을 데려갑니다. 지킬 선수를 고르세요. 데려가면 보상금을 받습니다.'],
  },
  national: {
    title: '국가대표 차출',
    body: [
      '우리 선수가 국가대표로 뽑혔습니다. 보내거나 제외를 요청할 수 있습니다. 다친 선수는 받아들여지지만, 건강한 선수는 받아들여질 확률이 40%이고 팬과 선수 본인이 서운해합니다.',
      '시즌 중 대회(아시안게임·올림픽)는 그동안 1군 경기에 못 나옵니다. 아시안게임 금메달이나 올림픽 메달을 따면 병역 혜택이 생깁니다.',
    ],
  },
  scandal: {
    title: '선수 사건',
    body: [
      '음주운전·폭행·승부조작·도핑 같은 사건에는 KBO 징계가 그대로 내려집니다. 구단은 방출, 자체 징계 추가, KBO 징계만 따르기 가운데 대응을 고릅니다.',
      '팬들은 사건의 무게와 구단의 대응을 함께 판단합니다. 도핑은 몇 주 전부터 징후 기사가 나오므로, 선수 창의 "구단 자체 검사"로 미리 막을 수 있습니다.',
    ],
  },
  dispute: {
    title: '지분 분쟁',
    body: ['창단 투자자가 구단 지분을 요구합니다(명명권 구단의 드문 사건). 합의하면 정해진 돈을 주고 끝나고, 소송으로 다투면 소송비를 내고 다음 겨울에 판결이 나옵니다. 지면 큰돈과 모기업 신뢰를 잃습니다.'],
  },
  meddle: {
    title: '구단주의 지시',
    body: [
      '시나리오 「재기」의 구단주가 시즌 중에 전화를 겁니다: 성적이 나쁘면 감독 교체, 6~7월에는 7월 31일까지 거물(현재 등급 60 이상) 영입, 관중석이 비면 표값 인하. 한 시즌에 종류마다 한 번입니다.',
      '따르면 신뢰도가 조금 오르고, 거절하면 지시마다 정해진 만큼 떨어집니다. 거물 영입을 따르면 그룹이 영입 자금을 넣어 주지만, 마감까지 데려오지 못하면 크게 실망합니다. 신뢰도가 15 아래로 떨어진 겨울에는 해임됩니다.',
    ],
  },
  fantasyPick: {
    title: '판타지 드래프트',
    body: [
      '시나리오 「판타지 드래프트」의 2027년 겨울, 리그의 국내 선수 모두와 그해 신인 드래프트 후보가 한 번에 나옵니다(외국인과 군 복무 중인 선수는 제외). 추첨한 순서대로 뱀 순서로 지명하고, 선수는 원래 계약(연봉·기간)을 그대로 가져갑니다. 신인은 신인 순번만큼의 계약금을 받습니다.',
      '"평가"는 공개 등급에 우리 구단에 모자란 포지션·나이·샐러리캡을 더한 스카우트의 순위입니다. 연봉이 큰 선수만 모으면 경쟁균형세와 예산을 넘습니다. 언제든 이번 지명이나 10라운드까지, 또는 남은 지명 모두를 스카우트에게 맡길 수 있습니다.',
    ],
  },
};

/** The short explanation of a decision (V0.15): the tutorial's tip, also folded into every decision screen. */
export const decisionTip = (kind: Decision['kind']) => DECISION_TIPS[kind] ?? null;

/** Every decision's tip, for the help page. */
export const decisionTips = () => Object.entries(DECISION_TIPS) as [Decision['kind'], { title: string; body: string[] }][];

const inTutorial = (s: LeagueState) => {
  const u = s.user;
  return !!u?.settings.tutorial && !u.tutorialOff;
};

const RULES: Rule[] = [
  {
    id: 'welcome',
    when: (s) => s.pending?.kind === 'tryout',
    title: '환영합니다, 단장님',
    body: (s) =>
      futuresYear(s)
        ? [
            '튜토리얼 모드입니다. 창단(2026년 7월)부터 퓨처스리그 1년(2027년)까지, 처음 해 보는 일이 생길 때마다 이 안내가 나옵니다.',
            '큰 흐름: 창단 트라이아웃 → 2026년 남은 시즌 관전 → 가을 신인 드래프트(우선지명) → 2027년 퓨처스리그 → 겨울 특별지명·FA 특례·외국인 선수 → 2028년 1군 데뷔.',
            '안내가 필요 없으면 언제든 "튜토리얼 끄기"를 누르세요. 퓨처스 1년은 그대로 진행됩니다.',
          ]
        : [
            '튜토리얼 모드입니다. 창단(2026년 7월)부터 2027년 1군 데뷔까지, 처음 해 보는 일이 생길 때마다 이 안내가 나옵니다.',
            '큰 흐름: 창단 트라이아웃 → 2026년 남은 시즌 관전 → 가을 신인 드래프트(우선지명) → 겨울 특별지명·FA 특례·외국인 선수 → 2027년 1군 데뷔. 퓨처스 1년이 없어 첫 겨울에 1군 전력을 한꺼번에 만듭니다.',
            '안내가 필요 없으면 언제든 "튜토리얼 끄기"를 누르세요.',
          ],
  },
  {
    id: 'decisions',
    when: (s) => !!s.pending,
    title: '결정할 일',
    body: [
      '게임이 단장의 결정을 기다릴 때는 맨 앞에 "● 결정할 일" 탭이 생깁니다. 결정을 끝내야 날짜가 흘러갑니다.',
      '기다리는 동안에도 다른 탭을 열어 볼 수 있고, 구단 운영(티켓·마케팅·구장)과 기사는 바꿀 수 있습니다.',
      '고르기 어렵다면 "스카우트 추천으로 채우기"로 추천안을 채운 뒤 고쳐서 "확정"하세요.',
    ],
  },
  {
    id: 'grades',
    when: (s) => !!s.pending,
    title: '스카우팅 등급 읽는 법',
    body: [
      '"현재"와 "미래"는 20~80 스카우팅 척도입니다. 50이 1군 평균, 60이면 주전급, 70 이상은 리그 정상급입니다. "현재"는 지금 실력, "미래"는 스카우트가 보는 성장 한계입니다.',
      '선수 이름을 누르면 능력치·기록·성격이 담긴 리포트가 열립니다. 등급은 스카우트의 눈이라 틀릴 수 있고, 스카우트가 좋을수록 정확합니다.',
    ],
  },
  {
    id: 'winter',
    when: (s) => !!s.pending && s.phase === 'offseason',
    title: '오프시즌',
    body: [
      '겨울 일정은 KBO 달력을 따릅니다: 국가대표·성장·은퇴·병역 → 포스팅 → FA → 연봉 → 신인 드래프트 → 2차 드래프트 → 정원 정리 → 방출선수 → 외국인 → 스프링캠프.',
      '구장 증축·펜스 공사는 겨울에만 시작할 수 있습니다. 결정을 기다리는 동안 우리 구단 → 구단 운영 → 구장에서 시작하세요.',
      '시상·FA 결과·은퇴 같은 큰일과 우리 구단 기사는 팝업으로 알려 드립니다. 기사 팝업은 설정 → 화면에서 끌 수 있습니다.',
    ],
  },
  {
    id: 'lastWinter',
    when: (s) => !!s.pending && s.offseason?.year === s.user!.firstTeamYear - 1,
    title: '1군 진입 전 마지막 겨울',
    body: [
      '이번 겨울에 1군 전력을 만듭니다: FA 특례(보상 없이 영입), 특별지명(구단마다 1명), 외국인 선수(4명 + 신생구단 특례 1명).',
      '연봉 예산과 창단 자금을 확인하며 결정하세요. 결정 화면마다 예산 줄이 나옵니다.',
    ],
  },
  ...(Object.entries(DECISION_TIPS) as [Decision['kind'], { title: string; body: string[] }][]).map(([kind, tip]) => ({
    id: `decision-${kind}`,
    when: (s: LeagueState) => s.pending?.kind === kind,
    ...tip,
  })),
  {
    id: 'foundingSeason',
    when: (s) => !s.pending && s.phase === 'regular' && s.year < s.user!.firstTeamYear - (futuresYear(s) ? 1 : 0) && !regularOver(s),
    title: '2026년 남은 시즌',
    body: [
      '올해는 우리 구단 경기가 없습니다. 다른 구단의 시즌을 지켜보며 가을 드래프트를 준비하세요.',
      '위쪽 버튼으로 날짜를 넘깁니다: 하루 · 1주 · 한 달 · 정규시즌 끝까지. 순위·기록·경기 탭에서 리그 흐름을 볼 수 있습니다.',
      '"드래프트 후보" 탭에 올가을 신인 드래프트 후보와 스카우팅 리포트가 있습니다. 우선지명할 선수를 미리 살펴보세요.',
    ],
  },
  {
    id: 'seasonEnd',
    when: (s) => !s.pending && ((s.phase === 'regular' && regularOver(s)) || s.phase === 'postseason'),
    title: '시즌이 끝나면',
    body: [
      '"포스트시즌 진행"으로 가을야구를 치르고, "다음 시즌으로"를 누르면 겨울(오프시즌)이 시작됩니다.',
      '겨울에는 결정할 일이 차례로 나옵니다. 하나씩 끝내면 다음 시즌 개막으로 넘어갑니다.',
    ],
  },
  {
    id: 'futures',
    when: (s) => futuresYear(s) && !s.pending && s.phase === 'regular' && s.year === s.user!.firstTeamYear - 1,
    title: '2027년 퓨처스리그',
    body: [
      '올해 우리 구단은 퓨처스리그(2군)에서만 뜁니다. 1군 데뷔는 2028년입니다.',
      '어린 선수는 뛴 만큼 자랍니다. 우리 구단 → 선수단에서 유망주를 퓨처스 출전조에 두고, 출전 기회가 없는 선수는 잔류군(3군)에서 훈련하게 하세요.',
      '개요에서 퓨처스 성적을, 소식에서 경기 기사와 알림을 볼 수 있습니다.',
    ],
  },
  {
    id: 'futuresMid',
    when: (s) => futuresYear(s) && !s.pending && s.phase === 'regular' && s.year === s.user!.firstTeamYear - 1 && (s.schedule[s.next]?.date ?? '9999') >= `${s.year}-06-01`,
    title: '시즌 중반',
    body: [
      '트레이드는 7월 31일에 마감됩니다. 1군 진입 전에 필요한 자리를 미리 채워 두세요.',
      '모기업은 해마다 목표(성적·관중·재정)를 주고 시즌 뒤에 평가합니다. 우리 구단 → 구단 운영 → 모기업에서 확인하세요.',
      '원하면 본인 API 키로 AI가 기사를 다시 쓰게 할 수 있습니다 (설정 → AI 기사).',
    ],
  },
  {
    id: 'tab-club',
    when: (_s, c) => c.tab === 'club',
    title: '우리 구단',
    body: [
      '개요: 성적·예산·클럽하우스 분위기. 선수단: 1군·퓨처스·잔류군 배치와 등록(감독에게 맡기거나 직접 관리). 라인업: 수비 위치와 타순을 한눈에.',
      '소식: 기사·인터뷰·연표·업적·알림. 구단 운영: 모기업 목표, 재정, 티켓·마케팅, 스태프, 구장.',
    ],
  },
  {
    id: 'tab-market',
    when: (_s, c) => c.tab === 'market',
    title: '이적시장',
    body: [
      '트레이드(7월 31일 마감, 상대가 받아들일지 바로 보여 줌), 방출·웨이버·자유계약, 외국인 교체(시즌 중 2번, 8월 15일까지), 이적 소식을 다룹니다.',
      '"선수 찾기"로 리그 전체 선수를 포지션·나이·등급·계약으로 거를 수 있습니다. 트레이드 상대를 고를 때 쓰세요.',
    ],
  },
  {
    id: 'club-squad',
    when: (_s, c) => c.tab === 'club' && c.view === 'squad',
    title: '선수단',
    body: [
      '1군·퓨처스·잔류군(3군) 배치와 1군 등록을 다룹니다. 처음에는 감독이 열흘마다 엔트리를 짭니다. "직접 관리"로 바꾸면 등록·말소, 선발·불펜 보직, 플래툰을 단장이 정하고, 정하지 않은 자리는 감독이 채웁니다.',
      '선수 이름을 누르면 선수 창이 열립니다. 등번호를 바꾸거나, 도핑 징후가 보이는 선수를 구단 자체 검사에 보낼 수 있습니다. 방출은 이적시장 탭에서 합니다.',
    ],
  },
  {
    id: 'club-lineup',
    when: (_s, c) => c.tab === 'club' && c.view === 'lineup',
    title: '라인업',
    body: [
      '감독이 평소 짜는 수비 위치와 타순(상대 선발이 우투일 때·좌투일 때), 선발 로테이션, 불펜 보직을 한눈에 봅니다.',
      '"단장 라인업 카드"로 타순 몇 자리와 수비 위치, 선발 순서를 직접 고정할 수 있습니다. 고정하지 않은 자리와 다치거나 대표팀에 간 선수 자리는 감독이 채웁니다.',
    ],
  },
  {
    id: 'club-training',
    when: (_s, c) => c.tab === 'club' && c.view === 'training',
    title: '해외 연수',
    body: [
      '선수를 미국·일본의 사설 트레이닝 시설에 몇 주 보냅니다. 비용은 구단 자금에서 나가고, 시즌 중에 보내면 그동안 경기에 나가지 못합니다.',
      '어리고 잠재력이 많이 남은 선수일수록 효과가 큽니다. 결과는 돌아온 뒤 이 화면과 소식에 나옵니다.',
    ],
  },
  {
    id: 'club-office',
    when: (_s, c) => c.tab === 'club' && c.view === 'office',
    title: '구단 운영',
    body: [
      '모기업은 해마다 목표를 주고 시즌 뒤에 평가합니다. 모기업 지원은 개막 때 확정되고, 쓰고 남은 돈은 구단 자금으로 쌓여 FA 계약금·공사·연수에 씁니다.',
      '관중·티켓: 표값을 내리면 관중이 늘어 굿즈·매점 수입이 함께 늘고, 올리면 표 한 장 값이 오릅니다. 늘 매진이면 올릴 여지가 있습니다. 시즌권은 할인만큼 덜 받는 대신 돈이 개막 때 들어오고, 성적이 나빠도 시즌권 관중은 옵니다.',
      '구장 증축·펜스 공사와 구장 보강·훈련 시설은 겨울에 시작합니다. 스태프(감독·코치·스카우트·트레이너·분석)는 겨울마다 바꿀 수 있습니다.',
    ],
  },
  {
    id: 'tab-settings',
    when: (_s, c) => c.tab === 'settings',
    title: '설정',
    body: [
      '화면(밝기·글자 크기·능력치 색), 게임(난이도·튜토리얼), 구단 이름, 저장, AI 기사를 한곳에서 정합니다.',
      '긴 게임은 가끔 "진행 파일 저장"으로 파일을 남겨 두세요. 아이폰·아이패드는 홈 화면에 추가해서 열면 브라우저가 저장을 지우지 않습니다.',
    ],
  },
  {
    id: 'tab-help',
    when: (_s, c) => c.tab === 'help',
    title: '도움말',
    body: ['용어·제도·화면 안내와 자주 묻는 질문이 있습니다. 결정 화면마다 "이 결정은?"을 펼치면 그 결정의 요점도 볼 수 있습니다.'],
  },
  {
    id: 'tab-draft',
    when: (_s, c) => c.tab === 'draft',
    title: '드래프트 후보',
    body: ['올가을 신인 드래프트 후보의 공개 순위, 스카우팅 등급, 아마추어 기록입니다. 이름을 누르면 오른쪽(좁은 화면에서는 아래)에 리포트가 나옵니다.'],
  },
  {
    id: 'graduate',
    when: (s) => !s.pending && s.phase === 'regular' && s.year >= s.user!.firstTeamYear,
    title: '튜토리얼 끝 · 1군 데뷔!',
    body: [
      '이제 1군입니다. 감독이 1군 엔트리를 자동으로 관리하고, 원하면 선수단에서 직접 관리로 바꿀 수 있습니다.',
      '해마다 모기업 평가와 겨울 결정이 이어지고, 큰일은 팝업으로 알려 드립니다. 행운을 빕니다!',
    ],
  },
];

/** The lesson to show now, if any: the first unread one whose moment has come. */
export function nextLesson(s: LeagueState, ctx: Ctx): (Lesson & { index: number }) | null {
  if (!inTutorial(s)) return null;
  const seen = s.user!.tutorialSeen ?? [];
  if (seen.includes('graduate')) return null;
  const rule = RULES.find((r) => !seen.includes(r.id) && r.when(s, ctx));
  return rule ? { id: rule.id, title: rule.title, body: typeof rule.body === 'function' ? rule.body(s) : rule.body, index: seen.length + 1 } : null;
}

/** Whether the guide can be turned back on: tutorial mode, turned off, and the first-team debut still ahead. */
export const tutorialPaused = (s: LeagueState) => {
  const u = s.user;
  return !!u?.settings.tutorial && !!u.tutorialOff && !(u.tutorialSeen ?? []).includes('graduate') && s.year <= u.firstTeamYear;
};
