import { k as __i18n_k } from '../i18n/index.js';
/* CPU draft logic (public scouting data only), difficulty settings and draft-board sorting. */
// Ported from KBO-Draft-Room df4faad src/core/draft-ai.js. See docs/UPSTREAM.md.
import DraftData from './prospects.js';
import DraftScouting from './scouting.js';
import DraftTuning from './tuning.js';

const D = DraftData;
const S = DraftScouting;
const { TUNING: T } = DraftTuning;
const DIFFICULTIES = {
  easy: { name: __i18n_k("draftroom.draft_ai.easy.name.aeb16cc3"), hint: __i18n_k("draftroom.draft_ai.easy.hint.9e2671b8"), noise: 12 },
  normal: { name: '보통', hint: __i18n_k("draftroom.draft_ai.normal.hint.72c6756b"), noise: 5 },
  hard: { name: __i18n_k("draftroom.draft_ai.hard.name.485e4f6a"), hint: __i18n_k("draftroom.draft_ai.hard.hint.615b5e55"), noise: 1.5 },
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
  rank: { label: __i18n_k("draftroom.draft_ai.rank.label.a98d4104"), group: __i18n_k("draftroom.draft_ai.rank.group.f7c86d76"), direction: 'asc' },
  fit: { label: __i18n_k("draftroom.draft_ai.fit.label.976f95df"), group: __i18n_k("draftroom.draft_ai.fit.group.f7c86d76"), direction: 'desc' },
  ready: { label: __i18n_k("draftroom.draft_ai.ready.label.7dbd5cbd"), group: __i18n_k("draftroom.draft_ai.ready.group.7ff13b06"), direction: 'desc' },
  scoutCeiling: { label: __i18n_k("draftroom.draft_ai.scoutCeiling.label.7afaeb51"), group: __i18n_k("draftroom.draft_ai.scoutCeiling.group.7ff13b06"), direction: 'desc' },
  stuff: { label: __i18n_k("draftroom.draft_ai.stuff.label.6ff2c5c1"), group: __i18n_k("draftroom.draft_ai.stuff.group.7ff13b06"), direction: 'desc' },
  breaking: { label: __i18n_k("draftroom.draft_ai.breaking.label.32352c71"), group: __i18n_k("draftroom.draft_ai.breaking.group.7ff13b06"), direction: 'desc' },
  stamina: { label: __i18n_k("draftroom.draft_ai.stamina.label.a45ea58e"), group: __i18n_k("draftroom.draft_ai.stamina.group.7ff13b06"), direction: 'desc' },
  contact: { label: __i18n_k("draftroom.draft_ai.contact.label.5edb7838"), group: __i18n_k("draftroom.draft_ai.contact.group.7ff13b06"), direction: 'desc' },
  power: { label: __i18n_k("draftroom.draft_ai.power.label.659d21e7"), group: __i18n_k("draftroom.draft_ai.power.group.7ff13b06"), direction: 'desc' },
  control: { label: __i18n_k("draftroom.draft_ai.control.label.4d59d0db"), group: __i18n_k("draftroom.draft_ai.control.group.7ff13b06"), direction: 'desc' },
  speed: { label: __i18n_k("draftroom.draft_ai.speed.label.b3c077b1"), group: __i18n_k("draftroom.draft_ai.speed.group.7ff13b06"), direction: 'desc' },
  defense: { label: __i18n_k("draftroom.draft_ai.defense.label.3be6f512"), group: __i18n_k("draftroom.draft_ai.defense.group.7ff13b06"), direction: 'desc' },
  hr: { label: __i18n_k("draftroom.draft_ai.hr.label.9162d3a3"), group: __i18n_k("draftroom.draft_ai.hr.group.d110c34f"), direction: 'desc' },
  avg: { label: __i18n_k("draftroom.draft_ai.avg.label.1eb19e0a"), group: __i18n_k("draftroom.draft_ai.avg.group.d110c34f"), direction: 'desc' },
  rbi: { label: __i18n_k("draftroom.draft_ai.rbi.label.fed1c588"), group: __i18n_k("draftroom.draft_ai.rbi.group.d110c34f"), direction: 'desc' },
  ops: { label: 'OPS', group: __i18n_k("draftroom.draft_ai.ops.group.d110c34f"), direction: 'desc' },
  sb: { label: __i18n_k("draftroom.draft_ai.sb.label.91e54831"), group: __i18n_k("draftroom.draft_ai.sb.group.d110c34f"), direction: 'desc' },
  hits: { label: '안타', group: __i18n_k("draftroom.draft_ai.hits.group.d110c34f"), direction: 'desc' },
  pa: { label: __i18n_k("draftroom.draft_ai.pa.label.0a3d002c"), group: __i18n_k("draftroom.draft_ai.pa.group.d110c34f"), direction: 'desc' },
  velocity: { label: __i18n_k("draftroom.draft_ai.velocity.label.b2ea2c6b"), group: __i18n_k("draftroom.draft_ai.velocity.group.493471fa"), direction: 'desc' },
  era: { label: 'ERA', group: __i18n_k("draftroom.draft_ai.era.group.493471fa"), direction: 'asc' },
  outs: { label: __i18n_k("draftroom.draft_ai.outs.label.639a1f2f"), group: __i18n_k("draftroom.draft_ai.outs.group.493471fa"), direction: 'desc' },
  k: { label: __i18n_k("draftroom.draft_ai.k.label.3e23c769"), group: __i18n_k("draftroom.draft_ai.k.group.493471fa"), direction: 'desc' },
  bb: { label: __i18n_k("draftroom.draft_ai.bb.label.a572dcd5"), group: __i18n_k("draftroom.draft_ai.bb.group.493471fa"), direction: 'asc' },
  wins: { label: __i18n_k("draftroom.draft_ai.wins.label.90e5e4d2"), group: __i18n_k("draftroom.draft_ai.wins.group.493471fa"), direction: 'desc' },
  games: { label: __i18n_k("draftroom.draft_ai.games.label.e0cee61a"), group: __i18n_k("draftroom.draft_ai.games.group.ffd79386"), direction: 'desc' },
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
