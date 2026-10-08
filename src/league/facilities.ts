import { k as __i18n_k } from '../i18n/index';
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
    label: __i18n_k("league.facilities.premium.label.43af90a4"),
    group: 'ballpark',
    note: __i18n_k("league.facilities.premium.note.90ec67a1"),
    levels: [
      { cost: 400_000, upkeep: 10_000, build: 1, effect: __i18n_k("league.facilities.levels.effect.1f860dcc") },
      { cost: 600_000, upkeep: 15_000, build: 1, effect: __i18n_k("league.facilities.levels.effect.89b295ed") },
    ],
  },
  scoreboard: {
    label: __i18n_k("league.facilities.scoreboard.label.17c8dd33"),
    group: 'ballpark',
    note: __i18n_k("league.facilities.scoreboard.note.92f0d9c6"),
    levels: [{ cost: 600_000, upkeep: 15_000, build: 1, effect: __i18n_k("league.facilities.levels.effect.e7ce0922") }],
  },
  turf: {
    label: __i18n_k("league.facilities.turf.label.c4bd29a1"),
    group: 'ballpark',
    note: __i18n_k("league.facilities.turf.note.0f97b92c"),
    levels: [{ cost: 250_000, upkeep: 10_000, build: 1, effect: __i18n_k("league.facilities.levels.effect.bfd9734d") }],
  },
  concessions: {
    label: __i18n_k("league.facilities.concessions.label.15adb391"),
    group: 'ballpark',
    note: __i18n_k("league.facilities.concessions.note.11ec5d5a"),
    levels: [
      { cost: 300_000, upkeep: 5_000, build: 1, effect: __i18n_k("league.facilities.levels.effect.ea8ee1cb") },
      { cost: 400_000, upkeep: 8_000, build: 1, effect: __i18n_k("league.facilities.levels.effect.78023a36") },
    ],
  },
  indoor: {
    label: __i18n_k("league.facilities.indoor.label.76426b1a"),
    group: 'training',
    note: __i18n_k("league.facilities.indoor.note.32874ac2"),
    levels: [
      { cost: 800_000, upkeep: 20_000, build: 1, effect: __i18n_k("league.facilities.levels.effect.fdf5dc85") },
      { cost: 1_000_000, upkeep: 30_000, build: 1, effect: __i18n_k("league.facilities.levels.effect.6b3fcbe1") },
    ],
  },
  gym: {
    label: __i18n_k("league.facilities.gym.label.c983b074"),
    group: 'training',
    note: __i18n_k("league.facilities.gym.note.9fa940d2"),
    levels: [
      { cost: 600_000, upkeep: 15_000, build: 1, effect: __i18n_k("league.facilities.levels.effect.c66fc1fa") },
      { cost: 800_000, upkeep: 20_000, build: 1, effect: __i18n_k("league.facilities.levels.effect.bc7e306d") },
    ],
  },
  rehab: {
    label: __i18n_k("league.facilities.rehab.label.a8a841e9"),
    group: 'training',
    note: __i18n_k("league.facilities.rehab.note.ae1a0d7e"),
    levels: [
      { cost: 500_000, upkeep: 15_000, build: 1, effect: __i18n_k("league.facilities.levels.effect.81f17d8c") },
      { cost: 700_000, upkeep: 20_000, build: 1, effect: __i18n_k("league.facilities.levels.effect.b859bd89") },
    ],
  },
  analytics: {
    label: __i18n_k("league.facilities.analytics.label.7b5e307f"),
    group: 'training',
    note: __i18n_k("league.facilities.analytics.note.7bc7547a"),
    levels: [
      { cost: 300_000, upkeep: 20_000, build: 1, effect: __i18n_k("league.facilities.levels.effect.940165c2") },
      { cost: 500_000, upkeep: 30_000, build: 1, effect: __i18n_k("league.facilities.levels.effect.a6b099f8") },
    ],
  },
  futuresPark: {
    label: __i18n_k("league.facilities.futuresPark.label.9d9d1b0a"),
    group: 'training',
    note: __i18n_k("league.facilities.futuresPark.note.2f522e9a"),
    levels: [
      { cost: 2_500_000, upkeep: 50_000, build: 2, effect: __i18n_k("league.facilities.levels.effect.af8096b0") },
      { cost: 1_500_000, upkeep: 70_000, build: 1, effect: __i18n_k("league.facilities.levels.effect.f3a3e1c3") },
      { cost: 2_000_000, upkeep: 90_000, build: 1, effect: __i18n_k("league.facilities.levels.effect.3748359c") },
    ],
  },
  dorm: {
    label: __i18n_k("league.facilities.dorm.label.95192ef2"),
    group: 'training',
    note: __i18n_k("league.facilities.dorm.note.e1a2acec"),
    levels: [{ cost: 600_000, upkeep: 10_000, build: 1, effect: __i18n_k("league.facilities.levels.effect.fbe0a4ac") }],
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
      ? __i18n_k("league.facilities.facilityOptions.blocked.a7a8d6a5")
      : s.phase !== 'offseason'
        ? __i18n_k("league.facilities.facilityOptions.blocked.df97ea07")
        : L.cost > u.fund
          ? __i18n_k("league.facilities.facilityOptions.blocked.2ffbf119")
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
  u.ledger.push({ year, label: __i18n_k("league.facilities.startFacility.label.f61f16b3", { label: spec.label, level: o.level }), amount: -o.cost, capital: true });
  (u.facilityWorks ??= []).push({ kind, level: o.level, opens: o.opens, cost: o.cost });
  (u.log ??= []).push({ year, text: __i18n_k("league.facilities.startFacility.text.cabda71e", { label: spec.label, level: o.level, value: Math.round(o.cost / 10000), opens: o.opens }) });
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
    (u.log ??= []).push({ year: season - 1, text: __i18n_k("league.facilities.openFacilities.text.93ceb158", { label: FACILITIES[w.kind].label, level: w.level, season: season, effect: FACILITIES[w.kind].levels[w.level - 1]!.effect }) });
  }
  return opened;
}
