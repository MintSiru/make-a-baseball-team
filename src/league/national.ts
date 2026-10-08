import { k as __i18n_k } from '../i18n/index';
/* The national team (V0.7, reworked in V0.12; events in international.ts). A squad is named for every event: the
   best players by grade within the event's limits, at most three from one club for the Asian Games. An in-season
   squad is named about two months ahead and leaves its clubs between the dates; a November squad is named and
   plays in the winter; the March World Baseball Classic squad is named at the end of the winter and plays before
   opening day, and a few of its players come back hurt. The result is drawn at the end (or is the real one).

   The user's club hears when its players are named and may ask to keep one at home (RULES.md §11: clubs cannot
   refuse a call-up, but a request citing an injury or his condition is common). An injured player is excused; a
   healthy one only sometimes, and the fans and the player himself remember it, the more so when the event could
   have spared him military service. */
import { startYear } from './era';
import { rng } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { addAlert } from './alerts';
import { clubState } from './fans';
import { INTERNATIONAL, announceDate, eventById, eventsIn, exempts, finishText, ODDS, timing, type Finish, type InternationalEvent } from './international';
import { iga } from './josa';
import { addNews } from './news';
import { isForeign, isPitcher } from './players';
import type { Decision, LeagueState, NationalEntry } from './state';
import { NATIONAL as N } from './tuning';

