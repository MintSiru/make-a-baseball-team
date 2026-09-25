/* Voices: the rookie's first words, the manager's comment and the scout director's advice.
   Text only, built from public information. Each voice draws from its own text stream, so wording never
   changes a result. Players talk like players, the manager like a manager, the scout like a scout. */
// Ported from KBO-Draft-Room df4faad src/core/voices.js. See docs/UPSTREAM.md.
import DraftData from './prospects.js';
import DraftClubs from './clubs.js';
import DraftWriter from './writer.js';

const D = DraftData;
const TEAMS = DraftClubs;
const W = DraftWriter;
const { ROLES, rng } = D;
const K = D.ko,
  G = D.grades;
const { one, fill } = W;
const isPitcher = (p) => p.role === 'SP' || p.role === 'RP';
const bestTool = (p) => Object.entries(p.tools).filter(([k]) => k !== 'eye').sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

// ------------------------------------------------------------ rookie interview

const OPENERS = {
  local: ['어릴 때부터 {team} 경기를 보면서 컸습니다. 연고 팀이라 더 기쁩니다.', '계속 {region}에서 야구를 했는데, 고향 팀 유니폼을 입게 됐습니다.', '{school} 선배들이 뛰던 팀이라 꼭 오고 싶었어요.'],
  early: ['이렇게 일찍 불릴 줄은 솔직히 몰랐습니다.', '이름이 불리는 순간 머리가 하얘졌어요.', '예상보다 훨씬 빨리 불렸어요. 그만큼 기대하신다는 뜻이니까 책임감이 큽니다.'],
  late: ['생각보다 늦게 불려서 마음 졸였습니다. 그래도 불러 주신 팀에서 보여 드리겠습니다.', '기다리는 동안 솔직히 불안했어요. 이제 순번은 신경 안 쓰고 야구만 하겠습니다.', '순번은 늦었지만 출발선은 같다고 생각합니다.'],
  independent: ['{prev|을/를} 거쳐 독립리그에서 다시 준비했습니다. 포기 안 하길 잘했어요.', '한 번 떨어지고 나서 매일 새벽에 훈련했습니다. 그 시간이 오늘을 만든 것 같습니다.', '다시 불릴 수 있다고 믿고 버텼습니다. 기다려 준 가족한테 제일 고맙습니다.'],
  early_college: ['2학년인데 얼리로 나왔습니다. 빨리 프로에서 부딪혀 보고 싶었어요.', '대학 감독님이 도전해 보라고 등을 밀어 주셨습니다.'],
  two_year: ['2년제에서 빨리 프로에 도전하고 싶었습니다.', '{school}에서 2년 동안 몸을 만들었습니다. 고등학교 때보다 훨씬 준비됐다고 생각해요.', '2년 동안 매일 웨이트부터 다시 했습니다. 그게 오늘 이름이 불린 이유 같아요.'],
  abroad: ['중학교 졸업하고 혼자 유학을 갔습니다. 한국 프로는 늘 목표였어요.', '밖에서 3년 동안 야구하면서 많이 배웠습니다. 이제 한국에서 보여 드릴 차례예요.'],
  college: ['고등학교 때 지명을 못 받고 대학에 갔습니다. 4년 동안 준비한 게 헛되지 않았네요.', '{school}에서 4년 동안 많이 배웠습니다. 그때 지명 못 받은 게 오히려 약이 됐어요.'],
  overseas: ['해외에서 혼자 야구하면서 한국 무대가 계속 그리웠습니다.', '밖에서 배운 걸 한국에서 보여 드리고 싶어요.', '돌아오는 결정이 쉽지 않았는데, 불러 주셔서 감사합니다.'],
  plain: ['{team}에 오게 돼서 정말 기쁩니다.', '부모님이 제일 먼저 생각났어요.', '{school} 감독님이랑 동료들한테 고맙다는 말부터 하고 싶습니다.', '어릴 때부터 꿈꾸던 순간입니다.'],
};
const TRAITS = {
  '차분한 노력파': ['말보다는 훈련량으로 보여 드리겠습니다.', '매일 똑같이 준비하는 게 제 장점입니다.'],
  '승부욕 강한 도전자': ['같은 포지션 선배님들하고도 당당하게 경쟁하겠습니다.', '지는 걸 정말 싫어합니다.'],
  '밝은 분위기 메이커': ['더그아웃 분위기는 제가 책임지겠습니다.', '먼저 인사하고 많이 물어보는 신인이 되겠습니다.'],
  '분석을 즐기는 연구형': ['제 영상은 거의 매일 돌려 봅니다.', '데이터 보는 걸 좋아해서 프로 전력분석이 기대돼요.'],
  '책임감 강한 리더': ['고등학교 때 주장을 했습니다. 팀을 먼저 생각하겠습니다.', '동기들이랑 같이 크고 싶습니다.'],
  '말보다 행동하는 실천형': ['말보다 결과로 보여 드리겠습니다.', '정해 둔 훈련은 무조건 지킵니다.'],
  '꾸준함을 믿는 성실형': ['하루하루 쌓이는 게 제일 무섭다고 믿습니다.', '다치지 않고 꾸준히 뛰는 게 목표입니다.'],
  '큰 무대를 즐기는 대담형': ['관중 많은 경기에서 더 잘하는 편이에요.', '만원 관중 앞에서 뛰어 보고 싶습니다.'],
};
const GOALS = {
  readyPitcher: ['올해 1군 마운드에 서는 게 첫 목표입니다.', '캠프에서 제 자리를 만들겠습니다.', '신인왕 욕심도 조금은 있습니다.'],
  readyHitter: ['1군 타석에 빨리 서고 싶습니다.', '캠프에서 제 자리를 만들겠습니다.', '신인왕 욕심도 조금은 있습니다.'],
  later: ['서두르지 않겠습니다. 2군에서 몸부터 만들겠습니다.', '퓨처스에서 제대로 준비해서 올라가겠습니다.', '1~2년 안에 1군에서 인사드리겠습니다.', '프로에서는 {focus}부터 신경 쓰겠습니다.'],
};

