import { k as __i18n_k } from '../i18n/index';
/* The dark side (V0.12; user's club only, like life.ts). Now and then one of our players drives drunk, gets into a
   fight, is caught doping, or is found fixing games. The KBO's penalties are the real ones (RULES.md §9, S73–S75):
   drunk driving 70 games with a suspended licence and a year's ban with a revoked one (five years the second time,
   for life the third; ten more games for hiding it), doping 72 games and then a whole season (game assumption: for
   life the third time), match fixing a life ban; a fight costs 30 games (50 for a bad one; a game assumption, the
   KBO decides case by case). The club then answers: release him, add a penalty of its own, or leave it to the KBO;
   the fans judge the answer.

   Doping gives warning (the player's request): a player who starts using shows it over the following weeks — a body
   that changes, a rumour about his trainer, numbers that jump, a supplement the trainers cannot place. Clean players
   draw a rumour or two as well. The general manager can order an internal test (a fee from the fund): it catches a
   user before the KBO's testers do and costs nothing but some goodwill, or upsets a clean player. Left alone, the
   KBO's random tests find him in the end. */
import { rng } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { addAlert } from './alerts';
import { clubState } from './fans';
import { eunneun, iga } from './josa';
import { addNews } from './news';
import { leaveLeague } from './offseason';
import { ageIn, isForeign, isPitcher } from './players';
import { orgPlayers, type Decision, type LeagueState } from './state';
import { GROWTH, SCANDAL as S } from './tuning';
import { temperFactor, troubleFactor } from './traits';
import { isMarried } from './life';
import { maybeDiscipline } from './discipline';

export type Offense = 'dui' | 'doping' | 'assault' | 'fixing' | RareOffense;
/** 2.0.28 (the user's request): 불륜, 낙태 종용, 불법 도박, 조직폭력배 연루, 학교 폭력, 병역 비리, 감독·코치에게 항명. */
export type RareOffense = 'affair' | 'abortion' | 'gambling' | 'gangs' | 'schoolViolence' | 'draftDodge' | 'insubordination' | ForeignOffense | NewOffense;
/** 2.0.36 (the user's request): 음주 난동, 마약류 투여, 후배 폭행, 부조리. */
export type NewOffense = 'drunkBrawl' | 'drugs' | 'hazing' | 'abuse';
/** 2.0.28: a foreign player's (팬과 언쟁, 마약류 성분 검출). */
export type ForeignOffense = 'fanQuarrel' | 'narcotics';
const FOREIGN_ONLY: Offense[] = ['fanQuarrel', 'narcotics'];

/** 2.0.28 (the user's request, kept rare): a new foreign signing fails his medical; a season's chance at a club that a
    foreign player has words with a fan or tests positive for a narcotic (a cold medicine, a supplement). */
export const FOREIGN_TROUBLE = { medical: 0.03, rates: { fanQuarrel: 0.015, narcotics: 0.003 } as Record<ForeignOffense, number> };
const RARE: RareOffense[] = ['affair', 'abortion', 'gambling', 'gangs', 'schoolViolence', 'draftDodge', 'insubordination', 'fanQuarrel', 'narcotics', 'drunkBrawl', 'drugs', 'hazing', 'abuse'];

/** A suspension: games still to sit out (his club's first-team games), or a ban until a date. */
export interface Suspension {
  reason: string;
  games?: number;
  until?: string;
  since: string;
}

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
const short = (s: LeagueState) => s.teams.find((t) => t.id === s.user?.teamId)?.short ?? '';

/** Whether he is serving a suspension on `date` (he cannot be registered or play). */
export function suspended(s: LeagueState, id: PlayerId, date?: string): boolean {
  const x = s.suspended?.[id];
  if (!x) return false;
  if ((x.games ?? 0) > 0) return true;
  return !!x.until && (!date || x.until > date);
}

/** One of his club's first-team games went by: one game fewer to sit out. */
export function serveSuspensions(s: LeagueState, teamId: string) {
  for (const [id, x] of Object.entries(s.suspended ?? {})) {
    if (s.players[id]?.teamId !== teamId || !x.games) continue;
    x.games--;
    if (x.games <= 0 && !x.until) delete s.suspended![id];
  }
}

