import { k as __i18n_k } from '../i18n/index.js';
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
  local: [__i18n_k("draftroom.voices.oPENERS.local.5638be64"), __i18n_k("draftroom.voices.oPENERS.local.f2611ee3"), __i18n_k("draftroom.voices.oPENERS.local.7ba56176")],
  early: [__i18n_k("draftroom.voices.oPENERS.early.5d6c6f0c"), __i18n_k("draftroom.voices.oPENERS.early.097adb68"), __i18n_k("draftroom.voices.oPENERS.early.a845d012")],
  late: [__i18n_k("draftroom.voices.oPENERS.late.8d8f8448"), __i18n_k("draftroom.voices.oPENERS.late.82004dc1"), __i18n_k("draftroom.voices.oPENERS.late.fb032433")],
  independent: [__i18n_k("draftroom.voices.oPENERS.independent.87ae2861"), __i18n_k("draftroom.voices.oPENERS.independent.8507a54b"), __i18n_k("draftroom.voices.oPENERS.independent.6d15061c")],
  early_college: [__i18n_k("draftroom.voices.oPENERS.early_college.ec8a513a"), __i18n_k("draftroom.voices.oPENERS.early_college.29bebaeb")],
  two_year: [__i18n_k("draftroom.voices.oPENERS.two_year.c22436d4"), __i18n_k("draftroom.voices.oPENERS.two_year.92b74512"), __i18n_k("draftroom.voices.oPENERS.two_year.9f9a64ad")],
  abroad: [__i18n_k("draftroom.voices.oPENERS.abroad.7f3a57b3"), __i18n_k("draftroom.voices.oPENERS.abroad.3120b855")],
  college: [__i18n_k("draftroom.voices.oPENERS.college.7ac34f8f"), __i18n_k("draftroom.voices.oPENERS.college.c985cc1f")],
  overseas: [__i18n_k("draftroom.voices.oPENERS.overseas.fc545cca"), __i18n_k("draftroom.voices.oPENERS.overseas.9567b153"), __i18n_k("draftroom.voices.oPENERS.overseas.3680bd42")],
  plain: [__i18n_k("draftroom.voices.oPENERS.plain.6fc13828"), __i18n_k("draftroom.voices.oPENERS.plain.192a6893"), __i18n_k("draftroom.voices.oPENERS.plain.269cede3"), __i18n_k("draftroom.voices.oPENERS.plain.91d1adb2")],
};
const TRAITS = {
  '차분한 노력파': [__i18n_k("draftroom.voices.tRAITS.9d20d06e"), __i18n_k("draftroom.voices.tRAITS.0c04b84f")],
  '승부욕 강한 도전자': [__i18n_k("draftroom.voices.tRAITS.190d500e"), __i18n_k("draftroom.voices.tRAITS.fbb03504")],
  '밝은 분위기 메이커': [__i18n_k("draftroom.voices.tRAITS.758ed6df"), __i18n_k("draftroom.voices.tRAITS.a287b915")],
  '분석을 즐기는 연구형': [__i18n_k("draftroom.voices.tRAITS.f134c9e2"), __i18n_k("draftroom.voices.tRAITS.89d5b65e")],
  '책임감 강한 리더': [__i18n_k("draftroom.voices.tRAITS.99b3be8b"), __i18n_k("draftroom.voices.tRAITS.587b741c")],
  '말보다 행동하는 실천형': [__i18n_k("draftroom.voices.tRAITS.bdb72c7c"), __i18n_k("draftroom.voices.tRAITS.8deb7f5e")],
  '꾸준함을 믿는 성실형': [__i18n_k("draftroom.voices.tRAITS.cda0e0b8"), __i18n_k("draftroom.voices.tRAITS.438369da")],
  '큰 무대를 즐기는 대담형': [__i18n_k("draftroom.voices.tRAITS.fee1c525"), __i18n_k("draftroom.voices.tRAITS.e6685053")],
};
const GOALS = {
  readyPitcher: [__i18n_k("draftroom.voices.gOALS.readyPitcher.a2adbfc3"), __i18n_k("draftroom.voices.gOALS.readyPitcher.2c3a1148"), __i18n_k("draftroom.voices.gOALS.readyPitcher.f3715d98")],
  readyHitter: [__i18n_k("draftroom.voices.gOALS.readyHitter.1f936623"), __i18n_k("draftroom.voices.gOALS.readyHitter.2c3a1148"), __i18n_k("draftroom.voices.gOALS.readyHitter.f3715d98")],
  later: [__i18n_k("draftroom.voices.gOALS.later.565c5bd7"), __i18n_k("draftroom.voices.gOALS.later.2e0000e6"), __i18n_k("draftroom.voices.gOALS.later.a7dcb72c"), __i18n_k("draftroom.voices.gOALS.later.4a0db864")],
};

