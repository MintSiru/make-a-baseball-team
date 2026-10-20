import { k as __i18n_k } from '../i18n/index';
/* 2.0.28, 통일 한국: the north's school circuit. Draft Room knows only the south's schools, so a northern prospect is
   one of its prospects renamed (north.ts makeNorthern) — and Draft Room's results would be those of the southern
   school he was made from, the same titles a southern player holds. The north's schools play their own year instead,
   drawn here from the north's class seed, the way hsevents.ts draws the south's:

   - each region's weekend league (its high schools and youth clubs),
   - the north's open tournament (every school), and the one through the regional leagues (each region's top four),
   - the champions' tournament (the top four of the two),
   - the colleges' league and their tournament (the top eight), the two-year colleges' league and theirs (the top four).

   A school is as strong as it always is, give or take its year; a draft class's awards are rewritten from the same
   draw (players.ts withNorth), so what the board shows and what the record shows agree. */
import { hashUnit, rng } from '../draftroom';
import { HS_EVENTS, knockout, roundName, type HsEvent } from './hsevents';
import type { Player } from '../model/types';
import { isNorthName, NORTH_CLUBS, NORTH_COLLEGES, NORTH_HIGH_SCHOOLS, NORTH_JUNIOR_COLLEGES, NORTH_REGIONS, NORTH_TOWNS, northName, northSchool, pick, REGION_WEIGHT, SCHOOL_KINDS, weighted } from './north';

/** An award for a school event, the south's (Draft Room's) or the north's. */
const EVENT_AWARD = /^(.+ 권역 주말리그|다이아몬드 데일리배 전국고교야구대회|대학리그 \S+|퓨처 베이스볼배 대학야구 왕중왕전|전문대학 리그|퓨처 베이스볼배 전문대학 야구대회|대동강배 북부 고교야구대회|대동강배 북부 대학야구대회|북부 전문대학 리그|북부 전문대학 야구대회) (.+)$/;

type Entrant = { id: string; strength: number };

/** A school's strength in a year: the school's own (clubs a little weaker) and its year's luck. */
const entrant = (seed: string, id: string, club = false): Entrant => ({ id, strength: (club ? 0.25 : 0.35) + hashUnit(`north-school|${id}`) * 0.3 + hashUnit(`${seed}|north-year|${id}`) * 0.25 });
const strength = (e: Entrant) => e.strength;

/** A league table: the order the year finished in. */
const table = (xs: Entrant[], r: () => number) =>
  xs
    .map((x) => ({ x, v: x.strength + r() * 0.25 }))
    .sort((a, b) => b.v - a.v || a.x.id.localeCompare(b.x.id))
    .map((e) => e.x);
/** A league's place, as the south's leagues name theirs. */
const leagueResult = (rank: number) => (rank === 1 ? __i18n_k("league.northevents.text.894badc3") : rank === 2 ? __i18n_k("league.northevents.text.3660fdbb") : rank <= 4 ? __i18n_k("league.northevents.text.82c2c27f") : rank <= 8 ? __i18n_k("league.northevents.text.bea9cec6") : __i18n_k("league.northevents.text.efb15c9f"));

const cache = new Map<string, Map<string, HsEvent[]>>();

/** Every northern school's year under `seed`. */
export function northSeason(seed: string): Map<string, HsEvent[]> {
  const hit = cache.get(seed);
  if (hit) return hit;
  const events = new Map<string, HsEvent[]>();
  const add = (id: string, e: HsEvent) => (events.get(id) ?? events.set(id, []).get(id)!).push(e);
  const games = (id: string, base: number, spread: number) => base + Math.floor(hashUnit(`${seed}|north-games|${id}`) * (spread * 2 + 1)) - spread;
  // The regional weekend leagues.
  const all: Entrant[] = [];
  const qualified: Entrant[] = [];
  NORTH_REGIONS.forEach((region, ri) => {
    const schools = [...NORTH_HIGH_SCHOOLS[ri]!.map((id) => entrant(seed, id)), ...NORTH_CLUBS[ri]!.map((id) => entrant(seed, id, true))];
    all.push(...schools);
    const order = table(schools, rng(`${seed}|north-league|${ri}`));
    order.forEach((x, i) => add(x.id, { kind: 'league', label: __i18n_k("league.northevents.text.66d071e5", { region }), result: leagueResult(i + 1), games: games(x.id, HS_EVENTS.leagueGames, 1) }));
    qualified.push(...order.slice(0, HS_EVENTS.qualifiers));
  });
  // The open tournament: every school.
  const open = knockout(all, rng(`${seed}|north-open`), strength);
  for (const [id, x] of open) add(id, { kind: 'open', label: __i18n_k("league.northevents.text.5aa472a6"), result: roundName(x.reached, x.size), games: x.games });
  // Through the regional leagues: each region's top four.
  const through = knockout(qualified, rng(`${seed}|north-qualified`), strength);
  for (const [id, x] of through) add(id, { kind: 'qualified', label: __i18n_k("league.northevents.text.457d6d25"), result: roundName(x.reached, x.size), games: x.games });
  // The champions: the top four of each (the next best fill in for a school in both).
  const top = (m: Map<string, { reached: number }>) => [...m.entries()].sort((a, b) => a[1].reached - b[1].reached || a[0].localeCompare(b[0])).map(([id]) => id);
  const picked = new Set(top(open).slice(0, HS_EVENTS.champions));
  for (const id of top(through)) if (picked.size < HS_EVENTS.champions * 2) picked.add(id);
  const champs = knockout(
    all.filter((x) => picked.has(x.id)),
    rng(`${seed}|north-champions`),
    strength,
  );
  for (const [id, x] of champs) add(id, { kind: 'champions', label: __i18n_k("league.northevents.text.b80e8368"), result: roundName(x.reached), games: x.games });
  // The colleges: one league, then its top eight; the two-year colleges' league, then its top four.
  for (const [list, league, national, size, place] of [
    [NORTH_COLLEGES, __i18n_k("league.northevents.text.d7d75f25"), __i18n_k("league.northevents.text.6a14ee2d"), 8, leagueResult],
    [NORTH_JUNIOR_COLLEGES, __i18n_k("league.northevents.text.cf8735ff"), __i18n_k("league.northevents.text.82ac692c"), 4, (rank: number) => __i18n_k("league.northevents.text.42a7b82f", { n: rank })],
  ] as const) {
    const order = table(
      list.map((id) => entrant(seed, id)),
      rng(`${seed}|north-college|${league}`),
    );
    order.forEach((x, i) => add(x.id, { kind: 'collegeLeague', label: league, result: place(i + 1), games: games(x.id, HS_EVENTS.collegeGames, 2) }));
    for (const [id, x] of knockout(order.slice(0, size), rng(`${seed}|north-college-national|${league}`), strength))
      add(id, { kind: 'collegeNational', label: national, result: roundName(x.reached, x.size), games: x.games });
  }
  cache.set(seed, events);
  if (cache.size > 40) cache.delete(cache.keys().next().value!);
  return events;
}

