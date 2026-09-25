/* Fictional media and fans. Inputs are allowlisted public projections, never hidden ability or future results. */
// Ported from KBO-Draft-Room df4faad src/core/press.js. See docs/UPSTREAM.md.
import DraftWriter from './writer.js';
import DraftData from './prospects.js';
import DraftRules from './draft-ai.js';

const W = DraftWriter;
const D = DraftData,
  R = DraftRules,
  K = D.ko;
const OUTLETS = [
  { id: 'diamond', name: '다이아몬드 데일리', style: '현재 기량과 당장 필요한 자리', ready: 0.68 },
  { id: 'future', name: '퓨처 베이스볼', style: '미래 가치와 재능의 폭', ready: 0.25 },
];
function forecast(players, teams, local, seed) {
  return OUTLETS.map((outlet) => {
    const r = D.rng(seed + '-mock-' + outlet.id),
      text = D.rng(seed + '-mock-text-' + outlet.id), // wording only; `r` drives the picks
      used = new Set(),
      picks = [];
    for (const round of local ? [0, 1] : [1])
      for (const t of teams) {
        const list = players.filter(
          (p) => !used.has(p.id) && (round !== 0 || (p.regionalEligible && p.region === t.region)),
        );
        const prior = picks
          .filter((s) => s.teamId === t.id)
          .map((s) => players.find((p) => p.id === s.playerId).role);
        const p = list
          .map((p) => ({
            p,
            score:
              (p.ready * outlet.ready + p.scoutCeiling * (1 - outlet.ready)) * 0.7 +
              p.publicScore * 0.2 +
              R.fit(p, t) * 0.1 -
              (prior.includes(p.role) ? 3 : 0) +
              (r() - 0.5) * 4,
          }))
          .sort((a, b) => b.score - a.score || a.p.id.localeCompare(b.p.id))[0]?.p;
        if (!p) throw Error('모의 드래프트 후보가 부족합니다.');
        used.add(p.id);
        picks.push({
          teamId: t.id,
          round,
          playerId: p.id,
          reason: W.mockReason(p, outlet.id, text),
        });
      }
    return { id: outlet.id, name: outlet.name, style: outlet.style, picks };
  });
}
function news(players, teams, selection, prior, forecasts, seed) {
  const p = players.find((p) => p.id === selection.playerId),
    t = teams.find((t) => t.id === selection.teamId),
    used = new Set(prior.map((x) => x.playerId));
  const available = players
    .filter(
      (q) => !used.has(q.id) && (selection.round !== 0 || (q.regionalEligible && q.region === t.region)),
    )
    .sort((a, b) => a.rank - b.rank);
  const remainingRank = available.findIndex((q) => q.id === p.id) + 1,
    fit = R.fit(p, t),
    owned = prior.filter(
      (s) => s.teamId === t.id && players.find((q) => q.id === s.playerId).role === p.role,
    ).length;
  const matched = forecasts
    .filter((f) =>
      f.picks.some((s) => s.teamId === t.id && s.round === selection.round && s.playerId === p.id),
    )
    .map((f) => f.name);
  const reach = remainingRank > (selection.round === 0 ? 5 : 12),
    // National pick number: the regional round is not part of the order.
    nationalPick = selection.overall - prior.filter((s) => s.round === 0).length,
    value = selection.round === 1 && p.rank <= nationalPick - 5;
  const label = selection.round === 0 ? '지역 1차' : '전국 1라운드',
    r = D.rng(seed + '-news-' + selection.overall),
    role = D.ROLES[p.role];
  // Wording draws from its own stream; `r` below only moves fan mood.
  const written = W.draftNews(
    p,
    t,
    selection,
    { reach, value, matched, fit, owned, local: selection.round === 0, remainingRank, nationalPick },
    D.rng(seed + '-news-text-' + selection.overall),
  );
  const delta = D.clamp(
    (fit >= 80 ? 2 : fit >= 60 ? 1 : -1) +
      (matched.length ? 2 : 0) +
      (value ? 1 : 0) -
      (reach ? 2 : 0) -
      (owned ? 1 : 0) +
      Math.floor(r() * 3) -
      1,
    -5,
    5,
  );
  return {
    id: 'pick-' + selection.overall,
    overall: selection.overall,
    teamId: t.id,
    playerId: p.id,
    round: selection.round,
    label,
    ...written,
    delta,
    reason: `${label} 반응 · ${matched.length ? '예측 일치' : '예측과 다른 선택'} · ${fit >= 60 ? '보강 연계' : '재능 우선'}${reach ? ' · 이른 선택에 대한 우려' : ''}`,
  };
}
const GM_CHOICES = [
  {
    id: 'immediate',
    title: '1군 경쟁을 약속합니다',
    answer:
      '첫해부터 경쟁에 나설 자원을 뽑았습니다. 신인 두 명 이상에게 1군 경험이 생기는지 지켜봐 주십시오.',
    promise: '첫해 1군 경험 2명 이상',
    risk: '현재 기량이 높아도 출전은 보장되지 않습니다.',
  },
  {
    id: 'development',
    title: '육성 과정을 약속합니다',
    answer:
      '첫해 숫자만으로 서두르지 않겠습니다. 신인 다수가 각자의 육성 과제를 이행하도록 준비하겠습니다.',
    promise: '신인의 60% 이상이 계획 이행 70점 이상',
    risk: '1군 미데뷔는 실패가 아니지만 실제 발전은 필요합니다.',
  },
  {
    id: 'needs',
    title: '보강과 활용을 약속합니다',
    answer:
      '세 가지 우선 보강 자리를 채우고, 그 자리의 신인 두 명 이상이 첫해 계획을 이행하도록 돕겠습니다.',
    promise: '3개 보강 포지션 확보 + 해당 신인 2명 이상 계획 이행 70점',
    risk: '지명한 자리의 수만큼 실제 육성 이행도 살펴봅니다.',
  },
  {
    id: 'core5',
    title: '5년 안에 주전 셋을 약속합니다',
    answer: '첫해 성적으로 평가받을 생각은 없습니다. 5년 안에 이번 신인 중 세 명을 주전으로 만들겠습니다.',
    promise: '5시즌 안에 이번 지명 선수 3명 이상 우리 팀 주전 경험',
    risk: '첫해 평가에는 반영되지 않고, 5년 차가 끝난 뒤 팬들이 평가합니다.',
  },
];
function gmOptions(players, team) {
  const prospects = players.filter((p) => p.ready >= 45 || p.scoutCeiling >= 55).length;
  const ready = players.filter((p) => p.ready >= 45).length,
    development = players.length - ready,
    covered = team.needs.filter((role) => players.some((p) => p.role === role)).length;
  return GM_CHOICES.map((c) => ({
    ...c,
    delta:
      c.id === 'immediate'
        ? ready >= 2
          ? 5
          : -3
        : c.id === 'development'
          ? development >= Math.ceil(players.length / 2)
            ? 3
            : -1
          : c.id === 'core5'
            ? prospects >= 3
              ? 2
              : -1
            : covered === 3
            ? 4
            : covered === 2
              ? 1
              : -2,
    reaction:
      c.id === 'immediate'
        ? `공개 현재 기량상 1군 경쟁 후보는 ${ready}명입니다. 기대와 부담이 함께 커집니다.`
        : c.id === 'development'
          ? `퓨처스 육성 우선 후보는 ${development}명입니다. 기다림을 설명하되 발전을 보여야 합니다.`
          : c.id === 'core5'
            ? `주전감으로 꼽히는 신인은 ${prospects}명입니다. 5년 뒤 성적표가 나옵니다.`
          : `우선 보강 포지션 ${covered}/3개를 확보했습니다. 활용 계획도 함께 평가합니다.`,
  }));
}
function accountability(choice, players, season, team) {
  const major = season.filter((s) => s.stats.games > 0).length,
    good = season.filter((s) => s.planScore >= 70).length,
    target = Math.ceil(players.length * 0.6),
    covered = team.needs.filter((role) => players.some((p) => p.role === role)).length;
  const useful = season.filter(
    (s) => s.planScore >= 70 && team.needs.includes(players.find((p) => p.id === s.playerId).role),
  ).length;
  let bonus = 0,
    detail = '';
  if (choice === 'core5') return { bonus: 0, detail: '5년 차 시즌이 끝난 뒤 평가합니다', status: '평가 대기' };
  if (choice === 'immediate') {
    bonus = major >= 2 ? 4 : major === 1 ? 0 : -4;
    detail = `1군 경험 ${major}/2명`;
  }
  if (choice === 'development') {
    bonus = good >= target ? 3 : good === target - 1 ? 0 : -3;
    detail = `계획 이행 70점 이상 ${good}/${target}명`;
  }
  if (choice === 'needs') {
    bonus = covered === 3 && useful >= 2 ? 4 : covered >= 2 && useful >= 1 ? 0 : -3;
    detail = `보강 ${covered}/3개 · 해당 선수 계획 이행 ${useful}/2명`;
  }
  return { bonus, detail, status: bonus > 0 ? '약속 이행' : bonus < 0 ? '약속 미달' : '부분 이행' };
}
/**
 * The press conference's first two questions. `first`: our first signed pick (public projection) or null;
 * `refused`: names of our picks who refused to sign; `spentShare`: share of the budget committed.
 */
