/* Scout-director logic: club staff tendencies, detailed needs, fit scores and recommendations.
   Reads only the public projection; never trueTools, potentialTools or growth outcomes. */
// Ported from KBO-Draft-Room df4faad src/core/scouting.js. See docs/UPSTREAM.md.
import DraftData from './prospects.js';

const D = DraftData;
const STYLES = { balanced: '균형형', immediate: '즉전형', floor: '안정형', ceiling: '실링형' };
const needs = {
  SP: [
    ['stamina', '긴 이닝을 맡을 선발', 45, '선발 이닝 부담을 줄여야 합니다.'],
    ['command', '볼넷을 줄일 커맨드형 선발', 45, '선발의 경기 운영 안정성이 필요합니다.'],
    ['stuff', '헛스윙을 만들 강속구 선발', 50, '타자를 압도할 구위가 부족합니다.'],
  ],
  RP: [
    ['stuff', '강한 공을 던질 불펜', 50, '접전에서 삼진을 만들 자원이 필요합니다.'],
    ['command', '스트라이크를 던질 불펜', 45, '불펜의 볼넷을 줄이는 것이 과제입니다.'],
    ['breaking', '결정구가 있는 불펜', 50, '다른 유형의 결정구를 더하고 싶습니다.'],
  ],
  C: [
    ['defense', '수비가 안정적인 포수', 45, '포수진의 수비 안정성을 보강합니다.'],
    ['ready', '바로 백업 경쟁을 할 포수', 40, '단기적으로 포수 뎁스가 필요합니다.'],
    ['scoutCeiling', '차세대 주전 포수', 50, '장기적인 포수 세대교체를 준비합니다.'],
  ],
  IF: [
    ['contact', '배트에 공을 맞힐 내야수', 45, '내야 타선의 컨택을 보강합니다.'],
    ['power', '장타를 보탤 내야수', 50, '코너 내야에 장타가 필요합니다.'],
    ['defense', '수비가 안정적인 내야수', 45, '내야 수비의 안정성을 높입니다.'],
    ['floorGrade', '역할이 분명한 내야수', 40, '안정적인 백업 경쟁 자원이 필요합니다.'],
  ],
  OF: [
    ['power', '공을 멀리 보낼 외야수', 50, '외야 타선의 장타 생산을 높입니다.'],
    ['speed', '발이 빠른 외야수', 50, '주루와 외야 기동력을 보강합니다.'],
    ['defense', '넓게 수비할 외야수', 50, '외야 수비 범위를 개선합니다.'],
    ['contact', '컨택이 좋은 외야수', 45, '외야 타선의 연결 능력을 보강합니다.'],
  ],
};
function plans(seed, teams) {
  return Object.fromEntries(
    teams.map((t) => {
      const r = D.rng(seed + '-club06-' + t.id),
        style = D.pick(Object.keys(STYLES), r),
        preference = D.pick(['균형', '고졸', '대졸', '해외 경력'], r);
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
  const label = D.grades.LABELS[need.key] || { ready: '현재 기량', scoutCeiling: '미래 가치', floorGrade: '플로어' }[need.key],
    v = value(p, need.key);
  return v >= need.target
    ? `찾던 '${need.label}' 유형. ${label} ${D.ko.p(String(v), '으로/로')} 기준(${need.target})을 ${v > need.target ? '넘는다' : '맞춘다'}.`
    : `'${need.label}'로 보기엔 ${label}${D.ko.particle(label, '이/가')} ${need.target - v}점 모자란다.`;
}
function explanation(p, t) {
  const need = t.detailedNeeds?.find((x) => x.role === p.role);
  return [
    `현재 ${p.ready} / 미래 가치 ${p.scoutCeiling} · ${p.pickTags.join(' + ')}.`,
    need ? needLine(p, need) : '보강 포지션은 아니다. 재능만 보고 고른 선수.',
    `플로어 ${p.floorGrade} / 실링 ${p.ceilingGrade} · 불확실성 ${p.uncertainty}.`,
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
  return { staff: t.staff, scope: local ? '지역 1차' : '전국 1라운드', candidates: chosen };
}
const api = { STYLES, needCoverage, plans, value, fit, score, explanation, recommend };
export default api;
