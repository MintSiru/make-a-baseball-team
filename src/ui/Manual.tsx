/* The help tab (V0.15): the game's manual — how a year goes, the screens, the words and rules a general
   manager meets, what each decision is about, and common questions. Rule numbers come from the rule book
   in code (rules/kbo2026.ts), so the help cannot drift from what the game does. */
import { DISCLAIMER } from '../core/about';
import { EXPANSION_DEFAULTS, KBO_2026 } from '../rules/kbo2026';
import { DIFFICULTY_LABEL, DIFFICULTY_NOTE } from './Settings';
import { decisionTips } from './tutorial';

const K = KBO_2026;
const eok = (manwon: number) => `${Math.round(manwon / 1000) / 10}억`;
const usd = (n: number) => `${n / 10_000}만 달러`;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const capNow = K.salaryCap.years.find((y) => y.year === K.season)!.cap;

const SCREENS: [string, string][] = [
  ['결정할 일', '겨울 결정과 시즌 중 결정(국가대표 차출 같은 일)이 기다릴 때만 맨 앞에 생깁니다. 끝내야 날짜가 흐릅니다.'],
  ['우리 구단', '개요, 선수단(1군·퓨처스·잔류군 배치와 등록), 라인업 카드, 해외 연수, 소식(기사·연표·업적·알림), 구단 운영(모기업·재정·티켓·스태프·구장·시설).'],
  ['이적시장', '트레이드, 선수 찾기, 방출·웨이버·자유계약, 외국인 교체, 이적 소식.'],
  ['경기', '경기 결과, 기록지와 문자중계(처음부터 다시 보기).'],
  ['순위 · 기록', '정규시즌 순위와 포스트시즌, 개인 기록 순위.'],
  ['구단', '다른 구단의 선수단과 라인업.'],
  ['역대', '시상, 기록실, 명예의 전당, 시즌별 결과.'],
  ['드래프트 후보', '올가을 신인 드래프트 후보와 스카우팅 리포트.'],
  ['설정', '화면(밝기·글자 크기·능력치 색), 게임(난이도·튜토리얼), 구단 이름, 저장, AI 기사, 정보.'],
];

