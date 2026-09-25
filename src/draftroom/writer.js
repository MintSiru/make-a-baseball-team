/* Writer: scouting notes, draft news, fan comments and mock-draft blurbs.

   Rules for everything in here:
   - Only public information (the scouting projection, amateur records, velocity), never hidden ability.
   - Every choice of wording draws from a text-only random stream passed in by the caller. Text streams never
     feed the simulation, so wording can change freely without changing any result or old save.
   - Write like a scout's notebook, a sports desk or a fan forum. No hedging boilerplate. */
// Ported from KBO-Draft-Room df4faad src/core/writer.js. See docs/UPSTREAM.md.
import DraftKo from './ko.js';
import DraftGrades from './grades.js';
import DraftBio from './biography.js';

const K = DraftKo,
  G = DraftGrades,
  Bio = DraftBio;
const ROLES = G.ROLES;

const one = (list, r) => list[Math.floor(r() * list.length)];
/** Up to n distinct items, in random order. */
function some(list, n, r) {
  const pool = [...list],
    out = [];
  while (pool.length && out.length < n) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}
const fill = (text, vars) => text.replace(/\{(\w+)(?:\|([^}]+))?\}/g, (_, k, pair) => (pair ? K.p(vars[k], pair) : vars[k]));
const isPitcher = (p) => p.role === 'SP' || p.role === 'RP';

// ------------------------------------------------------------ scouting notes (강점 / 과제)

// Pitch the breaking-ball line talks about, from the archetype index (see ARCHETYPES in prospects.js).
const pitchName = (p) => (p.role === 'SP' ? ['슬라이더', '슬라이더', '체인지업', '투심', '커브'] : ['슬라이더', '슬라이더', '슬라이더', '싱커', '포크볼'])[p.type] ?? '슬라이더';

const GOOD = {
  stuff: ['직구에 힘이 있다. 높은 코스로 헛스윙을 뺏는다.', '공 끝이 살아 있어 타자 앞에서 한 번 더 뻗는다.', '구속보다 체감이 빠른 공이다. 타자들이 계속 늦는다.', '직구 하나로 카운트를 잡고 승부까지 간다.'],
  command: ['원하는 코스에 넣는다. 볼넷으로 무너지는 유형이 아니다.', '초구 스트라이크 비율이 높다. 카운트 싸움이 된다.', '제구가 안정적이라 투구 수가 적다.', '양쪽 코너를 다 쓴다. 볼 배합이 어른스럽다.'],
  breaking: ['{pitch} 각이 날카롭다. 결정구로 바로 쓸 수 있다.', '{pitch|을/를} 원하는 카운트에 던진다.', '{pitch|이/가} 직구와 같은 팔 스윙에서 나온다.', '{pitch|으로/로} 헛스윙을 만든다. 좌우 타자 가리지 않는다.'],
  stamina: ['투구 수 100개 가까이 가도 구위가 유지된다.', '연투에도 회복이 빠르다.', '긴 이닝을 맡겨도 버틴다. 체력은 이미 선발감이다.'],
  contact: ['배트 컨트롤이 좋다. 삼진이 적다.', '반대 방향으로 밀어 치는 타격이 된다.', '공을 오래 보고 맞히는 능력이 있다.', '어떤 카운트에서도 인플레이 타구를 만든다.'],
  power: ['타구 속도가 빠르다. 제대로 맞으면 담장을 넘긴다.', '당겨 치는 힘이 있다. 장타가 꾸준히 나온다.', '몸쪽 공을 끌어당겨 넘길 수 있다.'],
  speed: ['1루까지 4초 초반. 내야 안타가 많다.', '주루 판단이 빠르고 도루 스타트가 좋다.', '발로 한 베이스를 더 가는 선수다.'],
  eye: ['유인구에 잘 속지 않는다. 볼넷을 고를 줄 안다.', '존을 아는 타자다. 불리한 카운트에서도 버틴다.'],
  defenseC: ['블로킹이 안정적이고 2루 송구가 빠르다.', '프레이밍이 좋다. 투수들이 편하게 던진다.', '어깨가 강해 도루 저지가 된다.'],
  defenseIF: ['첫발이 빠르고 송구가 정확하다.', '글러브 핸들링이 부드럽다. 까다로운 바운드도 잡는다.', '수비 범위가 넓다. 유격수도 볼 수 있다.'],
  defenseOF: ['타구 판단이 빠르다. 수비 범위가 넓다.', '어깨가 강해 주자를 묶는다.', '펜스 플레이를 겁내지 않는다.'],
};
const BAD = {
  stuff: ['직구 구위가 평범하다. 몰리면 맞는다.', '직구로 헛스윙을 못 뺏는다. 결정구가 늘 변화구다.'],
  command: ['제구가 들쭉날쭉하다. 볼넷이 많다.', '릴리스 포인트가 흔들린다. 같은 공을 두 번 못 던진다.', '주자가 나가면 제구가 급격히 흔들린다.'],
  breaking: ['변화구가 밋밋하다. 결정구가 필요하다.', '변화구 제구가 안 돼 결국 직구 타이밍에 걸린다.', '{pitch|이/가} 손에서 빠지는 날이 많다.'],
  stamina: ['5이닝이 넘어가면 구위가 떨어진다.', '체력이 약하다. 짧은 이닝이 맞는 유형이다.'],
  contact: ['변화구에 배트가 따라 나간다. 삼진이 많다.', '빠른 공에 밀린다. 타이밍이 늦다.', '스윙이 커서 콘택트가 들쭉날쭉하다.'],
  power: ['타구에 힘이 부족하다. 장타가 거의 없다.', '맞혀도 외야를 넘기지 못한다. 근력이 과제다.'],
  speed: ['발이 느려 주루에서 손해를 본다.', '주력이 떨어져 병살타가 많다.'],
  eye: ['초구부터 방망이가 나간다. 볼넷이 적다.'],
  defenseC: ['블로킹과 포구가 불안하다.', '2루 송구가 느리다. 도루를 자주 허용한다.'],
  defenseIF: ['송구 실책이 잦다.', '첫발이 늦어 옆 타구에 약하다.'],
  defenseOF: ['타구 판단이 늦다. 뒤로 가는 타구에 약하다.', '어깨가 약해 주자에게 한 베이스를 더 준다.'],
};
const noteKey = (p, tool) => (tool === 'defense' ? 'defense' + (p.role === 'C' ? 'C' : p.role === 'IF' ? 'IF' : 'OF') : tool);

