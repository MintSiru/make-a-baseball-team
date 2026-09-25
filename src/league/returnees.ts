/* Players coming home from abroad (V0.7.3, RULES.md §6).
   - Posted players: the club that posted him keeps his rights (보류권), so a player who comes back to
     the KBO signs with that club only. After his major league deal ends he may come home each winter
     (more likely as he gets older); a few come back early. His years abroad age him as they would
     have at home. The club offers a free-agent style multi-year deal from his record and age; an AI
     club brings back anyone still useful, and if the user's club passes, another club may sign him.
   - Draftees who refused to sign and went abroad: most come back within a few years, and after the
     KBO's two-year wait (해외파 2년 유예) they enter the rookie draft like anyone else.
   How long players stay abroad and who comes back are game assumptions, drawn from the player's id
   (never the season's random streams). Only in a game with the player's club: the generated history
   keeps its players abroad. */
import { hashUnit, rng } from '../draftroom';
import type { Player, PlayerId, TeamId } from '../model/types';
import { faContract, marketValue } from './market';
import { developPlayer, leaveLeague, removeFromRoster, rosterLimit, sign } from './offseason';
import { ageIn, currentValue, isForeign, keepValue } from './players';
import { registeredIds, type LeagueState } from './state';
import { moveNews } from './movenews';

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

/** Signs a returnee with a club: a multi-year deal, and an article. */
export function signReturnee(s: LeagueState, p: Player, teamId: TeamId, o: ReturnOffer, next: number) {
  sign(s, p, teamId, faContract(teamId, next, { years: o.years, annual: o.annual }));
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
  for (const p of postedAbroad(s)) {
    if (ageIn(p, next) > R.maxAge) {
      leaveLeague(s, p, 'retired');
      continue;
    }
    if (!comesHome(s, p, year)) continue;
    const before = currentValue(p);
    ageAbroad(s, p, p.service.postedIn! + 1, year);
    const o = { id: p.id, ...offerFor(p, next, before), abroad: year - p.service.postedIn! };
    const club = postingClub(p);
    p.status = 'freeAgent';
    if (club === u.teamId) mine.push(o);
    else if (club && s.rosters[club] && keepValue(p, next) >= R.aiKeep) signReturnee(s, p, club, o, next);
    else releaseReturnee(s, p, o, next);
  }
  return mine;
}

// ── Draftees who went abroad ─────────────────────────────────────────────────────────────────────

/** A draftee who refused to sign to go abroad: he leaves the league, and whether and when he comes back is set now. */
export function goAbroad(s: LeagueState, p: Player, year: number) {
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
    p.education.pathText = `${p.education.pathText} → ${p.abroad.left + 1}년 해외 진출 → ${draftYear - R.wait}년 복귀 (2년 유예)`;
    out.push(p);
  }
  return out;
}

/** For tests and the tuning note: the draft year a draftee abroad comes back through. */
export const draftBackIn = (p: Player) => p.abroad?.draft ?? null;