/** Bans that ran out by `date` are lifted. */
function liftBans(s: LeagueState, date: string) {
  for (const [id, x] of Object.entries(s.suspended ?? {})) if (!x.games && x.until && x.until <= date) delete s.suspended![id];
}

// ── A day of the season ──────────────────────────────────────────────────────────────────────────

/** Who might do it: our domestic players at the club, a little likelier for some than others. */
function candidate(s: LeagueState, offense: Offense | 'rumour', r: () => number): Player | null {
  const u = s.user!;
  // 2.0.28: the foreign players' own trouble finds a foreign player.
  const foreign = offense !== 'rumour' && FOREIGN_ONLY.includes(offense);
  const pool = orgPlayers(s, u.teamId).filter((p) => p.status === 'active' && isForeign(p) === foreign && !suspended(s, p.id) && !p.life?.suspicion);
  if (!pool.length) return null;
  const base = (p: Player) => {
    const age = ageIn(p, s.year);
    if (offense === 'doping') {
      // A contract year, a comeback from an operation or a career on the line.
      const lastYear = !(p.contract?.salaries ?? []).some((x) => x.season > s.year);
      const operated = (p.injuries ?? []).some((i) => i.surgery && Number(i.date.slice(0, 4)) >= s.year - 1);
      return (age >= 26 && age <= 34 ? 2 : 1) * (lastYear ? 1.5 : 1) * (operated ? 1.5 : 1);
    }
    if (offense === 'fixing') return isPitcher(p) && p.scouting.current < 50 ? 3 : 0.3;
    // 2.0.28: an affair needs a marriage; a school-violence story comes out early in a career; draft dodging is a
    // young man's who has not served; insubordination a hothead's.
    if (offense === 'affair') return isMarried(s, p) ? 1 : 0;
    if (offense === 'schoolViolence') return age <= 25 ? 3 : 0.3;
    if (offense === 'draftDodge') return p.service.military === 'pending' && age >= 20 && age <= 28 ? 1 : 0;
    if (offense === 'insubordination') return temperFactor(p);
    // 2.0.36: a senior picks on the juniors; a brawl is a hothead's.
    if (offense === 'hazing' || offense === 'abuse') return age >= 27 ? 2 : age >= 24 ? 0.5 : 0;
    if (offense === 'drunkBrawl') return (age >= 21 ? 1 : 0.2) * temperFactor(p);
    return age >= 21 ? 1 : 0.3;
  };
  // 논란성 (1.1.0): the likelier ones; a rumour finds anyone.
  const weight = offense === 'rumour' ? base : (p: Player) => base(p) * troubleFactor(p);
  const total = pool.reduce((a, p) => a + weight(p), 0);
  if (total <= 0) return null;
  let x = r() * total;
  return pool.find((p) => (x -= weight(p)) < 0) ?? pool.at(-1)!;
}

/** How much trouble the club's domestic players make, against the league's usual (1). */
function clubTrouble(s: LeagueState, teamId: string): number {
  const pool = orgPlayers(s, teamId).filter((p) => p.status === 'active' && !isForeign(p));
  return pool.length ? pool.reduce((a, p) => a + troubleFactor(p), 0) / pool.length / GROWTH.controversy.mean : 1;
}