// Grade 45–50: solid but not a carrying tool.
const FAIR = {
  stuff: ['직구 힘은 평균 이상이다.', '직구가 묵직하다. 구속은 더 오를 여지가 있다.', '직구 회전이 괜찮다.'],
  command: ['제구가 크게 흔들리지 않는다.', '스트라이크를 던질 줄 안다.', '볼넷으로 자멸하는 유형은 아니다.'],
  breaking: ['{pitch|은/는} 이미 쓸 만하다.', '{pitch} 하나는 확실히 던진다.', '변화구 감각이 있다.'],
  stamina: ['선발로 5이닝은 버틴다.', '체력은 문제없다.'],
  contact: ['맞히는 재주가 있다.', '콘택트는 평균 이상이다.', '타석에서 쉽게 물러서지 않는다.'],
  power: ['힘은 있다. 타구에 무게가 실린다.', '가끔 큰 타구가 나온다.'],
  speed: ['발이 빠른 편이다.', '주루는 평균 이상.'],
  eye: ['볼넷을 고를 줄 안다.'],
  defenseC: ['포구는 안정적이다.', '포수 기본기가 돼 있다.'],
  defenseIF: ['수비 기본기가 탄탄하다.', '송구가 안정적이다.'],
  defenseOF: ['외야 수비는 무난하다.', '어깨는 평균 이상이다.'],
};
const PLAIN = ['눈에 띄는 무기는 아직 없다.', '툴은 평범하지만 {tool|이/가} 그나마 낫다.', '아직 전체적으로 평균 아래다.', '{tool|이/가} 가장 낫지만 무기라고 하긴 이르다.'];
const UPSIDE = ['몸이 아직 덜 여물었다. 힘이 붙으면 한 단계 올라설 선수다.', '1~2년 뒤 평가가 크게 달라질 수 있다.', '{grow} 쪽은 앞으로 더 좋아질 여지가 크다.', '지금보다 몸이 커진 뒤를 봐야 하는 선수다.'];
const READY = { pitcher: ['프로 공에도 바로 적응할 완성도다.', '당장 1군 불펜에서 던질 수 있다.'], hitter: ['프로 투수 공에도 적응이 빠를 타입이다.', '당장 1군 대타·대수비로 쓸 수 있다.'] };
const SHORT = ['{tool|은/는} 아직 평균에 못 미친다.', '{tool} 쪽 보완이 먼저다.', '{tool|이/가} 약점으로 꼽힌다.'];
const SLOW = ['직구 최고 {v}km/h. 구속을 더 끌어올려야 한다.', '최고 {v}km/h로 구속이 아쉽다.', '구속이 {v}km/h에서 멈춰 있다. 힘을 더 붙여야 한다.'];

