import { k as __i18n_k } from '../i18n/index';
import { noteMove } from './moves';
/* Players coming home from abroad (V0.7.3, RULES.md §6).
   - Posted players: the club that posted him keeps his rights (보류권), so a player who comes back to
     the KBO signs with that club only. After his major league deal ends he may come home each winter
     (more likely as he gets older); a few come back early. His years abroad age him as they would
     have at home. The club offers a free-agent style multi-year deal from his record and age; an AI
     club brings back anyone still useful, and if the user's club passes, another club may sign him.
   - 2.0.67 (the user's request): free agents who signed abroad (fa.ts) come home the same way after their deal, but
     nobody holds their rights: an AI club may sign one at once, else he is an unattached free agent any club may sign
     (시장 → 방출·자유계약), asking a free agent's money.
   - 2.0.67 (the user's request): a returnee signing a KBO deal starts his free agency over — four registered seasons to
     the next one, as after a free-agent deal.
   - Draftees who refused to sign and went abroad: most come back within a few years, and after the
     KBO's two-year wait (해외파 2년 유예) they enter the rookie draft like anyone else.
   How long players stay abroad and who comes back are game assumptions, drawn from the player's id
   (never the season's random streams). Only in a game with the player's club: the generated history
   keeps its players abroad. */
import { hashUnit, rng } from '../draftroom';
import type { Player, PlayerId, TeamId } from '../model/types';
import { marketValue } from './fa';
import { developPlayer, leaveLeague, removeFromRoster, rosterLimit, sign } from './offseason';
import { ageIn, currentValue, isForeign, keepValue } from './players';
import { registeredIds, type LeagueState } from './state';
import { moveNews } from './movenews';
import { addAlert } from './alerts';
import { leaveMlb, mlbWinter } from './mlb';

const R = {
  /** Chance a posted player comes home in a winter after his deal: base, per extra year, from 33. */
  afterDeal: 0.35,
  perYear: 0.15,
  older: 0.2,
  /** ...and in a winter while his deal still runs (released, or it did not work out). */
  early: 0.05,
  /** A star (grade 68+) is more likely to stay in the majors. */
  starStays: 0.6,
  maxAge: 38,
  /** An AI club brings back a returnee worth at least this much (keep value). */
  aiKeep: 40,
  /** A club other than his own signs a returnee whose rights were released, this often. */
  otherClub: 0.6,
  /** 2.0.67: an AI club signs a free agent home from abroad at once this often (if he is worth a place). */
  faAi: 0.5,
  /** Draftees abroad: chance they ever come back, and years abroad before they do (then two years' wait). */
  amateurReturn: 0.75,
  amateurYears: [2, 5] as const,
  wait: 2,
};

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Posted players still abroad: they have KBO seasons and a posting year. */
export function postedAbroad(s: LeagueState): Player[] {
  return Object.values(s.players).filter((p) => p.status === 'overseas' && p.service.postedIn !== undefined && !isForeign(p) && p.career.some((c) => !c.level));
}

/** Seasons his major league deal ran: the same scale posting.ts signs deals on (grade and age then). */
export function dealYears(p: Player): number {
  const g = p.scouting.current;
  const age = ageIn(p, p.service.postedIn! + 1);
  return Math.max(1, (g >= 68 ? 6 : g >= 63 ? 4 : 2) - (age >= 30 ? 1 : 0));
}

/** The club that posted him (his last KBO season's club). */
export const postingClub = (p: Player): TeamId | null => p.career.filter((c) => !c.level).at(-1)?.teamId ?? null;

/** Whether a posted player comes home this winter (after the season `year`). */
function comesHome(s: LeagueState, p: Player, year: number): boolean {
  const abroad = year - p.service.postedIn!;
  if (abroad < 1) return false;
  const deal = dealYears(p);
  const older = ageIn(p, year + 1) >= 33 ? R.older : 0;
  let chance = abroad >= deal ? R.afterDeal + R.perYear * (abroad - deal) + older : R.early;
  if (p.scouting.current >= 68) chance *= R.starStays;
  return hashUnit(`${s.seed}-home-${p.id}-${year}`) < chance;
}

/** His years abroad, one development season each (aging and growth as at home). */
function ageAbroad(s: LeagueState, p: Player, from: number, to: number, scale = 1) {
  for (let y = from; y <= to; y++) developPlayer(p, y, 0, rng(`${s.seed}|abroad|${y}|${p.id}`), scale);
}

