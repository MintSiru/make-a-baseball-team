import { k as __i18n_k } from '../i18n/index.js';
/* Fictional educational histories. Current qualification != birthplace or old school. */
// Ported from KBO-Draft-Room df4faad src/core/biography.js. See docs/UPSTREAM.md.
import DraftCatalog from './catalog.js';

const Cat = DraftCatalog;
const DRAFT_DATE = '2026-09-16',
  DRAFT_YEAR = 2026,
  ENTRY_YEAR = 2027;
const REGIONS = [
  __i18n_k("draftroom.biography.rEGIONS.ea9858ee"),
  __i18n_k("draftroom.biography.rEGIONS.7aeadd5c"),
  '대전·충청·전북',
  '부산·울산',
  __i18n_k("draftroom.biography.rEGIONS.41402f7e"),
  '경기·강원',
  '대구·경북',
  '광주·전남·제주',
];
const CITIES = {
  서울: [__i18n_k("draftroom.biography.cITIES.message.71d9dd43"), __i18n_k("draftroom.biography.cITIES.message.91bf00f1"), __i18n_k("draftroom.biography.cITIES.message.ce691fd7"), __i18n_k("draftroom.biography.cITIES.message.014d6389"), __i18n_k("draftroom.biography.cITIES.message.c5003be8")],
  경남: [__i18n_k("draftroom.biography.cITIES.message.d517715a"), __i18n_k("draftroom.biography.cITIES.message.c446c4c9"), __i18n_k("draftroom.biography.cITIES.message.435a8215"), __i18n_k("draftroom.biography.cITIES.message.868f7fbe"), __i18n_k("draftroom.biography.cITIES.message.10da22f1")],
  '대전·충청·전북': [__i18n_k("draftroom.biography.cITIES.1e783cc6"), __i18n_k("draftroom.biography.cITIES.ffee1233"), __i18n_k("draftroom.biography.cITIES.d2f21306"), __i18n_k("draftroom.biography.cITIES.210a875a"), __i18n_k("draftroom.biography.cITIES.64ada749"), __i18n_k("draftroom.biography.cITIES.1801c5fc")],
  '부산·울산': [__i18n_k("draftroom.biography.cITIES.aed8af26"), __i18n_k("draftroom.biography.cITIES.a8f4acdb"), __i18n_k("draftroom.biography.cITIES.546ba657"), __i18n_k("draftroom.biography.cITIES.b00e43e0"), __i18n_k("draftroom.biography.cITIES.e68f5b53")],
  인천: [__i18n_k("draftroom.biography.cITIES.message.a134357c"), __i18n_k("draftroom.biography.cITIES.message.8d7b66b1"), __i18n_k("draftroom.biography.cITIES.message.70b39ea2"), __i18n_k("draftroom.biography.cITIES.message.1792b391")],
  '경기·강원': [__i18n_k("draftroom.biography.cITIES.08ccbbe9"), __i18n_k("draftroom.biography.cITIES.f560dc60"), __i18n_k("draftroom.biography.cITIES.c7311e99"), __i18n_k("draftroom.biography.cITIES.a227ab1c"), __i18n_k("draftroom.biography.cITIES.8b26cefa"), __i18n_k("draftroom.biography.cITIES.35543581"), __i18n_k("draftroom.biography.cITIES.da0de687"), __i18n_k("draftroom.biography.cITIES.d672dce0")],
  '대구·경북': [__i18n_k("draftroom.biography.cITIES.604f78d4"), __i18n_k("draftroom.biography.cITIES.a8164928"), __i18n_k("draftroom.biography.cITIES.1bd9ee29"), __i18n_k("draftroom.biography.cITIES.f6652dd7"), __i18n_k("draftroom.biography.cITIES.19136699")],
  '광주·전남·제주': [__i18n_k("draftroom.biography.cITIES.ad0d7d4b"), __i18n_k("draftroom.biography.cITIES.27f5a39c"), __i18n_k("draftroom.biography.cITIES.5ba7ff76"), __i18n_k("draftroom.biography.cITIES.1d78e09b"), __i18n_k("draftroom.biography.cITIES.b6966f66"), __i18n_k("draftroom.biography.cITIES.d63a985b")],
};
const TIERS = {
  명문: { ready: 4, weight: 1.8, team: 0.82 },
  강호: { ready: 1, weight: 1.3, team: 0.68 },
  중견: { ready: -1, weight: 1, team: 0.52 },
  약소: { ready: -4, weight: 0.7, team: 0.36 },
};
const pick = (xs, r) => xs[Math.floor(r() * xs.length)];