/** Strength and development-task lines from the public tool grades, projections and velocity. */
function scoutNotes(p, r) {
  const pitcher = isPitcher(p);
  const tools = Object.entries(p.tools).filter(([k]) => k !== 'eye' || !pitcher);
  const byGrade = [...tools].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [bestTool, bestGrade] = byGrade[0],
    [worstTool, worstGrade] = byGrade.at(-1);
  const [growTool, growBy] = tools.map(([k, v]) => [k, (p.futureTools?.[k] ?? v) - v]).sort((a, b) => b[1] - a[1])[0];
  const vars = { pitch: pitchName(p), tool: G.LABELS[bestTool], grow: G.LABELS[growTool], v: p.velocity };

  const strength = [];
  if (pitcher && p.velocity >= 148) strength.push(`최고 ${p.velocity}km/h.`);
  strength.push(fill(one(bestGrade >= 55 ? GOOD[noteKey(p, bestTool)] : bestGrade >= 45 ? FAIR[noteKey(p, bestTool)] : PLAIN, r), vars));
  if (p.pickTags?.includes('즉전감')) strength.push(one(READY[pitcher ? 'pitcher' : 'hitter'], r));
  else if (growBy >= 10 || p.pickTags?.includes('실링')) strength.push(fill(one(UPSIDE, r), vars));

  let weakness;
  if (pitcher && p.velocity <= 141) weakness = fill(one(SLOW, r), vars);
  else if (pitcher && p.velocity >= 147 && p.tools.stuff <= 40 && p.tools.command > 30)
    weakness = one(['구속은 나오는데 공이 가볍다. 회전수가 아쉽다.', '빠른 공이 밋밋하게 들어간다. 구속만큼 헛스윙이 안 나온다.'], r);
  else if (worstGrade >= 50) weakness = '약점이 두드러지지 않는다. 한 가지 확실한 무기를 만드는 게 과제다.';
  else if (worstGrade >= 40) weakness = fill(one(SHORT, r), { ...vars, tool: G.LABELS[worstTool] });
  else weakness = fill(one(BAD[noteKey(p, worstTool)], r), vars);
  return { strength: strength.join(' '), weakness };
}

// ------------------------------------------------------------ mock drafts

const TOOL_ADJ = { stuff: '힘 있는 공을 던지는', command: '제구가 되는', breaking: '변화구가 좋은', stamina: '긴 이닝을 버티는',
  contact: '정확하게 맞히는', power: '한 방이 있는', speed: '발 빠른', defense: '수비가 좋은', eye: '눈 좋은' };
function mockReason(p, outletId, r) {
  const tag = p.pickTags[0];
  const [best] = Object.entries(p.tools).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const now = ['당장 1군 엔트리에 넣을 수 있는 완성도.', '캠프부터 경쟁시킬 수 있는 선수.', '가장 빨리 1군에 올라올 후보.', '즉시 전력 기준으로는 이 순번에 가장 가깝다.'];
  const later = ['2~3년 뒤를 보는 지명.', '지금보다 3년 뒤가 더 궁금한 선수.', '실링은 이번 클래스 상위권.', '키워서 쓰는 팀이라면 놓치기 어렵다.'];
  const role = isPitcher(p) && p.velocity >= 147 ? `${p.velocity}km/h를 던지는 ${ROLES[p.role]}.` : `${TOOL_ADJ[best]} ${ROLES[p.role]}.`;
  return `${role} ${one(outletId === 'diamond' || tag === '즉전감' ? now : later, r)}`;
}

// ------------------------------------------------------------ draft news

const DAY = (() => {
  const [, m, d] = Bio.DRAFT_DATE.split('-').map(Number);
  return { month: m, day: d };
})();