// ------------------------------------------------------------ manager

const COACH_TOOL = {
  stuff: __i18n_k("draftroom.voices.cOACH_TOOL.stuff.46d0126a"), command: __i18n_k("draftroom.voices.cOACH_TOOL.command.29646448"), breaking: __i18n_k("draftroom.voices.cOACH_TOOL.breaking.3ad4da73"),
  stamina: __i18n_k("draftroom.voices.cOACH_TOOL.stamina.3efa4f1a"), contact: __i18n_k("draftroom.voices.cOACH_TOOL.contact.ed9bcc48"), power: __i18n_k("draftroom.voices.cOACH_TOOL.power.8b305294"),
  speed: __i18n_k("draftroom.voices.cOACH_TOOL.speed.009bdd3a"), defense: __i18n_k("draftroom.voices.cOACH_TOOL.defense.6f86324e"),
};

// ------------------------------------------------------------ scout director

const VERDICT = {
  즉전감: [__i18n_k("draftroom.voices.vERDICT.message.2ea4ad53"), __i18n_k("draftroom.voices.vERDICT.message.20d5705c")],
  실링: [__i18n_k("draftroom.voices.vERDICT.message.f6f6c528"), __i18n_k("draftroom.voices.vERDICT.message.8e15b9b9")],
  플로어: [__i18n_k("draftroom.voices.vERDICT.message.e3532d6f"), __i18n_k("draftroom.voices.vERDICT.message.09a9def3")],
  육성형: [__i18n_k("draftroom.voices.vERDICT.message.eaf4a104"), __i18n_k("draftroom.voices.vERDICT.message.414e1e3d")],
  역할형: [__i18n_k("draftroom.voices.vERDICT.message.51cfe04a"), __i18n_k("draftroom.voices.vERDICT.message.16fd4fb5")],
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
    const middle = fav ? __i18n_k("draftroom.voices.interview.middle.1bd8fe53", { short: t.short }) : one(TRAITS[p.personality] || TRAITS['차분한 노력파'], r);
    const goal = one(p.ready >= 45 ? GOALS[isPitcher(p) ? 'readyPitcher' : 'readyHitter'] : GOALS.later, r);
    return [fill(one(OPENERS[key], r), vars), middle, fill(goal, vars)].join(' ');
  }

  function coach(p, g) {
    const t = teamFor(g),
      r = rng(g.seed + '-coach-' + p.id),
      role = ROLES[p.role];
    const start = one(
      fit(p, t) >= 60
        ? [__i18n_k("draftroom.voices.coach.start.3d4bc206", { value: K.p(role, __i18n_k("draftroom.voices.coach.start.d54d1c05")) }), __i18n_k("draftroom.voices.coach.start.4e27f58c", { role: role }), __i18n_k("draftroom.voices.coach.start.1d00e1aa", { role: role })]
        : [__i18n_k("draftroom.voices.coach.start.238de8b7"), __i18n_k("draftroom.voices.coach.start.a3efa1c5"), __i18n_k("draftroom.voices.coach.start.fc477340")],
      r,
    );
    const [tool, grade] = bestTool(p);
    const remark = grade >= 50 ? COACH_TOOL[tool] : __i18n_k("draftroom.voices.coach.remark.d75812b2");
    const plan = one(
      p.ready >= 45
        ? [__i18n_k("draftroom.voices.coach.plan.e33dd2fa"), __i18n_k("draftroom.voices.coach.plan.b12c6928"), __i18n_k("draftroom.voices.coach.plan.f6dfc0e0")]
        : [__i18n_k("draftroom.voices.coach.plan.875a8489", { focus: p.focus }), __i18n_k("draftroom.voices.coach.plan.6dd53c91"), __i18n_k("draftroom.voices.coach.plan.3cc1db8d")],
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
      lines.push(missing.length ? __i18n_k("draftroom.voices.install.scoutAdvice.3c61ac35", { value: K.p(role, __i18n_k("draftroom.voices.install.scoutAdvice.d54d1c05")), owned: owned, value2: ROLES[missing[0]] }) : __i18n_k("draftroom.voices.install.scoutAdvice.f0091c71"));
    else if (fit(p, t) >= 60) lines.push(__i18n_k("draftroom.voices.install.scoutAdvice.cd70351a", { value: K.p(role, __i18n_k("draftroom.voices.install.scoutAdvice.d54d1c05")), value2: t.needs.indexOf(p.role) + 1 }));
    else lines.push(__i18n_k("draftroom.voices.install.scoutAdvice.f623f971"));
    if (g.difficulty === 'hard') return { title: __i18n_k("draftroom.voices.scoutAdvice.title.da093d03", { name: p.name }), lines: [...lines, __i18n_k("draftroom.voices.scoutAdvice.lines.53289fa9", { weakness: p.weakness })] };

    lines.push(
      similar === 0 ? __i18n_k("draftroom.voices.install.scoutAdvice.784712ed", { value: K.p(role, __i18n_k("draftroom.voices.install.scoutAdvice.d54d1c05")) })
      : similar <= 2 ? __i18n_k("draftroom.voices.install.scoutAdvice.7addf264", { value: K.p(role, __i18n_k("draftroom.voices.install.scoutAdvice.d54d1c05")), similar: similar })
      : __i18n_k("draftroom.voices.install.scoutAdvice.de1a7291", { value: K.p(role, __i18n_k("draftroom.voices.install.scoutAdvice.543ff075")), similar: similar }),
    );
    const need = t.detailedNeeds?.find((x) => x.role === p.role);
    if (need) {
      const label = G.LABELS[need.key] || { ready: __i18n_k("draftroom.voices.label.ready.7c2a9df6"), scoutCeiling: __i18n_k("draftroom.voices.label.scoutCeiling.d7ee4a2c"), floorGrade: __i18n_k("draftroom.voices.label.floorGrade.f5f120bd") }[need.key];
      const value = p.tools?.[need.key] ?? p[need.key];
      lines.push(value >= need.target ? __i18n_k("draftroom.voices.install.scoutAdvice.03dac186", { label: need.label, label2: label, value: value }) : __i18n_k("draftroom.voices.install.scoutAdvice.79734b27", { label: need.label, label2: label, value: value, value2: K.particle(label, __i18n_k("draftroom.voices.install.scoutAdvice.543ff075")), target: need.target }));
    }
    if (p.proExperience) lines.push(__i18n_k("draftroom.voices.install.scoutAdvice.fc8ff205"));
    else if (p.record.kind === 'pitcher' && p.record.outs < 90) lines.push(__i18n_k("draftroom.voices.install.scoutAdvice.1f0e6e69"));
    else if (p.uncertainty === '높음') lines.push(__i18n_k("draftroom.voices.install.scoutAdvice.e1d69d2e"));
    else if (p.awards.length) lines.push(__i18n_k("draftroom.voices.install.scoutAdvice.82d2a718", { value: p.awards[0] }));
    if (g.difficulty === 'easy') {
      const alternatives = candidates
        .filter((q) => q.id !== p.id)
        .sort((a, b) => b.publicScore + fit(b, t) * 0.12 - (a.publicScore + fit(a, t) * 0.12))
        .slice(0, 2);
      lines.push(__i18n_k("draftroom.voices.install.scoutAdvice.2c8179bb", { value: alternatives.map((q) => __i18n_k("draftroom.voices.install.scoutAdvice.e3d971e3", { name: q.name, value: ROLES[q.role], rank: q.rank })).join(', ') }));
    }
    return { title: __i18n_k("draftroom.voices.scoutAdvice.title.da093d03", { name: p.name }), lines };
  }

  Object.assign(C, { interview, coach, scoutAdvice });
}

const api = { install };
export default api;