export interface ReturnOffer {
  id: PlayerId;
  years: number;
  annual: number;
  /** Seasons he spent abroad. */
  abroad: number;
}

/** What his club offers: a free-agent style deal from his KBO record and age, moved by how his years abroad changed him. */
function offerFor(p: Player, next: number, before: number): { years: number; annual: number } {
  const base = marketValue(p, next);
  const k = clamp(1 + (currentValue(p) - before) * 0.04, 0.5, 1.2);
  return { years: base.years, annual: Math.round((base.annual * k) / 1000) * 1000 };
}

/** Signs a returnee with a club: a multi-year deal, and an article. 2.0.67: his free agency starts over (four seasons). */
export function signReturnee(s: LeagueState, p: Player, teamId: TeamId, o: ReturnOffer, next: number) {
  sign(s, p, teamId, { teamId, kind: 'freeAgent', signedIn: next - 1, signingBonus: 0, salaries: Array.from({ length: o.years }, (_, i) => ({ season: next + i, amount: o.annual })) });
  restartFreeAgency(p);
  moveNews(s, { type: 'returnee', teamId, id: p.id, years: o.years, annual: o.annual, abroad: o.abroad, own: teamId === postingClub(p) }, `${next - 1}-11-05`);
}

/** His rights released: another club with room may sign him, else he ends his career abroad. */
export function releaseReturnee(s: LeagueState, p: Player, o: ReturnOffer, next: number) {
  const own = postingClub(p);
  const clubs = s.teams.filter((t) => t.id !== own && t.id !== s.user?.teamId && s.rosters[t.id] && t.firstTeamFrom !== null && t.firstTeamFrom <= next && registeredIds(s, t.id).length < rosterLimit(next));
  if (clubs.length && keepValue(p, next) >= R.aiKeep && hashUnit(`${s.seed}-home-other-${p.id}-${next}`) < R.otherClub) {
    const to = clubs[Math.floor(hashUnit(`${s.seed}-home-club-${p.id}-${next}`) * clubs.length)]!;
    signReturnee(s, p, to.id, o, next);
  } else leaveLeague(s, p, 'retired');
}

/**
 * The winter's homecomings (called at the posting step with the player's club in the league): AI clubs
 * sign theirs; the user's club gets its own as a decision. Returns the user's offers.
 */
export function homecomings(s: LeagueState, next: number): ReturnOffer[] {
  const year = next - 1;
  const u = s.user;
  if (!u) return [];
  const mine: ReturnOffer[] = [];
  // 1.7.0: their season in the majors first (mlb.ts).
  mlbWinter(s, year);
  for (const p of postedAbroad(s)) {
    if (ageIn(p, next) > R.maxAge) {
      leaveMlb(p, year, 'ended');
      leaveLeague(s, p, 'retired');
      continue;
    }
    if (!comesHome(s, p, year)) continue;
    leaveMlb(p, year, 'back');
    const before = currentValue(p);
    ageAbroad(s, p, p.service.postedIn! + 1, year);
    const o = { id: p.id, ...offerFor(p, next, before), abroad: year - p.service.postedIn! };
    const club = postingClub(p);
    p.status = 'freeAgent';
    if (club === u.teamId) mine.push(o);
    else if (club && s.rosters[club] && keepValue(p, next) >= R.aiKeep) signReturnee(s, p, club, o, next);
    else releaseReturnee(s, p, o, next);
  }
  // 2.0.67: and the free agents abroad (no club holds their rights).
  freeAgentHomecomings(s, next);
  return mine;
}

/** 2.0.67 (the user's request): back from abroad and signed in the KBO, his free agency starts over — four registered
    seasons to the next (offseason.ts isFreeAgent), as after a free-agent deal. */
export function restartFreeAgency(p: Player) {
  if (p.mlb?.back !== undefined && p.career.some((c) => !c.level)) p.service.lastFreeAgencyAt = p.service.creditedSeasons;
}

/** 2.0.67: free agents who signed abroad (fa.ts) and are still there: KBO seasons, no posting, gone as a free agent. */
export function freeAgentsAbroad(s: LeagueState): Player[] {
  return Object.values(s.players).filter((p) => p.status === 'overseas' && p.mlb?.via === 'fa' && p.mlb.back === undefined && p.mlb.ended === undefined && !isForeign(p) && p.career.some((c) => !c.level));
}