/** A northern school's year (`[]` for a school outside the circuit, a 1.9.2 one). */
export const northSchoolEvents = (school: string, seed: string): HsEvent[] => northSeason(seed).get(school) ?? [];

/** The south's event awards Draft Room gave a prospect, replaced by what his northern school did under `seed`: a
    league's winner and runner-up (the two-year colleges' first), a tournament's winner and runner-up. */
export function northAwards(awards: string[], school: string, seed: string): string[] {
  const won = northSchoolEvents(school, seed)
    .filter((e) => e.result === __i18n_k("league.northevents.text.894badc3") || e.result === __i18n_k("league.northevents.text.3660fdbb") || (e.kind === 'collegeLeague' && e.result === __i18n_k("league.northevents.text.42a7b82f", { n: 1 })))
    .filter((e) => e.kind !== 'open' && e.kind !== 'champions')
    .map((e) => `${e.label} ${e.result}`);
  return [...awards.filter((a) => !EVENT_AWARD.test(a)), ...won];
}

/** 2.0.28: every school on his road a northern one (his last one `last`, when given), each stage in the north's
    region, and his amateur awards under the north's circuit (hsevents.ts northEvent). A school already northern is
    kept, so it can run again on a saved game. `key`: the seed his school's year is drawn under (a draft class's
    north seed). */
export function northernPast<T extends Pick<Player, 'id' | 'education' | 'amateur'>>(p: T, key: string, last?: string): T {
  const region = p.education.region;
  const ri = Math.max(0, (NORTH_REGIONS as readonly string[]).indexOf(region));
  const r = rng(`${key}|north-past|${p.id}`);
  const history = p.education.history ?? [];
  const lastSchool = history.map((h) => SCHOOL_KINDS.has(h.kind)).lastIndexOf(true);
  const renames: [string, string][] = [];
  const out = history.map((h, i) => {
    if (!SCHOOL_KINDS.has(h.kind)) return h;
    const name = i === lastSchool && last ? last : isNorthName(h.kind, h.name) ? h.name : northSchool(h.kind, ri, r);
    if (name !== h.name) renames.push([h.name, name]);
    return { ...h, name, region };
  });
  const swap = (text: string) => renames.reduce((t, [a, b]) => (a ? t.split(a).join(b) : t), text);
  const school = lastSchool >= 0 ? out[lastSchool]!.name : p.education.school;
  return {
    ...p,
    education: { ...p.education, school, pathText: swap(p.education.pathText ?? ''), history: out.map((h) => ({ ...h, note: swap(h.note ?? '') })) },
    amateur: { ...p.amateur, awards: northAwards(p.amateur.awards ?? [], school, key) },
  };
}

/** Remakes a prospect as one who grew up in the north: his region, town, schools (each of its kind) and name. */
export function makeNorthern(p: Player, seed: string, used: Set<string>): Player {
  const r = rng(`${seed}|north|${p.id}`);
  const ri = weighted(REGION_WEIGHT, r);
  const region = NORTH_REGIONS[ri]!;
  const town = pick(NORTH_TOWNS[ri]!, r);
  // His last school of its own kind (2.0.28: a two-year college was given a high school's name).
  const kind = [...(p.education.history ?? [])].reverse().find((h) => SCHOOL_KINDS.has(h.kind))?.kind ?? (p.origin.entryCategory === 'college' ? 'college' : 'high-school');
  const school = northSchool(kind, ri, r);
  return northernPast({ ...p, name: northName(p.name, r, used), birthplace: town, education: { ...p.education, region } }, seed, school);
}
