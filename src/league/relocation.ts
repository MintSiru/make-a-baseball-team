import { k as __i18n_k } from '../i18n/index';
/* 2.0.37 (the user's request): the parent wants to move our club out of a small market (the 현대 유니콘스 case: from
   Incheon toward Seoul, a temporary home at Suwon that became for good). Now and then, a winter after the club has
   played a couple of first-team seasons in a city of a small market, the parent proposes moving to the best free city
   with a bigger one.

   The general manager says no — and it ends there (the parent is a little put out) — or yes: the plan is announced,
   the city and the fans protest (the fans' mood drops), and the board votes. Approved, the club moves for next season:
   the city, the ballpark (the new city's), the name's city part, and the fans — some follow, the new city's come.
   Turned down, the club either moves to a temporary home on the way (a free city) and keeps trying each winter, the
   board likelier to give in each time (three tries, then it stays where it is), or drops the plan (the parent is
   more put out; the old fans are relieved). A citizen club belongs to its city and does not move. */
import { rng } from '../draftroom';
import { CITIES, cityById, type City } from '../club/cities';
import { addAlert } from './alerts';
import { clubState } from './fans';
import { eulreul, iga, ro } from './josa';
import { milestone } from './milestones';
import { addNews } from './news';
import { aiFoundingClubs, type Decision, type LeagueState } from './state';
import { FANS } from './tuning';

export const RELOCATE = {
  /** Cities under this market (0–100) are small; the chance a winter, from this many first-team seasons on. */
  market: 55,
  chance: 0.1,
  after: 2,
  /** The target must be this much bigger. */
  gap: 8,
  /** The board's yes: base, per point of the target's market over ours, per try after the first. */
  approve: { base: 0.4, perMarket: 0.004, perTry: 0.18, max: 0.9 },
  tries: 3,
  /** Share of the old fans who follow; the fans' mood when it is announced; the parent's trust after a no / a drop. */
  keep: 0.4,
  protest: 0.12,
  relief: 0.05,
  trust: { refuse: -2, drop: -5 },
};

/** Cities other clubs call home (and ours). */
export function takenCities(s: LeagueState): Set<string> {
  const out = new Set<string>();
  if (s.user) out.add(s.user.settings.cityId);
  if (s.twelve) out.add(s.twelve.cityId);
  for (const c of aiFoundingClubs(s)) if ('cityId' in c && c.cityId) out.add(c.cityId as string);
  for (const m of s.mergers ?? []) if (m.cityId) out.add(m.cityId);
  return out;
}

/** Free cities with a bigger market than `than`, biggest first. */
export function biggerCities(s: LeagueState, than: number, except: string[] = []): City[] {
  const taken = takenCities(s);
  return CITIES.filter((c) => !taken.has(c.id) && !except.includes(c.id) && c.market >= than + RELOCATE.gap).sort((a, b) => b.market - a.market);
}

/** The board's chance of saying yes. */
export function approveChance(from: City, to: City, tries: number): number {
  const A = RELOCATE.approve;
  return Math.min(A.max, A.base + Math.max(0, to.market - from.market) * A.perMarket + Math.max(0, tries - 1) * A.perTry);
}

/** The winter's turn: a retry from a temporary home, or now and then the parent's proposal. */
export function relocationDecision(s: LeagueState, year: number): Decision | null {
  const u = s.user;
  if (!u || u.settings.parentType === 'citizen' || year < u.firstTeamYear + RELOCATE.after - 1) return null;
  const r = rng(`${s.seed}|relocate|${year}`);
  const plan = u.relocation;
  if (plan) {
    if (plan.since >= year) return null;
    const from = cityById(u.settings.cityId)!,
      to = cityById(plan.target)!;
    plan.tries++;
    if (r() < approveChance(from, to, plan.tries)) {
      delete u.relocation;
      relocate(s, to.id, year, false);
    } else if (plan.tries >= RELOCATE.tries) {
      delete u.relocation;
      say(s, year, __i18n_k("league.relocation.text.b62a23ee", { club: clubName(s), city: from.name }), __i18n_k("league.relocation.text.0b362396", { tries: plan.tries, club: iga(clubName(s)), city: ro(from.name) }), 'bad');
    } else say(s, year, __i18n_k("league.relocation.text.a50d2945", { club: clubName(s) }), __i18n_k("league.relocation.text.bab2110e", { club: clubName(s), city: to.name }), 'bad');
    return null;
  }
  const home = cityById(u.settings.cityId);
  if (!home || home.market >= RELOCATE.market || r() >= RELOCATE.chance) return null;
  const target = biggerCities(s, home.market)[0];
  if (!target) return null;
  return { kind: 'relocate', stage: 'propose', from: home.id, target: target.id, chance: Math.round(approveChance(home, target, 1) * 100) };
}