/** 2.0.67: whether a free agent abroad comes home this winter: as a posted player, his own deal's years. */
function faComesHome(s: LeagueState, p: Player, year: number): boolean {
  const m = p.mlb!;
  const abroad = year - m.posted;
  if (abroad < 1) return false;
  const older = ageIn(p, year + 1) >= 33 ? R.older : 0;
  let chance = abroad >= m.years ? R.afterDeal + R.perYear * (abroad - m.years) + older : R.early;
  if (p.scouting.current >= 68) chance *= R.starStays;
  return hashUnit(`${s.seed}-fa-home-${p.id}-${year}`) < chance;
}

/** 2.0.67: the free agents abroad who come home this winter — an AI club signs one now and then, the rest are
    unattached free agents in the pool. Returns those who are free (for the alert). */
export function freeAgentHomecomings(s: LeagueState, next: number): Player[] {
  const year = next - 1;
  const free: Player[] = [];
  for (const p of freeAgentsAbroad(s)) {
    if (ageIn(p, next) > R.maxAge) continue;
    if (!faComesHome(s, p, year)) continue;
    leaveMlb(p, year, 'back');
    const before = currentValue(p);
    ageAbroad(s, p, p.mlb!.posted + 1, year);
    const o = { id: p.id, ...offerFor(p, next, before), abroad: year - p.mlb!.posted };
    p.status = 'freeAgent';
    p.teamId = null;
    p.contract = null;
    const clubs = s.teams.filter((t) => t.id !== s.user?.teamId && s.rosters[t.id] && t.firstTeamFrom !== null && t.firstTeamFrom <= next && registeredIds(s, t.id).length < rosterLimit(next));
    if (clubs.length && keepValue(p, next) >= R.aiKeep && hashUnit(`${s.seed}-fa-home-ai-${p.id}-${next}`) < R.faAi) {
      signReturnee(s, p, clubs[Math.floor(hashUnit(`${s.seed}-fa-home-club-${p.id}-${next}`) * clubs.length)]!.id, o, next);
    } else {
      (s.pool ??= []).push(p.id);
      free.push(p);
    }
  }
  if (s.user && free.length)
    addAlert(s, {
      id: `fa-home-${next}`,
      date: `${year}-11-05`,
      kind: 'move',
      title: __i18n_k("league.returnees.text.bf09ce39", { n: free.length }),
      lines: [...free.map((p) => `${p.name} · ${p.mlb!.club} · ${__i18n_k("league.returnees.text.2f1177fc", { n: year - p.mlb!.posted })}`), __i18n_k("league.returnees.text.20c811b6")],
      players: free.map((p) => p.id),
    });
  return free;
}

// ── Draftees who went abroad ─────────────────────────────────────────────────────────────────────

/** A draftee who refused to sign to go abroad: he leaves the league, and whether and when he comes back is set now. */
export function goAbroad(s: LeagueState, p: Player, year: number) {
  noteMove(s, p, 'abroad', p.teamId, null);
  removeFromRoster(s, p);
  p.teamId = null;
  p.contract = null;
  p.status = 'overseas';
  const back = hashUnit(`${s.seed}-abroad-back-${p.id}`) < R.amateurReturn;
  const [lo, hi] = R.amateurYears;
  const years = lo + Math.floor(hashUnit(`${s.seed}-abroad-years-${p.id}`) * (hi - lo + 1));
  // He leaves after this fall's draft; back after `years` seasons abroad, then the two-year wait, then the draft.
  p.abroad = { left: year, draft: back ? year + years + R.wait : null };
}

/** Draftees who went abroad and enter this draft: their years away age them, and they join the pool. */
export function draftReturnees(s: LeagueState, draftYear: number): Player[] {
  const out: Player[] = [];
  for (const p of Object.values(s.players)) {
    if (p.status !== 'overseas' || p.abroad?.draft !== draftYear) continue;
    const pro = draftYear - p.abroad.left - R.wait;
    ageAbroad(s, p, p.abroad.left + 1, p.abroad.left + pro); // pro seasons abroad
    ageAbroad(s, p, p.abroad.left + pro + 1, draftYear, 0.5); // the two-year wait (this year too: the draft is in the fall), training on his own
    p.status = 'amateur';
    p.proSince = draftYear + 1;
    delete p.origin.overallPick;
    p.education.pathText = __i18n_k("league.returnees.draftReturnees.b83df5aa", { pathText: p.education.pathText, value: p.abroad.left + 1, value2: draftYear - R.wait });
    out.push(p);
  }
  return out;
}

