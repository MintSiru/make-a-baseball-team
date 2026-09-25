/* 20–80 scouting scale.
   Hidden ability (`trueTools`, `potentialTools`) is continuous; everything shown to the
   player is rounded to five-point grades and includes observer error. */
// Ported from KBO-Draft-Room df4faad src/core/grades.js. See docs/UPSTREAM.md.
import DraftTuning from './tuning.js';

const { TUNING } = DraftTuning;
const V = TUNING.generation.velocity;
const clamp = (n, a = 20, b = 80) => Math.max(a, Math.min(b, n));
const grade = (n) => clamp(Math.round(n / 5) * 5);
const ROLES = { SP: '선발투수', RP: '불펜투수', C: '포수', IF: '내야수', OF: '외야수' };
const LABELS = {
  stuff: '구위',
  command: '커맨드',
  breaking: '변화구',
  stamina: '체력',
  contact: '컨택',
  power: '장타력',
  speed: '주력',
  defense: '수비',
  eye: '선구안',
};
const WEIGHTS = {
  SP: { stuff: 0.3, command: 0.25, breaking: 0.25, stamina: 0.2 },
  RP: { stuff: 0.4, command: 0.25, breaking: 0.3, stamina: 0.05 },
  C: { contact: 0.28, power: 0.2, speed: 0.04, defense: 0.48 },
  IF: { contact: 0.34, power: 0.26, speed: 0.1, defense: 0.3 },
  OF: { contact: 0.32, power: 0.35, speed: 0.14, defense: 0.19 },
};
const keys = (role) => Object.keys(WEIGHTS[role]);
const overall = (tools, role) => Object.entries(WEIGHTS[role]).reduce((a, [k, w]) => a + tools[k] * w, 0);
const normal = (r) => (r() + r() + r() - 1.5) / 1.5;

// Base-grade range for each talent band. The pool has 110/56/24/8/2 players per band.
const TALENT_BANDS = [[34, 43], [43, 49], [49, 56], [56, 62], [63, 69]];
// Tool offsets per archetype index (see ARCHETYPES in prospects.js).
const PITCHER_SHAPES = [
  { stuff: 11, command: -6, breaking: 1, stamina: -2 }, // power arm
  { stuff: -5, command: 12, breaking: -2, stamina: 3 }, // command
  { stuff: -3, command: 2, breaking: 10, stamina: 0 }, // breaking ball
  { stuff: 0, command: 7, breaking: 2, stamina: 2 }, // sinker / control
  { stuff: 3, command: -5, breaking: 10, stamina: 5 }, // big curveball
];
const HITTER_SHAPES = [
  { contact: 0, power: -7, speed: 5, defense: 10 }, // glove first
  { contact: -2, power: 15, speed: -8, defense: -5 }, // slugger
  { contact: 10, power: -6, speed: 6, defense: 1 }, // contact
  { contact: 3, power: -4, speed: 0, defense: 6 }, // balanced / eye
  { contact: 0, power: -5, speed: 12, defense: 4 }, // speed
];

