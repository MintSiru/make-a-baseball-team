import { k as __i18n_k } from '../i18n/index.js';
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
const SCHOOL_STYLES = [__i18n_k("draftroom.prospects.sCHOOL_STYLES.d7c7ce4c"), __i18n_k("draftroom.prospects.sCHOOL_STYLES.eee8c1ac"), __i18n_k("draftroom.prospects.sCHOOL_STYLES.8701ac09"), __i18n_k("draftroom.prospects.sCHOOL_STYLES.e5f2e5da")];
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
    ['강속구 선발', __i18n_k("draftroom.prospects.aRCHETYPES.sP.0d7ec4e2"), __i18n_k("draftroom.prospects.aRCHETYPES.sP.3eb6d6fa"), __i18n_k("draftroom.prospects.aRCHETYPES.sP.ae868f9e")],
    ['커맨드형 선발', __i18n_k("draftroom.prospects.aRCHETYPES.sP.5e4f6741"), __i18n_k("draftroom.prospects.aRCHETYPES.sP.328b6bba"), __i18n_k("draftroom.prospects.aRCHETYPES.sP.9822c047")],
    ['체인지업 좌완', __i18n_k("draftroom.prospects.aRCHETYPES.sP.3975b466"), __i18n_k("draftroom.prospects.aRCHETYPES.sP.fc33d47b"), __i18n_k("draftroom.prospects.aRCHETYPES.sP.99d871d2")],
    ['땅볼 유도형 선발', __i18n_k("draftroom.prospects.aRCHETYPES.sP.538f3c36"), __i18n_k("draftroom.prospects.aRCHETYPES.sP.fd835365"), __i18n_k("draftroom.prospects.aRCHETYPES.sP.2bd4789c")],
    ['장신 커브볼러', __i18n_k("draftroom.prospects.aRCHETYPES.sP.66e46cbf"), __i18n_k("draftroom.prospects.aRCHETYPES.sP.fd9ab91c"), __i18n_k("draftroom.prospects.aRCHETYPES.sP.010b856d")],
  ],
  RP: [
    ['파워 불펜', __i18n_k("draftroom.prospects.aRCHETYPES.rP.8e133215"), __i18n_k("draftroom.prospects.aRCHETYPES.rP.6e958584"), __i18n_k("draftroom.prospects.aRCHETYPES.rP.9061348f")],
    [__i18n_k("draftroom.prospects.aRCHETYPES.rP.e2eee185"), __i18n_k("draftroom.prospects.aRCHETYPES.rP.45f1cdc8"), __i18n_k("draftroom.prospects.aRCHETYPES.rP.6e3bc637"), __i18n_k("draftroom.prospects.aRCHETYPES.rP.7a87b564")],
    ['좌완 스페셜리스트', __i18n_k("draftroom.prospects.aRCHETYPES.rP.52c925f7"), __i18n_k("draftroom.prospects.aRCHETYPES.rP.d0c7cbaa"), __i18n_k("draftroom.prospects.aRCHETYPES.rP.c618b402")],
    [__i18n_k("draftroom.prospects.aRCHETYPES.rP.58abc028"), __i18n_k("draftroom.prospects.aRCHETYPES.rP.7d1c397e"), __i18n_k("draftroom.prospects.aRCHETYPES.rP.200bb2d3"), __i18n_k("draftroom.prospects.aRCHETYPES.rP.906090f0")],
    ['포크볼 불펜', __i18n_k("draftroom.prospects.aRCHETYPES.rP.f6bb28d4"), __i18n_k("draftroom.prospects.aRCHETYPES.rP.e3679c57"), __i18n_k("draftroom.prospects.aRCHETYPES.rP.4ad6fbe8")],
  ],
  C: [
    [__i18n_k("draftroom.prospects.aRCHETYPES.c.25565967"), __i18n_k("draftroom.prospects.aRCHETYPES.c.dbc3521b"), __i18n_k("draftroom.prospects.aRCHETYPES.c.91499167"), __i18n_k("draftroom.prospects.aRCHETYPES.c.29c536f6")],
    [__i18n_k("draftroom.prospects.aRCHETYPES.c.8915540f"), __i18n_k("draftroom.prospects.aRCHETYPES.c.53ab971a"), __i18n_k("draftroom.prospects.aRCHETYPES.c.0272cf6f"), __i18n_k("draftroom.prospects.aRCHETYPES.c.88902d3e")],
    [__i18n_k("draftroom.prospects.aRCHETYPES.c.a9b195e2"), __i18n_k("draftroom.prospects.aRCHETYPES.c.68df0eb1"), __i18n_k("draftroom.prospects.aRCHETYPES.c.aafff346"), __i18n_k("draftroom.prospects.aRCHETYPES.c.99d871d2")],
    [__i18n_k("draftroom.prospects.aRCHETYPES.c.27509b50"), __i18n_k("draftroom.prospects.aRCHETYPES.c.89647e24"), __i18n_k("draftroom.prospects.aRCHETYPES.c.26f5aef0"), __i18n_k("draftroom.prospects.aRCHETYPES.c.fe0dea7f")],
    [__i18n_k("draftroom.prospects.aRCHETYPES.c.fcc08f58"), __i18n_k("draftroom.prospects.aRCHETYPES.c.10201afb"), __i18n_k("draftroom.prospects.aRCHETYPES.c.77f5dc3e"), __i18n_k("draftroom.prospects.aRCHETYPES.c.0ed3e05c")],
  ],
  IF: [
    [__i18n_k("draftroom.prospects.aRCHETYPES.iF.2a1f0a37"), __i18n_k("draftroom.prospects.aRCHETYPES.iF.828323ea"), __i18n_k("draftroom.prospects.aRCHETYPES.iF.f4e8d7e8"), __i18n_k("draftroom.prospects.aRCHETYPES.iF.0ed3e05c")],
    [__i18n_k("draftroom.prospects.aRCHETYPES.iF.dd19b9fe"), __i18n_k("draftroom.prospects.aRCHETYPES.iF.bfc6c610"), __i18n_k("draftroom.prospects.aRCHETYPES.iF.ef05f1bb"), __i18n_k("draftroom.prospects.aRCHETYPES.iF.db055d95")],
    [__i18n_k("draftroom.prospects.aRCHETYPES.iF.9b3672ee"), __i18n_k("draftroom.prospects.aRCHETYPES.iF.c1a4a126"), __i18n_k("draftroom.prospects.aRCHETYPES.iF.0b06c06b"), __i18n_k("draftroom.prospects.aRCHETYPES.iF.99d871d2")],
    [__i18n_k("draftroom.prospects.aRCHETYPES.iF.71995077"), __i18n_k("draftroom.prospects.aRCHETYPES.iF.e85161c1"), __i18n_k("draftroom.prospects.aRCHETYPES.iF.248cd28c"), __i18n_k("draftroom.prospects.aRCHETYPES.iF.de54b296")],
    [__i18n_k("draftroom.prospects.aRCHETYPES.iF.28031bbe"), __i18n_k("draftroom.prospects.aRCHETYPES.iF.9f71b1e7"), __i18n_k("draftroom.prospects.aRCHETYPES.iF.06ce04f6"), __i18n_k("draftroom.prospects.aRCHETYPES.iF.b188da95")],
  ],
  OF: [
    [__i18n_k("draftroom.prospects.aRCHETYPES.oF.2ac63470"), __i18n_k("draftroom.prospects.aRCHETYPES.oF.1603f7f3"), __i18n_k("draftroom.prospects.aRCHETYPES.oF.f8c24d09"), __i18n_k("draftroom.prospects.aRCHETYPES.oF.ac886d4a")],
    [__i18n_k("draftroom.prospects.aRCHETYPES.oF.3f0cab37"), __i18n_k("draftroom.prospects.aRCHETYPES.oF.fbb17e4d"), __i18n_k("draftroom.prospects.aRCHETYPES.oF.2528444a"), __i18n_k("draftroom.prospects.aRCHETYPES.oF.db055d95")],
    [__i18n_k("draftroom.prospects.aRCHETYPES.oF.232cd720"), __i18n_k("draftroom.prospects.aRCHETYPES.oF.ffeae834"), __i18n_k("draftroom.prospects.aRCHETYPES.oF.eedfcd0d"), __i18n_k("draftroom.prospects.aRCHETYPES.oF.0ed3e05c")],
    [__i18n_k("draftroom.prospects.aRCHETYPES.oF.cd5d9d97"), __i18n_k("draftroom.prospects.aRCHETYPES.oF.a4e8ed93"), __i18n_k("draftroom.prospects.aRCHETYPES.oF.0cc170fd"), __i18n_k("draftroom.prospects.aRCHETYPES.oF.ac886d4a")],
    [__i18n_k("draftroom.prospects.aRCHETYPES.oF.989c91c4"), __i18n_k("draftroom.prospects.aRCHETYPES.oF.7d1edea8"), __i18n_k("draftroom.prospects.aRCHETYPES.oF.816aac20"), __i18n_k("draftroom.prospects.aRCHETYPES.oF.11465645")],
  ],
};
// Amateur tournaments. Descriptive only: results come from their own streams and never change players.
const HS_NATIONAL = __i18n_k("draftroom.prospects.hS_NATIONAL.5b4476fa"),
  COLLEGE_NATIONAL = __i18n_k("draftroom.prospects.cOLLEGE_NATIONAL.44c5af5b"),
  JUNIOR_COLLEGE_NATIONAL = __i18n_k("draftroom.prospects.jUNIOR_COLLEGE_NATIONAL.4de9ca9e"),
  NATIONAL_QUALIFIERS = 4; // top four of each regional/conference event go to the national event