/** For tests and the tuning note: the draft year a draftee abroad comes back through. */
export const draftBackIn = (p: Player) => p.abroad?.draft ?? null;

// ── 2.0.67: straight abroad out of high school, then the draft ─────────────────────────────────────

/* 2.0.67 (the user's request: 최지만 같은 해외 직행 유턴파): now and then a draft has a player who went abroad straight out of
   high school without a KBO draft — a minor-league contract in America — played there for years, and comes back to
   the KBO through the rookie draft after the two-year wait (해외파 2년 유예). He is older (mid- to late twenties) and
   readier than the class, with a high ceiling once; he takes no signing bonus (a returnee from a club abroad). Over
   the wait he either did his military service (현역) or played for a domestic independent club (독립야구단; military
   still ahead). He is a high-school prospect of his own class who was not drafted then (his draft is on record now). */
export const DIRECT = {
  /** One in a draft this often, two more rarely. */
  chance: 0.35,
  second: 0.12,
  /** Seasons abroad before the wait. */
  years: [4, 7] as const,
  /** Picked among this many of his class's best high-school prospects. */
  top: 15,
  /** Share who served in the army over the wait (the rest at an independent club). */
  military: 0.5,
  /** Growth over the wait: in the army, at an independent club. */
  waitGrowth: { military: 0.3, independent: 0.7 },
};

export const isOverseasDirect = (p: Pick<Player, 'origin'>) => !!p.origin.overseasDirect;

/** This draft's players straight from abroad (none most years). */
export function overseasDirects(s: LeagueState, draftYear: number, classOf: (year: number) => Player[]): Player[] {
  const key = `${s.seed}|direct|${draftYear}`;
  const u = hashUnit(key);
  const count = u < DIRECT.chance * DIRECT.second ? 2 : u < DIRECT.chance ? 1 : 0;
  const out: Player[] = [];
  const names = new Set(Object.values(s.players).map((p) => p.name));
  for (let i = 0; i < count; i++) {
    const [lo, hi] = DIRECT.years;
    const years = lo + Math.floor(hashUnit(`${key}|${i}|years`) * (hi - lo + 1));
    const left = draftYear - R.wait - years;
    const cls = classOf(left)
      .filter((p) => p.origin.entryCategory === 'high-school' && !s.players[p.id] && !names.has(p.name))
      .sort((a, b) => b.scouting.futureValue - a.scouting.futureValue)
      .slice(0, DIRECT.top);
    const base = cls[Math.floor(hashUnit(`${key}|${i}|pick`) * cls.length)];
    if (!base) continue;
    const p = JSON.parse(JSON.stringify(base)) as Player;
    p.id = `${base.id}-od${draftYear}`;
    if (s.players[p.id]) continue;
    const army = hashUnit(`${key}|${i}|wait`) < DIRECT.military;
    // His seasons in the minors, then the wait.
    ageAbroad(s, p, left + 1, draftYear - R.wait);
    ageAbroad(s, p, draftYear - R.wait + 1, draftYear, army ? DIRECT.waitGrowth.military : DIRECT.waitGrowth.independent);
    if (army) p.service.military = 'served';
    delete p.amateur.intent;
    p.status = 'amateur';
    p.teamId = null;
    p.contract = null;
    p.proSince = draftYear + 1;
    p.origin = { ...p.origin, draftYear, entryCategory: 'overseasDirect', overseasDirect: { left, wait: army ? 'military' : 'independent' } };
    delete p.origin.overallPick;
    p.education.pathText = __i18n_k("league.returnees.text.eba102e3", {
      pathText: p.education.pathText,
      left: left + 1,
      back: draftYear - R.wait,
      wait: army ? __i18n_k("league.returnees.text.95eae9b0") : __i18n_k("league.returnees.text.6faa64e5"),
    });
    names.add(p.name);
    s.players[p.id] = p;
    out.push(p);
  }
  return out;
}