// ------------------------------------------------------------ manager

const COACH_TOOL = {
  stuff: '직구 힘은 이미 프로 수준입니다.', command: '제구가 되는 투수라 계산이 섭니다.', breaking: '변화구는 바로 1군에서 통할 공입니다.',
  stamina: '선발로 길게 쓸 수 있는 체력이 있습니다.', contact: '방망이에 맞히는 재주가 있습니다.', power: '한 방이 있는 타자입니다.',
  speed: '발은 지금 당장 1군에서도 쓸 수 있습니다.', defense: '수비는 바로 써도 됩니다.',
};

// ------------------------------------------------------------ scout director

const VERDICT = {
  즉전감: ['바로 쓸 선수입니다. 1군 캠프 명단에 넣어도 됩니다.', '완성도로는 이 순번에서 가장 앞섭니다.'],
  실링: ['3년을 보고 뽑는 선수입니다. 실링은 이번 클래스에서도 손꼽힙니다.', '지금보다 3년 뒤가 궁금한 선수입니다. 기다릴 각오가 있다면 추천합니다.'],
  플로어: ['크게 실패할 선수는 아닙니다. 대신 스타가 될지는 물음표입니다.', '안전한 선택입니다. 1군 백업까지는 계산이 섭니다.'],
  육성형: ['당장은 아닙니다. 2군에서 2년은 키워야 합니다.', '몸이 덜 됐습니다. 육성 계획이 먼저 서야 하는 선수입니다.'],
  역할형: ['역할이 분명한 선수입니다. 주전보다는 쓰임새를 보고 뽑는 겁니다.', '한 자리를 메우는 데는 충분합니다.'],
};