/** The day's chances (game days only). Returns true when the club must answer before the game goes on. */
export function scandalDay(s: LeagueState, date: string): boolean {
  const u = s.user;
  if (!u) return false;
  liftBans(s, date);
  const r = rng(`${s.seed}|scandal|${date}`);
  // A club of troublemakers has more trouble (1.1.0).
  const k = clubTrouble(s, u.teamId);
  // Concealed drunk driving comes out.
  for (const p of orgPlayers(s, u.teamId)) {
    const hidden = p.life?.hiding;
    if (hidden && hidden.found <= date) {
      delete p.life!.hiding;
      if (incident(s, p, 'dui', date, r, true)) return true;
    }
  }
  dopingDay(s, date, r, k);
  if (s.pending) return true;
  for (const offense of ['dui', 'assault', 'fixing'] as const) {
    if (r() >= (S.rates[offense] / S.gameDays) * k) continue;
    const p = candidate(s, offense, r);
    if (!p) continue;
    if (offense === 'dui' && r() < S.dui.hidden) {
      (p.life ??= {}).hiding = { date, found: addDays(date, S.dui.foundAfter[0] + Math.floor(r() * (S.dui.foundAfter[1] - S.dui.foundAfter[0]))) };
      continue;
    }
    if (incident(s, p, offense, date, r)) return true;
  }
  // 2.0.28: the rare ones, and the club's own trouble.
  for (const offense of RARE) {
    const rate = offense === 'fanQuarrel' || offense === 'narcotics' ? FOREIGN_TROUBLE.rates[offense] : S.rare[offense];
    if (r() >= (rate / S.gameDays) * k) continue;
    const p = candidate(s, offense, r);
    if (p && incident(s, p, offense, date, r)) return true;
  }
  for (const kind of CLUB_TROUBLE) if (r() < S.club.rates[kind] / S.gameDays) clubTroubleDay(s, kind, date);
  for (const kind of PR_TROUBLE) if (r() < S.pr.rates[kind] / S.gameDays) prDay(s, kind, date, r);
  return !!s.pending;
}

// ── The papers and the fans (2.0.28) ─────────────────────────────────────────────────────────────

type PrTrouble = keyof typeof S.pr.rates;
const PR_TROUBLE: PrTrouble[] = ['gaffe', 'distorted', 'autograph', 'noInterview'];

/** A careless interview, one the reporter twisted, an autograph refused, an interview refused: the papers, his fans'
    fondness, a little of the club's. No decision; the better-known players are asked more, so it finds them more. */
function prDay(s: LeagueState, kind: PrTrouble, date: string, r: () => number) {
  const u = s.user!;
  const pool = orgPlayers(s, u.teamId).filter((p) => p.status === 'active' && !suspended(s, p.id));
  if (!pool.length) return;
  const weight = (p: Player) => (p.scouting.current >= 55 ? 3 : 1) * (kind === 'distorted' ? 1 : troubleFactor(p) * temperFactor(p));
  let x = r() * pool.reduce((a, p) => a + weight(p), 0);
  const p = pool.find((q) => (x -= weight(q)) < 0) ?? pool.at(-1)!;
  const club = short(s);
  const [title, body, life] =
    kind === 'gaffe'
      ? [__i18n_k("league.scandals.text.aa9b9ed4", { club, name: p.name }), __i18n_k("league.scandals.text.dcf82e20", { name: iga(p.name) }), __i18n_k("league.scandals.text.c1801365")]
      : kind === 'distorted'
        ? [__i18n_k("league.scandals.text.ee5931b1", { club, name: p.name }), __i18n_k("league.scandals.text.2f904ef6", { name: eunneun(p.name) }), __i18n_k("league.scandals.text.1d16914f")]
        : kind === 'autograph'
          ? [__i18n_k("league.scandals.text.5bb089b5", { club, name: p.name }), __i18n_k("league.scandals.text.ce43f398", { name: iga(p.name) }), __i18n_k("league.scandals.text.f7843bb0")]
          : [__i18n_k("league.scandals.text.6d07ad90", { club, name: p.name }), __i18n_k("league.scandals.text.cef3b3e7", { name: iga(p.name) }), __i18n_k("league.scandals.text.b57c99d1")];
  const l = (p.life ??= {});
  l.fans = Math.max(-30, (l.fans ?? 0) - S.pr.fans[kind]);
  (l.events ??= []).push({ date, text: life, tone: 'bad' });
  clubState(s, u.teamId).interest -= S.pr.mood[kind];
  addNews(s, { id: `pr-${kind}-${p.id}-${date}`, date, kind: 'interview', title, body, quotes: [], facts: { 선수: p.name }, players: [p.id], mine: true });
  addAlert(s, { id: `pr-${kind}-${p.id}-${date}`, date, kind: 'life', title, lines: [body], tone: 'bad', players: [p.id] });
  // 2.0.36: the manager may send him down for it (discipline.ts).
  if (kind === 'gaffe' || kind === 'noInterview') maybeDiscipline(s, p, date, r);
}