// Per pathway: education, entry category (drives talent generation), qualification and quota eligibility.
const PATHWAY_INFO = {
  고졸: { education: '고교 졸업 예정', entry: 'high-school', qualification: '고교 졸업 예정' },
  대졸: { education: __i18n_k("draftroom.biography.message.education.30007684"), entry: 'college-graduate', qualification: __i18n_k("draftroom.biography.message.qualification.f6edad66"), quota: true, collegeYear: 4 },
  '대학 얼리': { education: __i18n_k("draftroom.biography.pATHWAY_INFO.education.872d1210"), entry: 'college-early', qualification: __i18n_k("draftroom.biography.pATHWAY_INFO.qualification.7f32aad5"), collegeYear: 2 },
  '2년제': { education: __i18n_k("draftroom.biography.pATHWAY_INFO.education.2492908e"), entry: 'college-two-year', qualification: __i18n_k("draftroom.biography.pATHWAY_INFO.qualification.53e74ef0"), quota: true, collegeYear: 2 },
  '야구 유학': { education: __i18n_k("draftroom.biography.pATHWAY_INFO.education.f15ef1a7"), entry: 'study-abroad', qualification: __i18n_k("draftroom.biography.pATHWAY_INFO.qualification.f15ef1a7") },
  독립구단: { education: __i18n_k("draftroom.biography.message.education.61948271"), entry: 'independent', qualification: __i18n_k("draftroom.biography.message.qualification.a2382cae") },
  해외파: { education: __i18n_k("draftroom.biography.message.education.30007684"), entry: 'overseas', qualification: __i18n_k("draftroom.biography.message.qualification.65bd8a18") },
};
const RETURN_LEVELS = { '마이너 복귀': ['A', 'AA', 'AAA'], '해외독립 복귀': [__i18n_k("draftroom.biography.rETURN_LEVELS.400951ad")], 'MLB 경험 복귀': ['MLB'], '해외리그 복귀': [__i18n_k("draftroom.biography.rETURN_LEVELS.602ac124"), 'CPBL', 'LMB', 'ABL'] };
function choose(xs, r) {
  let n = r() * xs.reduce((s, x) => s + (x.weight || TIERS[x.tier]?.weight || 1), 0);
  for (const x of xs) {
    n -= x.weight || TIERS[x.tier]?.weight || 1;
    if (n < 0) return x;
  }
  return xs.at(-1);
}
function ageAt(birth, date = DRAFT_DATE) {
  const [y, m, d] = birth.split('-').map(Number),
    [cy, cm, cd] = date.split('-').map(Number);
  return cy - y - (cm < m || (cm === m && cd < d) ? 1 : 0);
}
const iso = (y, m, d = 1) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
function makeBiography(r, region, pathway) {
  let hs = choose(
    Cat.institutions.filter((s) => ['high-school', 'hs-club'].includes(s.kind) && s.region === region),
    r,
  );
  const high = pathway === '고졸';
  // A study-abroad player grew up in `region` but finished high school overseas.
  if (pathway === '야구 유학') hs = pick(Cat.institutions.filter((s) => s.kind === 'overseas-hs'), r);
  let current = hs,
    hsGrad = ENTRY_YEAR,
    withCollege = false;
  if (['대졸', '대학 얼리'].includes(pathway)) {
    current = choose(
      Cat.institutions.filter((s) => s.kind === 'college'),
      r,
    );
    hsGrad = ENTRY_YEAR - (pathway === '대학 얼리' ? 2 : 4);
  }
  if (pathway === '2년제') {
    current = choose(
      Cat.institutions.filter((s) => s.kind === 'college2'),
      r,
    );
    hsGrad = ENTRY_YEAR - 2;
  }
  const returning = Object.hasOwn(RETURN_LEVELS, pathway);
  if (pathway === '해외파') {
    current = choose(
      Cat.institutions.filter((s) => s.kind === 'overseas-college'),
      r,
    );
    hsGrad = DRAFT_YEAR - 4;
  }
  if (returning) {
    const level = pick(RETURN_LEVELS[pathway], r);
    current = pick(
      Cat.institutions.filter((s) => s.level === level),
      r,
    );
    hsGrad = DRAFT_YEAR - 3 - Math.floor(r() * 4);
  }
  if (pathway === '독립구단') {
    current = pick(
      Cat.institutions.filter((s) => s.kind === 'independent'),
      r,
    );
    withCollege = r() < 0.55;
    hsGrad = withCollege ? 2019 + Math.floor(r() * 3) : 2021 + Math.floor(r() * 5);
  }
  const birthYear = hsGrad - 19,
    month = 1 + Math.floor(r() * 12),
    day = 1 + Math.floor(r() * new Date(Date.UTC(birthYear, month, 0)).getUTCDate());
  const birthday = iso(birthYear, month, day),
    birthRegion =
      r() < 0.78
        ? region
        : pick(
            REGIONS.filter((x) => x !== region),
            r,
          ),
    birthplace = pick(CITIES[birthRegion], r);
  const history = [
    {
      institutionId: hs.id,
      name: hs.name,
      kind: hs.kind,
      region: hs.region,
      tier: hs.tier,
      start: iso(hsGrad - 3, 3),
      end: iso(hsGrad, 2, 28),
      status: hs.kind === 'hs-club' ? (high ? __i18n_k("draftroom.biography.history.status.e2991e2c") : __i18n_k("draftroom.biography.history.status.9d74244d")) : high || pathway === '야구 유학' ? __i18n_k("draftroom.biography.history.status.f00303ef") : __i18n_k("draftroom.biography.history.status.ca51f06f"),
      note:
        hs.kind === 'hs-club' ? __i18n_k("draftroom.biography.history.note.7e0e9103")
        : pathway === '야구 유학' ? __i18n_k("draftroom.biography.history.note.3cf890ad", { country: hs.country })
        : '',
    },
  ];
  if (['대졸', '대학 얼리'].includes(pathway))
    history.push({
      institutionId: current.id,
      name: current.name,
      kind: current.kind,
      region: current.region,
      tier: current.tier,
      start: iso(hsGrad, 3),
      end: pathway === '대학 얼리' ? null : iso(ENTRY_YEAR, 2, 28),
      status: pathway === '대학 얼리' ? __i18n_k("draftroom.biography.makeBiography.status.8c293b47") : __i18n_k("draftroom.biography.makeBiography.status.f00303ef"),
      note:
        pathway === '대학 얼리'
          ? __i18n_k("draftroom.biography.makeBiography.note.c154105d")
          : __i18n_k("draftroom.biography.makeBiography.note.d7e41505"),
    });
  if (pathway === '2년제')
    history.push({
      institutionId: current.id,
      name: current.name,
      kind: current.kind,
      region: current.region,
      tier: current.tier,
      start: iso(hsGrad, 3),
      end: iso(ENTRY_YEAR, 2, 28),
      status: __i18n_k("draftroom.biography.makeBiography.status.f00303ef"),
      note: __i18n_k("draftroom.biography.makeBiography.note.d82ec013"),
    });
  if (pathway === '해외파')
    history.push({
      institutionId: current.id,
      name: current.name,
      kind: current.kind,
      region: current.country,
      tier: null,
      start: iso(hsGrad, current.academicStartMonth),
      end: iso(DRAFT_YEAR, current.academicEndMonth, 28),
      status: __i18n_k("draftroom.biography.makeBiography.status.ca51f06f"),
      note: __i18n_k("draftroom.biography.makeBiography.note.2aa0d1ce"),
    });
  if (pathway === '독립구단') {
    let independentStart = hsGrad;
    if (withCollege) {
      const college = choose(
        Cat.institutions.filter((s) => s.kind === 'college'),
        r,
      );
      independentStart = hsGrad + 4;
      history.push({
        institutionId: college.id,
        name: college.name,
        kind: college.kind,
        region: college.region,
        tier: college.tier,
        start: iso(hsGrad, 3),
        end: iso(independentStart, 2, 28),
        status: __i18n_k("draftroom.biography.makeBiography.status.ca51f06f"),
        note: '',
      });
    }
    history.push({
      institutionId: current.id,
      name: current.name,
      kind: current.kind,
      region: current.region,
      tier: null,
      start: iso(independentStart, 3),
      end: null,
      status: __i18n_k("draftroom.biography.makeBiography.status.d38db827"),
      note: __i18n_k("draftroom.biography.makeBiography.note.54fca7e5"),
    });
  }
  if (returning)
    history.push({
      institutionId: current.id,
      name: current.name,
      kind: current.kind,
      region: current.country,
      tier: null,
      start: iso(hsGrad, 3),
      end: iso(DRAFT_YEAR, 8, 31),
      status: __i18n_k("draftroom.biography.makeBiography.status.f95ee99d"),
      note: __i18n_k("draftroom.biography.makeBiography.note.ff9096bc"),
    });
  const proExperience = returning
    ? {
        level: current.level,
        seasons: DRAFT_YEAR - hsGrad + 1,
        domesticPro: false,
        briefMLB: current.level === 'MLB',
        recordScope: current.level === 'MLB' ? __i18n_k("draftroom.biography.proExperience.recordScope.6a6bdf93") : __i18n_k("draftroom.biography.proExperience.recordScope.4494a8aa", { level: current.level }),
      }
    : null;
  return {
    proExperience,
    education: returning ? __i18n_k("draftroom.biography.makeBiography.education.a9b9dd23") : withCollege ? __i18n_k("draftroom.biography.makeBiography.education.a589337f") : PATHWAY_INFO[pathway].education,
    entryCategory: returning ? 'overseas-return' : PATHWAY_INFO[pathway].entry,
    collegeYear: PATHWAY_INFO[pathway]?.collegeYear ?? null,
    quotaEligible: !!PATHWAY_INFO[pathway]?.quota,
    birthday,
    age: ageAt(birthday),
    birthRegion,
    birthplace,
    cohort: birthYear,
    highSchoolId: hs.id,
    highSchoolName: hs.name,
    highSchoolRegion: hs.region,
    highSchoolGradYear: hsGrad,
    currentInstitutionId: current.id,
    currentInstitution: current,
    school: current.name,
    schoolTier: current.tier,
    history,
    pathText: history.map((h) => h.name).join(' → '),
    qualification: returning ? __i18n_k("draftroom.biography.makeBiography.qualification.ca422ce1") : PATHWAY_INFO[pathway].qualification,
    regionalEligible: high,
    regionalRegion: high ? hs.region : null,
    regionalReason: high
      ? hs.kind === 'hs-club'
        ? __i18n_k("draftroom.biography.makeBiography.regionalReason.1a5e715c")
        : __i18n_k("draftroom.biography.makeBiography.regionalReason.bdfdf932")
      : __i18n_k("draftroom.biography.makeBiography.regionalReason.96426f32"),
  };
}
function eligible(p, team) {
  const s = Cat.byId[p.currentInstitutionId];
  return (
    p.pathway === '고졸' &&
    p.qualification === '고교 졸업 예정' &&
    p.highSchoolGradYear === ENTRY_YEAR &&
    s &&
    ['high-school', 'hs-club'].includes(s.kind) &&
    s.id === p.highSchoolId &&
    s.region === team.region &&
    !p.history.some((h) => ['college', 'college2', 'independent', 'overseas-college'].includes(h.kind))
  );
}
const api = { DRAFT_DATE, DRAFT_YEAR, ENTRY_YEAR, REGIONS, CITIES, TIERS, ageAt, makeBiography, eligible };
export default api;