const COLLEGE_CONFERENCES = [
  [__i18n_k("draftroom.prospects.cOLLEGE_CONFERENCES.b3590bfe"), [__i18n_k("draftroom.prospects.cOLLEGE_CONFERENCES.ea9858ee"), __i18n_k("draftroom.prospects.cOLLEGE_CONFERENCES.41402f7e"), '경기·강원']],
  [__i18n_k("draftroom.prospects.cOLLEGE_CONFERENCES.e1c050ad"), ['대전·충청·전북', '광주·전남·제주']],
  [__i18n_k("draftroom.prospects.cOLLEGE_CONFERENCES.a98d86de"), ['대구·경북', '부산·울산', __i18n_k("draftroom.prospects.cOLLEGE_CONFERENCES.7aeadd5c")]],
];
const placeLabel = (i) => (i === 0 ? '우승' : i === 1 ? __i18n_k("draftroom.prospects.placeLabel.3660fdbb") : i < 4 ? __i18n_k("draftroom.prospects.placeLabel.82c2c27f") : i < 8 ? __i18n_k("draftroom.prospects.placeLabel.bea9cec6") : __i18n_k("draftroom.prospects.placeLabel.efb15c9f"));
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
const roundLabel = (n) => (n === 1 ? '우승' : n === 2 ? __i18n_k("draftroom.prospects.roundLabel.3660fdbb") : __i18n_k("draftroom.prospects.roundLabel.0e854629", { n: n }));

