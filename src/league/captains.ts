import { k as __i18n_k } from '../i18n/index';
/* The captain and his vice-captains (1.7.0, from the 1.6 feedback: 주장단 선임). The general manager names them
   (with the manager, as KBO clubs do) for our club; who they are shows in the clubhouse and makes things happen:
   - the clubhouse mood: a captain with a leader's voice lifts it, a loose cannon wears on it;
   - a players-only meeting after a losing streak of five: a real leader's meeting lifts everyone a little for a
     week (form), a weak one's changes nothing;
   - now and then in the season, his character shows: a 책임감 강한 리더 takes a struggling young player under his
     wing, a 분위기 메이커 throws a team dinner, a captain prone to trouble clashes with a teammate.
   His leadership is hidden (traits.ts): the coaches' reports tell you how much of it they have seen. */
import { rng } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { eulreul, iga, wagwa } from './josa';
import { addNews } from './news';
import { ageIn, isForeign } from './players';
import { orgIds, type LeagueState } from './state';
import { traitsOf } from './traits';

export const CAPTAIN = {
  vice: 2,
  /** Losses in a row before the captain calls a meeting, once a streak. */
  slump: 5,
  /** A meeting under a captain with this much leadership lifts the team; under less it does nothing. */
  meetingLeader: 60,
  meetingForm: 2,
  meetingDays: 7,
  /** Chance of a captain's event at the first game day of each month (April–September). */
  monthly: 0.35,
} as const;

/** Why this captaincy cannot be named, or null. */
export function captainsProblem(s: LeagueState, captain: PlayerId | null, vice: PlayerId[]): string | null {
  const u = s.user;
  if (!u) return __i18n_k("league.captains.text.e837c83d");
  const ours = new Set(orgIds(s, u.teamId));
  const all = [captain, ...vice].filter((x): x is PlayerId => !!x);
  if (vice.length > CAPTAIN.vice) return __i18n_k("league.captains.text.b95b5e52", { n: CAPTAIN.vice });
  if (new Set(all).size !== all.length) return __i18n_k("league.captains.text.c25e7f7a");
  if (all.some((id) => !ours.has(id))) return __i18n_k("league.captains.text.2fdf1b06");
  return null;
}

export function setCaptains(s: LeagueState, captain: PlayerId | null, vice: PlayerId[]) {
  const problem = captainsProblem(s, captain, vice);
  if (problem) throw new Error(problem);
  const u = s.user!;
  const before = u.captains?.captain;
  u.captains = { captain, vice: [...vice], since: s.offseason ? s.offseason.year + 1 : s.year };
  if (captain && captain !== before) {
    const p = s.players[captain]!;
    const club = s.teams.find((t) => t.id === u.teamId)!.short;
    addNews(s, {
      id: `captain-${captain}-${s.year}`,
      date: s.schedule[s.next]?.date ?? `${s.year}-12-01`,
      kind: 'interview',
      title: __i18n_k("league.captains.text.5b1a7726", { club, name: p.name }),
      body: __i18n_k("league.captains.text.393d843e", {
        club: iga(club),
        name: eulreul(p.name),
        pers: p.personality,
        vice: vice.length ? __i18n_k("league.captains.text.333c39f7", { names: vice.map((id) => s.players[id]?.name ?? '').join(', ') }) : '',
      }),
      quotes: [],
      facts: { captain: p.name },
      players: [captain, ...vice],
      mine: true,
    });
  }
}

/** The captaincy as it stands: players gone from the club drop out of it. */
export function captainsOf(s: LeagueState): { captain: Player | null; vice: Player[] } {
  const u = s.user;
  const c = u?.captains;
  if (!u || !c) return { captain: null, vice: [] };
  const ours = (id: PlayerId | null) => (id && s.players[id]?.teamId === u.teamId ? s.players[id]! : null);
  return { captain: ours(c.captain), vice: c.vice.map(ours).filter((p): p is Player => !!p) };
}

/** What the captaincy adds to the clubhouse score (views.ts clubhouse), and why. */
export function captaincyLift(s: LeagueState): { lift: number; note: string } | null {
  const { captain, vice } = captainsOf(s);
  if (!captain) return null;
  const t = traitsOf(captain);
  const lift = (t.leadership - 50) / 100 + (captain.personality === '책임감 강한 리더' ? 0.08 : captain.personality === '밝은 분위기 메이커' ? 0.06 : 0) - Math.max(0, t.controversy - 60) / 80 + vice.reduce((a, p) => a + (traitsOf(p).leadership - 50) / 300, 0);
  return { lift, note: lift >= 0.15 ? __i18n_k("league.captains.text.8da23788", { name: captain.name }) : lift <= -0.05 ? __i18n_k("league.captains.text.2dab69f3", { name: captain.name }) : __i18n_k("league.captains.text.28ff118c", { name: captain.name }) };
}