// ── The club's own trouble (2.0.28) ──────────────────────────────────────────────────────────────

type ClubTrouble = keyof typeof S.club.rates;
const CLUB_TROUBLE: ClubTrouble[] = ['cctv', 'sns', 'fans', 'kickback', 'neglect'];

function clubTroubleDay(s: LeagueState, kind: ClubTrouble, date: string) {
  const u = s.user!;
  const club = short(s);
  const fine = S.club.fine[kind];
  clubState(s, u.teamId).interest -= S.club.mood[kind];
  if (fine) {
    u.fund -= fine;
    u.ledger.push({ year: s.year, label: __i18n_k("league.scandals.text.c7c25019"), amount: -fine });
  }
  const particle = iga(club).slice(club.length);
  const [t, body] =
    kind === 'cctv'
      ? [__i18n_k("league.scandals.text.a03c00f6", { club }), __i18n_k("league.scandals.text.0926e424", { club, particle, fine })]
      : kind === 'sns'
        ? [__i18n_k("league.scandals.text.a764734a", { club }), __i18n_k("league.scandals.text.887d6212", { club })]
        : kind === 'fans'
          ? [__i18n_k("league.scandals.text.0e751bd7", { club }), __i18n_k("league.scandals.text.175641cd", { club, particle })]
          : // 2.0.36: the front office's kickbacks, players treated badly.
            kind === 'kickback'
            ? [__i18n_k("league.scandals.text.0815d9cd", { club }), __i18n_k("league.scandals.text.b200a735", { club: iga(club), fine })]
            : [__i18n_k("league.scandals.text.a6e859be", { club }), __i18n_k("league.scandals.text.b1bfba87", { club: iga(club) })];
  addNews(s, { id: `club-trouble-${kind}-${date}`, date, kind: 'move', title: t, body, quotes: [{ who: __i18n_k("league.scandals.text.9b20cdfe"), role: 'fan', text: __i18n_k("league.scandals.text.1e27e617") }], facts: { 구단: club }, players: [], mine: true });
  addAlert(s, { id: `club-trouble-${kind}-${date}`, date, kind: 'scandal', title: t, lines: [body, __i18n_k("league.scandals.text.897cda5b")], tone: 'bad' });
}

// ── Doping and its warning signs ─────────────────────────────────────────────────────────────────

const SIGNS: Record<'body' | 'trainer' | 'numbers' | 'supplement', (p: Player) => [string, string]> = {
  body: (p: Player) => [__i18n_k("league.scandals.sIGNS.body.3c5e1502", { name: p.name }), __i18n_k("league.scandals.sIGNS.body.b3c63475", { name: iga(p.name) })],
  trainer: (p: Player) => [__i18n_k("league.scandals.sIGNS.trainer.f97f7aed", { name: p.name }), __i18n_k("league.scandals.sIGNS.trainer.3b1e355e", { name: iga(p.name) })],
  numbers: (p: Player) =>
    isPitcher(p)
      ? [__i18n_k("league.scandals.sIGNS.numbers.acf9d4fb", { name: p.name }), __i18n_k("league.scandals.sIGNS.numbers.312387e8", { name: p.name })]
      : [__i18n_k("league.scandals.sIGNS.numbers.d7c98d66", { name: p.name }), __i18n_k("league.scandals.sIGNS.numbers.53b37b78", { name: p.name })],
  supplement: (p: Player) => [__i18n_k("league.scandals.sIGNS.supplement.621b0d2b", { name: p.name }), __i18n_k("league.scandals.sIGNS.supplement.2c3e5417", { name: p.name })],
};
/** Signs of a real user, in order; a clean player under a rumour shows the first two at most. */
const REAL_SIGNS: (keyof typeof SIGNS)[] = ['body', 'trainer', 'numbers', 'supplement'];

