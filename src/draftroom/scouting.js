import { k as __i18n_k } from '../i18n/index.js';
/* Scout-director logic: club staff tendencies, detailed needs, fit scores and recommendations.
   Reads only the public projection; never trueTools, potentialTools or growth outcomes. */
// Ported from KBO-Draft-Room df4faad src/core/scouting.js. See docs/UPSTREAM.md.
import DraftData from './prospects.js';

const D = DraftData;
const STYLES = { balanced: __i18n_k("draftroom.scouting.sTYLES.balanced.81c84478"), immediate: __i18n_k("draftroom.scouting.sTYLES.immediate.f8472100"), floor: __i18n_k("draftroom.scouting.sTYLES.floor.d0c4771a"), ceiling: __i18n_k("draftroom.scouting.sTYLES.ceiling.25ccbc57") };
const needs = {
  SP: [
    ['stamina', __i18n_k("draftroom.scouting.needs.sP.3f554f44"), 45, __i18n_k("draftroom.scouting.needs.sP.796b0848")],
    ['command', __i18n_k("draftroom.scouting.needs.sP.d0e9d9bf"), 45, __i18n_k("draftroom.scouting.needs.sP.b9bb6951")],
    ['stuff', __i18n_k("draftroom.scouting.needs.sP.7cdb0d82"), 50, __i18n_k("draftroom.scouting.needs.sP.4af6767d")],
  ],
  RP: [
    ['stuff', __i18n_k("draftroom.scouting.needs.rP.e552546f"), 50, __i18n_k("draftroom.scouting.needs.rP.21fc3b84")],
    ['command', __i18n_k("draftroom.scouting.needs.rP.09a38367"), 45, __i18n_k("draftroom.scouting.needs.rP.8f3f645f")],
    ['breaking', __i18n_k("draftroom.scouting.needs.rP.87054933"), 50, __i18n_k("draftroom.scouting.needs.rP.5b5dde53")],
  ],
  C: [
    ['defense', __i18n_k("draftroom.scouting.needs.c.de3cee54"), 45, __i18n_k("draftroom.scouting.needs.c.973b7856")],
    ['ready', __i18n_k("draftroom.scouting.needs.c.6c1ceabb"), 40, __i18n_k("draftroom.scouting.needs.c.a541723e")],
    ['scoutCeiling', __i18n_k("draftroom.scouting.needs.c.494e039e"), 50, __i18n_k("draftroom.scouting.needs.c.db952e66")],
  ],
  IF: [
    ['contact', __i18n_k("draftroom.scouting.needs.iF.1692d49b"), 45, __i18n_k("draftroom.scouting.needs.iF.40ebc9b5")],
    ['power', __i18n_k("draftroom.scouting.needs.iF.47820b0f"), 50, __i18n_k("draftroom.scouting.needs.iF.8175d79f")],
    ['defense', __i18n_k("draftroom.scouting.needs.iF.842a8e04"), 45, __i18n_k("draftroom.scouting.needs.iF.0ec297a8")],
    ['floorGrade', __i18n_k("draftroom.scouting.needs.iF.38ae71f6"), 40, __i18n_k("draftroom.scouting.needs.iF.26be8ab0")],
  ],
  OF: [
    ['power', __i18n_k("draftroom.scouting.needs.oF.92c3492f"), 50, __i18n_k("draftroom.scouting.needs.oF.97917ff8")],
    ['speed', __i18n_k("draftroom.scouting.needs.oF.7846c4db"), 50, __i18n_k("draftroom.scouting.needs.oF.999ce5ab")],
    ['defense', __i18n_k("draftroom.scouting.needs.oF.0e3bf010"), 50, __i18n_k("draftroom.scouting.needs.oF.72c95d97")],
    ['contact', __i18n_k("draftroom.scouting.needs.oF.1a4b15d9"), 45, __i18n_k("draftroom.scouting.needs.oF.8d3d88cd")],
  ],
};
function plans(seed, teams) {
  return Object.fromEntries(
    teams.map((t) => {
      const r = D.rng(seed + '-club06-' + t.id),
        style = D.pick(Object.keys(STYLES), r),
        preference = D.pick([__i18n_k("draftroom.scouting.plans.preference.45c89bab"), '고졸', '대졸', '해외 경력'], r);
      const detailedNeeds = t.needs.map((role) => {
        const [key, label, target, reason] = D.pick(needs[role], r);
        return { role, key, label, target, reason };
      });
      return [t.id, { staff: { style, label: STYLES[style], preference }, detailedNeeds }];
    }),
  );
}
function value(p, key) {
  return p.tools?.[key] ?? p[key] ?? 20;
}
function fit(p, t) {
  const n = t.needs.indexOf(p.role);
  if (n < 0) return 25;
  const base = [100, 80, 60][n],
    need = t.detailedNeeds?.find((x) => x.role === p.role);
  return need ? Math.round(base * (0.74 + 0.26 * D.clamp(value(p, need.key) / need.target, 0.4, 1))) : base;
}
// Need-coverage points: priorities 1/2/3 are worth 50/30/20, scaled by the best fit at that position.
const NEED_POINTS = [50, 30, 20],
  NEED_FIT_MAX = [100, 80, 60];
