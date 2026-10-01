/* Facilities (V0.10): what the user's club can build besides more seats and new fences (ballpark.ts). Ballpark
   improvements bring money in (premium seats, a new scoreboard, food and shops) or keep players healthier (the
   grass); training facilities grow players faster, keep them healthy and slow the veterans' decline. Each comes in
   levels, is paid from the fund up front (building work: the owner's support does not cover it), costs upkeep every
   year and is ready the next season (the futures park's first stage takes two).

   Costs follow what KBO clubs spent where known (2군 구장: KIA 함평 250억, 한화 서산 260억, SK 강화 450억, 두산
   이천 550억, LG 이천 1,200억; RULES.md §9, S67); the effects are game assumptions. AI clubs are taken to have
   their facilities already (their staff ratings stand for them). */
import type { Player, TeamId } from '../model/types';
import type { FacilityKind, LeagueState } from './state';
import { ageIn } from './players';

export interface FacilityLevel {
  /** 만 원. */
  cost: number;
  upkeep: number;
  /** Seasons until it is ready. */
  build: number;
  effect: string;
}

export interface FacilitySpec {
  label: string;
  group: 'ballpark' | 'training';
  note: string;
  levels: FacilityLevel[];
}

export const FACILITIES: Record<FacilityKind, FacilitySpec> = {
  premium: {
    label: '좌석 리모델링 · 프리미엄석',
    group: 'ballpark',
    note: '테이블석·스카이박스를 늘려 관중 한 명당 티켓 수입이 오름',
    levels: [
      { cost: 400_000, upkeep: 10_000, build: 1, effect: '티켓 수입 +6%' },
      { cost: 600_000, upkeep: 15_000, build: 1, effect: '티켓 수입 +12%' },
    ],
  },
  scoreboard: {
    label: '대형 전광판 · LED 조명',
    group: 'ballpark',
    note: '경기장 경험이 좋아져 관중 수요가 조금 늘고, 들어서는 해 팬 관심이 오름',
    levels: [{ cost: 600_000, upkeep: 15_000, build: 1, effect: '관중 수요 +3%, 개장 때 팬 관심 +0.03' }],
  },
  turf: {
    label: '천연잔디 · 배수 시설',
    group: 'ballpark',
    note: '그라운드가 좋아져 부상이 조금 줄어듦',
    levels: [{ cost: 250_000, upkeep: 10_000, build: 1, effect: '부상 확률 −5%' }],
  },
  concessions: {
    label: '먹거리 · 편의시설',
    group: 'ballpark',
    note: '매장과 편의시설을 늘려 식음료·상품 수입이 오름',
    levels: [
      { cost: 300_000, upkeep: 5_000, build: 1, effect: '식음료 수입 +15%' },
      { cost: 400_000, upkeep: 8_000, build: 1, effect: '식음료 수입 +30%' },
    ],
  },
  indoor: {
    label: '실내 연습장',
    group: 'training',
    note: '날씨와 상관없이 훈련: 모든 선수의 성장이 조금 빨라짐',
    levels: [
      { cost: 800_000, upkeep: 20_000, build: 1, effect: '성장 +3%' },
      { cost: 1_000_000, upkeep: 30_000, build: 1, effect: '성장 +6%' },
    ],
  },
  gym: {
    label: '트레이닝센터 · 웨이트장',
    group: 'training',
    note: '근력·컨디셔닝: 부상이 줄고 베테랑의 노쇠가 늦어짐',
    levels: [
      { cost: 600_000, upkeep: 15_000, build: 1, effect: '부상 확률 −6%, 노쇠 −10%' },
      { cost: 800_000, upkeep: 20_000, build: 1, effect: '부상 확률 −12%, 노쇠 −20%' },
    ],
  },
  rehab: {
    label: '재활센터',
    group: 'training',
    note: '재활 장비와 전담 트레이너: 부상 기간이 짧아짐',
    levels: [
      { cost: 500_000, upkeep: 15_000, build: 1, effect: '부상 기간 −8%' },
      { cost: 700_000, upkeep: 20_000, build: 1, effect: '부상 기간 −15%' },
    ],
  },
  analytics: {
    label: '데이터 분석실 · 트래킹 장비',
    group: 'training',
    note: '투구·타구 추적 장비와 분석원: 성장과 해외 연수 효과가 커짐',
    levels: [
      { cost: 300_000, upkeep: 20_000, build: 1, effect: '성장 +2%, 해외 연수 효과 +10%' },
      { cost: 500_000, upkeep: 30_000, build: 1, effect: '성장 +4%, 해외 연수 효과 +20%' },
    ],
  },
  futuresPark: {
    label: '2군 전용 구장 (퓨처스 파크)',
    group: 'training',
    note: '2군 경기장·숙소·훈련장을 갖춘 단지: 24세 이하 선수의 성장이 빨라짐',
    levels: [
      { cost: 2_500_000, upkeep: 50_000, build: 2, effect: '24세 이하 성장 +5%' },
      { cost: 1_500_000, upkeep: 70_000, build: 1, effect: '24세 이하 성장 +10%' },
      { cost: 2_000_000, upkeep: 90_000, build: 1, effect: '24세 이하 성장 +15%' },
    ],
  },
  dorm: {
    label: '선수단 숙소',
    group: 'training',
    note: '어린 선수들이 함께 지내며 훈련: 23세 이하 성장이 빨라짐',
    levels: [{ cost: 600_000, upkeep: 10_000, build: 1, effect: '23세 이하 성장 +4%' }],
  },
};