function dopingDay(s: LeagueState, date: string, r: () => number, k: number) {
  const u = s.user!;
  // Someone starts, or a rumour starts about someone clean.
  for (const real of [true, false]) {
    if (r() >= ((real ? S.rates.doping : S.doping.rumours) / S.gameDays) * (real ? k : 1)) continue;
    const p = candidate(s, real ? 'doping' : 'rumour', r);
    if (!p) continue;
    const life = (p.life ??= {});
    life.suspicion = { since: date, signs: 0, real, next: addDays(date, S.doping.firstSign[0] + Math.floor(r() * (S.doping.firstSign[1] - S.doping.firstSign[0]))) };
    if (real) {
      // It works, for now.
      const tool = isPitcher(p) ? 'stuff' : 'power';
      p.hidden.current[tool] = (p.hidden.current[tool] ?? 40) + S.doping.boost;
      life.suspicion.boost = { tool, delta: S.doping.boost };
    }
  }
  for (const p of orgPlayers(s, u.teamId)) {
    const x = p.life?.suspicion;
    if (!x) continue;
    // The next sign.
    const most = x.real ? REAL_SIGNS.length : S.doping.rumourSigns;
    if (x.signs < most && x.next <= date) {
      const sign = REAL_SIGNS[x.signs]!;
      const [title, body] = SIGNS[sign](p);
      addNews(s, { id: `sign-${p.id}-${date}`, date, kind: 'interview', title, body, quotes: [], facts: { 선수: p.name }, players: [p.id], mine: true });
      x.signs++;
      x.next = addDays(date, S.doping.between[0] + Math.floor(r() * (S.doping.between[1] - S.doping.between[0])));
    }
    // A rumour about a clean player dies down.
    if (!x.real && date >= addDays(x.since, S.doping.rumourDays)) delete p.life!.suspicion;
    // The KBO's testers come by.
    else if (x.real && date >= addDays(x.since, S.doping.graceDays) && r() < S.doping.test) {
      stopDoping(p);
      incident(s, p, 'doping', date, r);
    }
  }
}

function stopDoping(p: Player) {
  const x = p.life?.suspicion;
  if (x?.boost) p.hidden.current[x.boost.tool] = (p.hidden.current[x.boost.tool] ?? 40) - x.boost.delta;
  delete p.life!.suspicion;
}

/** Why the club cannot test him now, or null. */
export function checkInspect(s: LeagueState, id: PlayerId): string | null {
  const u = s.user;
  const p = s.players[id];
  if (!u || !p || p.teamId !== u.teamId) return __i18n_k("league.scandals.checkInspect.3b1be98c");
  if (u.fund < S.doping.inspectCost) return __i18n_k("league.scandals.checkInspect.2ffbf119");
  if (p.life?.inspected === s.year) return __i18n_k("league.scandals.checkInspect.215d2598");
  return null;
}

/** The club's own test: it stops a user quietly, or hurts a clean player's feelings. */
export function inspect(s: LeagueState, id: PlayerId) {
  if (checkInspect(s, id)) return;
  const u = s.user!;
  const p = s.players[id]!;
  const date = s.phase === 'regular' ? (s.schedule[s.next]?.date ?? `${s.year}-10-01`) : `${s.year}-12-15`;
  u.fund -= S.doping.inspectCost;
  u.ledger.push({ year: s.year, label: __i18n_k("league.scandals.inspect.label.688d712a", { name: p.name }), amount: -S.doping.inspectCost });
  const life = (p.life ??= {});
  life.inspected = s.year;
  const caught = !!life.suspicion?.real;
  if (caught) stopDoping(p);
  else delete life.suspicion;
  life.fans = Math.max(-30, (life.fans ?? 0) - (caught ? S.doping.caughtGrudge : S.doping.cleanGrudge));
  (life.events ??= []).push({ date, text: caught ? __i18n_k("league.scandals.inspect.text.18a3ec1c") : __i18n_k("league.scandals.inspect.text.fe9c91e2"), tone: caught ? 'bad' : undefined });
  (u.log ??= []).push({ year: s.year, text: __i18n_k("league.scandals.inspect.text.7fa58d25", { name: p.name, value: caught ? __i18n_k("league.scandals.inspect.text.f1932326") : __i18n_k("league.scandals.inspect.text.787a86b7") }) });
  addAlert(s, {
    id: `inspect-${p.id}-${s.year}`,
    date,
    kind: 'scandal',
    title: caught ? __i18n_k("league.scandals.inspect.title.9cc678a4", { name: p.name }) : __i18n_k("league.scandals.inspect.title.3465c656", { name: p.name }),
    lines: caught
      ? [__i18n_k("league.scandals.inspect.lines.30b56f4f"), __i18n_k("league.scandals.inspect.lines.0fb50f70")]
      : [__i18n_k("league.scandals.inspect.lines.78090110")],
    tone: caught ? 'good' : undefined,
    players: [p.id],
  });
}

