/* CPU draft logic (public scouting data only), difficulty settings and draft-board sorting. */
// Ported from KBO-Draft-Room df4faad src/core/draft-ai.js. See docs/UPSTREAM.md.
import DraftData from './prospects.js';
import DraftScouting from './scouting.js';
import DraftTuning from './tuning.js';

const D = DraftData;
const S = DraftScouting;
const { TUNING: T } = DraftTuning;
const DIFFICULTIES = {
  easy: { name: '쉬움', hint: '상세 조언과 비교 후보 · 단순한 AI', noise: 12 },
  normal: { name: '보통', hint: '추천 근거 제공 · 구단 성향별 AI', noise: 5 },
  hard: { name: '어려움', hint: '핵심 관찰만 제공 · 보강·중복·희소성을 따지는 AI', noise: 1.5 },
};
function project(p) {
  return {
    id: p.id,
    name: p.name,
    role: p.role,
    pathway: p.pathway,
    quotaEligible: p.quotaEligible === true,
    entryCategory: p.entryCategory,
    school: p.school,
    region: p.highSchoolRegion,
    ready: p.ready,
    scoutCeiling: p.scoutCeiling,
    publicScore: p.publicScore,
    rank: p.rank,
    schoolTier: p.schoolTier,
    ceilingGrade: p.ceilingGrade,
    floorGrade: p.floorGrade,
    tools: { ...p.tools },
    futureTools: { ...p.futureTools },
    pickTags: [...p.pickTags],
    uncertainty: p.uncertainty,
    regionalEligible: !!D.bio.eligible(p, { region: p.highSchoolRegion }),
    // Public facts used by the media and scouting text.
    age: p.age,
    velocity: p.velocity,
    throwHand: p.throwHand,
    type: p.type,
    record: { ...p.record },
    awards: [...p.awards],
    proExperience: p.proExperience ? { level: p.proExperience.level } : null,
    intent: p.intent ?? null,
    twoWay: !!p.twoWay,
    // Scouts mention the other side only when it is worth something.
    altPublic: p.alt && p.alt.scoutCeiling >= T.altTalent.publicMinFV ? { role: p.alt.role, ready: p.alt.ready, scoutCeiling: p.alt.scoutCeiling } : null,
  };
}
function fit(p, t) {
  return S.fit(p, t);
}
function aiScores(candidates, team, prior, difficulty, seed) {
  const cfg = DIFFICULTIES[difficulty];
  if (!cfg) throw Error('알 수 없는 난이도입니다.');
  const r = D.rng(seed),
    top = [...candidates].sort((a, b) => b.publicScore - a.publicScore).slice(0, 30);
  return candidates
    .map((p) => {
      const owned = prior.filter((x) => x.role === p.role).length,
        f = fit(p, team),
        scarcity = 6 - Math.min(6, top.filter((x) => x.role === p.role).length);
      let score =
        difficulty === 'easy'
          ? p.publicScore + f * 0.03 - owned
          : S.score(p, team) -
            owned * (difficulty === 'hard' ? 3.5 : 2) +
            (difficulty === 'hard' && owned === 0 && f >= 60 ? scarcity * 0.65 : 0);
      // Clubs are wary of players who announced they may not sign.
      if (p.intent) score -= T.contracts.aiIntentPenalty[difficulty][p.intent];
      return { id: p.id, score: score + (r() - 0.5) * cfg.noise };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
const SORTS = {
  rank: { label: '스카우트 순위', group: '종합', direction: 'asc' },
  fit: { label: '우리 팀 적합도', group: '종합', direction: 'desc' },
  ready: { label: '현재 기량 (20–80)', group: '능력 추정', direction: 'desc' },
  scoutCeiling: { label: '미래 가치 (20–80)', group: '능력 추정', direction: 'desc' },
  stuff: { label: '구위', group: '능력 추정', direction: 'desc' },
  breaking: { label: '변화구', group: '능력 추정', direction: 'desc' },
  stamina: { label: '체력', group: '능력 추정', direction: 'desc' },
  contact: { label: '컨택', group: '능력 추정', direction: 'desc' },
  power: { label: '장타력 추정', group: '능력 추정', direction: 'desc' },
  control: { label: '커맨드 추정', group: '능력 추정', direction: 'desc' },
  speed: { label: '주력 추정', group: '능력 추정', direction: 'desc' },
  defense: { label: '수비 추정', group: '능력 추정', direction: 'desc' },
  hr: { label: '홈런', group: '타격 기록', direction: 'desc' },
  avg: { label: '타율', group: '타격 기록', direction: 'desc' },
  rbi: { label: '타점', group: '타격 기록', direction: 'desc' },
  ops: { label: 'OPS', group: '타격 기록', direction: 'desc' },
  sb: { label: '도루', group: '타격 기록', direction: 'desc' },
  hits: { label: '안타', group: '타격 기록', direction: 'desc' },
  pa: { label: '타석', group: '타격 기록', direction: 'desc' },
  velocity: { label: '최고 구속', group: '투구 기록', direction: 'desc' },
  era: { label: 'ERA', group: '투구 기록', direction: 'asc' },
  outs: { label: '이닝', group: '투구 기록', direction: 'desc' },
  k: { label: '탈삼진', group: '투구 기록', direction: 'desc' },
  bb: { label: '허용 볼넷', group: '투구 기록', direction: 'asc' },
  wins: { label: '승리', group: '투구 기록', direction: 'desc' },
  games: { label: '경기', group: '공통 기록', direction: 'desc' },
};
function sortValue(p, key, team) {
  if (!SORTS[key]) throw Error('알 수 없는 정렬 항목입니다.');
  const pitcher = p.record.kind === 'pitcher';
  if (key === 'fit') return fit(p, team);
  if (['rank', 'ready', 'scoutCeiling'].includes(key)) return p[key];
  if (['stuff', 'breaking', 'stamina'].includes(key)) return pitcher ? p.tools[key] : null;
  if (key === 'contact') return pitcher ? null : p.tools.contact;
  if (['power', 'speed', 'defense'].includes(key)) return pitcher ? null : p[key];
  if (['control', 'velocity'].includes(key)) return pitcher ? p[key] : null;
  if (['hr', 'avg', 'rbi', 'ops', 'sb', 'hits', 'pa'].includes(key) && pitcher) return null;
  if (['era', 'outs', 'k', 'bb', 'wins'].includes(key) && !pitcher) return null;
  return Number.isFinite(p.record[key]) ? p.record[key] : null;
}
function sortPlayers(players, key, dir, team) {
  if (!['asc', 'desc'].includes(dir)) throw Error('잘못된 정렬 방향입니다.');
  return [...players].sort((a, b) => {
    const av = sortValue(a, key, team),
      bv = sortValue(b, key, team);
    if (av == null && bv != null) return 1;
    if (bv == null && av != null) return -1;
    return (
      (av == null ? 0 : (av - bv) * (dir === 'asc' ? 1 : -1)) || a.rank - b.rank || a.id.localeCompare(b.id)
    );
  });
}
const api = { DIFFICULTIES, SORTS, project, fit, aiScores, sortValue, sortPlayers };
export default api;
