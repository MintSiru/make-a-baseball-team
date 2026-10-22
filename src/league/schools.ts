import { k as __i18n_k } from '../i18n/index';
/* 2.0.39 (the user's request: 지역 연고 고등학교 후원): the club sponsors up to three high schools of its region (the
   draft region its city lies in, territorial.ts) — equipment, a coach's visits, a summer camp. Each costs a sum a
   season from the club's fund (now, and every winter after). In return:
   - their players come to the draft a little better (a grade point on every tool for each season sponsored, up to
     three) — the club's scouts know of it, the others' reports do not;
   - one of them the club drafts is more loyal to it;
   - the region notices: a little more interest every winter.
   The schools are the draft's own (the north's in a unified game). */
import { DRAFT_REGIONS, DRAFT_SCHOOLS } from '../draftroom';
import type { Player } from '../model/types';
import { hometownClub } from './fa';
import { clubState } from './fans';
import { NORTH_HIGH_SCHOOLS, NORTH_REGIONS } from './north';
import type { LeagueState } from './state';
import { draftRegionOf } from './territorial';

export const SCHOOLS = {
  /** Schools at once, the cost a season (만 원), the grade points a season sponsored (and the most seasons that count),
      the loyalty a drafted player gains, and the fans' interest a winter for each school. */
  max: 3,
  cost: 5_000,
  growth: 1,
  most: 3,
  loyalty: 10,
  interest: 0.01,
};

/** The club's region (its city's draft region, or the original clubs' own). */
export function schoolRegion(s: LeagueState): string | null {
  const u = s.user;
  if (!u) return null;
  return draftRegionOf(s, u.teamId) ?? [...DRAFT_REGIONS, ...NORTH_REGIONS].find((r) => hometownClub(s, u.teamId, r)) ?? null;
}

/** The high schools of the club's region, by name. */
export function regionSchools(s: LeagueState): string[] {
  const region = schoolRegion(s);
  if (!region) return [];
  const north = (NORTH_REGIONS as readonly string[]).indexOf(region);
  if (north >= 0) return [...(NORTH_HIGH_SCHOOLS[north] ?? [])];
  return DRAFT_SCHOOLS.filter((x) => (x.kind === 'high-school' || x.kind === 'hs-club') && x.region === region).map((x) => x.name);
}

/** Why the club cannot start (or stop) sponsoring this school, or null. */
export function checkSponsor(s: LeagueState, name: string, on: boolean): string | null {
  const u = s.user;
  if (!u) return __i18n_k("league.schools.text.272add95");
  const now = u.schools ?? {};
  if (!on) return name in now ? null : __i18n_k("league.schools.text.4cf4f201");
  if (name in now) return __i18n_k("league.schools.text.adc3ad91");
  if (!regionSchools(s).includes(name)) return __i18n_k("league.schools.text.cd295560");
  if (Object.keys(now).length >= SCHOOLS.max) return __i18n_k("league.schools.text.1cc654dd", { n: SCHOOLS.max });
  if (u.fund < SCHOOLS.cost) return __i18n_k("league.schools.text.28f75cea");
  return null;
}

/** Starts (paying this season's sum) or stops sponsoring a school. */
export function sponsorSchool(s: LeagueState, name: string, on: boolean) {
  if (checkSponsor(s, name, on)) return;
  const u = s.user!;
  const schools = (u.schools ??= {});
  if (!on) {
    delete schools[name];
    return;
  }
  // From the coming season when the year's draft is behind us.
  schools[name] = s.phase === 'offseason' ? s.year + 1 : s.year;
  u.fund -= SCHOOLS.cost;
  u.ledger.push({ year: s.year, label: __i18n_k("league.schools.text.e1cd0603", { name }), amount: -SCHOOLS.cost });
}

/** The winter: next season's sums, and the region's goodwill. */
export function schoolsWinter(s: LeagueState, year: number) {
  const u = s.user;
  const names = Object.keys(u?.schools ?? {});
  if (!u || !names.length) return;
  const cost = SCHOOLS.cost * names.length;
  u.fund -= cost;
  u.ledger.push({ year, label: __i18n_k("league.schools.text.87c2836b", { n: names.length, next: year + 1 }), amount: -cost });
  const c = clubState(s, u.teamId);
  c.interest += SCHOOLS.interest * names.length;
}

/** Seasons a school has been sponsored by the draft of `draftYear` (0 when it is not). */
export function sponsoredSeasons(s: LeagueState, school: string, draftYear: number): number {
  const since = s.user?.schools?.[school];
  return since === undefined || since > draftYear ? 0 : Math.min(SCHOOLS.most, draftYear - since + 1);
}

/** The draft class as it comes in: the sponsored schools' players a little better. */
export function schoolBoost(s: LeagueState, pool: Player[], draftYear: number) {
  if (!s.user?.schools) return;
  for (const p of pool) {
    if (p.origin.entryCategory !== 'high-school') continue;
    const n = sponsoredSeasons(s, p.education.school, draftYear);
    if (!n) continue;
    const g = SCHOOLS.growth * n;
    const h = p.hidden;
    for (const k of Object.keys(h.current) as (keyof typeof h.current)[]) {
      if (h.current[k] == null) continue;
      h.current[k] = Math.min(80, h.current[k]! + g);
      if (h.potential[k] != null) h.potential[k] = Math.min(80, h.potential[k]! + g);
    }
  }
}

/** One of the sponsored schools' players drafted by the club: more loyal to it. */
export function schoolPick(s: LeagueState, p: Player, teamId: string) {
  if (teamId !== s.user?.teamId || !(p.education.school in (s.user.schools ?? {})) || !p.hidden.traits) return;
  p.hidden.traits.loyalty = Math.min(100, p.hidden.traits.loyalty + SCHOOLS.loyalty);
}