function needCoverage(players, team) {
  return team.needs.reduce((n, role, i) => {
    const own = players.filter((p) => p.role === role);
    if (!own.length) return n;
    const best = Math.max(...own.map((p) => fit(p, team)));
    return n + (NEED_POINTS[i] * best) / NEED_FIT_MAX[i];
  }, 0);
}
function score(p, t, style = t.staff?.style || 'balanced') {
  const base =
    style === 'immediate'
      ? p.ready * 0.7 + p.scoutCeiling * 0.3
      : style === 'floor'
        ? p.floorGrade * 0.5 + p.ready * 0.25 + p.scoutCeiling * 0.25
        : style === 'ceiling'
          ? p.ceilingGrade * 0.45 + p.scoutCeiling * 0.45 + p.ready * 0.1
          : p.ready * 0.4 + p.scoutCeiling * 0.6;
  const pref = t.staff?.preference,
    bonus =
      pref === p.pathway ||
      (pref === '해외 경력' && (p.entryCategory === 'overseas-return' || p.pathway === '해외파'))
        ? 1.2
        : 0;
  return base + fit(p, t) * 0.065 + bonus;
}
function needLine(p, need) {
  const label = D.grades.LABELS[need.key] || { ready: __i18n_k("draftroom.scouting.label.ready.7c2a9df6"), scoutCeiling: __i18n_k("draftroom.scouting.label.scoutCeiling.d7ee4a2c"), floorGrade: __i18n_k("draftroom.scouting.label.floorGrade.f5f120bd") }[need.key],
    v = value(p, need.key);
  return v >= need.target
    ? __i18n_k("draftroom.scouting.needLine.d447d0f3", { label: need.label, label2: label, value: D.ko.p(String(v), '으로/로'), target: need.target, value2: v > need.target ? __i18n_k("draftroom.scouting.needLine.8e862018") : __i18n_k("draftroom.scouting.needLine.0d40a0d5") })
    : __i18n_k("draftroom.scouting.needLine.b6a1d748", { label: need.label, label2: label, value: D.ko.particle(label, __i18n_k("draftroom.scouting.needLine.543ff075")), value2: need.target - v });
}
function explanation(p, t) {
  const need = t.detailedNeeds?.find((x) => x.role === p.role);
  return [
    __i18n_k("draftroom.scouting.explanation.25ea1a49", { ready: p.ready, scoutCeiling: p.scoutCeiling, value: p.pickTags.join(' + ') }),
    need ? needLine(p, need) : __i18n_k("draftroom.scouting.explanation.ae39f8ba"),
    __i18n_k("draftroom.scouting.explanation.f4f583d9", { floorGrade: p.floorGrade, ceilingGrade: p.ceilingGrade, uncertainty: p.uncertainty }),
  ];
}
function recommend(players, t, local) {
  const eligible = players.filter((p) => !local || (p.regionalEligible && p.region === t.region)),
    chosen = [];
  for (const style of [t.staff.style, 'immediate', 'ceiling', 'floor', 'balanced']) {
    const p = eligible
      .filter((p) => !chosen.some((x) => x.playerId === p.id))
      .map((p) => ({ p, score: score(p, t, style) }))
      .sort((a, b) => b.score - a.score || a.p.rank - b.p.rank)[0]?.p;
    if (p) chosen.push({ playerId: p.id, angle: STYLES[style], lines: explanation(p, t) });
    if (chosen.length === 3) break;
  }
  return { staff: t.staff, scope: local ? __i18n_k("draftroom.scouting.recommend.scope.e8a3b15a") : __i18n_k("draftroom.scouting.recommend.scope.06780eed"), candidates: chosen };
}
const api = { STYLES, needCoverage, plans, value, fit, score, explanation, recommend };
export default api;
