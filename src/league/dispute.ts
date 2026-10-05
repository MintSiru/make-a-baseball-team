/* An old promise comes back (V0.12, an easter egg for clubs without a parent company). Very rarely, a winter brings
   an investor who put money into the club when it was founded and now says it was never a loan: it bought a share
   of the club, 40 percent, and he wants it. The story follows the Heroes' long fight (RULES.md S76: an investor's
   2008 money, a commercial arbitration award for 40 percent, the courts upholding it in 2017–18). The club can
   settle now or fight; a fight costs lawyers this winter and is decided the next, and the investor usually wins. */
import { rng } from '../draftroom';
import { addAlert } from './alerts';
import { clubState } from './fans';
import { addNews } from './news';
import type { Decision, LeagueState } from './state';
import { DISPUTE as D } from './tuning';

const FAMILY = ['남궁', '서문', '황보', '독고', '제갈', '선우', '사공', '동방'];
const GIVEN = ['태진', '석호', '영길', '만수', '정훈', '기덕', '상철', '동하'];
const FIRMS = ['동방인베스트', '한결파트너스', '청운캐피탈', '태평홀딩스', '새솔투자'];
const money = (n: number) => `${Math.round(n / 10000)}억 원`;

/** A winter's look at the dispute: the verdict on one being fought (no decision), or, very rarely, a new claim. */
export function disputeDecision(s: LeagueState, year: number): Decision | null {
  const u = s.user;
  if (!u || u.settings.parentType !== 'namingRights' || year < u.firstTeamYear) return null;
  const d = u.dispute;
  if (d?.verdictIn === year) {
    verdict(s, year);
    return null;
  }
  if (d) return null;
  const r = rng(`${s.seed}|dispute|${year}`);
  if (r() >= D.chance) return null;
  const investor = `${FAMILY[Math.floor(r() * FAMILY.length)]}${GIVEN[Math.floor(r() * GIVEN.length)]}`;
  const firm = FIRMS[Math.floor(r() * FIRMS.length)]!;
  u.dispute = { year, investor, firm };
  addAlert(s, {
    id: `dispute-${year}`,
    date: `${year}-11-20`,
    kind: 'dispute',
    title: `${firm} ${investor} 회장, 구단 지분 40% 요구`,
    lines: [
      `창단 때 운영 자금을 댄 ${investor} 회장이 "빌려준 돈이 아니라 지분 40%를 받기로 한 투자였다"며 상사중재를 신청했습니다.`,
      `지금 합의하면 ${money(D.settle)}, 다투면 올겨울 소송비 ${money(D.legal)}이 들고 판정은 내년 겨울에 나옵니다.`,
    ],
    tone: 'bad',
  });
  return { kind: 'dispute', investor, firm, settle: D.settle, legal: D.legal, loss: D.loss };
}

/** Settle now, or fight it out. */
export function resolveDispute(s: LeagueState, d: Extract<Decision, { kind: 'dispute' }>, answer: 'settle' | 'fight', year: number) {
  const u = s.user!;
  if (answer === 'settle') {
    u.fund -= d.settle;
    u.ledger.push({ year, label: `${d.investor} 회장 지분 분쟁 합의금`, amount: -d.settle });
    u.trust = Math.max(0, (u.trust ?? 60) - D.trust.settle);
    u.dispute = { ...u.dispute!, settled: year };
  } else {
    u.fund -= d.legal;
    u.ledger.push({ year, label: `${d.investor} 회장 지분 분쟁 소송비`, amount: -d.legal });
    u.dispute = { ...u.dispute!, verdictIn: year + 1 };
  }
  (u.log ??= []).push({ year, text: answer === 'settle' ? `${d.investor} 회장과 지분 분쟁 합의 (${money(d.settle)})` : `${d.investor} 회장의 지분 요구에 맞서 소송` });
  addNews(s, {
    id: `dispute-${year}`,
    date: `${year}-11-25`,
    kind: 'move',
    title: answer === 'settle' ? `구단, ${d.investor} 회장과 지분 분쟁 합의` : `구단, ${d.investor} 회장 지분 요구에 "투자 아닌 대여금" 맞서`,
    body:
      answer === 'settle'
        ? `구단이 창단 투자자 ${d.investor} 회장과 합의했다. 합의금은 ${money(d.settle)}으로 알려졌다. 명명권 스폰서는 "구단 운영에는 변함이 없다"고 했다.`
        : `구단은 ${d.investor} 회장의 돈이 지분 투자가 아니라 대여금이었다며 법적 대응에 나섰다. 판정은 내년 겨울께 나올 전망이다.`,
    quotes: [],
    facts: { 투자자: `${d.firm} ${d.investor}`, 대응: answer === 'settle' ? '합의' : '소송' },
    players: [],
    mine: true,
  });
}

function verdict(s: LeagueState, year: number) {
  const u = s.user!;
  const d = u.dispute!;
  const won = rng(`${s.seed}|dispute-verdict|${year}`)() < D.win;
  d.decided = year;
  delete d.verdictIn;
  if (won) u.trust = Math.min(100, (u.trust ?? 60) + D.trust.win);
  else {
    u.fund -= D.loss;
    u.ledger.push({ year, label: `${d.investor} 회장 지분 40% 되사기 (판정 패소)`, amount: -D.loss });
    u.trust = Math.max(0, (u.trust ?? 60) - D.trust.loss);
    clubState(s, u.teamId).interest -= D.fans;
  }
  addAlert(s, {
    id: `dispute-verdict-${year}`,
    date: `${year}-11-20`,
    kind: 'dispute',
    title: won ? `지분 분쟁 승소: "${d.investor} 회장의 돈은 대여금"` : `지분 분쟁 패소: ${d.investor} 회장에 지분 40%`,
    lines: won
      ? ['중재 판정과 법원이 구단의 손을 들어 줬습니다. 투자자들의 신뢰가 조금 올라갔습니다.']
      : [`구단은 ${money(D.loss)}을 들여 지분을 되사기로 했습니다.`, '구단 매각설이 돌며 팬 분위기가 가라앉았습니다.'],
    tone: won ? 'good' : 'bad',
  });
  addNews(s, {
    id: `dispute-verdict-${year}`,
    date: `${year}-11-20`,
    kind: 'move',
    title: won ? `구단, ${d.investor} 회장과의 지분 분쟁 승소` : `구단, 지분 분쟁 패소… ${d.investor} 회장 몫 40% 되사기로`,
    body: won ? `법원은 ${d.investor} 회장의 돈을 대여금으로 봤다. 구단 지배구조는 그대로다.` : `법원은 ${d.investor} 회장이 지분 40%를 받기로 한 투자자라고 판단했다. 구단은 ${money(D.loss)}에 그 지분을 되사기로 했다.`,
    quotes: [],
    facts: { 투자자: `${d.firm} ${d.investor}`, 결과: won ? '승소' : '패소' },
    players: [],
    mine: true,
  });
}

/** The scouts (here, the lawyers) advise settling. */
export const autoDispute = (): 'settle' => 'settle';