/** Our club's losing streak at the end of a game day. */
function losingStreak(s: LeagueState): number {
  const me = s.user!.teamId;
  let n = 0;
  for (let i = s.scores.length - 1; i >= 0; i--) {
    const g = s.scores[i]!;
    if (g.home !== me && g.away !== me) continue;
    const mine = g.home === me ? g.hs : g.as,
      theirs = g.home === me ? g.as : g.hs;
    if (mine < theirs) n++;
    else break;
  }
  return n;
}

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
/** A spell of form for a player, unless he has a stronger one already. */
function lift(p: Player, delta: number, until: string, why: string) {
  const life = (p.life ??= {});
  if (life.form && Math.abs(life.form.delta) >= Math.abs(delta) && life.form.until >= until) return;
  life.form = { delta, until, why };
}

/** After our games of a day: the captain's meeting in a slump, and his monthly moment. */
export function captainDay(s: LeagueState, date: string, monthStart: boolean) {
  const u = s.user;
  if (!u || s.phase !== 'regular') return;
  const { captain } = captainsOf(s);
  if (!captain) return;
  const t = traitsOf(captain);
  const club = s.teams.find((x) => x.id === u.teamId)!.short;
  const active = s.rosters[u.teamId]?.active.map((id) => s.players[id]!) ?? [];
  // A players-only meeting at the fifth loss in a row (once a streak).
  const streak = losingStreak(s);
  if (streak === CAPTAIN.slump && !(s.news ?? []).some((n) => n.id === `captain-meeting-${date}`)) {
    const works = t.leadership >= CAPTAIN.meetingLeader;
    if (works) for (const p of active) lift(p, CAPTAIN.meetingForm, addDays(date, CAPTAIN.meetingDays), __i18n_k("league.captains.text.6370c488"));
    addNews(s, {
      id: `captain-meeting-${date}`,
      date,
      kind: 'interview',
      title: works ? __i18n_k("league.captains.text.a5fc9093", { streak, club, name: captain.name }) : __i18n_k("league.captains.text.d4129b44", { streak, club }),
      body: works
        ? __i18n_k("league.captains.text.479fe341", { name: iga(captain.name) })
        : __i18n_k("league.captains.text.f7087255", { name: iga(captain.name) }),
      quotes: [],
      facts: { streak, captain: captain.name },
      players: [captain.id],
      mine: true,
    });
    return;
  }
  if (!monthStart) return;
  const r = rng(`${s.seed}|captain|${date}`);
  if (r() > CAPTAIN.monthly) return;
  const young = active.filter((p) => p.id !== captain.id && !isForeign(p) && ageIn(p, s.year) <= 24);
  if (t.controversy >= 65 && r() < 0.5) {
    const other = active.filter((p) => p.id !== captain.id)[Math.floor(r() * Math.max(1, active.length - 1))];
    if (!other) return;
    lift(other, -2, addDays(date, 10), __i18n_k("league.captains.text.1ad41150"));
    addNews(s, {
      id: `captain-clash-${date}`,
      date,
      kind: 'interview',
      title: __i18n_k("league.captains.text.2e8817f0", { club, name: captain.name, other: wagwa(other.name) }),
      body: __i18n_k("league.captains.text.9e14ab78", { name: iga(captain.name), other: wagwa(other.name) }),
      quotes: [],
      facts: { captain: captain.name, other: other.name },
      players: [captain.id, other.id],
      mine: true,
    });
    return;
  }
  if ((captain.personality === '책임감 강한 리더' || t.leadership >= 65) && young.length) {
    const kid = young[Math.floor(r() * young.length)]!;
    lift(kid, 2, addDays(date, 14), __i18n_k("league.captains.text.74814040"));
    addNews(s, {
      id: `captain-mentor-${date}`,
      date,
      kind: 'interview',
      title: __i18n_k("league.captains.text.1ea6fdb3", { name: captain.name, kid: kid.name }),
      body: __i18n_k("league.captains.text.8f2a2459", { name: iga(captain.name), kid: eulreul(kid.name), kid2: iga(kid.name) }),
      quotes: [],
      facts: { captain: captain.name, young: kid.name },
      players: [captain.id, kid.id],
      mine: true,
    });
    return;
  }
  if (captain.personality === '밝은 분위기 메이커' || t.leadership >= 55) {
    for (const p of active) lift(p, 1, addDays(date, 5), __i18n_k("league.captains.text.86341c1f"));
    addNews(s, {
      id: `captain-dinner-${date}`,
      date,
      kind: 'interview',
      title: __i18n_k("league.captains.text.ff474cf7", { name: iga(captain.name), club }),
      body: __i18n_k("league.captains.text.763884f2", { name: iga(captain.name) }),
      quotes: [],
      facts: { captain: captain.name },
      players: [captain.id],
      mine: true,
    });
  }
}