function schoolHonors(seed) {
  const map = {};
  // Regional events. The seed key keeps its original label so the rankings (and players) stay the same.
  const regional = REGIONS.map((region) => ({
    key: __i18n_k("draftroom.prospects.regional.key.6e101381", { region: region }),
    label: __i18n_k("draftroom.prospects.regional.label.66d071e5", { region: region }),
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
  const r = rng(__i18n_k("draftroom.prospects.schoolHonors.r.2147c880", { seed: seed }));
  const collegeRank = colleges.map((s) => ({ s, score: Bio.TIERS[s.tier].team * 60 + r() * 55 })).sort((a, b) => b.score - a.score).map((x) => x.s);
  const collegeQualifiers = [];
  for (const [name, regions] of COLLEGE_CONFERENCES) {
    const label = __i18n_k("draftroom.prospects.schoolHonors.label.65d1967c", { name: name });
    collegeRank.filter((s) => regions.includes(s.region)).forEach((s, i) => {
      map[s.id] = { event: label, result: placeLabel(i), award: i < 2 ? `${label} ${placeLabel(i)}` : null, national: null };
      if (i < NATIONAL_QUALIFIERS) collegeQualifiers.push(s);
    });
  }
  // Two-year colleges: one league, then the top four meet in their own tournament.
  const juniors = Cat.institutions.filter((x) => x.kind === 'college2');
  const rj = rng(__i18n_k("draftroom.prospects.schoolHonors.rj.91b38c0c", { seed: seed }));
  const juniorQualifiers = [];
  juniors
    .map((s) => ({ s, score: Bio.TIERS[s.tier].team * 60 + rj() * 55 }))
    .sort((a, b) => b.score - a.score)
    .forEach(({ s }, i) => {
      map[s.id] = { event: __i18n_k("draftroom.prospects.schoolHonors.event.bd2e96fc"), result: __i18n_k("draftroom.prospects.schoolHonors.result.290bdca7", { value: i + 1 }), award: i === 0 ? __i18n_k("draftroom.prospects.schoolHonors.award.878c136f") : null, national: null };
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
    if (high && ready >= 45 && r() < 0.35) awards.push(__i18n_k("draftroom.prospects.generatePool.67a28002"));
    if (['대졸', '대학 얼리', '2년제'].includes(pathway) && ready >= 45 && r() < 0.25) awards.push(__i18n_k("draftroom.prospects.generatePool.f45e2ce3"));
    // Shared school results: school reputation affects team success, not a direct AVG/ERA multiplier.
    if (schoolTournament?.award) awards.push(schoolTournament.award);
    if (schoolTournament?.national?.award) awards.push(schoolTournament.national.award);
    if (ready >= 45 && r() < 0.25) awards.push(pitcher ? __i18n_k("draftroom.prospects.generatePool.41960e75") : __i18n_k("draftroom.prospects.generatePool.411ea424"));
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
      confidence: record.games >= 25 ? '보통' : __i18n_k("draftroom.prospects.generatePool.confidence.24373bd2"),
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