// ── The incident, the penalty, the club's answer ─────────────────────────────────────────────────

const LABEL: Record<Offense, string> = {
  dui: __i18n_k("league.scandals.lABEL.dui.9c13f6aa"),
  doping: __i18n_k("league.scandals.lABEL.doping.a6e4dc21"),
  assault: __i18n_k("league.scandals.lABEL.assault.efa1416c"),
  fixing: __i18n_k("league.scandals.lABEL.fixing.0e7e07ce"),
  affair: __i18n_k("league.scandals.text.83d3556c"),
  abortion: __i18n_k("league.scandals.text.44626f52"),
  gambling: __i18n_k("league.scandals.text.9db193cb"),
  gangs: __i18n_k("league.scandals.text.0bd65bef"),
  schoolViolence: __i18n_k("league.scandals.text.f9ad59c6"),
  draftDodge: __i18n_k("league.scandals.text.6c1c41bd"),
  insubordination: __i18n_k("league.scandals.text.c7d06d6d"),
  fanQuarrel: __i18n_k("league.scandals.text.9ce1e89d"),
  narcotics: __i18n_k("league.scandals.text.75d0b2e7"),
  drunkBrawl: __i18n_k("league.scandals.text.af34a9e3"),
  drugs: __i18n_k("league.scandals.text.ef291265"),
  hazing: __i18n_k("league.scandals.text.3289ffa1"),
  abuse: __i18n_k("league.scandals.text.7736a978"),
};

