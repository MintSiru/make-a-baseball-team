/* Why the scouts recommend what they do (1.5.0, from the 1.4 review): for the decision waiting, the rule the
   recommendation follows, what it picks, and what choosing otherwise costs. It reads the recommendation itself
   (autoDecision) and the public grades, so it explains rather than adds a second opinion. */
import type { PlayerId } from '../model/types';
import { autoDecision, type DecisionInput } from './expansion';
import { ageIn, isPitcher } from './players';
import { STAFF_LABELS } from './staff';
import type { LeagueState, StaffRole } from './state';

export interface Advice {
  /** The rule, in a sentence. */
  rule: string;
  /** What it picks (a few names with their grades). */
  picks: string[];
  /** What choosing otherwise costs or risks. */
  tradeoff: string;
}

const won = (n: number) => (Math.abs(n) >= 10_000 ? `${(n / 10_000).toFixed(1).replace(/\.0$/, '')}억` : `${Math.round(n).toLocaleString('ko-KR')}만`);
const MAX = 6;

export function adviceFor(s: LeagueState): Advice | null {
  const d = s.pending;
  if (!d || !s.user) return null;
  const input = autoDecision(s) as DecisionInput | null;
  if (!input) return null;
  const next = (s.offseason?.year ?? s.year) + 1;
  const who = (id: PlayerId) => {
    const p = s.players[id];
    return p ? `${p.name} (${isPitcher(p) ? p.role : (p.position ?? '야수')}, 만 ${ageIn(p, next)}세, 현재 ${p.scouting.current} · 미래 ${p.scouting.futureValue})` : id;
  };
  const list = (ids: PlayerId[]) => [...ids.slice(0, MAX).map(who), ...(ids.length > MAX ? [`외 ${ids.length - MAX}명`] : [])];
  const none = (ids: PlayerId[], what: string) => (ids.length ? list(ids) : [`${what} 없음`]);
  const KEEP = '보유 가치(현재 등급에, 23세 이하는 미래 등급을 절반, 26세 이하는 30% 섞은 값)';

  switch (input.kind) {
    case 'tryout':
      return { rule: `${KEEP}가 높은 순으로 12명.`, picks: list(input.ids), tradeoff: '덜 뽑으면 연봉이 줄지만 퓨처스 1년을 버틸 선수층이 얇아집니다. 더 뽑으면 소속선수 자리를 일찍 채웁니다.' };
    case 'released':
      return { rule: `방출 선수 가운데 ${KEEP}가 높은 5명까지.`, picks: none(input.ids, '데려올 만한 선수'), tradeoff: '즉시 쓸 경력 선수지만 나이가 많아 몇 해 뒤 자리를 비워야 합니다.' };
    case 'specialDraft': {
      const picks = Object.values(input.picks);
      return {
        rule: '구단마다 보호선수 밖에서 보유 가치가 가장 높은 선수를, 좋은 선수부터 자금·연봉 예산이 허락하는 만큼.',
        picks: none(picks, '지명'),
        tradeoff: '한 명마다 보상금이 나갑니다. 덜 뽑으면 자금이 남아 FA·외국인에 쓸 수 있지만 1군 첫해 전력이 약해집니다.',
      };
    }
    case 'roster':
      return { rule: `소속선수 한도를 맞추도록 ${KEEP}가 가장 낮은 선수부터 정리.`, picks: list(input.ids), tradeoff: '젊은 선수를 남기려면 대신 다른 선수를 정리해야 합니다. 정리한 선수 중 원하는 선수는 육성선수로 다시 계약해 한도 밖에 둘 수 있습니다.' };
    case 'foreign': {
      const offers = input.offers ?? {};
      return {
        rule: '정규 외국인은 투수 2명·타자 1명, 아시아쿼터 1명을 공개 등급 순으로, 신규 상한과 외국인 샐러리캡 안에서 희망 보장액 그대로(옵션 없이) 제안.',
        picks: input.ids.length ? input.ids.map((id) => `${who(id)}${offers[id] ? ` · 보장 ${(offers[id]!.guaranteed / 10_000).toFixed(0)}만 달러` : ''}`) : ['예산·상한 안에서 계약할 후보 없음'],
        tradeoff: '보장액을 깎으면 돈은 아끼지만 역제안이나 결렬, 그 사이 다른 리그로 갈 위험이 있습니다. 옵션은 선수가 절반 가치로 봅니다.',
      };
    }
    case 'military': {
      const orders = Object.entries(input.orders);
      const label = { sangmu: '상무 지원', army: '현역 입대', social: '사회복무' } as Record<string, string>;
      return {
        rule: '나이 때문에 꼭 가야 하는 선수는 상무 합격 가능성이 25% 이상이면 상무, 아니면 현역. 1군 주전이 아닌 23세 이상은 상무 가능성 30% 이상이면 지금 지원. 1군 주전은 미룹니다.',
        picks: orders.length ? orders.map(([id, o]) => `${who(id)} → ${label[o] ?? o}`) : ['지금 보낼 선수 없음'],
        tradeoff: '주전을 지금 보내면 1군 전력이 빠지고, 미루면 서른 전에 가야 할 때 상무 자리가 없을 수 있습니다. 상무는 퓨처스에서 뛰며 기량이 이어집니다.',
      };
    }
    case 'rookieBonus': {
      const total = Object.values(input.offers).reduce((a, b) => a + b, 0);
      const short = d.kind === 'rookieBonus' ? d.picks.filter((p) => input.offers[p.id] !== p.ask).length : 0;
      return {
        rule: '자금이 허락하는 한 요구액을 그대로 주고, 모자라면 슬롯 금액.',
        picks: [`계약금 합계 ${won(total)}${short ? ` · ${short}명은 슬롯 금액` : ''}`],
        tradeoff: '슬롯 금액으로 깎으면 자금은 남지만 선수가 서운해하고, 해외로 갈 수 있는 선수는 협상이 틀어질 수 있습니다.',
      };
    }
    case 'development':
      return { rule: '미래 등급이 높은 순으로, 한 해 영입 한도까지.', picks: none(input.ids, '영입'), tradeoff: '육성선수는 한도 밖이라 소속선수 자리를 쓰지 않지만, 1군에 올리려면 정식 계약으로 바꿔야 합니다.' };
    case 'camp': {
      const moves = Object.entries(input.plans).filter(([, plan]) => plan.position);
      return {
        rule: '수비 능력이 지금 포지션에 맞지 않는 선수만 한 칸 쉬운 포지션으로(유격수 → 2루·3루 → 1루·외야 → 지명).',
        picks: moves.length ? moves.map(([id, plan]) => `${who(id)} → ${plan.position}`) : ['옮길 선수 없음'],
        tradeoff: '포지션을 바꾼 첫해에는 수비가 흔들립니다. 그대로 두면 수비 손해가 계속됩니다.',
      };
    }
    case 'retire':
      return { rule: '등급 50 이상이고 설득이 통할 가능성이 30% 이상인 선수만 붙잡습니다.', picks: none(input.ids, '붙잡을 선수'), tradeoff: '붙잡으면 한 해 더 쓰지만 연봉이 들고 기량이 더 떨어질 수 있습니다. 보내면 자리가 젊은 선수에게 갑니다.' };
    case 'faOptions':
      return { rule: '보유 가치 45 이상이고, 그 선수가 시장에서 받을 금액이 남은 연봉의 80% 이상일 때만 옵션을 행사.', picks: none(input.keep, '행사'), tradeoff: '행사하면 확실히 남지만 연봉이 고정되고, 포기하면 그 돈을 FA 시장에 쓸 수 있습니다.' };
    case 'faProtect':
    case 'secondProtect':
      return { rule: '보유 가치가 높은 순으로 보호 명단을 채웁니다.', picks: list(input.ids), tradeoff: '보호하지 않은 선수 중 한 명을 다른 구단이 데려갈 수 있습니다. 젊은 유망주를 보호하려면 고참 한 명을 빼야 합니다.' };
    case 'salaries':
      return { rule: '모두 성적 기준(가치에 맞는 금액)으로 제안.', picks: ['전원 성적 기준'], tradeoff: '깎으면 예산은 남지만 연봉 조정 신청과 불만이 늘고, 올려 주면 사기가 오르지만 예산이 듭니다.' };
    case 'sponsor':
      return { rule: '연간 후원금이 가장 큰 제안.', picks: d.kind === 'sponsor' ? [d.offers[input.index]?.name ?? ''] : [], tradeoff: '후원금이 큰 곳은 목표도 까다로울 수 있습니다. 목표를 못 채우면 다음 계약이 나빠집니다.' };
    case 'staff': {
      const hires = Object.entries(input.hires);
      return {
        rule: '계약이 끝난 자리에서, 후보의 평가가 지금 사람보다 10 이상 높을 때만 바꿉니다(위약금이 드는 교체는 하지 않음).',
        picks: hires.length ? hires.map(([role, id]) => `${STAFF_LABELS[role as StaffRole]}: ${d.kind === 'staff' ? (d.rows.find((r) => r.role === role)?.candidates.find((c) => c.id === id)?.name ?? id) : id}`) : ['모두 유지·재계약'],
        tradeoff: '평가가 높은 사람일수록 연봉이 높고, 계약 기간이 남은 사람을 바꾸면 남은 연봉을 위약금으로 냅니다.',
      };
    }
    case 'returnee':
      return { rule: '보유 가치 45 이상인 선수를 좋은 순으로, 예산이 허락하는 만큼.', picks: none(input.ids, '데려올 선수'), tradeoff: '데려오지 않은 선수는 보류권이 풀려 다른 구단이 데려갈 수 있습니다.' };
    case 'posting':
      return { rule: '27세 이상은 꿈을 좇게 해 주고 이적료를 받고, 그보다 어린 선수는 남깁니다.', picks: input.id ? [who(input.id)] : ['보내지 않음'], tradeoff: '보내면 이적료가 들어오지만 주전 한 명이 빠집니다. 남기면 서운해할 수 있습니다.' };
    case 'secondPick':
      return { rule: '보유 가치 50 이상이고 양도금을 낼 자금이 있을 때만 지명.', picks: input.id ? [who(input.id)] : ['지명하지 않음'], tradeoff: '양도금이 나가고 소속선수 자리를 하나 씁니다.' };
    case 'foreignRenew':
      return { rule: '올해 WAR이 기준 이상인 선수를 WAR 순으로, 새 외국인 몫을 남겨 두고 외국인 샐러리캡 안에서 재계약.', picks: none(input.keep, '재계약'), tradeoff: '재계약하지 않은 선수는 다른 구단이 데려갈 수 있습니다. 새 외국인은 검증이 안 됐지만 더 쌀 수 있습니다.' };
    case 'faCompensation':
      return { rule: '명단 맨 위 선수의 보유 가치가 50 이상이면 선수를, 아니면 돈으로 보상받습니다.', picks: input.player ? [who(input.player)] : ['보상금만'], tradeoff: '선수를 받으면 보상금이 줄어듭니다.' };
    case 'national': {
      const rows = d.kind === 'national' ? d.rows : [];
      const exempt = rows.filter((r) => r.exemption).map((r) => r.id);
      return {
        rule: '다친 선수만 남게 해 달라고 요청하고, 건강한 선수는 보냅니다.',
        picks: input.ids.length ? input.ids.map(who) : ['모두 보냄'],
        tradeoff: `대표팀에 가면 그동안 경기에 못 나오지만 등록일수는 그대로 쌓입니다.${exempt.length ? ` 이 대회에서 메달을 따면 병역 혜택을 받을 수 있는 선수가 ${exempt.length}명 있습니다.` : ''} 건강한 선수를 빼 달라고 하면 팬들의 관심이 식고 선수 본인도 서운해하며, 대표팀이 거절할 수도 있습니다.`,
      };
    }
    case 'meddle':
      return {
        rule: '구단주의 뜻을 따르는 것이 기본. 감독 교체 지시에서 구단주가 미는 사람이 지금 감독보다 등급이 10 넘게 낮고 신뢰도가 40을 넘을 때만 거절합니다.',
        picks: [input.answer === 'obey' ? '따른다' : '거절한다'],
        tradeoff: '따르면 신뢰도가 조금 오르지만 구단 운영이 구단주 뜻대로 흔들립니다. 거절하면 신뢰도가 깎이고, 신뢰도가 15 아래로 떨어진 겨울에는 해임됩니다.',
      };
    default:
      return null;
  }
}