function amateurFact(p) {
  const r = p.record;
  if (!r) return '';
  const where = p.pathway === '고졸' ? '올해 고교 무대에서' : ['대졸', '대학 얼리', '2년제'].includes(p.pathway) ? '대학리그에서' : p.proExperience ? '해외 마지막 시즌' : '지난 시즌';
  if (r.kind === 'pitcher') {
    const ip = `${Math.floor(r.outs / 3)}${r.outs % 3 ? '⅓⅔'[r.outs % 3 - 1] : ''}`;
    return `${where} ${r.games}경기 ${ip}이닝, 평균자책점 ${r.era.toFixed(2)}, 탈삼진 ${r.k}개를 기록했다.`;
  }
  return `${where} ${r.games}경기 타율 ${r.avg.toFixed(3).replace(/^0/, '')}, ${r.hr}홈런 ${r.sb}도루를 기록했다.`;
}

/**
 * Headline, body and three fan comments for a regional or first-round pick.
 * `f` holds the situation computed by press.js (reach, value, matched outlets, fit, owned, local).
 */
function draftNews(p, t, selection, f, r) {
  const role = ROLES[p.role];
  const age = p.age ? `(${p.age})` : '';
  const where = selection.round === 0 ? '지역 1차 지명으로' : `1라운드 ${((selection.overall - 1) % 10) + 1}순위로`;
  const hook =
    isPitcher(p) && p.velocity >= 150 ? `최고 ${p.velocity}km/h ${p.throwHand === '좌' ? '좌완' : '우완'}`
    : f.local ? '연고 출신'
    : p.pathway === '고졸' && p.rank <= 5 ? '고교 최대어'
    : p.proExperience ? '해외파 유턴'
    : p.pathway === '야구 유학' ? '유학파'
    : p.pathway === '2년제' ? '2년제 출신'
    : p.pathway === '독립구단' ? '독립리그 출신'
    : role;
  const headlines = f.reach
    ? [`${t.short}, ${selection.round === 0 ? '지역 1차' : '1라운드'}에 ${p.name}… "우리 눈엔 1순위"`, `예상 밖 선택… ${t.short}, ${hook} ${p.name} 지명`, `${t.short}의 과감한 선택, ${p.name}`]
    : f.value
      ? [`${t.short}, ${hook} ${p.name}${K.particle(p.name, '을/를')} 잡았다`, `'이 순번에?' ${t.short}, ${p.name} 품었다`, `${p.name}, 예상보다 늦게… 웃은 건 ${t.short}`]
      : f.matched.length
        ? [`${t.short}, 예상대로 ${hook} ${p.name}`, `${t.short}의 선택은 ${p.name}… 모의지명 적중`]
        : f.fit >= 80
          ? [`${t.short}, 급한 불 껐다… ${hook} ${p.name} 지명`, `${t.short}, ${role} 보강 1순위 과제에 ${p.name}`]
          : [`${t.short}, ${hook} ${p.name} 지명`, `${t.short}의 1라운드는 ${p.name}`];
  const lead = `${t.name}${K.particle(t.name, '이/가')} ${DAY.month}월 ${DAY.day}일 열린 ${Bio.ENTRY_YEAR} KBO 신인 드래프트에서 ${where} ${p.school} ${role} ${p.name}${age}${K.particle(p.name, '을/를')} 지명했다.`;
  const facts = [amateurFact(p)];
  if (isPitcher(p) && p.velocity) facts.push(`최고 구속은 ${p.velocity}km/h.`);
  if (p.awards?.length) facts.push(`${p.awards[0]} 경력도 있다.`);
  const context = f.reach
    ? one([`모의지명에서는 이름이 거론되지 않았던 선수다. 남은 후보 가운데 공개 순위는 ${f.remainingRank}번째였다.`, `공개 순위로는 더 뒤에 불릴 선수였지만 ${t.short}의 판단은 달랐다.`], r)
    : f.value
      ? one([`공개 순위 ${p.rank}위로, 더 앞 순번에서 불릴 것으로 예상됐다.`, `앞 순번 구단들이 지나친 덕에 ${t.short} 차례까지 남았다.`], r)
      : f.matched.length
        ? `${f.matched.join('·')}의 모의지명과 같은 선택이다.`
        : f.fit >= 60
          ? `${role}${K.particle(role, '은/는')} ${t.short}의 보강 ${t.needs.indexOf(p.role) + 1}순위 포지션이다.`
          : `보강 포지션보다 선수 개인의 재능을 우선했다.`;
  const quote = one(
    f.fit >= 60
      ? [`필요한 자리에 가장 좋은 선수가 남아 있었다`, `처음부터 이 선수를 보고 준비했다`, `${role} 쪽을 오래 지켜봤다`]
      : [`포지션보다 선수를 봤다`, `이 순번에서 가장 높게 평가한 선수`, `재능만 보면 고민할 이유가 없었다`],
    r,
  );
  const body = [lead, ...facts, context, `${t.short} 구단 관계자는 “${quote}”고 말했다.`].filter(Boolean).join(' ');
  return { headline: one(headlines, r), body, comments: fanComments(p, t, selection, f, r) };
}