/** The general manager's answer. Returns the next decision (the board said no: temporary home or drop). */
export function resolveRelocation(s: LeagueState, d: Extract<Decision, { kind: 'relocate' }>, answer: 'accept' | 'refuse' | 'temporary' | 'drop', year: number): Decision | null {
  const u = s.user!;
  const from = cityById(d.from)!,
    to = cityById(d.target)!;
  const r = rng(`${s.seed}|relocate-vote|${year}`);
  const club = clubName(s);
  if (d.stage === 'propose') {
    if (answer !== 'accept') {
      u.trust = Math.max(0, (u.trust ?? 50) + RELOCATE.trust.refuse);
      say(s, year, __i18n_k("league.relocation.text.a312f8ab", { club }), __i18n_k("league.relocation.text.9efd971e", { club: iga(club), to: to.name, from: from.name }), 'good');
      return null;
    }
    say(s, year, __i18n_k("league.relocation.text.12feee1b", { club, to: to.name }), __i18n_k("league.relocation.text.81e2d3b2", { club: iga(club), from: eulreul(from.name), to: ro(to.name) }), 'bad');
    clubState(s, u.teamId).interest -= RELOCATE.protest;
    say(s, year, __i18n_k("league.relocation.text.b4c3df5e", { from: from.name }), __i18n_k("league.relocation.text.440075b0", { from: from.name }), 'bad', 'protest');
    if (r() < approveChance(from, to, 1)) {
      relocate(s, to.id, year, false);
      return null;
    }
    say(s, year, __i18n_k("league.relocation.text.addd428d", { club }), __i18n_k("league.relocation.text.2ff02ff2", { club: clubName(s), to: to.name }), 'bad', 'vote');
    const temp = biggerCities(s, from.market - RELOCATE.gap, [to.id]).find((c) => c.id !== from.id) ?? null;
    return { kind: 'relocate', stage: 'rejected', from: from.id, target: to.id, temp: temp?.id ?? null, chance: Math.round(approveChance(from, to, 2) * 100) };
  }
  // Turned down: a temporary home on the way, or drop the plan.
  if (answer === 'temporary' && d.temp) {
    relocate(s, d.temp, year, true);
    u.relocation = { target: to.id, temp: d.temp, tries: 1, since: year };
    return null;
  }
  u.trust = Math.max(0, (u.trust ?? 50) + RELOCATE.trust.drop);
  clubState(s, u.teamId).interest += RELOCATE.relief;
  say(s, year, __i18n_k("league.relocation.text.f76b447d", { club }), __i18n_k("league.relocation.text.8c987fe2", { club: iga(club), to: to.name, from: from.name }), 'good');
  return null;
}

/** Moves our club (from next season): city, ballpark, the name's city, and the fans. */
export function relocate(s: LeagueState, cityId: string, year: number, temporary: boolean) {
  const u = s.user!;
  const team = s.teams.find((t) => t.id === u.teamId)!;
  const from = cityById(u.settings.cityId)!,
    to = cityById(cityId)!;
  u.settings.cityId = to.id;
  team.region = to.name;
  if (team.name.startsWith(from.name)) team.name = to.name + team.name.slice(from.name.length);
  const seats = to.stadium.seats;
  team.stadium = { name: to.stadium.name, size: seats < 10_000 ? 'small' : seats >= 20_000 ? 'large' : 'medium', capacity: seats, ownership: 'municipalLease' };
  const c = clubState(s, u.teamId);
  const fresh = FANS.newClub.base + to.market * FANS.newClub.perMarket;
  c.popularity = Math.round(c.popularity * RELOCATE.keep + fresh * (1 - RELOCATE.keep));
  c.interest = Math.max(c.interest, FANS.newClub.novelty / 2);
  (u.relocations ??= []).push({ year, from: from.id, to: to.id, ...(temporary ? { temporary: true } : {}) });
  milestone(s, year, temporary ? __i18n_k("league.relocation.text.c6e3d7f1", { club: team.name, to: ro(to.name) }) : __i18n_k("league.relocation.text.a12d5dc7", { club: team.name, from: from.name, to: ro(to.name) }));
  if (temporary) say(s, year, __i18n_k("league.relocation.text.c974dbfb", { club: team.name, to: ro(to.name) }), __i18n_k("league.relocation.text.51c88bac", { club: iga(team.name), to: ro(to.name), park: to.stadium.name }), 'bad');
  else say(s, year, __i18n_k("league.relocation.text.10b946ee", { club: team.name, to: to.name }), __i18n_k("league.relocation.text.663fd334", { club: iga(team.name), to: eulreul(to.name), park: to.stadium.name, from: from.name }), 'good');
}

const clubName = (s: LeagueState) => s.teams.find((t) => t.id === s.user?.teamId)?.name ?? '';

function say(s: LeagueState, year: number, title: string, body: string, tone: 'good' | 'bad', tag = 'news') {
  const date = `${year}-11-24`;
  const id = `relocate-${year}-${tag}-${(s.news ?? []).length}`;
  addNews(s, { id, date, kind: 'move', title, body, quotes: [], facts: { club: clubName(s) }, players: [], mine: true });
  addAlert(s, { id, date, kind: 'owner', title, lines: [body], tone });
}