const GLOSSARY: [string, string][] = [
  ['현재 · 미래 등급', '20~80 스카우팅 척도입니다. 50이 1군 평균, 60이면 주전급, 70 이상은 리그 정상급입니다. "미래"는 스카우트가 보는 성장 한계이고, 스카우트가 좋을수록 정확합니다.'],
  ['WAR', '대체 선수(쉽게 구할 수 있는 선수)보다 팀에 몇 승을 더 벌어 줬는지입니다.'],
  ['wRC+', '타격 생산력입니다. 100이 리그 평균이고, 120이면 평균보다 20% 낫습니다.'],
  ['OPS', '출루율 + 장타율. 타자를 한 숫자로 볼 때 씁니다.'],
  ['FIP', '수비와 상관없는 삼진·볼넷·홈런만으로 본 투수 지표입니다. 평균자책점처럼 읽습니다.'],
  ['QS', '선발 투수가 6이닝 이상 3자책점 이하로 막은 경기입니다.'],
  ['등록일수', `1군에 등록된 날입니다. ${K.freeAgency.daysPerSeason}일이 한 시즌으로 쳐지고, 고졸 ${K.freeAgency.seasonsHighSchool}시즌·대졸 ${K.freeAgency.seasonsCollege}시즌을 채우면 FA가 됩니다.`],
  ['소속선수 · 1군 엔트리', `구단마다 소속선수는 ${K.league.rosterLimit}명까지, 1군은 ${K.league.firstTeam.registered}명 등록에 ${K.league.firstTeam.active}명이 경기에 나섭니다.`],
  ['육성선수', `소속선수 정원 밖의 선수입니다. ${Number(K.development.registerFrom.slice(0, 2))}월 ${Number(K.development.registerFrom.slice(3))}일부터 정식선수로 등록해 1군에 올릴 수 있습니다.`],
  ['퓨처스 · 잔류군', '퓨처스는 2군 리그입니다. 잔류군(3군)은 경기 대신 훈련·재활을 하는 곳입니다. 어린 선수는 뛴 만큼 자랍니다.'],
  ['FA 등급과 보상', `FA는 연봉 순위로 A·B·C등급이 됩니다. A등급을 데려가면 보호선수 ${K.freeAgency.compensation.A.protected}명 밖 한 명 + 직전 연봉 ${pct(K.freeAgency.compensation.A.withPlayer)}(돈만이면 ${pct(K.freeAgency.compensation.A.cashOnly)}), B등급은 ${K.freeAgency.compensation.B.protected}명 밖 한 명 + ${pct(K.freeAgency.compensation.B.withPlayer)}(돈만이면 ${pct(K.freeAgency.compensation.B.cashOnly)}), C등급은 ${pct(K.freeAgency.compensation.C.cashOnly)}만 보상합니다.`],
  ['경쟁균형세', `연봉 상위 ${K.salaryCap.topPlayers}명 총액의 상한입니다(${K.season}년 ${eok(capNow)}). 넘으면 초과분의 ${K.salaryCap.levies.map(pct).join('·')}를 내고(연속 횟수에 따라), ${K.salaryCap.pickDropFrom}년 연속이면 1라운드 지명이 ${K.salaryCap.pickDrop}순위 밀립니다.`],
  ['외국인 선수', `${K.foreign.regular}명 + 아시아쿼터 ${K.foreign.asiaQuota}명입니다. 새 외국인은 ${usd(K.foreign.newContractCapUSD)}까지, 세 명 합계는 ${usd(K.foreign.clubTotalCapUSD)}(재계약 연차만큼 늘어남)까지 쓸 수 있고, 시즌 중 ${K.foreign.replacementsPerSeason}번 교체합니다.`],
  ['포스팅', `${K.posting.seasons}시즌을 채운 선수를 메이저리그에 보내는 제도입니다. 구단마다 한 겨울에 ${K.posting.perClubPerWinter}명이고, 계약하면 이적료를 받습니다.`],
  ['2차 드래프트', `2년마다 열립니다. 구단마다 ${K.secondaryDraft.protected}명을 보호하고, 나머지에서 ${K.secondaryDraft.rounds}라운드까지 지명하며 양도금을 냅니다.`],
  ['특별지명 · 신생구단 혜택', `새 구단은 기존 구단마다 보호선수 ${EXPANSION_DEFAULTS.specialDraft.protected}명 밖에서 한 명씩(선수당 ${eok(EXPANSION_DEFAULTS.specialDraft.feePerPlayer)}) 데려가고, FA ${EXPANSION_DEFAULTS.freeAgentSigns}명을 보상선수 없이 영입합니다. 1군 첫 ${EXPANSION_DEFAULTS.benefitSeasons}시즌은 외국인 +${EXPANSION_DEFAULTS.extraForeignPlayers}명, 1군 등록 +${EXPANSION_DEFAULTS.extraFirstTeamSpots}명입니다.`],
  ['병역', '상무·현역·사회복무 가운데 하나로 군대에 갑니다. 아시안게임 금메달이나 올림픽 메달을 따면 면제되고, 큰 수술을 받은 선수는 보충역 판정을 받기도 합니다.'],
  ['모기업 · 신뢰도', '모기업은 해마다 목표(성적·관중·재정)를 주고 평가합니다. 평가가 예산과 신뢰도를 움직이고, 개막 때 그해 지원금을 확정해 먼저 줍니다.'],
  ['명명권 · 시즌권', '명명권 구단은 스폰서 이름을 달고 후원금을 받습니다. 시즌권은 비시즌에 할인율을 정해 미리 팔고, 개막 때 돈이 들어옵니다.'],
];