// ------------------------------------------------------------ fan comments

const HANDLES = ['직관가는길', '퓨처스덕후', '2군구장지박령', '야구는9회말', '불펜걱정러', '드래프트광', '외야석한줄', '원정석매진',
  '연간회원권', '개막전티켓팅', '포수난민', '좌완수집가', '야잘알지망생', '치맥직관', '응원단장친구', '스코어북', '육성이답이다',
  '가을야구가자', '신인은사랑', '더그아웃뷰', '홈런존', '만년하위권', '1루측관중'];

function fanComments(p, t, selection, f, r) {
  const role = ROLES[p.role],
    need = ROLES[t.needs[0]];
  const says = [];
  const add = (tone, lines) => says.push({ tone, text: one(lines, r) });
  if (f.fit >= 60) add('반색', [`${role} 급했는데 잘 뽑았다`, `드디어 ${role}! 몇 년째 이 자리만 기다림`, `이번엔 필요한 자리 알고 뽑았네`]);
  else add('갸웃', [`${need} 급하다니까 또 ${role}?`, `${need}는 다음 라운드에서 뽑겠지…`, `재능 보고 뽑은 거면 인정`]);
  if (f.reach) add('의문', ['이 순번에? 좀 이르지 않나', '모의지명엔 이름도 없던데', '스카우트팀이 뭘 봤는지 궁금하다']);
  if (f.value) add('환호', ['이 선수가 여기까지 남아 있었다고?', '앞 순번 팀들 뭐 함 ㅋㅋ 꿀픽', '순번 대비 최고의 선택']);
  if (f.matched.length) add('담담', ['예상대로 갔네', '기사에서 본 그대로', '다들 예상한 픽']);
  if (f.owned) add('걱정', [`${role} 또 뽑았네 ㅋㅋ`, '같은 포지션 두 명이면 경쟁은 되겠다']);
  if (f.local) add('반가움', ['연고지 출신이라 더 정감 간다', '동네 학교 출신 반갑다', `${p.school} 경기 몇 번 봤는데 잘하더라`]);
  if (isPitcher(p) && p.velocity >= 148) add('기대', [`${p.velocity} 던지는 신인이면 일단 합격`, '구속은 확실히 매력 있다', '제구만 잡히면 무섭겠다']);
  if (p.ready >= 45) add('기대', ['내년 캠프에서 바로 보고 싶다', '즉전감이라니 1군에서 빨리 보자']);
  else add('인내', ['2~3년은 기다려야 할 듯', '퓨처스에서 몸 좀 만들고 오자', '급하게 쓰지 말고 제대로 키우자']);
  if (p.pathway === '독립구단') add('응원', ['독립리그에서 버틴 거 대단하다', '다시 기회 잡은 거 멋지다']);
  if (p.pathway === '대졸') add('담담', ['대학 4년 동안 꾸준했지', '대졸이라 적응은 빠를 듯']);
  if (p.pathway === '2년제') add('담담', ['2년제에서 몸 좀 만들고 나왔겠지', '전문대 리그 기록 좋던데', '고졸 때보다 확실히 성장했다더라']);
  if (p.pathway === '야구 유학') add('기대', ['유학파는 기본기가 탄탄하던데', '어린 나이에 혼자 유학 간 것부터 대단하다']);
  if (p.proExperience || p.pathway === '해외파') add('기대', ['해외 경험 있는 선수 반갑다', '미국에서 뭘 배워 왔는지 궁금']);
  add('응원', ['잘 커서 오래 뛰자', '이름 외워 둔다', '사인볼 받으러 간다', '부상 없이만 크자']);
  const names = some(HANDLES, 3, r);
  return some(says, 3, r).map((c, i) => ({ handle: i === 0 && r() < 0.5 ? `${t.short}팬${10 + Math.floor(r() * 20)}년` : names[i], tone: c.tone, text: c.text }));
}

const api = { one, some, fill, scoutNotes, mockReason, draftNews, fanComments };
export default api;
