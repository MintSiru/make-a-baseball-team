import { k as __i18n_k } from '../i18n/index';
/* 2.0.37 (the user's request): very rarely, a player walks away from baseball to try another sport — golf, the
   bobsleigh, mixed martial arts. He is not released: like the KBO's 임의해지 (voluntary retirement), his club keeps
   his rights, so if he comes back it is to his old club. Each winter from the second after he left he may come
   back — the other sport did not work out, or he missed the game — rusty for the seasons away; after five he is
   gone for good. Only a domestic player in his twenties with a first-team past, a star less often than a
   fringe player. */
import { rng } from '../draftroom';
import type { Tools } from '../draftroom';
import type { Player, PlayerId, TeamId } from '../model/types';
import { minimumSalaryFor } from '../rules/kbo2026';
import { addAlert } from './alerts';
import { eunneun, iga, ro } from './josa';
import { farewell, note } from './life';
import { noteMove } from './moves';
import { addNews } from './news';
import { removeFromRoster, rescout, sign } from './offseason';
import { ageIn, isForeign } from './players';
import type { LeagueState } from './state';

export const OTHER_SPORT = {
  /** A player's chance a winter (between the ages), less for a regular and much less for a star. */
  chance: 0.0008,
  ages: [21, 30] as const,
  byGrade: [[60, 0.3], [52, 0.7]] as [number, number][],
  fringe: 1.4,
  /** Coming back: from this many winters away, at this chance a winter, never after `until` or past `maxAge`. */
  back: { after: 2, chance: 0.35, until: 5, maxAge: 34 },
  /** Grade points lost a season away (speed and a pitcher's stuff a little more). */
  rust: { base: 2, quick: 2.6, skill: 1.2 },
};

export type OtherSport = 'golf' | 'bobsleigh' | 'mma' | 'basketball' | 'football' | 'esports' | 'sprint';
const SPORTS: OtherSport[] = ['golf', 'bobsleigh', 'mma', 'basketball', 'football', 'esports', 'sprint'];

/** The sport's name, and what he set out to do. */
export const sportName = (k: OtherSport) =>
  ({
    golf: __i18n_k("league.othersport.text.5b4172e9"),
    bobsleigh: __i18n_k("league.othersport.text.0611cd3a"),
    mma: __i18n_k("league.othersport.text.ea29db94"),
    basketball: __i18n_k("league.othersport.text.102f52f0"),
    football: __i18n_k("league.othersport.text.b3ac27b8"),
    esports: __i18n_k("league.othersport.text.564761e3"),
    sprint: __i18n_k("league.othersport.text.4984319d"),
  })[k];
const sportPlan = (k: OtherSport) =>
  ({
    golf: __i18n_k("league.othersport.text.f10c1e6d"),
    bobsleigh: __i18n_k("league.othersport.text.c6d77f87"),
    mma: __i18n_k("league.othersport.text.1d5a2765"),
    basketball: __i18n_k("league.othersport.text.b00deb1f"),
    football: __i18n_k("league.othersport.text.8cdee8f2"),
    esports: __i18n_k("league.othersport.text.d7d72438"),
    sprint: __i18n_k("league.othersport.text.5722fc40"),
  })[k];
const BACK_WHY = [__i18n_k("league.othersport.text.ffd618e7"), __i18n_k("league.othersport.text.ecc92aed"), __i18n_k("league.othersport.text.8df112dd"), __i18n_k("league.othersport.text.e758f61d")];

/** He has left for another sport and the club still holds his rights. */
export const awayAtSport = (s: LeagueState, id: PlayerId) => !!s.otherSport?.[id];

function chanceOf(p: Player, year: number): number {
  const O = OTHER_SPORT;
  const age = ageIn(p, year);
  if (age < O.ages[0] || age > O.ages[1]) return 0;
  const grade = p.scouting.current;
  const f = O.byGrade.find(([g]) => grade >= g)?.[1] ?? O.fringe;
  return O.chance * f;
}

const shortOf = (s: LeagueState, id: TeamId | null) => s.teams.find((t) => t.id === id)?.short ?? '';