/** The KBO's penalty for this offense and his record. */
function penalty(p: Player, offense: Offense, r: () => number, hid: boolean): { text: string; games?: number; years?: number; life?: boolean } {
  const n = (p.life?.offenses?.[offense] ?? 0) + 1;
  switch (offense) {
    case 'dui': {
      if (n >= 3) return { text: __i18n_k("league.scandals.penalty.text.1897ee5c"), life: true };
      if (n === 2) return { text: __i18n_k("league.scandals.penalty.text.2c245b7f"), years: 5 };
      const revoked = r() < S.dui.revoked;
      const extra = hid ? S.dui.hidingGames : 0;
      return revoked ? { text: __i18n_k("league.scandals.penalty.text.548064bd", { value: hid ? __i18n_k("league.scandals.penalty.text.95fa35e4") : '' }), years: 1, games: extra || undefined } : { text: __i18n_k("league.scandals.penalty.text.38afb355", { value: S.dui.games + extra, value2: hid ? __i18n_k("league.scandals.penalty.text.95fa35e4") : '' }), games: S.dui.games + extra };
    }
    case 'doping':
      if (n >= 3) return { text: __i18n_k("league.scandals.penalty.text.aa11e865"), life: true };
      return n === 2 ? { text: __i18n_k("league.scandals.penalty.text.81984ab3"), games: 144 } : { text: __i18n_k("league.scandals.penalty.text.c8c522fb"), games: 72 };
    case 'assault': {
      const bad = r() < S.assault.bad;
      return { text: __i18n_k("league.scandals.penalty.text.17b086a4", { value: bad ? S.assault.badGames : S.assault.games }), games: bad ? S.assault.badGames : S.assault.games };
    }
    case 'fixing':
      return { text: __i18n_k("league.scandals.penalty.text.22b60d7f"), life: true };
    // 2.0.28.
    case 'gambling':
      return n >= 2 ? { text: __i18n_k("league.scandals.text.57851fc3"), years: 1 } : { text: __i18n_k("league.scandals.text.b87c3929", { games: S.rareGames.gambling }), games: S.rareGames.gambling };
    case 'gangs':
      return { text: __i18n_k("league.scandals.text.b87c3929", { games: S.rareGames.gangs }), games: S.rareGames.gangs };
    case 'draftDodge':
      return { text: __i18n_k("league.scandals.text.6e61822d", { years: S.rareGames.draftDodgeYears }), years: S.rareGames.draftDodgeYears };
    case 'abortion':
      return { text: __i18n_k("league.scandals.text.a0878aca") };
    case 'affair':
    case 'schoolViolence':
      return { text: __i18n_k("league.scandals.text.9ecabb3d") };
    case 'insubordination':
      return { text: __i18n_k("league.scandals.text.41bd5cf9") };
    case 'fanQuarrel':
      return { text: __i18n_k("league.scandals.text.d4855beb") };
    case 'narcotics':
      return { text: __i18n_k("league.scandals.text.6e61822d", { years: 1 }), years: 1 };
    // 2.0.36.
    case 'drunkBrawl':
      return { text: __i18n_k("league.scandals.text.b87c3929", { games: S.rareGames.drunkBrawl }), games: S.rareGames.drunkBrawl };
    case 'hazing':
      return { text: __i18n_k("league.scandals.text.b87c3929", { games: S.rareGames.hazing }), games: S.rareGames.hazing };
    case 'drugs':
      return { text: __i18n_k("league.scandals.text.9a014a3d"), life: true };
    case 'abuse':
      return { text: __i18n_k("league.scandals.text.9ecabb3d") };
  }
}

/** It happened (or came out): the penalty, the news, the fans; a decision for the club unless he is gone for good. */
function incident(s: LeagueState, p: Player, offense: Offense, date: string, r: () => number, hid = false): boolean {
  const u = s.user!;
  const pen = penalty(p, offense, r, hid);
  const life = (p.life ??= {});
  (life.offenses ??= {})[offense] = (life.offenses[offense] ?? 0) + 1;
  life.fans = Math.max(-30, (life.fans ?? 0) - (S.fans[offense] ?? 0));
  (life.events ??= []).push({ date, text: `${LABEL[offense]} · ${pen.text}`, tone: 'bad' });
  clubState(s, u.teamId).interest -= S.clubMood[offense] ?? 0;
  addNews(s, {
    id: `scandal-${p.id}-${date}`,
    date,
    kind: 'move',
    title: `${short(s)} ${p.name}, ${LABEL[offense]}… ${pen.text}`,
    body: __i18n_k("league.scandals.incident.body.49591e7c", { short: short(s), name: iga(p.name), value: LABEL[offense], value2: offense === 'dui' && hid ? __i18n_k("league.scandals.incident.body.c41bcb51") : __i18n_k("league.scandals.incident.body.8f337d30"), text: pen.text, value3: pen.life ? __i18n_k("league.scandals.incident.body.9ffde087") : '' }),
    quotes: [{ who: __i18n_k("league.scandals.quotes.who.724cc77d"), role: 'fan', text: offense === 'fixing' ? __i18n_k("league.scandals.quotes.text.81459ace") : __i18n_k("league.scandals.quotes.text.48bd277f") }],
    facts: { 선수: p.name, 사유: LABEL[offense], 징계: pen.text },
    players: [p.id],
    mine: true,
  });
  addAlert(s, {
    id: `scandal-${p.id}-${date}`,
    date,
    kind: 'scandal',
    title: `${p.name} ${LABEL[offense]} · ${pen.text}`,
    lines: [__i18n_k("league.scandals.incident.lines.fb415c17", { text: pen.text }), pen.life ? __i18n_k("league.scandals.incident.lines.71803273") : __i18n_k("league.scandals.incident.lines.ec5cbb3e"), __i18n_k("league.scandals.incident.lines.db7a1f47")],
    tone: 'bad',
    players: [p.id],
  });
  if (pen.life) {
    leaveLeague(s, p, 'retired');
    delete s.suspended?.[p.id];
    return false;
  }
  // 2.0.28: an offense the KBO does not punish leaves him free to play (the club decides).
  if (pen.games || pen.years) (s.suspended ??= {})[p.id] = { reason: __i18n_k("league.scandals.incident.reason.df64fc10", { value: LABEL[offense] }), since: date, ...(pen.games ? { games: pen.games } : {}), ...(pen.years ? { until: addDays(date, 365 * pen.years) } : {}) };
  s.pending = { kind: 'scandal', id: p.id, offense, penalty: pen.text };
  return true;
}

