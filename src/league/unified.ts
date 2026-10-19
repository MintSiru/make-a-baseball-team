import { k as __i18n_k } from '../i18n/index';
/* 통일 한국 (1.9.2, the 1.9 plan's third stage): after a peaceful unification (game fiction) the KBO takes six clubs
   from the north at once — ours and five the AI runs — and becomes sixteen clubs in two leagues of eight.

   The five go through the twelfth club's founding (rival.ts), all in the year ours is founded and on its calendar:
   a tryout, priority picks in the draft, the futures, then a special draft before the first first-team season (one
   unprotected player from each existing club each, so an existing club gives up to six), the players the others let
   go, and the registered-player limit. From the first sixteen-club season the league plays in two leagues, the new
   clubs and the old split evenly between them (twelve.ts sidesOf, the 1.9.1 schedule). The north's amateurs join
   each year's draft class (players.ts withNorth). */
import { rng } from '../draftroom';
import type { ParentCompanyType } from '../club/types';
import type { TeamId } from '../model/types';
import { EXPANSION_DEFAULTS } from '../rules/kbo2026';
import { addAlert } from './alerts';
import { clubState } from './fans';
import { milestone } from './milestones';
import { iga } from './josa';
import { addNews } from './news';
import { isNorthCity, makeNorthern, NORTH_CITIES, NORTH_COLORS, NORTH_COMPANIES, NORTH_NICKNAMES } from './north';
import { rivalTryout, type FoundingClub } from './rival';
import { MANAGER_STYLES, staffOf } from './staff';
import { emptyRoster, firstTeamIds, type GmStyle, type LeagueSide, type LeagueState, type ManagerStyle } from './state';

export type NorthClub = FoundingClub & { cityId: string; manager: ManagerStyle };

export interface UnifiedState {
  /** The first draft with the north's amateurs (the founding year's). */
  since: number;
  /** The five clubs the AI runs. */
  clubs: NorthClub[];
}

/** How many clubs the AI founds in the north with ours, and how many each signs at its tryout (the north's adult
    players: more than the twelfth club's 20, as six clubs share the rest of the founding). */
export const NORTH_AI_CLUBS = 5;
export const NORTH_TRYOUT = 30;

const GM_KEYS: GmStyle[] = ['balanced', 'develop', 'winNow', 'moneyball'];
const OWNERS: ParentCompanyType[] = ['conglomerate', 'conglomerate', 'midsize', 'midsize', 'citizen'];

export const isUnified = (s: LeagueState) => !!s.unified;
export const northClub = (s: LeagueState, teamId: TeamId) => s.unified?.clubs.find((c) => c.teamId === teamId);

/** Founds the north's five other clubs with ours (in the founding summer, after ours). */
export function foundNorthClubs(s: LeagueState, year: number, firstTeam: number, ourCity: string) {
  const r = rng(`${s.seed}|unified|${year}`);
  // The biggest markets left, ours taken out.
  const cities = NORTH_CITIES.filter((c) => c.id !== ourCity).slice(0, NORTH_AI_CLUBS);
  const start = Math.floor(r() * NORTH_NICKNAMES.length);
  const clubs: NorthClub[] = [];
  cities.forEach((city, i) => {
    const id = `n-${city.id}`;
    const nickname = NORTH_NICKNAMES[(start + i) % NORTH_NICKNAMES.length]!;
    const seats = city.stadium.seats;
    s.teams.push({
      id,
      name: `${city.name} ${nickname}`,
      short: city.name,
      color: NORTH_COLORS[(start + i) % NORTH_COLORS.length]!,
      region: city.name,
      kind: 'expansion',
      founded: year,
      firstTeamFrom: firstTeam,
      benefitsUntil: firstTeam + EXPANSION_DEFAULTS.benefitSeasons - 1,
      parent: { type: OWNERS[i % OWNERS.length]!, name: NORTH_COMPANIES[(start + i * 2) % NORTH_COMPANIES.length]! },
      stadium: { name: city.stadium.name, size: seats < 10_000 ? 'small' : seats >= 20_000 ? 'large' : 'medium', capacity: seats, ownership: 'municipalLease' },
    });
    s.rosters[id] = emptyRoster();
    const manager = (Object.keys(MANAGER_STYLES) as ManagerStyle[])[Math.floor(r() * Object.keys(MANAGER_STYLES).length)]!;
    clubs.push({ teamId: id, cityId: city.id, founded: year, firstTeam, gm: GM_KEYS[Math.floor(r() * GM_KEYS.length)]!, manager });
  });
  s.unified = { since: year, clubs };
  const used = new Set(Object.values(s.players).map((p) => p.name));
  for (const c of clubs) {
    clubState(s, c.teamId);
    staffOf(s, c.teamId).manager.style = c.manager;
    rivalTryout(s, year, c.teamId, c.gm, false, { count: NORTH_TRYOUT, make: (p) => makeNorthern(p, `${s.seed}|north-tryout`, used) });
  }
  const names = clubs.map((c) => s.teams.find((t) => t.id === c.teamId)!.name);
  const date = `${year}-07-20`;
  const title = __i18n_k("league.unified.text.27bc4887", { firstTeam });
  const lines = [__i18n_k("league.unified.text.74c77977", { names: iga(names.join(', ')) }), __i18n_k("league.unified.text.d1dbb2ef", { firstTeam })];
  addNews(s, { id: `unified-${year}`, date, kind: 'season', title, body: lines.join(' '), quotes: [], facts: { clubs: names.length + 1, firstTeam }, players: [], mine: true });
  addAlert(s, { id: `unified-${year}`, date, kind: 'season', title, lines });
  milestone(s, year, title, 'unified');
}

/** 2.0.23 (conditions.ts): the winter's development step founds the north's clubs for a unified condition added to a
    game already under way — this winter, their first team the season after next. */
export function conditionUnified(s: LeagueState, year: number) {
  const u = s.user;
  if (!u || s.unified || s.twelve || s.legacy || s.leagueSides || !s.conditions?.some((c) => c.id === 'unified')) return;
  foundNorthClubs(s, year, year + 2, u.settings.cityId);
}

/**
 * The two leagues of eight, drawn once before the first sixteen-club season: our club in the 드림리그, the north's
 * clubs three and three (ours counted), the ten old clubs five and five down last season's table.
 */
export function assignUnifiedLeagues(s: LeagueState) {
  const u = s.unified;
  if (!u || s.leagueSides) return;
  // 2.0.23: our club is one of the north's only when its home is there (a unified condition added to a southern club's game).
  const me = s.user && isNorthCity(s.user.settings.cityId) ? s.user.teamId : undefined;
  const ids = firstTeamIds(s);
  const north = [...(me ? [me] : []), ...u.clubs.map((c) => c.teamId)].filter((id) => ids.includes(id));
  if (north.length < u.clubs.length) return;
  const table = s.history.at(-1)?.table ?? [];
  const old = ids
    .filter((id) => !north.includes(id))
    .sort((a, b) => (table.find((r) => r.teamId === a)?.rank ?? 99) - (table.find((r) => r.teamId === b)?.rank ?? 99) || a.localeCompare(b));
  const sides: Record<TeamId, LeagueSide> = {};
  // Snake down each list so both leagues get strong and weak clubs.
  const snake = (list: TeamId[]) => list.forEach((id, i) => (sides[id] = i % 4 === 0 || i % 4 === 3 ? 'dream' : 'magic'));
  snake(north);
  snake(old);
  s.leagueSides = { sides };
}