const short = (s: LeagueState, id: string | null | undefined) => s.teams.find((t) => t.id === id)?.short ?? '';
const POS: Record<string, string> = { C: __i18n_k("league.national.pOS.c.5f31470d"), '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: __i18n_k("league.national.pOS.sS.3e24c7f1"), LF: __i18n_k("league.national.pOS.lF.73836db2"), CF: __i18n_k("league.national.pOS.cF.56780b2a"), RF: __i18n_k("league.national.pOS.rF.a28a0ef8") };
const posOf = (p: Player) => (p.position ? POS[p.position]! : p.role === 'SP' ? __i18n_k("league.national.posOf.cd036b1a") : __i18n_k("league.national.posOf.ac3cc00a"));
const ageAt = (p: Player, year: number) => year - Number(p.birthday.slice(0, 4));
const pending = (p: Player) => p.service.military === 'pending' || p.service.military === 'serving';

// ── The squad ────────────────────────────────────────────────────────────────────────────────────

/** Everyone the event could pick: domestic players at a club (soldiers included), within its limits. */
function eligible(s: LeagueState, e: InternationalEvent, young: boolean): Player[] {
  const L = e.limit;
  return Object.values(s.players).filter((p) => {
    if ((p.status !== 'active' && p.status !== 'military') || !p.teamId || isForeign(p)) return false;
    if (!L) return true;
    return young ? ageAt(p, e.year) <= L.maxAge || e.year - p.proSince < L.maxProYears : ageAt(p, e.year) <= L.wildcardMaxAge;
  });
}

const byGrade = (a: Player, b: Player) => b.scouting.current - a.scouting.current || a.id.localeCompare(b.id);

/** Adds the best of `pool` to `squad` up to `n`, at most `perClub` from a club. */
function fill(squad: Player[], pool: Player[], n: number, perClub: number | undefined, skip: Set<PlayerId>) {
  const from = (teamId: string) => squad.filter((p) => p.teamId === teamId).length;
  for (const p of [...pool].sort(byGrade)) {
    if (squad.length >= n) break;
    if (squad.includes(p) || skip.has(p.id) || (perClub && from(p.teamId!) >= perClub)) continue;
    squad.push(p);
  }
}

/** Names the squad for an event (once). */
export function selectNationalTeam(s: LeagueState, e: InternationalEvent): NationalEntry {
  const existing = s.international.find((x) => x.id === e.id);
  if (existing) return existing;
  const squad: Player[] = [];
  const L = e.limit;
  fill(squad, eligible(s, e, true), e.squad - (L?.wildcards ?? 0), e.perClub, new Set());
  if (L) fill(squad, eligible(s, e, false), e.squad, e.perClub, new Set());
  const entry: NationalEntry = { id: e.id, year: e.year, name: e.name, kind: e.kind, medal: false, squad: squad.map((p) => p.id) };
  s.international.push(entry);
  return entry;
}

/** Takes `id` out of the squad and names the next best in his place (same limits). */
function replace(s: LeagueState, e: InternationalEvent, entry: NationalEntry, id: PlayerId) {
  entry.squad = entry.squad.filter((x) => x !== id);
  const squad = entry.squad.map((x) => s.players[x]!).filter(Boolean);
  const skip = new Set([...(entry.excused ?? []), id]);
  fill(squad, eligible(s, e, true), squad.length + 1, e.perClub, skip);
  if (e.limit && squad.length <= entry.squad.length) fill(squad, eligible(s, e, false), squad.length + 1, e.perClub, skip);
  entry.squad = squad.map((p) => p.id);
}

// ── The result ───────────────────────────────────────────────────────────────────────────────────

/** The event is over: its result, the exemptions it brings, the hurt from a March tournament, and the fans. */
export function finishEvent(s: LeagueState, e: InternationalEvent) {
  const entry = selectNationalTeam(s, e);
  if (entry.finish) return entry;
  const r = rng(`${s.seed}|international|${e.id}`);
  let x = r();
  // The real result only for events before the game starts (1.6.0: a game from 2016 plays the 2017 WBC itself).
  const finish: Finish = (e.year < startYear() ? e.finish : null) ?? ODDS[e.kind].find(([, w]) => (x -= w) < 0)?.[0] ?? ODDS[e.kind].at(-1)![0];
  entry.finish = finish;
  entry.medal = exempts(e, finish);
  const players = entry.squad.map((id) => s.players[id]).filter((p): p is Player => !!p);
  if (entry.medal)
    for (const p of players) {
      if (!pending(p)) continue;
      if (p.status === 'military') {
        p.status = 'active';
        if (p.teamId) s.rosters[p.teamId]!.futures.push(p.id);
      }
      p.service.military = 'exempt';
      delete p.service.route;
      delete p.service.returnsOn;
    }
  // Playing for the country: the fans warm to him, a little more for a title.
  for (const p of players) if (p.teamId === s.user?.teamId) (p.life ??= {}).fans = Math.min(30, (p.life.fans ?? 0) + (finish === 'champion' ? N.fans.champion : N.fans.called));
  // March tournaments cost a few players the start of their season.
  const hurt: Player[] = [];
  if (timing(e) === 'spring')
    for (const p of players) {
      if (r() >= N.springInjury.chance) continue;
      const parts = isPitcher(p) ? N.springInjury.pitcher : N.springInjury.hitter;
      const part = parts[Math.floor(r() * parts.length)]!;
      const days = N.springInjury.days[0] + Math.floor(r() * (N.springInjury.days[1] - N.springInjury.days[0] + 1));
      const until = new Date(Date.parse(e.dates.to) + days * 86400000).toISOString().slice(0, 10);
      s.injuries[p.id] = { until, days, onList: false, part };
      (p.injuries ??= []).push({ date: e.dates.to, days, part });
      hurt.push(p);
    }
  if (finish === 'champion' && s.user) clubState(s, s.user.teamId).interest += N.titleBuzz;
  resultAlert(s, e, entry, hurt);
  return entry;
}

/** Finishes every event of `year` not yet finished (the winter step; also anything left over). */
export function applyInternational(s: LeagueState, year: number) {
  for (const e of eventsIn(year)) finishEvent(s, e);
}

// ── In the season ────────────────────────────────────────────────────────────────────────────────

/**
 * The start of a game day: an in-season squad named today. Returns true when the game must wait for the user's
 * decision on his players (nothing of the day has happened yet; the day runs once he has decided).
 */
export function nationalTeamCalls(s: LeagueState, date: string): boolean {
  for (const e of eventsIn(s.year)) {
    if (timing(e) !== 'season' || date < announceDate(e) || date > e.dates.to || s.international.some((x) => x.id === e.id)) continue;
    const entry = selectNationalTeam(s, e);
    pickAlert(s, e, entry, date);
    const d = nationalDecision(s, e);
    if (d) {
      s.pending = d;
      return true;
    }
  }
  return false;
}

/** The squad leaves on its date (clubs call up replacements) and is back after the last day. */
export function nationalTeamLeaves(s: LeagueState, date: string): boolean {
  let left = false;
  for (const e of eventsIn(s.year)) {
    if (timing(e) !== 'season' || date < e.dates.from || date > e.dates.to) continue;
    const entry = selectNationalTeam(s, e);
    if (entry.left) continue;
    entry.left = true;
    for (const id of entry.squad) if (s.players[id]?.status === 'active') s.away[id] = e.dates.to;
    left = true;
  }
  return left;
}

export function nationalTeamBack(s: LeagueState, date: string) {
  for (const e of eventsIn(s.year)) if (timing(e) === 'season' && date > e.dates.to) finishEvent(s, e);
}

// ── The winter and the spring ────────────────────────────────────────────────────────────────────

/** Squads named in the winter step for November events, and at the end of the winter for March ones. */
export function winterSquads(s: LeagueState, events: InternationalEvent[]) {
  for (const e of events) {
    if (s.international.some((x) => x.id === e.id)) continue;
    const entry = selectNationalTeam(s, e);
    pickAlert(s, e, entry, timing(e) === 'spring' ? `${e.year}-02-10` : `${e.year}-10-25`);
  }
}

/** November events of `year` (named and played in the winter step). */
export const novemberEvents = (year: number) => eventsIn(year).filter((e) => timing(e) === 'winter');
/** March events of `year` (named at the end of the winter before). */
export const marchEvents = (year: number) => eventsIn(year).filter((e) => timing(e) === 'spring');

// ── The user's club ──────────────────────────────────────────────────────────────────────────────

/** Our players named for `e`, and what the club may say (once per event). */
export function nationalDecision(s: LeagueState, e: InternationalEvent): Decision | null {
  const u = s.user;
  const entry = s.international.find((x) => x.id === e.id);
  if (!u || !entry || entry.asked) return null;
  entry.asked = true;
  const ours = entry.squad.map((id) => s.players[id]).filter((p): p is Player => !!p && p.teamId === u.teamId);
  if (!ours.length) return null;
  return {
    kind: 'national',
    event: e.id,
    rows: ours.map((p) => ({ id: p.id, injured: !!s.injuries[p.id] && !s.injuries[p.id]!.dtd, exemption: pending(p) && (e.kind === 'asianGames' || e.kind === 'olympics') })),
  };
}

/** The first winter or spring event still waiting on our answer. */
export function nextNationalDecision(s: LeagueState, events: InternationalEvent[]): Decision | null {
  winterSquads(s, events);
  for (const e of events) {
    const d = nationalDecision(s, e);
    if (d) return d;
  }
  return null;
}

/** The club's answer: the ones it asks to keep home. Injured players are let off; a healthy one sometimes. */
export function resolveNational(s: LeagueState, d: Extract<Decision, { kind: 'national' }>, excuse: PlayerId[]) {
  const e = eventById(d.event)!;
  const entry = s.international.find((x) => x.id === e.id)!;
  const u = s.user!;
  const club = clubState(s, u.teamId);
  for (const row of d.rows) {
    if (!excuse.includes(row.id)) continue;
    const p = s.players[row.id]!;
    const ok = row.injured || rng(`${s.seed}|excuse|${e.id}|${row.id}`)() < N.excuse.healthy;
    if (!row.injured) {
      club.interest -= N.excuse.fans;
      // He wanted to go, all the more when a medal would have spared him the army.
      (p.life ??= {}).fans = Math.max(-30, (p.life.fans ?? 0) - (row.exemption ? N.excuse.exemptionGrudge : N.excuse.grudge));
    }
    if (ok) {
      (entry.excused ??= []).push(row.id);
      replace(s, e, entry, row.id);
    }
    addNews(s, {
      id: `excuse-${e.id}-${row.id}`,
      date: newsDate(s, e),
      kind: 'move',
      title: ok ? __i18n_k("league.national.resolveNational.title.1f45794c", { short: short(s, u.teamId), name: p.name, name2: e.name }) : __i18n_k("league.national.resolveNational.title.7e587388", { short: short(s, u.teamId), name: p.name }),
      body: ok
        ? __i18n_k("league.national.resolveNational.body.1b443c11", { short: short(s, u.teamId), value: row.injured ? __i18n_k("league.national.resolveNational.body.ca63cdf1") : __i18n_k("league.national.resolveNational.body.b433754a"), name: p.name, value2: row.injured ? '' : __i18n_k("league.national.resolveNational.body.2d721fcf"), value3: row.exemption && !row.injured ? __i18n_k("league.national.resolveNational.body.2fd1d289", { name: p.name }) : '' })
        : __i18n_k("league.national.resolveNational.body.9516dfd2", { short: short(s, u.teamId), name: p.name, name2: iga(p.name) }),
      quotes: [],
      facts: { 선수: p.name, 대회: e.name, 결과: ok ? __i18n_k("league.national.facts.message.a0c196ee") : __i18n_k("league.national.facts.message.01aff88d") },
      players: [p.id],
      mine: true,
    });
  }
}

const newsDate = (s: LeagueState, e: InternationalEvent) =>
  s.phase === 'regular' ? (s.schedule[s.next]?.date ?? e.dates.from) : timing(e) === 'spring' ? `${e.year}-02-10` : `${e.year}-10-25`;

/** The scouts' answer: keep only the injured at home. */
export const autoNational = (d: Extract<Decision, { kind: 'national' }>) => d.rows.filter((r) => r.injured).map((r) => r.id);

// ── Alerts ───────────────────────────────────────────────────────────────────────────────────────

function pickAlert(s: LeagueState, e: InternationalEvent, entry: NationalEntry, date: string) {
  const u = s.user;
  if (!u) return;
  const ours = entry.squad.map((id) => s.players[id]).filter((p): p is Player => !!p && p.teamId === u.teamId);
  if (!ours.length) return;
  const exempt = e.kind === 'asianGames' || e.kind === 'olympics' ? ours.filter(pending) : [];
  addAlert(s, {
    id: `intl-pick-${e.id}`,
    date,
    kind: 'national',
    title: __i18n_k("league.national.pickAlert.title.4bb7c369", { year: e.year, name: e.name }),
    lines: [
      __i18n_k("league.national.pickAlert.lines.ab84a82e", { length: entry.squad.length, length2: ours.length }),
      ...ours.map((p) => __i18n_k("league.national.pickAlert.lines.8df31f5a", { name: p.name, posOf: posOf(p), value: pending(p) ? __i18n_k("league.national.pickAlert.lines.22e04b25") : '' })),
      ...(exempt.length ? [__i18n_k("league.national.pickAlert.lines.9753ff03", { value: e.kind === 'asianGames' ? '금메달' : __i18n_k("league.national.pickAlert.lines.9705e8f9"), length: exempt.length })] : []),
      timing(e) === 'season' ? __i18n_k("league.national.pickAlert.lines.73e23b67", { value: e.dates.from.slice(5), value2: e.dates.to.slice(5) }) : timing(e) === 'spring' ? __i18n_k("league.national.pickAlert.lines.d9d36dda") : __i18n_k("league.national.pickAlert.lines.29a7c705"),
    ],
    tone: 'good',
    players: ours.map((p) => p.id),
  });
}

function resultAlert(s: LeagueState, e: InternationalEvent, entry: NationalEntry, hurt: Player[]) {
  const u = s.user;
  if (!u) return;
  const ours = entry.squad.map((id) => s.players[id]).filter((p): p is Player => !!p && p.teamId === u.teamId);
  const exempt = entry.medal ? ours.filter((p) => p.service.military === 'exempt' && (e.kind === 'asianGames' || e.kind === 'olympics')) : [];
  const text = finishText(e, entry.finish!);
  const ourHurt = hurt.filter((p) => p.teamId === u.teamId);
  addAlert(s, {
    id: `intl-result-${e.id}`,
    date: e.dates.to,
    kind: 'national',
    title: `${e.year} ${e.name} ${text}`,
    lines: [
      __i18n_k("league.national.resultAlert.lines.8d5c0301", { text: text }),
      ...(ours.length ? [__i18n_k("league.national.resultAlert.lines.63d96aae", { value: ours.map((p) => p.name).join(', ') })] : []),
      ...(exempt.length ? [__i18n_k("league.national.resultAlert.lines.a9d2b901", { value: exempt.map((p) => p.name).join(', ') })] : []),
      ...(ourHurt.length ? [__i18n_k("league.national.resultAlert.lines.a4a43953", { value: ourHurt.map((p) => __i18n_k("league.national.resultAlert.lines.93a16219", { name: p.name, value: s.injuries[p.id]?.part ?? __i18n_k("league.national.resultAlert.lines.501fb802") })).join(', ') })] : []),
    ],
    tone: entry.finish === 'champion' || entry.medal ? 'good' : ours.length && (entry.finish === 'first' || entry.finish === 'second') ? 'bad' : undefined,
    players: ours.map((p) => p.id),
  });
}

/** Asian Games coming this season or next (clubs hold back their likely picks from the army). */
export const asianGamesSoon = (next: number) => INTERNATIONAL.find((e) => (e.year === next || e.year === next + 1) && e.kind === 'asianGames');