/** Adds interview/coach/scoutAdvice to the engine API `C` (avoids a require cycle). */
function install(C) {
  const { teamFor, fit, myPicks, poolFor, available } = C;

  function interview(p, s, g, context = 'live') {
    const t = teamFor(g, s.teamId || g.teamId),
      r = rng(g.seed + '-voice-' + p.id + '-' + context),
      fav = g.difficulty === 'easy' && TEAMS[p.favoriteTeam].id === t.id;
    // National pick number, compared with the public rank to spot early or late calls.
    const regional = g.schedule.filter((x) => x.round === 0).length;
    const pickNo = s.round === 0 ? null : (s.overall ?? 0) - regional;
    const key =
      s.round === 0 ? 'local'
      : p.pathway === '독립구단' ? 'independent'
      : p.pathway === '대학 얼리' ? 'early_college'
      : p.pathway === '대졸' ? 'college'
      : p.pathway === '2년제' ? 'two_year'
      : p.pathway === '야구 유학' ? 'abroad'
      : p.pathway === '해외파' || p.proExperience ? 'overseas'
      : pickNo && p.rank < pickNo - 12 ? 'late'
      : pickNo && p.rank > pickNo + 12 ? 'early'
      : 'plain';
    const vars = { team: t.short, region: p.region, school: p.school, prev: p.history.at(-2)?.name ?? p.highSchoolName, focus: p.focus };
    const middle = fav ? `사실 어릴 때부터 ${t.short} 팬이었어요.` : one(TRAITS[p.personality] || TRAITS['차분한 노력파'], r);
    const goal = one(p.ready >= 45 ? GOALS[isPitcher(p) ? 'readyPitcher' : 'readyHitter'] : GOALS.later, r);
    return [fill(one(OPENERS[key], r), vars), middle, fill(goal, vars)].join(' ');
  }

  function coach(p, g) {
    const t = teamFor(g),
      r = rng(g.seed + '-coach-' + p.id),
      role = ROLES[p.role];
    const start = one(
      fit(p, t) >= 60
        ? [`${K.p(role, '은/는')} 우리가 가장 필요했던 자리입니다.`, `${role} 보강이 이번 드래프트 첫 번째 과제였습니다.`, `${role} 쪽은 몇 년째 고민이었습니다.`]
        : ['포지션보다 선수를 봤습니다.', '당장 필요한 자리는 아니지만 이 재능은 놓칠 수 없었습니다.', '우리 팀에 없는 유형이라 욕심이 났습니다.'],
      r,
    );
    const [tool, grade] = bestTool(p);
    const remark = grade >= 50 ? COACH_TOOL[tool] : '아직 다듬을 게 많지만 몸이 좋습니다.';
    const plan = one(
      p.ready >= 45
        ? ['캠프에서 직접 보고 기회를 주겠습니다.', '자리는 스스로 만들어야 합니다. 기회는 주겠습니다.', '보직은 캠프가 끝나고 정하겠습니다.']
        : [`첫해는 2군에서 ${p.focus}에 집중합니다.`, '급하게 올리지 않겠습니다. 1~2년 뒤를 보고 키웁니다.', '퓨처스 코치들한테 맡겨 두겠습니다. 좋은 습관이 먼저입니다.'],
      r,
    );
    return [start, remark, plan].join(' ');
  }

  function scoutAdvice(p, g) {
    const t = teamFor(g),
      mine = myPicks(g),
      byId = poolFor(g).byId,
      role = ROLES[p.role],
      r = rng(`${g.seed}-advice-${p.id}-${g.cursor}`);
    const owned = mine.filter((s) => byId[s.playerId].role === p.role).length;
    const candidates = available(g),
      similar = candidates.filter((q) => q.id !== p.id && q.role === p.role && q.rank <= p.rank + 15).length;
    const missing = t.needs.filter((x) => !mine.some((s) => byId[s.playerId].role === x));
    const lines = [];

    lines.push(one(VERDICT[p.pickTags[0]] || VERDICT.역할형, r));
    if (owned > 0)
      lines.push(missing.length ? `${K.p(role, '은/는')} 이미 ${owned}명 뽑았습니다. ${ROLES[missing[0]]} 자리가 비어 있는 걸 잊지 마세요.` : `보강 자리는 다 채웠습니다. 이제는 재능 순서대로 가도 됩니다.`);
    else if (fit(p, t) >= 60) lines.push(`${K.p(role, '은/는')} 우리 보강 ${t.needs.indexOf(p.role) + 1}순위 자리입니다. 뽑으면 바로 채워집니다.`);
    else lines.push('보강 자리는 아닙니다. 재능을 보고 가는 선택입니다.');
    if (g.difficulty === 'hard') return { title: `${p.name} · 팀장 의견`, lines: [...lines, `걸리는 점: ${p.weakness}`] };

    lines.push(
      similar === 0 ? `이 급의 ${K.p(role, '은/는')} 이 선수가 마지막입니다.`
      : similar <= 2 ? `비슷한 급의 ${K.p(role, '은/는')} ${similar}명밖에 안 남았습니다. 다음 차례엔 없을 수 있습니다.`
      : `비슷한 급의 ${K.p(role, '이/가')} ${similar}명 더 남아 있습니다. 급할 건 없습니다.`,
    );
    const need = t.detailedNeeds?.find((x) => x.role === p.role);
    if (need) {
      const label = G.LABELS[need.key] || { ready: '현재 기량', scoutCeiling: '미래 가치', floorGrade: '플로어' }[need.key];
      const value = p.tools?.[need.key] ?? p[need.key];
      lines.push(value >= need.target ? `우리가 찾던 '${need.label}'에 맞습니다. ${label} ${value}.` : `'${need.label}'로 보기엔 ${label}(${value})${K.particle(label, '이/가')} 아직 기준(${need.target})에 못 미칩니다.`);
    }
    if (p.proExperience) lines.push('해외 리그 기록이라 수준 차이를 감안해서 보세요.');
    else if (p.record.kind === 'pitcher' && p.record.outs < 90) lines.push('던진 이닝이 적습니다. 평균자책점은 크게 믿지 마세요.');
    else if (p.uncertainty === '높음') lines.push('고졸이라 평가 오차가 큽니다. 몸이 크면서 달라질 수 있습니다.');
    else if (p.awards.length) lines.push(`${p.awards[0]} 경험이 있습니다. 큰 경기 경험은 됐습니다.`);
    if (g.difficulty === 'easy') {
      const alternatives = candidates
        .filter((q) => q.id !== p.id)
        .sort((a, b) => b.publicScore + fit(b, t) * 0.12 - (a.publicScore + fit(a, t) * 0.12))
        .slice(0, 2);
      lines.push('대안으로는 ' + alternatives.map((q) => `${q.name}(${ROLES[q.role]}, ${q.rank}위)`).join(', ') + '도 볼 만합니다.');
    }
    return { title: `${p.name} · 팀장 의견`, lines };
  }

  Object.assign(C, { interview, coach, scoutAdvice });
}

const api = { install };
export default api;