/** Generates hidden and public tools for one prospect. Consumes `r` in a fixed order. */
function make(role, type, bio, band, r) {
  const pitcher = role === 'SP' || role === 'RP',
    high = bio.entryCategory === 'high-school' || bio.entryCategory === 'study-abroad',
    early = bio.entryCategory === 'college-early',
    twoYear = bio.entryCategory === 'college-two-year'; // same age as early entrants, a little more finished
  const range = TALENT_BANDS[band],
    base = range[0] + r() * (range[1] - range[0]);
  const shape = (pitcher ? PITCHER_SHAPES : HITTER_SHAPES)[type];
  const center = overall(shape, role),
    potentialTools = {},
    trueTools = {},
    tools = {};
  const curveRoll = r(),
    growthCurve = curveRoll < 0.2 ? 'early' : curveRoll < 0.78 ? 'normal' : 'late';
  const rawProject = high && band >= 2 && r() < 0.12;
  const gap =
    (high ? 10 + r() * 8 : early ? 7 + r() * 6 : twoYear ? 6 + r() * 5 : bio.proExperience ? 3 + r() * 6 : 4 + r() * 6) +
    (growthCurve === 'late' ? 2 : 0) +
    (rawProject ? 8 + r() * 5 : 0);
  const observerBias = (r() - 0.5) * (high ? 7 : 5),
    uncertainty = high ? '높음' : early || twoYear ? '보통' : bio.proExperience?.level === 'MLB' ? '보통' : '낮음';
  const arm = pitcher ? normal(r) * 3 : 0;
  for (const k of keys(role)) {
    const lift = k === 'stuff' ? arm * V.armToStuff : 0;
    potentialTools[k] = clamp(base + shape[k] - center + normal(r) * 3 + lift);
    trueTools[k] = clamp(
      potentialTools[k] -
        gap * (k === 'speed' ? 0.4 : 0.8 + r() * 0.4) +
        (bio.schoolTier === '명문' ? 0.6 : 0),
    );
    trueTools[k] = Math.min(trueTools[k], potentialTools[k]);
    tools[k] = grade(trueTools[k] + observerBias + normal(r) * 4);
  }
  if (!pitcher) {
    potentialTools.eye = clamp(base + (type === 3 ? 10 : normal(r) * 10));
    trueTools.eye = clamp(potentialTools.eye - gap * 0.8);
    tools.eye = grade(trueTools.eye + observerBias + normal(r) * 4);
  }
  const velocity = pitcher
    ? Math.round(clamp(V.base + (trueTools.stuff - V.pivot) * V.perStuff + arm * V.perArm + (high ? 0 : V.adultBonus) + normal(r) * V.noise, V.min, V.max))
    : null;
  const trueReady = overall(trueTools, role),
    upside = overall(potentialTools, role),
    ready = grade(overall(tools, role));
  const scoutCeiling = Math.max(
    ready,
    grade(
      upside * (rawProject ? 0.65 : 0.83) +
        trueReady * (rawProject ? 0.35 : 0.17) +
        observerBias * 0.6 +
        normal(r) * 4,
    ),
  );
  const ceilingGrade = Math.max(scoutCeiling, grade(upside + observerBias + normal(r) * 4));
  const floorGrade = Math.min(
    scoutCeiling,
    Math.max(
      ready - 5,
      grade(scoutCeiling - (uncertainty === '높음' ? 12 : uncertainty === '보통' ? 9 : 6)),
    ),
  );
  const futureTools = Object.fromEntries(
    Object.entries(tools).map(([k, v]) => [
      k,
      Math.max(
        v,
        grade(
          potentialTools[k] * (rawProject ? 0.65 : 0.83) +
            trueTools[k] * (rawProject ? 0.35 : 0.17) +
            observerBias * 0.6,
        ),
      ),
    ]),
  );
  const pickTags = [];
  if (ready >= 45) pickTags.push('즉전감');
  if (floorGrade >= 40 && uncertainty !== '높음') pickTags.push('플로어');
  if (ceilingGrade >= 55 && ceilingGrade - ready >= 10) pickTags.push('실링');
  if (!pickTags.length) pickTags.push(scoutCeiling - ready >= 10 ? '육성형' : '역할형');
  return {
    velocity,
    ready,
    trueReady,
    upside,
    scoutCeiling,
    ceilingGrade,
    floorGrade,
    tools,
    futureTools,
    trueTools,
    potentialTools,
    uncertainty,
    pickTags,
    growthCurve,
    developmentRate: rawProject ? 0.38 + r() * 0.65 : r() < 0.18 ? 0.42 : 0.85 + r() * 0.3,
    observerBias,
    publicScore: Math.round((ready * 0.43 + scoutCeiling * 0.57 + normal(r) * 1.5) * 10) / 10,
    control: tools.command ?? tools.eye,
    power: tools.power ?? 30,
    speed: tools.speed ?? 30,
    defense: tools.defense ?? 30,
  };
}
/** Re-scouts a player after a season; observer error shrinks with years of pro data. */
function observe(trueTools, role, p, yearIndex, r) {
  const error = (p.observerBias || 0) / (1 + yearIndex * 0.8),
    tools = Object.fromEntries(
      Object.entries(trueTools).map(([k, v]) => [
        k,
        grade(v + error + normal(r) * (4 / (1 + yearIndex * 0.7))),
      ]),
    );
  return { tools, ready: grade(overall(tools, role)) };
}
const api = { grade, clamp, keys, ROLES, LABELS, WEIGHTS, overall, make, observe };
export default api;