/** The winter's turn (after the retirements): who leaves for another sport, and who comes back. */
export function otherSportWinter(s: LeagueState, year: number) {
  const next = year + 1;
  const date = `${year}-11-20`;
  // Back first, so a player who leaves this winter is not looked at again.
  for (const [id, away] of Object.entries(s.otherSport ?? {})) {
    const p = s.players[id];
    const gone = year - away.since;
    if (!p || gone < OTHER_SPORT.back.after) continue;
    const club = s.teams.find((t) => t.id === away.teamId && t.firstTeamFrom !== null);
    const r = rng(`${s.seed}|other-sport-back|${year}|${id}`);
    if (club && ageIn(p, next) <= OTHER_SPORT.back.maxAge && r() < OTHER_SPORT.back.chance) comeBack(s, p, club.id, gone, year, r);
    else if (gone >= OTHER_SPORT.back.until || !club || ageIn(p, next) > OTHER_SPORT.back.maxAge) {
      delete s.otherSport![id];
      if (away.teamId === s.user?.teamId) note(p, date, __i18n_k("league.othersport.text.106fd999", { sport: sportName(away.sport) }));
    }
  }
  const r = rng(`${s.seed}|other-sport|${year}`);
  for (const p of Object.values(s.players)) {
    if (p.status !== 'active' || isForeign(p) || p.origin.kyopo || !p.teamId || !p.career.some((c) => !c.level && c.days > 0)) continue;
    if (r() >= chanceOf(p, next)) continue;
    leaveFor(s, p, SPORTS[Math.floor(r() * SPORTS.length)]!, year);
  }
}

function leaveFor(s: LeagueState, p: Player, sport: OtherSport, year: number) {
  const teamId = p.teamId!;
  const ours = teamId === s.user?.teamId;
  const date = `${year}-11-20`;
  const club = shortOf(s, teamId);
  noteMove(s, p, 'retire', teamId, null, sportName(sport), date);
  if (ours) farewell(s, p, teamId, __i18n_k("league.othersport.text.1346e5ff", { sport: sportName(sport) }), date);
  removeFromRoster(s, p);
  p.status = 'retired';
  p.teamId = null;
  p.contract = null;
  delete s.injuries[p.id];
  (s.otherSport ??= {})[p.id] = { sport, since: year, teamId };
  const title = __i18n_k("league.othersport.text.4cf5fc3a", { club, name: p.name, sport: sportName(sport) });
  const body = __i18n_k("league.othersport.text.10162b1c", {
    club: club,
    name: iga(p.name),
    plan: sportPlan(sport),
    club2: club,
  });
  if (ours) note(p, date, title, 'bad');
  addNews(s, { id: `other-sport-${year}-${p.id}`, date, kind: 'move', title, body, quotes: [], facts: { player: p.name, club, sport: sportName(sport) }, players: [p.id], ...(ours ? { mine: true } : {}) });
  if (ours) addAlert(s, { id: `other-sport-${year}-${p.id}`, date, kind: 'retire', title, lines: [body], tone: 'bad', players: [p.id] });
}

/** Back to his old club for next season, on the minimum salary, rusty for the seasons away. */
function comeBack(s: LeagueState, p: Player, teamId: TeamId, seasons: number, year: number, r: () => number) {
  const away = s.otherSport![p.id]!;
  delete s.otherSport![p.id];
  const next = year + 1;
  const R = OTHER_SPORT.rust;
  const h = p.hidden.current as Record<string, number>;
  for (const k of Object.keys(h) as (keyof Tools)[]) {
    const per = k === 'speed' || k === 'stuff' ? R.quick : k === 'command' || k === 'eye' ? R.skill : R.base;
    h[k] = Math.max(20, Math.round((h[k]! - per * seasons * (0.7 + r() * 0.6)) * 10) / 10);
  }
  rescout(p, next, Math.max(0, next - p.proSince), r);
  sign(s, p, teamId, { teamId, kind: 'standard', signedIn: year, signingBonus: 0, salaries: [{ season: next, amount: minimumSalaryFor(next) }] });
  const date = `${year}-11-20`;
  const club = shortOf(s, teamId);
  const ours = teamId === s.user?.teamId;
  noteMove(s, p, 'returnee', null, teamId, sportName(away.sport), date);
  const title = __i18n_k("league.othersport.text.6cc62f5f", { sport: sportName(away.sport), name: p.name, seasons, club });
  const body = __i18n_k("league.othersport.text.a11fad81", {
    year: away.since,
    sport: sportName(away.sport),
    name: eunneun(p.name),
    why: pickWhy(r),
    club: ro(club),
  });
  if (ours) note(p, date, title, 'good');
  addNews(s, { id: `other-sport-back-${year}-${p.id}`, date, kind: 'move', title, body, quotes: [], facts: { player: p.name, club, sport: sportName(away.sport) }, players: [p.id], ...(ours ? { mine: true } : {}) });
  if (ours) addAlert(s, { id: `other-sport-back-${year}-${p.id}`, date, kind: 'move', title, lines: [body], tone: 'good', players: [p.id] });
}

const pickWhy = (r: () => number) => BACK_WHY[Math.floor(r() * BACK_WHY.length)]!;