function gmQuestions({ first, firstLabel, refused, spentShare, boost, team }) {
  const out = [];
  if (first) {
    const f = R.fit(first, team);
    out.push({
      id: 'first',
      question: `${firstLabel} ${first.name}${K.particle(first.name, '을/를')} 먼저 뽑은 이유는 무엇입니까?`,
      options: [
        { id: 'now', title: '바로 쓸 선수입니다', answer: '캠프부터 1군에서 경쟁시킵니다. 올해 1군에서 보실 겁니다.', delta: first.ready >= 45 ? 2 : -1, pledge: `첫해 ${first.name} 1군 출전` },
        { id: 'project', title: '길게 보고 키웁니다', answer: '당장보다 3–4년 뒤가 기대되는 선수입니다. 그때 주전으로 세우겠습니다.', delta: first.scoutCeiling >= 55 ? 2 : 0, pledge: `4시즌 안에 ${first.name} 주전` },
        { id: 'fit', title: '가장 필요한 자리였습니다', answer: '우리 팀에 제일 급한 포지션을 채웠습니다.', delta: f >= 80 ? 3 : -2, pledge: null },
      ],
    });
  }
  if (refused.length)
    out.push({
      id: 'issue',
      question: `${refused.join(', ')} 선수가 계약을 거부했습니다. 협상에 문제는 없었습니까?`,
      options: [
        { id: 'apologize', title: '제 책임입니다', answer: '협상을 매끄럽게 풀지 못했습니다. 팬들께 죄송합니다.', delta: 1, pledge: null },
        { id: 'respect', title: '선수 선택을 존중합니다', answer: '선수가 더 나은 길이라고 판단했다면 존중해야 합니다.', delta: -1, pledge: null },
        { id: 'principle', title: '원칙을 지켰습니다', answer: '한 선수에게 예산을 몰아줄 수는 없었습니다. 남은 돈은 육성에 씁니다.', delta: boost >= 0.05 ? 1 : -2, pledge: null },
      ],
    });
  else if (spentShare >= 0.95)
    out.push({
      id: 'issue',
      question: '계약금으로 예산을 거의 다 썼습니다. 지나친 지출 아닙니까?',
      options: [
        { id: 'worth', title: '그만한 선수들입니다', answer: '몇 년 뒤 성적으로 증명하겠습니다.', delta: 1, pledge: null },
        { id: 'sorry', title: '부담이 큰 건 맞습니다', answer: '다음 해에는 더 신중하게 쓰겠습니다.', delta: 0, pledge: null },
      ],
    });
  else
    out.push({
      id: 'issue',
      question: '남은 예산은 어디에 쓰십니까?',
      options: [
        { id: 'develop', title: '신인 육성에 씁니다', answer: '코치와 훈련 시설에 투자해 신인들이 빨리 크도록 돕겠습니다.', delta: 2, pledge: null },
        { id: 'save', title: '아껴 두겠습니다', answer: '구단 살림도 생각해야 합니다.', delta: -1, pledge: null },
      ],
    });
  return out;
}

const api = { OUTLETS, GM_CHOICES, forecast, news, gmOptions, gmQuestions, accountability };
export default api;