export const FACILITY_KINDS = Object.keys(FACILITIES) as FacilityKind[];

/** The level the user's club has built (0 for none, and for every AI club). */
export const facilityLevel = (s: LeagueState, kind: FacilityKind, teamId: TeamId | null | undefined = s.user?.teamId) =>
  teamId && teamId === s.user?.teamId ? (s.user.facilities?.[kind] ?? 0) : 0;

const pick = (level: number, values: number[]) => (level > 0 ? values[Math.min(level, values.length) - 1]! : 0);

/** Extra share of a season's growth from the facilities (on top of coaching). */
export function facilityGrowth(s: LeagueState, p: Player, year: number): number {
  if (!p.teamId || p.teamId !== s.user?.teamId) return 0;
  const age = ageIn(p, year);
  return (
    pick(facilityLevel(s, 'indoor'), [0.03, 0.06]) +
    pick(facilityLevel(s, 'analytics'), [0.02, 0.04]) +
    (age <= 24 ? pick(facilityLevel(s, 'futuresPark'), [0.05, 0.1, 0.15]) : 0) +
    (age <= 23 ? pick(facilityLevel(s, 'dorm'), [0.04]) : 0)
  );
}

/** Share off the injury chance for the user's players (grass, gym). */
export const facilityInjury = (s: LeagueState, teamId: TeamId | null | undefined) =>
  teamId && teamId === s.user?.teamId ? pick(facilityLevel(s, 'turf'), [0.05]) + pick(facilityLevel(s, 'gym'), [0.06, 0.12]) : 0;

/** Share off injury layoffs (rehab centre). */
export const facilityRehab = (s: LeagueState, teamId: TeamId | null | undefined) => (teamId && teamId === s.user?.teamId ? pick(facilityLevel(s, 'rehab'), [0.08, 0.15]) : 0);

/** Share off the late-career decline (gym). */
export const facilityAging = (s: LeagueState, p: Player) => (p.teamId && p.teamId === s.user?.teamId ? pick(facilityLevel(s, 'gym'), [0.1, 0.2]) : 0);

