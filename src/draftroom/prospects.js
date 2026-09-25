/* Seeded fictional prospects. Public scouting estimates are separate from hidden ability. */
// Ported from KBO-Draft-Room df4faad src/core/prospects.js. See docs/UPSTREAM.md.
import DraftCatalog from './catalog.js';
import DraftBio from './biography.js';
import DraftNames from './names.js';
import DraftKo from './ko.js';
import DraftGrades from './grades.js';
import DraftClubs from './clubs.js';
import DraftTuning from './tuning.js';
import DraftWriter from './writer.js';

const Cat = DraftCatalog;
const Bio = DraftBio;
const Names = DraftNames;
const Ko = DraftKo;
const G = DraftGrades;
const CLUBS = DraftClubs;
const { TUNING } = DraftTuning;
const W = DraftWriter;
const REGIONS = Bio.REGIONS,
  ROLES = G.ROLES;
function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
function rng(seed) {
  let a = hash(seed);
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const round = (n, p = 0) => {
  const v = Math.round(n * 10 ** p) / 10 ** p;
  return Object.is(v, -0) ? 0 : v;
};
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
const pick = (xs, r) => xs[Math.floor(r() * xs.length)];
function shuffle(xs, r) {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const normal = (r) => (r() + r() + r() - 1.5) / 1.5;
const SCHOOL_STYLES = ['투수 육성', '수비 기본기', '타격 중심', '기동력 야구'];
const PERSONALITIES = [
  '차분한 노력파',
  '승부욕 강한 도전자',
  '밝은 분위기 메이커',
  '분석을 즐기는 연구형',
  '책임감 강한 리더',
  '말보다 행동하는 실천형',
  '꾸준함을 믿는 성실형',
  '큰 무대를 즐기는 대담형',
];
// Per role, five archetypes: [name, strength, development task, training focus].
// The index is also the tool shape in grades.js.
// prettier-ignore
const ARCHETYPES = {
  SP: [
    ['강속구 선발', '높은 타점의 빠른 공으로 헛스윙을 유도한다.', '긴 이닝에서 릴리스 포인트가 흔들린다.', '구속 유지'],
    ['커맨드형 선발', '스트라이크 선점과 경기 운영이 안정적이다.', '타순이 한 바퀴 돈 뒤 결정구가 필요하다.', '변화구 완성'],
    ['체인지업 좌완', '좌우 타자 모두에게 체인지업을 던질 수 있다.', '빠른 공의 평균 구속을 높여야 한다.', '체력 보강'],
    ['땅볼 유도형 선발', '투심의 움직임과 낮은 코스 공략이 좋다.', '주자가 있을 때 투구 템포가 빨라진다.', '주자 관리'],
    ['장신 커브볼러', '낙차 큰 커브와 투구 각도가 매력적이다.', '상하체 타이밍을 일정하게 맞춰야 한다.', '폼 안정화'],
  ],
  RP: [
    ['파워 불펜', '짧은 이닝에서 강한 빠른 공과 슬라이더가 돋보인다.', '연투 시 회복 루틴을 정립해야 한다.', '회복 루틴'],
    ['제구형 불펜', '과감한 몸쪽 승부로 유리한 카운트를 만든다.', '몰린 실투가 장타로 이어지는 편이다.', '실투 관리'],
    ['좌완 스페셜리스트', '좌타자 바깥쪽으로 달아나는 공이 위력적이다.', '우타자에게 쓸 구종이 하나 더 필요하다.', '구종 확장'],
    ['낮은 팔각도 불펜', '낯선 투구 각도로 타자의 타이밍을 뺏는다.', '좌우 타자 상대 편차를 줄여야 한다.', '상대별 대응'],
    ['포크볼 불펜', '결정구의 낙차와 헛스윙 유도 능력이 좋다.', '불리한 카운트에서도 포크볼에 의존한다.', '빠른 공 제구'],
  ],
  C: [
    ['수비형 포수', '블로킹과 송구 동작이 간결하다.', '빠른 공에 밀리는 타격을 보완해야 한다.', '배트 스피드'],
    ['공격형 포수', '강한 타구와 코스별 대응력이 돋보인다.', '포구와 후반 체력 관리가 과제다.', '포구 안정'],
    ['균형형 포수', '기본기와 선구안이 균형 있게 갖춰졌다.', '한 가지 확실한 주전 경쟁력이 필요하다.', '체력 보강'],
    ['강견 포수', '빠른 송구와 주자 견제 능력이 좋다.', '변화구 블로킹 때 자세가 높아진다.', '블로킹'],
    ['리더형 포수', '투수와의 소통과 경기 흐름 읽기가 좋다.', '장타를 늘리려면 하체 힘이 필요하다.', '타구 질'],
  ],
  IF: [
    ['공수형 내야수', '타구 판단과 송구 정확성이 안정적이다.', '강한 공을 당겨 치는 힘이 부족하다.', '타구 질'],
    ['거포 코너 내야수', '실투를 장타로 연결하는 힘이 있다.', '변화구 대처와 수비 범위가 과제다.', '변화구 대응'],
    ['기동형 유격수', '첫발과 넓은 수비 범위가 돋보인다.', '프로 일정에 버틸 체력을 늘려야 한다.', '체력 보강'],
    ['선구안형 내야수', '유인구를 참아내며 긴 승부를 만든다.', '빠른 타구에 대한 수비 반응을 보완해야 한다.', '수비 반응'],
    ['멀티 내야수', '여러 내야 위치에서 기본기를 보여준다.', '주 포지션에서 확실한 무기가 필요하다.', '주 포지션 정착'],
  ],
  OF: [
    ['중견수 유망주', '빠른 첫발과 넓은 수비 범위를 갖췄다.', '타석에서 공격 범위가 넓은 편이다.', '선구안'],
    ['장타형 외야수', '높은 타구 속도와 담장을 넘길 힘이 있다.', '삼진을 줄이고 코너 수비를 다져야 한다.', '변화구 대응'],
    ['콘택트 외야수', '배트 컨트롤과 반대 방향 타격이 좋다.', '장타를 늘리기 위한 근력이 부족하다.', '타구 질'],
    ['강견 외야수', '정확한 장거리 송구로 주자를 묶는다.', '낮게 떨어지는 공에 배트가 따라간다.', '선구안'],
    ['기동형 외야수', '주루 판단과 번트, 작전 수행이 좋다.', '강한 타구를 꾸준히 만드는 것이 과제다.', '타격 중심 이동'],
  ],
};
// Amateur tournaments. Descriptive only: results come from their own streams and never change players.
const HS_NATIONAL = '다이아몬드 데일리배 전국고교야구대회',
  COLLEGE_NATIONAL = '퓨처 베이스볼배 대학야구 왕중왕전',
  JUNIOR_COLLEGE_NATIONAL = '퓨처 베이스볼배 전문대학 야구대회',
  NATIONAL_QUALIFIERS = 4; // top four of each regional/conference event go to the national event
const COLLEGE_CONFERENCES = [
  ['수도권', ['서울', '인천', '경기·강원']],
  ['충청·호남권', ['대전·충청·전북', '광주·전남·제주']],
  ['영남권', ['대구·경북', '부산·울산', '경남']],
];
const placeLabel = (i) => (i === 0 ? '우승' : i === 1 ? '준우승' : i < 4 ? '4강' : i < 8 ? '8강' : '예선');
const strength = (s) => Bio.TIERS[s.tier].team;

/** Single-elimination bracket; the strongest entrants get byes up to the next power of two. */
function bracket(entrants, r) {
  let size = 1;
  while (size < entrants.length) size *= 2;
  const seeded = [...entrants].sort((a, b) => strength(b) - strength(a) || a.id.localeCompare(b.id));
  const reached = new Map(seeded.map((s) => [s.id, size]));
  // Standard seeding so top seeds meet late (1 v 16, 8 v 9, ...); missing low seeds are byes.
  let order = [0];
  while (order.length < size) order = order.flatMap((i) => [i, order.length * 2 - 1 - i]);
  let round = order.map((i) => seeded[i] ?? null);
  for (let alive = size; alive > 1; alive /= 2) {
    const next = [];
    for (let i = 0; i < round.length; i += 2) {
      const [a, b] = [round[i], round[i + 1]];
      const winner = !a ? b : !b ? a : r() < 1 / (1 + Math.exp((strength(b) - strength(a)) * 4)) ? a : b;
      if (winner) reached.set(winner.id, alive / 2);
      next.push(winner);
    }
    round = next;
  }
  return reached; // id -> best round reached (1 = champion, 2 = final, 4 = semi-final ...)
}
const roundLabel = (n) => (n === 1 ? '우승' : n === 2 ? '준우승' : `${n}강`);

function schoolHonors(seed) {
  const map = {};
  // Regional events. The seed key keeps its original label so the rankings (and players) stay the same.
  const regional = REGIONS.map((region) => ({
    key: region + ' 고교대회',
    label: region + ' 권역 주말리그',
    list: Cat.institutions.filter((x) => ['high-school', 'hs-club'].includes(x.kind) && x.region === region),
  }));
  const hsQualifiers = [];
  for (const group of regional) {
    const r = rng(seed + '-school-event-' + group.key);
    const ranks = group.list.map((s) => ({ s, score: Bio.TIERS[s.tier].team * 60 + r() * 55 })).sort((a, b) => b.score - a.score);
    ranks.forEach(({ s }, i) => {
      map[s.id] = { event: group.label, result: placeLabel(i), award: i < 2 ? `${group.label} ${placeLabel(i)}` : null, national: null };
      if (i < NATIONAL_QUALIFIERS) hsQualifiers.push(s);
    });
  }
  // College league: one ranking over all colleges (original stream), read per conference.
  const colleges = Cat.institutions.filter((x) => x.kind === 'college');
  const r = rng(seed + '-school-event-전국 대학대회');
  const collegeRank = colleges.map((s) => ({ s, score: Bio.TIERS[s.tier].team * 60 + r() * 55 })).sort((a, b) => b.score - a.score).map((x) => x.s);
  const collegeQualifiers = [];
  for (const [name, regions] of COLLEGE_CONFERENCES) {
    const label = `대학리그 ${name}`;
    collegeRank.filter((s) => regions.includes(s.region)).forEach((s, i) => {
      map[s.id] = { event: label, result: placeLabel(i), award: i < 2 ? `${label} ${placeLabel(i)}` : null, national: null };
      if (i < NATIONAL_QUALIFIERS) collegeQualifiers.push(s);
    });
  }
  // Two-year colleges: one league, then the top four meet in their own tournament.
  const juniors = Cat.institutions.filter((x) => x.kind === 'college2');
  const rj = rng(seed + '-school-event-2년제');
  const juniorQualifiers = [];
  juniors
    .map((s) => ({ s, score: Bio.TIERS[s.tier].team * 60 + rj() * 55 }))
    .sort((a, b) => b.score - a.score)
    .forEach(({ s }, i) => {
      map[s.id] = { event: '전문대학 리그', result: `${i + 1}위`, award: i === 0 ? '전문대학 리그 1위' : null, national: null };
      if (i < NATIONAL_QUALIFIERS) juniorQualifiers.push(s);
    });
  // National events from the qualifiers.
  for (const [event, entrants] of [[HS_NATIONAL, hsQualifiers], [COLLEGE_NATIONAL, collegeQualifiers], [JUNIOR_COLLEGE_NATIONAL, juniorQualifiers]]) {
    const reached = bracket(entrants, rng(seed + '-national-' + event));
    for (const s of entrants) {
      const result = roundLabel(reached.get(s.id));
      map[s.id].national = { event, result, award: reached.get(s.id) <= 2 ? `${event} ${result}` : null };
    }
  }
  return map;
}

// Pool composition. Each of the 8 regions gets 50 slots: 33 high-schoolers and 17 others (136 in total).
const POOL_SIZE = 400,
  SLOTS_PER_REGION = 50,
  HIGH_SCHOOL_PER_REGION = 33;
const OTHER_PATHWAYS = [
  ['대졸', 56],
  ['대학 얼리', 24],
  ['2년제', 24],
  ['독립구단', 12],
  ['해외파', 6],
  ['마이너 복귀', 10],
  ['해외독립 복귀', 3],
];
// One returnee slot is special: rarely a brief MLB career or another foreign league, otherwise the minors.
const RARE_RETURN = { mlb: 0.12, otherLeague: 0.15 };
const STUDY_ABROAD_CHANCE = 0.2; // one high-school slot per pool, sometimes, is a player who studied abroad
// Talent bands; the extra depth of a 400-player pool sits mostly in the lower bands.
const BAND_COUNTS = [250, 100, 36, 11, 3];
const repeat = (value, n) => Array(n).fill(value);

const pitcherRole = (role) => role === 'SP' || role === 'RP';
/** Index into the club list. Players lean towards a club from the region where they grew up. */
function favoriteTeam(region, r) {
  const local = CLUBS.map((t, i) => (t.region === region ? i : -1)).filter((i) => i >= 0);
  if (local.length && r() < TUNING.generation.localFavorite) return local[Math.floor(r() * local.length)];
  return Math.floor(r() * CLUBS.length);
}
function rollRole(r) {
  const roll = r();
  return roll < 0.32 ? 'SP' : roll < 0.49 ? 'RP' : roll < 0.58 ? 'C' : roll < 0.81 ? 'IF' : 'OF';
}
function throwingHand(role, type, r) {
  if (pitcherRole(role)) return type === 2 || r() < 0.21 ? '좌' : '우'; // type 2 is the changeup lefty
  return role === 'OF' && r() < 0.25 ? '좌' : '우';
}
const battingHand = (r) => (r() < 0.015 ? '양' : r() < 0.43 ? '좌' : '우');

function generatePool(seed) {
  const r = rng(seed + '-pool-v6'),
    usedNames = new Set(),
    players = [],
    honors = schoolHonors(seed);
  const rare = rng(seed + '-rare-return')();
  const special = rare < RARE_RETURN.mlb ? 'MLB 경험 복귀' : rare < RARE_RETURN.mlb + RARE_RETURN.otherLeague ? '해외리그 복귀' : '마이너 복귀';
  const otherPaths = shuffle([...OTHER_PATHWAYS.flatMap(([path, n]) => repeat(path, n)), special], r);
  const abroad = rng(seed + '-study-abroad');
  const studyAbroadSlot = abroad() < STUDY_ABROAD_CHANCE ? Math.floor(abroad() * HIGH_SCHOOL_PER_REGION * REGIONS.length) : -1;
  const bands = shuffle(
    BAND_COUNTS.flatMap((n, band) => repeat(band, n)),
    rng(seed + '-talent-bands'),
  );
  const othersPerRegion = SLOTS_PER_REGION - HIGH_SCHOOL_PER_REGION;
  for (let i = 0; i < POOL_SIZE; i++) {
    const regionIndex = Math.floor(i / SLOTS_PER_REGION),
      slot = i % SLOTS_PER_REGION,
      region = REGIONS[regionIndex],
      hsIndex = regionIndex * HIGH_SCHOOL_PER_REGION + slot,
      pathway =
        slot >= HIGH_SCHOOL_PER_REGION
          ? otherPaths[regionIndex * othersPerRegion + slot - HIGH_SCHOOL_PER_REGION]
          : hsIndex === studyAbroadSlot
            ? '야구 유학'
            : '고졸',
      high = pathway === '고졸';
    const identity = Names.makeName(r, usedNames),
      bio = Bio.makeBiography(r, region, pathway),
      { name } = identity,
      { school, age } = bio;
    const schoolStyle = SCHOOL_STYLES[hash(bio.currentInstitutionId) % SCHOOL_STYLES.length];
    const reputation = Bio.TIERS[bio.schoolTier] || { ready: 0, team: 0.52 };
    const schoolTournament = honors[bio.currentInstitutionId] || null;
    const role = rollRole(r),
      pitcher = pitcherRole(role);
    const type = Math.floor(r() * 5),
      a = ARCHETYPES[role][type];
    const talent = G.make(role, type, bio, bands[i], r);
    const { ready, trueReady, upside, scoutCeiling, publicScore, control, power, speed, defense } = talent;
    const throwHand = throwingHand(role, type, r);
    const batHand = battingHand(r);
    const velocity = talent.velocity;
    const height = type === 4 && role === 'SP' ? 190 + Math.floor(r() * 7) : 174 + Math.floor(r() * 19),
      weight = round(68 + (height - 174) * 0.6 + r() * 15 + (type === 1 && !pitcher ? 7 : 0));
    const awards = [];
    if (high && ready >= 45 && r() < 0.35) awards.push('U-18 대표팀');
    if (['대졸', '대학 얼리', '2년제'].includes(pathway) && ready >= 45 && r() < 0.25) awards.push('대학 대표팀');
    // Shared school results: school reputation affects team success, not a direct AVG/ERA multiplier.
    if (schoolTournament?.award) awards.push(schoolTournament.award);
    if (schoolTournament?.national?.award) awards.push(schoolTournament.national.award);
    if (ready >= 45 && r() < 0.25) awards.push(pitcher ? '소속 대회 우수투수상' : '소속 대회 타격상');
    const record = amateurRecord(
      {
        role,
        ready,
        control,
        power,
        speed,
        schoolTier: bio.schoolTier,
        teamSupport: 0.85 + reputation.team * 0.4,
      },
      r,
    );
    if (bio.proExperience) applyOverseasRecord(record, bio.proExperience.level, pitcher, talent, r);
    players.push({
      id: 'p' + String(i + 1).padStart(3, '0'),
      ...identity,
      ...bio,
      ...talent,
      region,
      pathway,
      school,
      schoolStyle,
      schoolTournament,
      role,
      type,
      archetype: a[0],
      focus: a[3],
      age,
      height,
      weight,
      throwHand,
      batHand,
      ready,
      trueReady,
      upside,
      scoutCeiling,
      publicScore,
      velocity,
      control,
      power,
      speed,
      defense,
      awards,
      record,
      risk: 0.05 + r() * 0.11,
      personality: pick(PERSONALITIES, r),
      favoriteTeam: favoriteTeam(bio.highSchoolRegion, r),
      lateDevelopment: talent.growthCurve === 'late',
      confidence: record.games >= 25 ? '보통' : '관찰 표본 적음',
    });
  }
  // Scouting notes come from the public grades on a text-only stream, after all players are generated.
  for (const p of players) Object.assign(p, W.scoutNotes(p, rng(seed + '-notes-' + p.id)));
  players.sort((a, b) => b.publicScore - a.publicScore || a.id.localeCompare(b.id));
  players.forEach((p, i) => (p.rank = i + 1));
  // The other side of each player, then two-way prospects. Own streams: talent above is unaffected.
  const A = TUNING.altTalent,
    ar = rng(seed + '-alt-talent'),
    tw = rng(seed + '-two-way');
  const twoWayIds = new Set();
  const eligible = players.filter((p) => p.rank <= A.twoWay.maxRank && !p.proExperience);
  for (const chance of A.twoWay.chances) if (tw() < chance && eligible.length) twoWayIds.add(eligible.splice(Math.floor(tw() * eligible.length), 1)[0].id);
  for (const p of players) Object.assign(p, altSide(p, twoWayIds.has(p.id), ar));
  // Public scouting card for the other side (future grades, floor, ceiling). Display only, own stream per player.
  for (const p of players) p.alt.scouting = altScouting(p.alt, rng(seed + '-alt-scout-' + p.id));
  // Announced intentions (public): a few high-school players would rather go to college, and a rare
  // top prospect has interest from abroad. Own stream, so talent and ranks are unaffected.
  const I = TUNING.contracts.intent,
    ir = rng(seed + '-intent');
  let abroadCount = 0;
  for (const p of players) {
    p.intent = null;
    if (p.pathway !== '고졸' && p.pathway !== '야구 유학') continue;
    if (p.rank <= I.abroadMaxRank && p.scoutCeiling >= I.abroadMinFV && abroadCount < I.abroadMax && ir() < I.abroadChance) {
      p.intent = 'abroad';
      abroadCount++;
    } else if (p.scoutCeiling >= I.collegeMinFV && ir() < I.collegeShare) p.intent = 'college';
  }
  return { players, byId: Object.fromEntries(players.map((p) => [p.id, p])), seed: String(seed) };
}
/**
 * The other side of a player: hidden tools (`trueTools`, `potentialTools`) and a public estimate.
 * Pitchers' other side is a hitter (outfield or infield); hitters' is a pitcher (mostly relief).
 */
function altSide(p, twoWay, r) {
  const A = TUNING.altTalent,
    V = TUNING.generation.velocity,
    pitcher = pitcherRole(p.role);
  const role = pitcher ? (r() < 0.6 ? 'OF' : 'IF') : twoWay && r() < 0.5 ? 'SP' : 'RP';
  const centre = twoWay ? p.upside - (A.twoWay.below[0] + r() * A.twoWay.below[1]) : A.base[0] + r() * A.base[1] + Math.max(0, p.upside - 45) * A.athleticism;
  const young = p.pathway === '고졸' || p.pathway === '야구 유학',
    [g0, gs] = young ? A.gap.young : A.gap.older,
    gap = g0 + r() * gs;
  const keys = G.keys(role).concat(pitcherRole(role) ? [] : ['eye']);
  const potentialTools = {},
    trueTools = {},
    tools = {};
  for (const k of keys) {
    potentialTools[k] = clamp(centre + normal(r) * 4, 20, 80);
    trueTools[k] = Math.min(potentialTools[k], clamp(potentialTools[k] - gap * (k === 'speed' ? 0.4 : 1), 20, 80));
    tools[k] = G.grade(trueTools[k] + normal(r) * 5);
  }
  const ready = G.grade(G.overall(tools, role)),
    scoutCeiling = Math.max(ready, G.grade(G.overall(potentialTools, role) * 0.8 + G.overall(trueTools, role) * 0.2 + normal(r) * 3));
  const velocity = pitcherRole(role) ? Math.round(clamp(V.base + (trueTools.stuff - V.pivot) * V.perStuff + normal(r) * V.noise * 2, V.min, V.max)) : null;
  return { twoWay, alt: { role, trueTools, potentialTools, tools, ready, scoutCeiling, ceilingGrade: scoutCeiling, velocity, upside: G.overall(potentialTools, role) } };
}
/** Scouts' future grades for the other side. Never read by the simulation. */
function altScouting(alt, r) {
  const futureTools = Object.fromEntries(
    Object.keys(alt.tools).map((k) => [k, Math.max(alt.tools[k], G.grade(alt.potentialTools[k] * 0.8 + alt.trueTools[k] * 0.2 + normal(r) * 3))]),
  );
  return {
    futureTools,
    floorGrade: Math.min(alt.scoutCeiling, Math.max(alt.ready - 5, G.grade(alt.scoutCeiling - 9))),
    ceilingGrade: Math.max(alt.scoutCeiling, G.grade(alt.upside + normal(r) * 4)),
  };
}
/** Replaces the amateur line with a last overseas season (or a short MLB sample). */
function applyOverseasRecord(record, level, pitcher, talent, r) {
  const { ready, control, power, speed } = talent;
  const mult = level === 'MLB' ? 0.33 : level === 'AAA' ? 0.84 : level === 'AA' ? 0.94 : 1.05;
  record.games = level === 'MLB' ? 4 + Math.floor(r() * 12) : record.games + 15;
  if (pitcher) {
    record.outs = level === 'MLB' ? 9 + Math.floor(r() * 70) : record.outs + 100;
    record.er = Math.max(
      1,
      round((record.outs / 27) * (5.9 - (ready - 35) * 0.085 + (level === 'MLB' ? 1 : 0))),
    );
    record.era = round((record.er * 27) / record.outs, 2);
    record.k = round((record.outs / 3) * (0.5 + talent.tools.stuff / 110));
    record.bb = round((record.outs / 3) * Math.max(0.15, 0.75 - control / 105));
    record.wins = Math.floor(record.games * 0.3 * r());
  } else {
    record.ab = level === 'MLB' ? 12 + Math.floor(r() * 48) : record.games * 3;
    record.hits = round(
      record.ab * clamp((0.23 + (ready - 35) * 0.002) * mult + (level === 'MLB' ? 0.14 : 0), 0.12, 0.39),
    );
    record.bb = round(record.ab * 0.08);
    record.pa = record.ab + record.bb;
    record.hr = Math.min(record.hits, round(record.ab * clamp((power - 25) * 0.0008, 0.002, 0.06)));
    record.doubles = Math.min(record.hits - record.hr, round(record.hits * 0.2));
    record.triples = 0;
    record.avg = round(record.hits / record.ab, 3);
    record.ops = round(
      (record.hits + record.bb) / record.pa + (record.hits + record.doubles + 3 * record.hr) / record.ab,
      3,
    );
    record.rbi = round(record.hits * 0.4 + record.hr);
    record.runs = round((record.hits + record.bb) * 0.35);
    record.sb = round(((record.games * Math.max(0, speed - 30)) / 500) * r());
  }
}
function amateurRecord(p, r) {
  if (['SP', 'RP'].includes(p.role)) {
    const exposure = p.schoolTier === '명문' && p.ready < 53 ? 0.8 : 1;
    const games = Math.max(5, round((9 + Math.floor(r() * 15)) * exposure)),
      outs = round((p.role === 'SP' ? 24 + r() * 45 : 12 + r() * 23) * 3 * exposure),
      ip = outs / 3;
    const er = Math.max(2, round((ip * (7.3 - p.ready * 0.09 + normal(r) * 0.8)) / 9));
    return {
      kind: 'pitcher',
      games,
      outs,
      er,
      era: round((er * 9) / ip, 2),
      k: round(ip * (0.6 + p.ready / 105)),
      bb: round(ip * (0.67 - p.control / 170)),
      wins: Math.min(games, round(games * Math.max(0.05, (7 - (er * 9) / ip) / 20) * p.teamSupport)),
    };
  }
  const exposure = p.schoolTier === '명문' && p.ready < 53 ? 0.8 : 1;
  const games = round((20 + Math.floor(r() * 22)) * exposure),
    ab = games * (3 + Math.floor(r() * 2));
  const hits = round(ab * clamp(0.2 + p.ready * 0.0026 + normal(r) * 0.045, 0.21, 0.455)),
    bb = round(ab * (0.07 + p.control / 1000));
  const hr = Math.min(hits, round(ab * Math.max(0.001, (p.power - 25) / 850) * r())),
    doubles = Math.min(hits - hr, round(hits * 0.18)),
    triples = Math.min(hits - hr - doubles, Math.floor(r() * 3));
  const avg = round(hits / ab, 3),
    ops = round((hits + bb) / (ab + bb) + (hits + doubles + 2 * triples + 3 * hr) / ab, 3);
  return {
    kind: 'hitter',
    games,
    ab,
    pa: ab + bb,
    hits,
    bb,
    hr,
    doubles,
    triples,
    avg,
    ops,
    sb: round(((Math.max(0, p.speed - 25) * games) / 140) * r()),
    rbi: round((hits * 0.3 + hr) * p.teamSupport),
    runs: round((hits + bb) * 0.4 * p.teamSupport),
  };
}
const api = {
  grades: G,
  catalog: Cat.institutions,
  schoolHonors,
  bio: Bio,
  ko: Ko,
  names: Names,
  ROLES,
  REGIONS,
  SCHOOL_STYLES,
  PERSONALITIES,
  ARCHETYPES,
  hash,
  rng,
  clamp,
  round,
  mean,
  pick,
  shuffle,
  normal,
  generatePool,
  POOL_SIZE,
};
export default api;