/** The club's answer. */
/** 2.0.37: `voluntary` puts him on the voluntary retired list (voluntary.ts) — the club keeps his rights. */
export function resolveScandal(s: LeagueState, d: Extract<Decision, { kind: 'scandal' }>, chosen: 'release' | 'extra' | 'none' | 'voluntary', release: (id: PlayerId, how?: 'voluntary') => boolean) {
  const u = s.user!;
  const p = s.players[d.id]!;
  // A release the roster cannot take now (the first team's minimum) becomes a penalty of our own.
  const answer = (chosen === 'release' || chosen === 'voluntary') && !release(d.id, chosen === 'voluntary' ? 'voluntary' : undefined) ? 'extra' : chosen;
  const club = clubState(s, u.teamId);
  club.interest += S.answer[answer];
  const text = answer === 'voluntary' ? __i18n_k("league.scandals.text.88338b66") : answer === 'release' ? __i18n_k("league.scandals.resolveScandal.text.e16b5dd5") : answer === 'extra' ? __i18n_k("league.scandals.resolveScandal.text.8108135a", { extraGames: S.extraGames }) : __i18n_k("league.scandals.resolveScandal.text.a5cf5786");
  if (answer === 'extra') {
    const x = s.suspended?.[d.id];
    if (x) x.games = (x.games ?? 0) + S.extraGames;
  }
  (u.log ??= []).push({ year: s.year, text: __i18n_k("league.scandals.resolveScandal.text.16670818", { name: p.name, value: LABEL[d.offense as Offense], text: text }) });
  addNews(s, {
    id: `answer-${p.id}-${s.year}-${d.offense}`,
    date: s.phase === 'regular' ? (s.schedule[s.next]?.date ?? `${s.year}-10-01`) : `${s.year}-12-01`,
    kind: 'move',
    title: __i18n_k("league.scandals.resolveScandal.title.f3725815", { short: short(s), name: p.name, value: answer === 'voluntary' ? __i18n_k("league.scandals.text.1d116c4d") : answer === 'release' ? __i18n_k("league.scandals.resolveScandal.title.991ef114") : answer === 'extra' ? __i18n_k("league.scandals.resolveScandal.title.15c7ad7c") : __i18n_k("league.scandals.resolveScandal.title.3fb9d596") }),
    body: answer === 'none' ? __i18n_k("league.scandals.resolveScandal.body.b97ed44f", { short: eunneun(short(s)) }) : __i18n_k("league.scandals.resolveScandal.body.7e2cc384", { short: iga(short(s)), name: p.name, text: text }),
    quotes: [],
    facts: { 선수: p.name, 대응: text },
    players: [p.id],
    mine: true,
  });
}

/** The scouts' answer: release him for a life-changing offense, a penalty of our own otherwise. */
export const autoScandal = (d: Extract<Decision, { kind: 'scandal' }>): 'release' | 'extra' => (['dui', 'fixing', 'gambling', 'gangs', 'draftDodge', 'narcotics', 'drugs'].includes(d.offense) ? 'release' : 'extra');