/** Ticket revenue multiplier (premium seats), attendance demand (scoreboard), concessions (shops). */
export const premiumShare = (s: LeagueState, teamId: TeamId) => (teamId === s.user?.teamId ? pick(facilityLevel(s, 'premium'), [0.06, 0.12]) : 0);
export const scoreboardDemand = (s: LeagueState, teamId: TeamId) => (teamId === s.user?.teamId ? pick(facilityLevel(s, 'scoreboard'), [0.03]) : 0);
export const concessionsShare = (s: LeagueState, teamId: TeamId) => (teamId === s.user?.teamId ? pick(facilityLevel(s, 'concessions'), [0.15, 0.3]) : 0);

/** A year's upkeep of what is built: ballpark facilities and training facilities. */
export function facilityUpkeep(s: LeagueState, teamId: TeamId): { ballpark: number; training: number } {
  const out = { ballpark: 0, training: 0 };
  if (teamId !== s.user?.teamId) return out;
  for (const kind of FACILITY_KINDS) {
    const level = facilityLevel(s, kind);
    if (!level) continue;
    const spec = FACILITIES[kind];
    // Each level adds its own upkeep.
    const upkeep = spec.levels.slice(0, level).reduce((a, l) => a + l.upkeep, 0);
    out[spec.group === 'ballpark' ? 'ballpark' : 'training'] += upkeep;
  }
  return out;
}

export interface FacilityOption {
  kind: FacilityKind;
  level: number;
  cost: number;
  opens: number;
  blocked: string | null;
}

/** What can be built now: the next level of each facility, and why not when it cannot. */
export function facilityOptions(s: LeagueState): FacilityOption[] {
  const u = s.user;
  if (!u) return [];
  const next = s.phase === 'offseason' ? (s.offseason?.year ?? s.year) + 1 : s.year + 1;
  const busy = (u.facilityWorks ?? []).some((w) => w.opens >= next);
  return FACILITY_KINDS.flatMap((kind) => {
    const spec = FACILITIES[kind];
    const level = facilityLevel(s, kind) + 1;
    if (level > spec.levels.length) return [];
    const L = spec.levels[level - 1]!;
    const blocked = busy
      ? '진행 중인 시설 공사가 있습니다 (한 번에 하나).'
      : s.phase !== 'offseason'
        ? '공사는 비시즌에만 시작할 수 있습니다.'
        : L.cost > u.fund
          ? '구단 자금이 부족합니다.'
          : null;
    return [{ kind, level, cost: L.cost, opens: next + L.build - 1, blocked }];
  });
}

/** Starts the next level of a facility: paid from the fund now, ready before `opens`. */
export function startFacility(s: LeagueState, kind: FacilityKind) {
  const u = s.user;
  if (!u) throw new Error('구단이 없습니다.');
  const o = facilityOptions(s).find((x) => x.kind === kind);
  if (!o) throw new Error('더 지을 수 없는 시설입니다.');
  if (o.blocked) throw new Error(o.blocked);
  const year = s.offseason?.year ?? s.year;
  const spec = FACILITIES[kind];
  u.fund -= o.cost;
  u.ledger.push({ year, label: `시설 공사 · ${spec.label} ${o.level}단계`, amount: -o.cost, capital: true });
  (u.facilityWorks ??= []).push({ kind, level: o.level, opens: o.opens, cost: o.cost });
  (u.log ??= []).push({ year, text: `${spec.label} ${o.level}단계 공사 시작 (${Math.round(o.cost / 10000)}억, ${o.opens}년 시즌부터)` });
}

/** Works due by `season` are finished: the level counts from that season. Returns what opened. */
export function openFacilities(s: LeagueState, season: number): FacilityKind[] {
  const u = s.user;
  if (!u?.facilityWorks) return [];
  const opened: FacilityKind[] = [];
  for (const w of u.facilityWorks) {
    if (w.opens !== season || (u.facilities?.[w.kind] ?? 0) >= w.level) continue;
    (u.facilities ??= {})[w.kind] = w.level;
    opened.push(w.kind);
    (u.log ??= []).push({ year: season - 1, text: `${FACILITIES[w.kind].label} ${w.level}단계 완공: ${season} 시즌부터 (${FACILITIES[w.kind].levels[w.level - 1]!.effect})` });
  }
  return opened;
}