const YEAR: [string, string][] = [
  ['3월', '개막. 시범경기 뒤 정규시즌이 시작됩니다.'],
  ['4~9월', '정규시즌 144경기. 1군 등록·말소, 부상, 트레이드(7월 31일 마감), 외국인 교체(8월 15일까지).'],
  ['9월', '신인 드래프트 후보가 확정됩니다.'],
  ['10월', '포스트시즌.'],
  ['11~2월', '겨울 결정: 국가대표·성장·은퇴·병역 → 포스팅 → FA → 연봉 → 신인 계약 → 2차 드래프트(격년) → 정원 정리 → 방출선수 → 외국인 → 스프링캠프.'],
];

const FAQ: [string, string][] = [
  ['진행은 어디에 저장되나요?', '조작할 때마다 이 브라우저에 자동으로 저장됩니다(압축해서). 다른 기기로 옮기거나 따로 보관하려면 설정 → 저장의 "진행 파일 저장"으로 파일을 받으세요.'],
  ['아이폰에서 진행이 사라졌어요.', 'Safari는 한동안 방문하지 않은 사이트의 저장소를 지울 수 있습니다. 공유 버튼 → "홈 화면에 추가"로 열면 지워지지 않고, 진행 파일을 가끔 받아 두면 안전합니다.'],
  ['난이도는 무엇을 바꾸나요?', `${DIFFICULTY_LABEL.easy}: ${DIFFICULTY_NOTE.easy} ${DIFFICULTY_LABEL.hard}: ${DIFFICULTY_NOTE.hard} 게임 중 설정 탭에서 바꿀 수 있습니다.`],
  ['결정이 어려우면요?', '결정 화면의 "스카우트 추천으로 채우기"로 추천안을 채운 뒤 고쳐서 확정하세요. 결정마다 "이 결정은?"을 펼치면 요점이 나옵니다.'],
  ['AI 기사 키는 안전한가요?', '키는 기본적으로 이 탭에만 있고, "기억하기"를 켤 때만 이 브라우저에 남습니다. 진행 파일에는 절대 들어가지 않고, 게임은 공개 정보(경기 결과·기록·이름)만 보냅니다.'],
  ['실제 구단과 선수인가요?', `${DISCLAIMER} 설정 → 구단 이름에서 가상 이름으로 바꿀 수 있습니다.`],
];

export function Manual() {
  return (
    <section class="settings-page manual" aria-labelledby="manual-title">
      <div class="page-head">
        <div>
          <h2 id="manual-title">도움말</h2>
          <p class="muted">2026년 여름, KBO 11번째 구단의 초대 단장이 됩니다. 창단 트라이아웃 → 첫 드래프트 → 퓨처스리그 → 1군 진입 → 가을야구 → 왕조까지, 선수단·계약·육성·예산을 결정하고 경기는 AI 감독이 치릅니다.</p>
        </div>
      </div>

      <section class="settings-block" aria-labelledby="manual-year">
        <h2 id="manual-year">한 해의 흐름</h2>
        <dl class="manual-list">
          {YEAR.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section class="settings-block" aria-labelledby="manual-screens">
        <h2 id="manual-screens">화면</h2>
        <dl class="manual-list">
          {SCREENS.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section class="settings-block" aria-labelledby="manual-words">
        <h2 id="manual-words">용어와 제도</h2>
        <p class="muted small">제도는 현실 KBO 규정을 따르고, 현실에 선례가 없는 부분만 게임이 정했습니다.</p>
        <dl class="manual-list">
          {GLOSSARY.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section class="settings-block" aria-labelledby="manual-decisions">
        <h2 id="manual-decisions">결정 안내</h2>
        {decisionTips().map(([kind, tip]) => (
          <details key={kind} class="help">
            <summary>{tip.title}</summary>
            {tip.body.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </details>
        ))}
      </section>

      <section class="settings-block" aria-labelledby="manual-faq">
        <h2 id="manual-faq">자주 묻는 질문</h2>
        {FAQ.map(([q, a]) => (
          <details key={q} class="help">
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
    </section>
  );
}
