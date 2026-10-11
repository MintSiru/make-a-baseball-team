import { k as __i18n_k } from '../i18n/index';
/* The free-agent negotiation (V0.8, RULES.md §4 and §9). From the day after the list is published every club
   may talk to every free agent (no exclusive window since 2016). An offer has a signing bonus, the same salary
   each guaranteed season, incentives, perhaps a period option ("2+1", an opt-out) and, from the user's club,
   promises. Each player wants a price and has demands of his own (years, the bonus, a starting job, a stronger
   club, his home town, an opt-out). Once an offer is good enough he takes a few days to weigh it, lets the
   other bidders know, and signs with the best; with nothing acceptable his price falls as the winter goes on.
   On the day before camp everyone left takes what is there.

   The market runs in rounds a few days apart; the user's club makes and changes its offers between rounds.
   Compensation follows each signing as before (market.ts). Money in 만 원. */
import { rng } from '../draftroom';
import type { FaPromise, FaSpot, FaTerms, IncentiveKind, Player, PlayerId, TeamId } from '../model/types';
import { EXPANSION_DEFAULTS, minimumSalaryFor, salaryCapFor } from '../rules/kbo2026';
import { addAlert } from './alerts';
import { bonusShare, renewSalary, salaryIn } from './contracts';
import { eulreul, iga, ro, wagwa } from './josa';
import { clubState } from './fans';
import { aiCompensation, compensationCash, externalLimit, faGrades, moneyFor, parentGiftFor, projectedPayroll, protectedBy, type FaGrade, type FaQueueItem } from './market';
import { moveNews } from './movenews';
import { freeAgentsFor, removeFromRoster } from './offseason';
import { ageIn, currentValue, isForeign, isPitcher, keepValue } from './players';
import { firstTeamIds, orgPlayers, registeredIds, type LeagueState } from './state';
import { FA, MARKET, DIFFICULTY } from './tuning';
import { gmAppetite, gmOf } from './twelve';
import { crossing } from './rivalry';
import { farewell } from './life';
import { traitsOf } from './traits';

// ── Offers ───────────────────────────────────────────────────────────────────────────────────────

export interface FaOffer {
  years: number;
  /** Signing bonus: counted in the payroll budget and the salary cap spread over the guaranteed seasons. */
  bonus: number;
  /** Salary each guaranteed season. */
  annual: number;
  /** Incentives over the guaranteed seasons. */
  options: number;
  /** Extra seasons at the same salary after the guaranteed ones: the club's option, or the player's. */
  extra?: { years: number; holder: 'club' | 'player' };
  /** The user's club only. */
  promises?: FaPromise[];
  /** The user's club (V0.8.1): the most guaranteed money it will go to. Each round the offer is raised, within
      this and the budget, to what he would take and past the best rival offer. */
  ceiling?: number;
  /** The user's club (V0.8.1): the bonus is paid at once from the fund, outside the payroll budget. */
  prepaid?: boolean;
}

export interface FaBid extends FaOffer {
  day: number;
}

export type FaDemand =
  | { kind: 'years'; min: number }
  | { kind: 'bonus'; share: number }
  | { kind: 'starter' }
  | { kind: 'reinforce'; spot: FaSpot }
  | { kind: 'contender' }
  | { kind: 'hometown'; region: string }
  | { kind: 'optOut' };

/** One free agent's winter. */
export interface FaTalk {
  id: PlayerId;
  from: TeamId;
  grade: FaGrade;
  /** No compensation: his period option was declined or he opted out. */
  free?: boolean;
  /** What the market would call a fair deal for him. */
  price: FaOffer;
  /** What he asks (in value, see offerValue), and what he takes today. */
  ask: number;
  floor: number;
  demands: FaDemand[];
  /** How much more his own club's offer is worth to him (a share). */
  loyalty: number;
  /** Days he weighs an acceptable offer. */
  patience: number;
  offers: Record<TeamId, FaBid>;
  /** AI clubs that want him: the round they come in, their first offer and the most they pay (× the market's guaranteed money). Hidden. */
  interest: Record<TeamId, { enter: number; open: number; most: number }>;
  /** Weighing an acceptable offer: he decides on this market day. */
  decideOn?: number;
  signed?: { teamId: TeamId; day: number; offer: FaOffer };
  /** Nobody signed him: he retired. */
  gone?: boolean;
  /** What he told the user's club, latest last; `said` keeps the last message so it is not repeated. */
  notes: { day: number; text: string; tone?: 'good' | 'bad' }[];
  said?: string;
  /** The user's club offered at some point (the winter's summary). */
  courted?: boolean;
}

export interface FaMarket {
  /** The winter (the season just played). */
  year: number;
  /** The next round to play, an index into FA.rounds. */
  round: number;
  /** Outside signings a club may make, and the user's club (three in its founding winter). */
  limit: number;
  userLimit: number;
  /** The user's club signs without compensation this winter (its founding winter, NC precedent). */
  userFree: boolean;
  /** The twelfth club in its founding winter (V0.9): three outside signings, no compensation. */
  newClub?: TeamId;
  talks: Record<PlayerId, FaTalk>;
  /** Best first. */
  order: PlayerId[];
  signedOut: Record<TeamId, number>;
  news: { day: number; text: string; mine?: boolean }[];
  /** The owner's free agent (V0.7.7): the owner pays a deal of up to `total` guaranteed. */
  gift?: { id: PlayerId; total: number; years: number };
  /** The user asked to play one round, until news of the club's talks, or to the end. */
  run?: 'round' | 'news' | 'close';
  closed?: boolean;
  /** Who the user's club had at each spot when the market opened (the yardstick of a reinforce promise). */
  baseline?: Record<FaSpot, PlayerId[]>;
}

export const guaranteed = (o: FaOffer) => o.bonus + o.annual * o.years;
/** The headline figure: guaranteed money, incentives and the option seasons' salary ("최대"). */
export const offerTotal = (o: FaOffer) => guaranteed(o) + o.options + (o.extra ? o.annual * o.extra.years : 0);

/** What an offer is worth to the player, before his demands: the bonus a little above salary, incentives at half. */
export function offerValue(o: FaOffer) {
  const V = FA.value;
  const extra = o.extra ? o.annual * o.extra.years * (o.extra.holder === 'player' ? V.playerOption : V.clubOption) : 0;
  return o.bonus * V.bonus + o.annual * o.years + o.options * V.options + extra;
}

const round1000 = (x: number) => Math.max(0, Math.round(x / 1000) * 1000);
const round100 = (x: number) => Math.max(0, Math.round(x / 100) * 100);
const lerp = ([a, b]: readonly [number, number], t: number) => a + (b - a) * t;

/** Recent WAR, the last three first-team seasons weighted 1:2:3. */
function recentWar(p: Player) {
  const recs = p.career.filter((r) => !r.level).slice(-3);
  if (!recs.length) return 0;
  const w = recs.map((_, i) => i + 1);
  return recs.reduce((a, r, i) => a + r.war * w[i]!, 0) / w.reduce((a, b) => a + b, 0);
}

/** Bonus share of the guaranteed money that is usual for a deal this size (0..1 picks within the range). */
export function usualBonusShare(g: number, t = 0.5) {
  return lerp(FA.bonus.find((b) => g >= b.from)!.share, t);
}

/** Splits guaranteed money into bonus and salary over `years`. */
export function splitOffer(g: number, years: number, share: number, options: number, next: number, extra?: FaOffer['extra']): FaOffer {
  const bonus = round1000(g * share);
  const annual = Math.max(minimumSalaryFor(next), (g - bonus) / years >= 10000 ? round1000((g - bonus) / years) : round100((g - bonus) / years));
  return { years, bonus, annual, options: round1000(options), ...(extra ? { extra } : {}) };
}

/** The same offer at a different guaranteed total (bonus, salary and incentives in proportion). */
export function scaleOffer(o: FaOffer, g: number, next: number): FaOffer {
  const k = g / Math.max(1, guaranteed(o));
  const share = o.bonus / Math.max(1, guaranteed(o));
  const out: FaOffer = { ...o, ...splitOffer(g, o.years, share, o.options * k, next, o.extra) };
  return out;
}

/**
 * What the market calls a fair deal: a season's worth from recent WAR (less with age), the usual length for
 * his age, incentives of about a tenth on top, the usual bonus share for the size.
 */
export function faPrice(p: Player, next: number): FaOffer {
  const P = FA.price;
  const war = recentWar(p);
  const age = ageIn(p, next);
  let season = P.base + P.perWar * Math.max(0, war);
  if (age > P.ageFrom) season *= Math.max(0.5, 1 - P.perAge * (age - P.ageFrom));
  season = Math.min(P.max, Math.max(P.min, season));
  let years = age <= 31 ? 4 : age <= 33 ? 3 : age <= 35 ? 2 : 1;
  if (war >= 4 && age >= 32) years = Math.min(4, years + 1);
  const options = lerp(FA.options, 0.4);
  const g = (season * years) / (1 + options);
  return splitOffer(g, years, usualBonusShare(g), g * options, next);
}

/** The guaranteed-money-per-season the market pays him (for the salary talks' extensions and the scouts). */
export function marketValue(p: Player, next: number) {
  const x = faPrice(p, next);
  return { annual: round1000(guaranteed(x) / x.years), years: x.years };
}

// ── Clubs as he sees them ────────────────────────────────────────────────────────────────────────

const SPOT_LABEL: Record<FaSpot, string> = { SP: __i18n_k("league.fa.sPOT_LABEL.sP.c787908f"), RP: __i18n_k("league.fa.sPOT_LABEL.rP.5b8607a3"), C: __i18n_k("league.fa.sPOT_LABEL.c.5f31470d"), IF: __i18n_k("league.fa.sPOT_LABEL.iF.0c733fda"), OF: __i18n_k("league.fa.sPOT_LABEL.oF.aa487065") };
export const spotLabel = (s: FaSpot) => SPOT_LABEL[s];

const spotOf = (p: Player): FaSpot =>
  isPitcher(p) ? (p.role === 'SP' ? 'SP' : 'RP') : p.position === 'C' ? 'C' : p.position === 'LF' || p.position === 'CF' || p.position === 'RF' ? 'OF' : 'IF';

/** A club's strength at a spot: the average of its best (5 starters, 5 relievers, 1 catcher, 4 infielders, 3 outfielders). */
function spotStrength(s: LeagueState, teamId: TeamId, spot: FaSpot) {
  const n = { SP: 5, RP: 5, C: 1, IF: 4, OF: 3 }[spot];
  const xs = registeredIds(s, teamId)
    .map((id) => s.players[id]!)
    .filter((p) => spotOf(p) === spot)
    .map(currentValue)
    .sort((a, b) => b - a)
    .slice(0, n);
  while (xs.length < n) xs.push(35);
  return xs.reduce((a, b) => a + b, 0) / n;
}

const clubsOf = (s: LeagueState, next: number) => {
  const ids = firstTeamIds(s, next);
  const u = s.user?.teamId;
  return u && !ids.includes(u) ? [...ids, u] : ids;
};

/** The club is in the top half of the league at the spot. */
export function strongAt(s: LeagueState, teamId: TeamId, spot: FaSpot, next: number) {
  const mine = spotStrength(s, teamId, spot);
  const clubs = clubsOf(s, next);
  const better = clubs.filter((t) => t !== teamId && spotStrength(s, t, spot) > mine).length;
  return better < Math.ceil(clubs.length / 2);
}

/** He would start there: the best at his position, among the five best starters or the three best relievers. */
export function wouldStart(s: LeagueState, teamId: TeamId, p: Player) {
  const mates = registeredIds(s, teamId)
    .map((id) => s.players[id]!)
    .filter((x) => x.id !== p.id);
  const me = currentValue(p);
  if (isPitcher(p)) {
    const same = mates.filter((x) => x.role === p.role && currentValue(x) > me).length;
    return same < (p.role === 'SP' ? 5 : 3);
  }
  return !mates.some((x) => !isPitcher(x) && x.position === p.position && currentValue(x) > me + 1);
}

/** Last season's place (the last place for a club with none). */
function lastRank(s: LeagueState, teamId: TeamId, next: number) {
  const table = s.history.at(-1)?.table ?? [];
  return table.find((r) => r.teamId === teamId)?.rank ?? clubsOf(s, next).length;
}

/** The club is his home town's: its region or city is where he went to school or was born. */
export function hometownClub(s: LeagueState, teamId: TeamId, region: string, birthplace = '') {
  const team = s.teams.find((t) => t.id === teamId);
  if (!team) return false;
  const parts = team.region.split('·');
  return parts.some((x) => region.split('·').includes(x) || birthplace.startsWith(x));
}

/** Broken promises in recent winters: every free agent trusts the user's club this much less (a share). */
export function promiseDoubt(s: LeagueState, year: number) {
  const broken = (s.user?.promises ?? []).filter((x) => !x.kept && x.year > year - FA.promise.winters).length;
  return broken * FA.promise.trust;
}

export interface Fit {
  /** Multiplier on the offer's value. */
  k: number;
  /** What he says about it, one line per demand not met (or met by a promise). */
  wants: string[];
  good: string[];
}

/** How an offer from a club fits what he wants. */
export function fitOf(s: LeagueState, t: FaTalk, teamId: TeamId, o: FaOffer, next: number): Fit {
  const p = s.players[t.id]!;
  const D = FA.demand;
  const user = teamId === s.user?.teamId;
  const promised = (x: FaPromise) => user && !!o.promises?.includes(x);
  // A promise from a club that broke promises lately counts for less.
  const doubt = user ? promiseDoubt(s, next - 1) : 0;
  let k = 1;
  const wants: string[] = [];
  const good: string[] = [];
  for (const d of t.demands) {
    switch (d.kind) {
      case 'years': {
        const years = o.years + (o.extra?.holder === 'player' ? o.extra.years : 0);
        if (years < d.min) {
          k -= D.yearShort * (d.min - years);
          wants.push(__i18n_k("league.fa.fitOf.b5b67806", { min: d.min }));
        }
        break;
      }
      case 'bonus': {
        const share = o.bonus / Math.max(1, guaranteed(o));
        if (share + 0.005 < d.share) {
          k -= D.bonusShort * (d.share - share);
          wants.push(__i18n_k("league.fa.fitOf.20e6fcdf", { value: Math.round(d.share * 100) }));
        }
        break;
      }
      case 'starter':
        if (wouldStart(s, teamId, p)) good.push(__i18n_k("league.fa.fitOf.5f5a2690"));
        else if (promised('starter')) {
          k -= D.starter * doubt * 3;
          good.push(__i18n_k("league.fa.fitOf.3d5768bb"));
        } else {
          k -= D.starter;
          wants.push(__i18n_k("league.fa.fitOf.514627f3"));
        }
        break;
      case 'reinforce':
        if (strongAt(s, teamId, d.spot, next)) good.push(__i18n_k("league.fa.fitOf.9721a6ce", { value: SPOT_LABEL[d.spot] }));
        else if (promised('reinforce')) {
          k -= D.reinforce * doubt * 3;
          good.push(__i18n_k("league.fa.fitOf.6641ecba", { value: SPOT_LABEL[d.spot] }));
        } else {
          k -= D.reinforce;
          wants.push(__i18n_k("league.fa.fitOf.e033352d", { value: SPOT_LABEL[d.spot] }));
        }
        break;
      case 'contender': {
        const rank = lastRank(s, teamId, next);
        const clubs = clubsOf(s, next).length;
        if (rank <= 3) {
          k += D.contender.top;
          good.push(__i18n_k("league.fa.fitOf.ae6842e6"));
        } else if (rank > clubs - 3) {
          k += D.contender.low;
          wants.push(__i18n_k("league.fa.fitOf.8a670afe"));
        }
        break;
      }
      case 'hometown':
        if (hometownClub(s, teamId, d.region, p.birthplace)) {
          k += D.hometown;
          good.push(__i18n_k("league.fa.fitOf.6107d8d8"));
        }
        break;
      case 'optOut':
        if (o.extra?.holder !== 'player') {
          k -= D.optOut;
          wants.push(__i18n_k("league.fa.fitOf.c74e0e40"));
        } else good.push(__i18n_k("league.fa.fitOf.3c8880c5"));
        break;
    }
  }
  if (teamId === t.from) k += t.loyalty;
  if (user) k += DIFFICULTY.faFit[s.user!.settings.difficulty] - doubt;
  return { k, wants, good };
}

/** An offer's worth to him from this club, demands included. */
export const utility = (s: LeagueState, t: FaTalk, teamId: TeamId, o: FaOffer, next: number) => offerValue(o) * fitOf(s, t, teamId, o, next).k;

/** The best offer on the table for him, or null. */
function leader(s: LeagueState, t: FaTalk, next: number) {
  let best: { teamId: TeamId; u: number } | null = null;
  for (const teamId of Object.keys(t.offers).sort()) {
    const u = utility(s, t, teamId, t.offers[teamId]!, next);
    if (!best || u > best.u + 1e-6 || (Math.abs(u - best.u) <= 1e-6 && teamId === t.from)) best = { teamId, u };
  }
  return best;
}

export interface Reaction {
  /** The offer's worth to him against what he takes today (1 = enough). */
  ratio: number;
  band: 'great' | 'ok' | 'short' | 'far';
  label: string;
  fit: Fit;
  /** He is weighing offers and another club's is better (how much, as a share). */
  behind?: number;
}

/** How he would take an offer from the user's club, as the scouts hear it. */
export function reaction(s: LeagueState, m: FaMarket, t: FaTalk, o: FaOffer, next: number): Reaction {
  const me = s.user!.teamId;
  const fit = fitOf(s, t, me, o, next);
  const u = offerValue(o) * fit.k;
  const ratio = u / t.floor;
  const band = ratio >= FA.overwhelm ? 'great' : ratio >= 1 ? 'ok' : ratio >= 0.9 ? 'short' : 'far';
  const label = { great: __i18n_k("league.fa.label.great.4559b432"), ok: __i18n_k("league.fa.label.ok.f4469b6f"), short: __i18n_k("league.fa.label.short.ee34a92c"), far: __i18n_k("league.fa.label.far.2287f09b") }[band];
  const others = Object.entries(t.offers).filter(([id]) => id !== me);
  const best = others.reduce((a, [id, x]) => Math.max(a, utility(s, t, id, x, next)), 0);
  const behind = t.decideOn !== undefined && best > u ? best / u - 1 : undefined;
  return { ratio, band, label, fit, ...(behind !== undefined ? { behind } : {}) };
}

/** An offer shaped to what he wants today: his years, his bonus share, promises for the demands the club
    cannot meet otherwise, priced so it just reaches his floor (the scouts' "meet his terms"). */
export function meetTerms(s: LeagueState, m: FaMarket, t: FaTalk, next: number, margin = 1.01): FaOffer {
  const me = s.user!.teamId;
  const p = s.players[t.id]!;
  let years = t.price.years;
  let share = t.price.bonus / Math.max(1, guaranteed(t.price));
  let extra: FaOffer['extra'];
  const promises: FaPromise[] = [];
  for (const d of t.demands) {
    if (d.kind === 'years') years = Math.max(years, d.min);
    if (d.kind === 'bonus') share = Math.max(share, d.share);
    if (d.kind === 'optOut') extra = { years: 2, holder: 'player' };
    if (d.kind === 'starter' && !wouldStart(s, me, p)) promises.push('starter');
    if (d.kind === 'reinforce' && !strongAt(s, me, d.spot, next)) promises.push('reinforce');
  }
  const optShare = t.price.options / Math.max(1, guaranteed(t.price));
  const shape = (g: number): FaOffer => ({ ...splitOffer(g, years, share, g * optShare, next, extra), ...(promises.length ? { promises } : {}) });
  // Value is linear in the guaranteed money: scale once, then round.
  const unit = shape(guaranteed(t.price));
  const k = (t.floor * margin) / Math.max(1, utility(s, t, me, unit, next));
  return shape(guaranteed(t.price) * k);
}

/** An offer he signs at once (V0.8.1): his terms, priced over what he takes outright and past the best rival offer. */
export function winTerms(s: LeagueState, m: FaMarket, t: FaTalk, next: number): FaOffer {
  const me = s.user!.teamId;
  const base = meetTerms(s, m, t, next);
  const rival = Object.entries(t.offers)
    .filter(([id]) => id !== me)
    .reduce((a, [id, o]) => Math.max(a, utility(s, t, id, o, next)), 0);
  const want = Math.max(t.floor * FA.overwhelm * 1.01, rival * 1.03);
  return scaleOffer(base, (guaranteed(base) * want) / Math.max(1, utility(s, t, me, base, next)), next);
}

// ── Opening the market ───────────────────────────────────────────────────────────────────────────

/** What an AI club's offer looks like at `k` × the market's guaranteed money. */
function aiOffer(t: FaTalk, p: Player, k: number, r: () => number, next: number): FaOffer {
  const g = guaranteed(t.price) * k;
  let years = t.price.years;
  const want = t.demands.find((d) => d.kind === 'years');
  if (want && want.kind === 'years' && r() < 0.5) years = Math.max(years, want.min);
  const bonus = t.demands.find((d) => d.kind === 'bonus');
  const share = Math.max(usualBonusShare(g, r()), bonus && bonus.kind === 'bonus' && r() < 0.5 ? bonus.share : 0);
  const extra: FaOffer['extra'] =
    t.demands.some((d) => d.kind === 'optOut') && r() < 0.35 ? { years: 2, holder: 'player' } : ageIn(p, next) >= 34 && r() < FA.ai.clubOption ? { years: 1, holder: 'club' } : undefined;
  return splitOffer(g, years, share, g * lerp(FA.options, r()), next, extra);
}

/** His demands, from his character, age, standing and club (deterministic per player and winter). */
function demandsFor(s: LeagueState, p: Player, price: FaOffer, next: number, r: () => number): FaDemand[] {
  const age = ageIn(p, next);
  const star = p.scouting.current >= 60;
  const who = p.personality;
  const out: FaDemand[] = [];
  const chance = (base: number, ...more: [boolean, number][]) => r() < base + more.reduce((a, [on, x]) => a + (on ? x : 0), 0);
  if (chance(0.25, [age >= 31, 0.35], [who === '꾸준함을 믿는 성실형', 0.2])) out.push({ kind: 'years', min: Math.min(6, price.years + (r() < 0.35 ? 1 : 0)) });
  if (chance(0.3, [guaranteed(price) >= 150000, 0.15], [who === '분석을 즐기는 연구형', 0.25])) out.push({ kind: 'bonus', share: Math.round(usualBonusShare(guaranteed(price), 0.6 + r() * 0.4) * 20) / 20 });
  if (chance(0.15, [p.scouting.current < 58, 0.2], [who === '말보다 행동하는 실천형', 0.3])) out.push({ kind: 'starter' });
  if (chance(0.12, [who === '책임감 강한 리더', 0.35], [age >= 32, 0.1])) {
    const spots: FaSpot[] = isPitcher(p) ? (p.role === 'SP' ? ['RP', 'C'] : ['SP', 'C']) : ['SP', 'RP'];
    out.push({ kind: 'reinforce', spot: spots[Math.floor(r() * spots.length)]! });
  }
  if (chance(0.12, [who === '승부욕 강한 도전자', 0.3], [who === '큰 무대를 즐기는 대담형', 0.2], [age >= 32, 0.12])) out.push({ kind: 'contender' });
  if (chance(0.15, [who === '차분한 노력파', 0.2], [who === '밝은 분위기 메이커', 0.2])) {
    const region = p.education.region;
    if (s.teams.some((t) => s.rosters[t.id] && hometownClub(s, t.id, region, p.birthplace))) out.push({ kind: 'hometown', region });
  }
  if (age <= 31 && star && chance(0.2, [who === '큰 무대를 즐기는 대담형', 0.25])) out.push({ kind: 'optOut' });
  // Three things at most besides the money.
  return out.slice(0, 3);
}

/** What an offer counts against next season's cap: salary, the bonus spread, incentives half earned. */
export const capHit = (o: FaOffer) => o.annual + o.bonus / o.years + (o.options / o.years) * 0.5;

/** Room under the salary cap next season: salaries set or estimated (a renewal for domestic players, this
    season's pay for foreign players still to be re-signed or replaced) and bonuses spread. Free agents still on
    the market (`without`) are left out: whoever signs them counts them then. */
export function capRoomFor(s: LeagueState, teamId: TeamId, next: number, without?: Set<PlayerId>) {
  const pay = orgPlayers(s, teamId)
    .filter((p) => !without?.has(p.id))
    .reduce((a, p) => a + (salaryIn(p, next) || (isForeign(p) ? salaryIn(p, next - 1) : renewSalary(p, next))) + bonusShare(p, next), 0);
  return salaryCapFor(next) - pay;
}

/** How much better he is than what the club has at his spot (public grades). */
function improvement(s: LeagueState, teamId: TeamId, p: Player) {
  const mates = registeredIds(s, teamId)
    .map((id) => s.players[id]!)
    .filter((x) => x.id !== p.id && !isForeign(x));
  let bench: number;
  if (isPitcher(p)) {
    const same = mates.filter((x) => x.role === p.role).map(currentValue).sort((a, b) => b - a);
    bench = same[p.role === 'SP' ? 3 : 5] ?? 40;
  } else {
    const same = mates.filter((x) => x.position === p.position).map(currentValue).sort((a, b) => b - a);
    bench = same[0] ?? 40;
  }
  return currentValue(p) - bench;
}

/** The chance an AI club wants him at all, and how much (× the market price) it would pay at most. */
function appetite(s: LeagueState, teamId: TeamId, t: FaTalk, p: Player, next: number, onMarket: Set<PlayerId>) {
  const gain = improvement(s, teamId, p);
  const own = teamId === t.from;
  const keep = keepValue(p, next);
  let chance = own ? (keep >= FA.ai.keepOwn.value ? FA.ai.keepOwn.chance : MARKET.stay * (ageIn(p, next) <= 32 ? 1 : 0.8) * 0.6) : MARKET.interest.base + gain * MARKET.interest.perGain;
  // A club without room under the cap seldom goes after someone else's free agent (its offers are checked against the cap anyway).
  const cost = guaranteed(t.price) / t.price.years;
  if (!own && capRoomFor(s, teamId, next, onMarket) < cost) chance *= MARKET.interest.overCap;
  if (!own && ageIn(p, next) >= 34) chance *= 0.6;
  // The twelfth club's front office (V0.9) goes after free agents in its own way; in its founding winter it
  // owes no compensation.
  const style = gmAppetite(gmOf(s, teamId), ageIn(p, next));
  chance = Math.max(0, Math.min(own ? 1 : MARKET.interest.max, chance * (own ? 1 : style.chance)));
  const need = Math.max(0.8, Math.min(1.25, 0.9 + gain * 0.02)) * style.need;
  const founding = s.twelve?.teamId === teamId && s.twelve.firstTeam === next;
  const comp = own || t.free || founding ? 1 : FA.ai.compensation[t.grade];
  return { chance, need: need * comp };
}

/** Opens the winter's market: every free agent's price, ask, demands and the AI clubs that want him. */
export function openMarket(s: LeagueState, next: number): FaMarket {
  const year = next - 1;
  const u = s.user;
  const fas = freeAgentsFor(s, next);
  const grades = faGrades(s, next, fas);
  const entering = !!u && next === u.firstTeamYear;
  const limit = externalLimit(fas.length);
  const m: FaMarket = {
    year,
    round: 0,
    limit,
    userLimit: entering ? EXPANSION_DEFAULTS.freeAgentSigns : limit,
    userFree: entering,
    ...(s.twelve && s.twelve.firstTeam === next ? { newClub: s.twelve.teamId } : {}),
    talks: {},
    order: [],
    signedOut: {},
    news: [],
  };
  const clubs = firstTeamIds(s, next).filter((id) => id !== u?.teamId);
  const onMarket = new Set(fas.map((p) => p.id));
  const rows = fas.map((p) => ({ p, price: faPrice(p, next) })).sort((a, b) => offerValue(b.price) - offerValue(a.price) || a.p.id.localeCompare(b.p.id));
  for (const { p, price } of rows) {
    const r = rng(`${s.seed}|fa-talk|${year}|${p.id}`);
    const war = recentWar(p);
    const greed = lerp(FA.greed, r()) + (war >= 4 ? 0.04 : 0);
    const ask = offerValue(price) * greed;
    const free = p.service.optionFree === year;
    const t: FaTalk = {
      id: p.id,
      from: p.teamId!,
      grade: free ? 'C' : (grades[p.id] ?? 'C'),
      ...(free ? { free: true } : {}),
      price,
      ask,
      floor: ask * FA.floorStart,
      demands: demandsFor(s, p, price, next, r),
      // Half chance, half his 충성심 (1.1.0).
      loyalty: lerp(FA.loyalty, (r() + traitsOf(p).loyalty / 100) / 2),
      patience: Math.round(lerp(FA.patience, r())),
      offers: {},
      interest: {},
      notes: [],
    };
    for (const c of clubs) {
      const a = appetite(s, c, t, p, next, onMarket);
      if (r() >= a.chance) continue;
      // His own club and the clubs after a star come in at once; the rest over the first weeks.
      const enter = c === t.from ? Math.floor(r() * 2) : Math.floor(r() ** 2 * (war >= 3 ? 3 : 7));
      t.interest[c] = { enter, open: lerp(FA.ai.open, r()) * a.need, most: lerp(FA.ai.most, r()) * a.need };
    }
    m.talks[p.id] = t;
    m.order.push(p.id);
  }
  if (u) {
    markBaseline(s, m);
    const gift = parentGiftFor(s, next, fas, grades);
    if (gift) {
      const t = m.talks[gift.id]!;
      m.gift = { id: gift.id, total: round1000(guaranteed(t.price) * gift.premium), years: t.price.years };
      giftAlert(s, m, next);
    }
  }
  return m;
}

function giftAlert(s: LeagueState, m: FaMarket, next: number) {
  const u = s.user!;
  const g = m.gift!;
  const p = s.players[g.id]!;
  addAlert(s, {
    id: `fa-gift-${next}`,
    date: faDate(m, 0),
    kind: 'owner',
    title: __i18n_k("league.fa.giftAlert.title.ed00d79b", { name: p.name }),
    lines: [
      __i18n_k("league.fa.giftAlert.lines.6b53b0cb", { parentName: u.settings.parentName, name: eulreul(p.name) }),
      __i18n_k("league.fa.giftAlert.lines.8ca5d7d5", { eok: eok(g.total) }),
    ],
    tone: 'good',
    players: [p.id],
  });
}

// ── Dates and money words ────────────────────────────────────────────────────────────────────────

/** The calendar date of a market day. */
export function faDate(m: Pick<FaMarket, 'year'>, day: number) {
  const d = new Date(Date.UTC(m.year, 10, 9 + day));
  return d.toISOString().slice(0, 10);
}

/** 만 원 as "12억" or "12억 5,000만" or "8,000만". */
export function eok(n: number) {
  const e = Math.floor(n / 10000),
    rest = Math.round(n % 10000);
  return e ? (rest ? __i18n_k("league.fa.eok.a1ab0842", { e: e, value: rest.toLocaleString('ko-KR') }) : __i18n_k("league.fa.eok.c50a1aa4", { e: e })) : __i18n_k("league.fa.eok.cd1481f0", { value: rest.toLocaleString('ko-KR') });
}

/** "4+1년 총액 60억 (계약금 30억 · 연봉 7억 · 옵션 2억)". */
export function termsText(o: FaOffer) {
  const len = o.extra ? __i18n_k("league.fa.termsText.len.1538dc1f", { years: o.years, years2: o.extra.years }) : __i18n_k("league.fa.termsText.len.044a2535", { years: o.years });
  const parts = [o.bonus ? __i18n_k("league.fa.termsText.parts.b27ba50d", { eok: eok(o.bonus) }) : '', __i18n_k("league.fa.termsText.parts.f4f14ab0", { eok: eok(o.annual) }), o.options ? __i18n_k("league.fa.termsText.parts.cdca7fab", { eok: eok(o.options) }) : ''].filter(Boolean);
  return __i18n_k("league.fa.termsText.45bec87f", { len: len, eok: eok(offerTotal(o)), value: parts.join(' · ') });
}

// ── A round ──────────────────────────────────────────────────────────────────────────────────────

const short = (s: LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? id;
const isOpen = (t: FaTalk) => !t.signed && !t.gone;

/** The offers a club drafted on the market screen that can still go out (1.0.1): a player who has signed or left
    since they were drafted drops out, instead of blocking the next round. */
export const openDrafts = <T>(m: FaMarket, drafts: Record<PlayerId, T>): Record<PlayerId, T> =>
  Object.fromEntries(Object.entries(drafts).filter(([id]) => !!m.talks[id] && isOpen(m.talks[id]!)));
const outside = (m: FaMarket, t: FaTalk, teamId: TeamId) => teamId !== t.from;
const limitOf = (s: LeagueState, m: FaMarket, teamId: TeamId) => (teamId === s.user?.teamId ? m.userLimit : teamId === m.newClub ? EXPANSION_DEFAULTS.freeAgentSigns : m.limit);

/** Plays the next round: AI clubs bid, raise or pull out, then every player decides. Returns whether anything
    touched the user's club (an answer to its offer, one of its free agents signing, news it waits for). */
export function playRound(s: LeagueState, m: FaMarket, next: number): boolean {
  const day = FA.rounds[m.round]!;
  const last = m.round === FA.rounds.length - 1;
  const prev = m.round ? FA.rounds[m.round - 1]! : 0;
  const r = rng(`${s.seed}|fa-round|${m.year}|${m.round}`);
  const me = s.user?.teamId;
  let touched = false;
  // AI clubs, each within its room under the cap less what it has on the table elsewhere.
  const tabled: Record<TeamId, number> = {};
  for (const id of m.order) {
    const t = m.talks[id]!;
    if (isOpen(t)) for (const [c, o] of Object.entries(t.offers)) if (c !== me) tabled[c] = (tabled[c] ?? 0) + capHit(o);
  }
  const onMarket = new Set(m.order.filter((id) => isOpen(m.talks[id]!)));
  const rooms: Record<TeamId, number> = {};
  const roomOf = (c: TeamId) => (rooms[c] ??= capRoomFor(s, c, next, onMarket) + FA.ai.capSlack);
  for (const id of m.order) {
    const t = m.talks[id]!;
    if (!isOpen(t)) continue;
    const p = s.players[id]!;
    const lead = t.decideOn !== undefined ? leader(s, t, next) : null;
    for (const c of Object.keys(t.interest).sort()) {
      const it = t.interest[c]!;
      const full = outside(m, t, c) && (m.signedOut[c] ?? 0) >= limitOf(s, m, c);
      const bid = t.offers[c];
      // AI clubs stay under the salary cap: no offer (or a raise) that would take them over with what they
      // have on the table, and an offer made before other signings used the room is pulled.
      const room = roomOf(c) - (tabled[c] ?? 0) + (bid ? capHit(bid) : 0);
      if (full || (bid && capHit(bid) > room)) {
        if (bid) tabled[c] = (tabled[c] ?? 0) - capHit(bid);
        delete t.offers[c];
        continue;
      }
      if (!bid) {
        if (m.round < it.enter) continue;
        // A club that has filled the spot since may drop out.
        if (c !== t.from && improvement(s, c, p) < -3 && r() < 0.6) {
          delete t.interest[c];
          continue;
        }
        // Its first offer; when that does not fit under the cap, what he would take today, if that does.
        let o = aiOffer(t, p, it.open, r, next);
        if (capHit(o) > room) {
          const k = it.open * (t.floor / Math.max(1, utility(s, t, c, o, next))) * 1.01;
          if (k < it.open) o = aiOffer(t, p, k, r, next);
        }
        if (capHit(o) <= room) {
          t.offers[c] = { ...o, day };
          tabled[c] = (tabled[c] ?? 0) + capHit(o);
        }
        continue;
      }
      const now = guaranteed(bid) / guaranteed(t.price);
      // Raise to beat the leader when he is weighing another club's offer, or a little when he has nothing he
      // likes yet (talks go on), as far as the club goes.
      const k =
        lead && lead.teamId !== c && r() < FA.ai.raise
          ? now * (lead.u / utility(s, t, c, bid, next)) * (1.01 + r() * 0.04)
          : !lead && r() < FA.ai.nudge
            ? now * (1 + lerp(FA.ai.step, r()))
            : 0;
      if (k) {
        const o = k <= it.most ? aiOffer(t, p, Math.min(k, it.most), r, next) : now < it.most ? aiOffer(t, p, it.most, r, next) : null;
        if (o && capHit(o) <= room) {
          tabled[c] = (tabled[c] ?? 0) - capHit(bid) + capHit(o);
          t.offers[c] = { ...o, day };
        }
      }
    }
  }
  // The user's offers with a ceiling are raised the same way, before anyone decides.
  if (me) raiseUserOffers(s, m, day, next);
  // Players.
  for (const id of m.order) {
    const t = m.talks[id]!;
    if (!isOpen(t)) continue;
    const p = s.players[id]!;
    let best = leader(s, t, next);
    const sign = () => {
      // A club at its limit of outside signings cannot register him, and an AI club whose room under the cap
      // went to other signings pulls out: the next best.
      const cannot = (c: TeamId) =>
        (outside(m, t, c) && (m.signedOut[c] ?? 0) >= limitOf(s, m, c)) || (c !== me && capHit(t.offers[c]!) > capRoomFor(s, c, next, onMarket) + FA.ai.capSlack);
      while (best && cannot(best.teamId)) {
        delete t.offers[best.teamId];
        best = leader(s, t, next);
      }
      if (!best) return false;
      signTalk(s, m, t, best.teamId, t.offers[best.teamId]!, day, next);
      return true;
    };
    if (last) {
      if (!sign()) closeUnsigned(s, m, t, day, next);
    } else if (best && best.u >= t.floor * FA.overwhelm) sign();
    else if (best && best.u >= t.floor) {
      if (t.decideOn === undefined) t.decideOn = day + t.patience;
      else if (day >= t.decideOn) sign();
    } else {
      delete t.decideOn;
      // Nothing good enough: his price falls with the weeks (not while three clubs are after him), and moves
      // toward the best offer he has.
      if (Object.keys(t.offers).length < 3) {
        const cool = ageIn(p, next) >= 33 ? FA.coolOld : FA.coolPerWeek;
        t.floor = t.floor * (1 - (cool * (day - prev)) / 7);
      }
      if (best) t.floor -= (t.floor - best.u) * FA.meet;
      t.floor = Math.max(t.ask * FA.floorMin, t.floor);
    }
    if (me && (t.from === me || t.courted) && tell(s, m, t, day, next)) touched = true;
  }
  m.round++;
  if (m.round >= FA.rounds.length) m.closed = true;
  return touched;
}

/** The user's offers with a ceiling (V0.8.1): raised to what he would take and past the best rival offer, as far
    as the ceiling and the payroll budget (and the fund, for a bonus paid at once) allow. */
function raiseUserOffers(s: LeagueState, m: FaMarket, day: number, next: number) {
  const me = s.user!.teamId;
  for (const id of m.order) {
    const t = m.talks[id]!;
    const mine = t.offers[me];
    if (!isOpen(t) || !mine || mine.ceiling === undefined) continue;
    const ours = utility(s, t, me, mine, next);
    const rival = Object.entries(t.offers)
      .filter(([c]) => c !== me)
      .reduce((a, [c, o]) => Math.max(a, utility(s, t, c, o, next)), 0);
    const want = Math.max(t.floor * 1.01, rival * 1.02);
    if (want <= ours) continue;
    const now = guaranteed(mine);
    const most = Math.min(mine.ceiling, maxGuaranteed(s, m, t, mine, next, userOffers(s, m)));
    const need = (now * want) / Math.max(1, ours);
    const g = Math.min(need, most);
    const name = s.players[id]!.name;
    if (g <= now + 500) {
      if (t.said !== 'ceiling') {
        t.said = 'ceiling';
        t.notes.push({ day, text: __i18n_k("league.fa.raiseUserOffers.text.4f520c36", { name: name, eok: eok(mine.ceiling) }), tone: 'bad' });
      }
      continue;
    }
    t.offers[me] = { ...scaleOffer(mine, g, next), day };
    const capped = g < need ? __i18n_k("league.fa.raiseUserOffers.capped.c4c7c458", { eok: eok(mine.ceiling) }) : __i18n_k("league.fa.raiseUserOffers.capped.ce19aa62", { eok: eok(mine.ceiling) });
    t.notes.push({ day, text: __i18n_k("league.fa.raiseUserOffers.text.6f67f00f", { name: name, eok: eok(now), eok2: eok(guaranteed(t.offers[me]!)), capped: capped }), tone: g < need ? undefined : 'good' });
    if (t.notes.length > 12) t.notes.splice(0, t.notes.length - 12);
    delete t.said;
  }
}

/** What he tells the user's club after a round (only when it is news). Returns whether it matters: he signed,
    left or started weighing offers. */
function tell(s: LeagueState, m: FaMarket, t: FaTalk, day: number, next: number): boolean {
  const me = s.user!.teamId;
  const p = s.players[t.id]!;
  let key: string, text: string, tone: 'good' | 'bad' | undefined;
  if (t.signed) {
    const own = t.from === me;
    key = `signed-${t.signed.teamId}`;
    if (t.signed.teamId === me) {
      text = __i18n_k("league.fa.tell.f05bfcbc", { name: iga(p.name), termsText: termsText(t.signed.offer) });
      tone = 'good';
    } else {
      text = __i18n_k("league.fa.tell.98b5006d", { name: iga(p.name), short: wagwa(short(s, t.signed.teamId)), termsText: termsText(t.signed.offer) });
      tone = own || t.courted ? 'bad' : undefined;
    }
  } else if (t.gone) {
    key = 'gone';
    text = __i18n_k("league.fa.tell.4116c10b", { name: iga(p.name) });
  } else {
    const mine = t.offers[me];
    if (!mine) {
      const n = Object.keys(t.offers).length;
      key = `none-${n}`;
      text = n ? __i18n_k("league.fa.tell.bd73c0e4", { name: iga(p.name), n: n }) : __i18n_k("league.fa.tell.9fb49507", { name: p.name });
    } else {
      const x = reaction(s, m, t, mine, next);
      if (t.decideOn !== undefined) {
        key = `think-${x.behind !== undefined ? 'behind' : 'lead'}-${t.decideOn}`;
        text =
          x.behind !== undefined
            ? __i18n_k("league.fa.tell.52441049", { name: iga(p.name), value: Math.max(1, Math.round(x.behind * 100)), value2: faDate(m, t.decideOn).slice(5).replace('-', '/') })
            : __i18n_k("league.fa.tell.9ed3c3df", { name: iga(p.name), value: faDate(m, t.decideOn).slice(5).replace('-', '/') });
        tone = x.behind !== undefined ? 'bad' : 'good';
      } else {
        key = `short-${x.band}-${x.fit.wants.join('|')}`;
        text = __i18n_k("league.fa.tell.839456cf", { name: p.name, label: x.label, value: x.fit.wants.join(' ') || __i18n_k("league.fa.tell.a30dfae1") });
        tone = x.band === 'far' ? 'bad' : undefined;
      }
    }
  }
  if (t.said === key) return false;
  t.said = key;
  t.notes.push({ day, text, ...(tone ? { tone } : {}) });
  if (t.notes.length > 12) t.notes.splice(0, t.notes.length - 12);
  return /^(signed|gone|think)/.test(key);
}

/** The contract a signing writes. */
export function faContract(teamId: TeamId, next: number, o: FaOffer, p: Player, spot?: FaSpot): Player['contract'] {
  const incentive: IncentiveKind = isPitcher(p) ? (p.role === 'SP' ? 'innings' : 'relief') : 'games';
  const fa: FaTerms = { years: o.years, options: o.options, incentive, paid: [], ...(o.prepaid && o.bonus ? { prepaid: true } : {}) };
  if (o.extra) fa.extra = { ...o.extra, annual: o.annual };
  if (o.promises?.length) {
    fa.promises = [...o.promises];
    if (o.promises.includes('reinforce') && spot) fa.spot = spot;
  }
  return { teamId, kind: 'freeAgent', signedIn: next - 1, signingBonus: o.bonus, salaries: Array.from({ length: o.years }, (_, i) => ({ season: next + i, amount: o.annual })), fa };
}

function signTalk(s: LeagueState, m: FaMarket, t: FaTalk, teamId: TeamId, o: FaOffer, day: number, next: number) {
  const p = s.players[t.id]!;
  const u = s.user;
  const me = u?.teamId;
  const from = t.from;
  const date = faDate(m, day);
  const reinforce = t.demands.find((d) => d.kind === 'reinforce');
  // Compensation is on last season's salary, read before the new contract replaces it.
  const salary = salaryIn(p, next - 1);
  removeFromRoster(s, p);
  p.teamId = teamId;
  s.rosters[teamId]!.futures.push(p.id);
  p.contract = faContract(teamId, next, o, p, reinforce?.kind === 'reinforce' ? reinforce.spot : undefined);
  p.service.lastFreeAgencyAt = p.service.creditedSeasons;
  delete p.service.optionFree;
  t.signed = { teamId, day, offer: { ...o } };
  delete t.decideOn;
  t.offers = {};
  if (teamId !== from) m.signedOut[teamId] = (m.signedOut[teamId] ?? 0) + 1;
  const year = m.year;
  const gift = m.gift?.id === p.id && teamId === me;
  if (u && teamId === me) {
    if (gift) {
      // The owner pays the whole deal (salary and bonus spread over it) outside the payroll budget.
      const annual = o.annual + Math.round(o.bonus / o.years);
      (u.parentGifts ??= []).push({ id: p.id, name: p.name, annual, from: next, to: next + o.years - 1 });
      u.payrollBudget += annual;
      (u.log ??= []).push({ year, text: __i18n_k("league.fa.signTalk.text.273dec18", { name: p.name, termsText: termsText(o) }) });
    } else if (o.prepaid && o.bonus) {
      u.fund -= o.bonus;
      u.ledger.push({ year, label: __i18n_k("league.fa.signTalk.label.7d3d0d9c", { name: p.name }), amount: -o.bonus });
    }
    if (!gift) (u.log ??= []).push({ year, text: __i18n_k("league.fa.signTalk.text.e82ccbcc", { name: p.name, value: from === me ? __i18n_k("league.fa.signTalk.text.994331cf") : __i18n_k("league.fa.signTalk.text.cbe9195d", { short: short(s, from) }), termsText: termsText(o) }) });
  } else if (u && from === me) (u.log ??= []).push({ year, text: __i18n_k("league.fa.signTalk.text.c617190d", { name: p.name, short: ro(short(s, teamId)), termsText: termsText(o) }) });
  m.news.push({
    day,
    text: teamId === from ? __i18n_k("league.fa.signTalk.text.5e0e721b", { short: short(s, teamId), grade: t.grade, name: p.name, termsText: termsText(o) }) : __i18n_k("league.fa.signTalk.text.85534c18", { grade: t.grade, name: p.name, short: short(s, from), short2: short(s, teamId), termsText: termsText(o) }),
    ...(teamId === me || from === me ? { mine: true } : {}),
  });
  moveNews(s, { type: 'fa', from, to: teamId, id: p.id, years: o.years, annual: o.annual, bonus: o.bonus, options: o.options, extra: o.extra, grade: t.grade }, date);
  crossing(s, p, from, teamId, __i18n_k("league.fa.signTalk.b30dac4a"), date);
  if (from === me && teamId !== me) farewell(s, p, from, __i18n_k("league.fa.signTalk.1046ffcb", { short: short(s, teamId) }), date);
  if (teamId === from) return;
  // Compensation to the club he left (none after a declined option, none for the user's founding signings).
  if (t.free || (teamId === me && m.userFree) || teamId === m.newClub) return;
  if (t.grade === 'C') {
    moneyFor(s, teamId, from, compensationCash('C', salary).cashOnly, __i18n_k("league.fa.signTalk.a1be4423", { name: p.name }), year);
    return;
  }
  const item: FaQueueItem = { kind: 'protect', fa: p.id, grade: t.grade, from, to: teamId, salary };
  const o2 = s.offseason!;
  if (teamId === me) (o2.faQueue ??= []).push(item);
  else if (from === me) (o2.faQueue ??= []).push({ ...item, kind: 'compensation' });
  else aiCompensation(s, item, protectedBy(s, teamId, t.grade, next), next);
}

/** The day before camp with no offer: his club takes him back on a one-year deal if it wants him; otherwise, since
    1.6.0, he waits as an unattached player (FA 미아) any club can sign at his ask, without talks, until the next
    season ends (before, he retired at once). */
function closeUnsigned(s: LeagueState, m: FaMarket, t: FaTalk, day: number, next: number) {
  const p = s.players[t.id]!;
  const me = s.user?.teamId;
  if (t.from !== me && keepValue(p, next) >= 40) {
    const o = splitOffer((guaranteed(t.price) / t.price.years) * 0.7, 1, 0, 0, next);
    signTalk(s, m, t, t.from, o, day, next);
    return;
  }
  t.gone = true;
  if (me && t.from === me) (s.user!.log ??= []).push({ year: m.year, text: __i18n_k("league.fa.closeUnsigned.text.0971c548", { name: p.name }) });
  m.news.push({ day, text: __i18n_k("league.fa.closeUnsigned.text.83bc90ee", { name: p.name }), ...(t.from === me ? { mine: true } : {}) });
  removeFromRoster(s, p);
  p.teamId = null;
  p.contract = null;
  (p.life ??= {}).unsigned = m.year;
  if (!(s.pool ??= []).includes(p.id)) s.pool.push(p.id);
}

/** After the last round: the owner's free agent, the winter's summary for the user. */
export function closeMarket(s: LeagueState, m: FaMarket, next: number) {
  const u = s.user;
  if (!u) return;
  const g = m.gift;
  if (g) {
    const t = m.talks[g.id];
    const p = s.players[g.id];
    if (t && !t.courted) {
      // Never talking to the owner's free agent is turning down the present.
      u.trust = Math.max(0, (u.trust ?? 60) - 3);
      (u.log ??= []).push({ year: m.year, text: __i18n_k("league.fa.closeMarket.text.63001418", { value: p?.name ?? '' }) });
    } else if (p && t?.signed?.teamId !== u.teamId) (u.log ??= []).push({ year: m.year, text: __i18n_k("league.fa.closeMarket.text.ecdc7a4f", { name: p.name, value: p.teamId ? __i18n_k("league.fa.closeMarket.text.f10244df") : __i18n_k("league.fa.closeMarket.text.7e6bf393") }) });
  }
  const lines: string[] = [];
  let good = false,
    bad = false;
  for (const id of m.order) {
    const t = m.talks[id]!;
    const p = s.players[id];
    if (!p) continue;
    const to = t.signed?.teamId;
    const terms = t.signed ? termsText(t.signed.offer) : '';
    if (t.from !== u.teamId && t.courted) {
      if (to === u.teamId) {
        lines.push(__i18n_k("league.fa.closeMarket.41a4ae61", { name: p.name, short: short(s, t.from), terms: terms }));
        good = true;
      } else {
        lines.push(__i18n_k("league.fa.closeMarket.af60f9c9", { name: p.name, value: to ? `${short(s, to)} (${terms})` : __i18n_k("league.fa.closeMarket.f22fcccd") }));
        bad = true;
      }
    } else if (t.from === u.teamId) {
      if (to === u.teamId) lines.push(__i18n_k("league.fa.closeMarket.ea5c02b4", { name: p.name, terms: terms }));
      else {
        lines.push(__i18n_k("league.fa.closeMarket.9107d814", { name: p.name, value: to ? `${short(s, to)} (${terms})` : __i18n_k("league.fa.closeMarket.f22fcccd") }));
        bad = true;
      }
    }
  }
  const big = m.order
    .map((id) => m.talks[id]!)
    .filter((t) => t.signed && t.signed.teamId !== t.from && t.signed.teamId !== u.teamId && t.from !== u.teamId)
    .sort((a, b) => offerTotal(b.signed!.offer) - offerTotal(a.signed!.offer))
    .slice(0, 3);
  if (big.length) lines.push(__i18n_k("league.fa.closeMarket.3deb8ccf", { value: big.map((t) => `${s.players[t.id]?.name ?? ''} ${short(s, t.from)}→${short(s, t.signed!.teamId)} (${eok(offerTotal(t.signed!.offer))})`).join(', ') }));
  if (!lines.length) return;
  addAlert(s, { id: `fa-${m.year}`, date: faDate(m, FA.rounds.at(-1)!), kind: 'fa', title: __i18n_k("league.fa.closeMarket.title.65c7d8d7", { year: m.year }), lines, tone: good ? 'good' : bad ? 'bad' : undefined, players: m.order });
}

// ── The user's round ─────────────────────────────────────────────────────────────────────────────

export interface RoundInput {
  kind: 'faRound';
  /** New or changed offers; null withdraws one. */
  offers: Record<PlayerId, FaOffer | null>;
  run: 'round' | 'news' | 'close';
}

/** The user's offers after this input. */
function offersAfter(s: LeagueState, m: FaMarket, input: RoundInput) {
  const me = s.user!.teamId;
  const out: Record<PlayerId, FaOffer> = {};
  for (const id of m.order) {
    const t = m.talks[id]!;
    if (isOpen(t) && t.offers[me]) out[id] = t.offers[me]!;
  }
  for (const [id, o] of Object.entries(input.offers)) {
    if (o) out[id] = o;
    else delete out[id];
  }
  return out;
}

/** What one offer takes from next season's payroll budget: the salary, and the bonus spread over the deal unless
    it is paid at once from the fund. */
export const budgetUse = (o: FaOffer) => o.annual + (o.prepaid ? 0 : Math.round(o.bonus / o.years));

/** What the user's club has put on the table: next season's payroll budget, and bonuses paid at once from the
    fund (the owner's free agent aside). */
export function openCommitments(s: LeagueState, m: FaMarket, offers: Record<PlayerId, FaOffer>) {
  let budget = 0,
    fund = 0;
  for (const [id, o] of Object.entries(offers)) {
    if (m.gift?.id === id && guaranteed(o) <= m.gift.total) continue;
    budget += budgetUse(o);
    if (o.prepaid) fund += o.bonus;
  }
  return { budget, fund };
}

/** The user's offers on the table now (open talks only). */
export function userOffers(s: LeagueState, m: FaMarket): Record<PlayerId, FaOffer> {
  const me = s.user!.teamId;
  const out: Record<PlayerId, FaOffer> = {};
  for (const id of m.order) {
    const t = m.talks[id]!;
    if (isOpen(t) && t.offers[me]) out[id] = t.offers[me]!;
  }
  return out;
}

/** The most guaranteed money an offer of this shape to him can carry: within the payroll budget and the fund left
    after the club's other offers (the owner's free agent: up to the owner's limit). */
export function maxGuaranteed(s: LeagueState, m: FaMarket, t: FaTalk, o: FaOffer, next: number, offers: Record<PlayerId, FaOffer>) {
  if (m.gift?.id === t.id) return m.gift.total;
  const u = s.user!;
  const others = Object.fromEntries(Object.entries(offers).filter(([id]) => id !== t.id));
  const c = openCommitments(s, m, others);
  const budgetRoom = u.payrollBudget - payrollBeforeOffers(s, m, next) - c.budget;
  const g = Math.max(1, guaranteed(o));
  const perYear = budgetUse(o) / g;
  let most = perYear > 0 ? budgetRoom / perYear : Infinity;
  if (o.prepaid && o.bonus > 0) most = Math.min(most, (u.fund - c.fund) / (o.bonus / g));
  return Math.max(0, Math.floor(most / 1000) * 1000);
}

/** Next season's payroll without the club's own free agents still on the market. */
export function payrollBeforeOffers(s: LeagueState, m: FaMarket, next: number) {
  const me = s.user!.teamId;
  const own = m.order.filter((id) => m.talks[id]!.from === me && isOpen(m.talks[id]!));
  return projectedPayroll(s, me, next, own);
}

export function checkRound(s: LeagueState, m: FaMarket, input: RoundInput, next: number): string | null {
  const u = s.user!;
  for (const [id, o] of Object.entries(input.offers)) {
    const t = m.talks[id];
    const name = s.players[id]?.name ?? id;
    if (!t) return __i18n_k("league.fa.checkRound.39a599fa");
    if (!isOpen(t)) return __i18n_k("league.fa.checkRound.08db9b93", { name: name });
    if (!o) continue;
    if (!Number.isInteger(o.years) || o.years < 1 || o.years > 6) return __i18n_k("league.fa.checkRound.81dfd03b", { name: name });
    if (![o.bonus, o.annual, o.options].every((x) => Number.isFinite(x) && x >= 0)) return __i18n_k("league.fa.checkRound.6212800e", { name: name });
    if (o.annual < minimumSalaryFor(next)) return __i18n_k("league.fa.checkRound.9e2cebf9", { name: name });
    if (o.options > guaranteed(o)) return __i18n_k("league.fa.checkRound.789893cb", { name: name });
    if (o.extra && (!Number.isInteger(o.extra.years) || o.extra.years < 1 || o.extra.years > 2 || !['club', 'player'].includes(o.extra.holder))) return __i18n_k("league.fa.checkRound.6bdbb415", { name: name });
    if (o.promises?.some((x) => !t.demands.some((d) => d.kind === x))) return __i18n_k("league.fa.checkRound.c23d79fa", { name: name });
    if (m.gift?.id === id && guaranteed(o) > m.gift.total) return __i18n_k("league.fa.checkRound.543bd63d", { name: name, eok: eok(m.gift.total) });
    if (o.ceiling !== undefined && (!Number.isFinite(o.ceiling) || o.ceiling < guaranteed(o))) return __i18n_k("league.fa.checkRound.499acba4", { name: name });
  }
  const offers = offersAfter(s, m, input);
  const me = u.teamId;
  const outsideOffers = Object.keys(offers).filter((id) => m.talks[id]!.from !== me).length;
  const room = m.userLimit - (m.signedOut[me] ?? 0);
  if (outsideOffers > room) return __i18n_k("league.fa.checkRound.db8686c6", { userLimit: m.userLimit, value: Math.max(0, room) });
  const c = openCommitments(s, m, offers);
  if (c.budget > 0 && payrollBeforeOffers(s, m, next) + c.budget > u.payrollBudget)
    return __i18n_k("league.fa.checkRound.c11b3b7a", { next: next, eok: eok(payrollBeforeOffers(s, m, next) + c.budget - u.payrollBudget) });
  if (c.fund > 0 && c.fund > u.fund) return __i18n_k("league.fa.checkRound.0fb348ae", { eok: eok(c.fund), eok2: eok(Math.max(0, u.fund)) });
  return null;
}

export function resolveRound(s: LeagueState, m: FaMarket, input: RoundInput) {
  const me = s.user!.teamId;
  const day = m.round ? FA.rounds[m.round - 1]! : 0;
  for (const [id, o] of Object.entries(input.offers)) {
    const t = m.talks[id]!;
    if (o) {
      t.offers[me] = { ...o, day };
      t.courted = true;
    } else delete t.offers[me];
    delete t.said;
  }
  m.run = input.run;
}

/** The scouts' round: keep our own free agents worth keeping on their terms, take up the owner's present, let the market run. */
export function autoRound(s: LeagueState, m: FaMarket, next: number): RoundInput {
  const u = s.user!;
  const me = u.teamId;
  const offers: Record<PlayerId, FaOffer | null> = {};
  const ok = (trial: Record<PlayerId, FaOffer | null>) => checkRound(s, m, { kind: 'faRound', offers: trial, run: 'close' }, next) === null;
  if (m.gift && isOpen(m.talks[m.gift.id]!) && !m.talks[m.gift.id]!.offers[me]) {
    const t = m.talks[m.gift.id]!;
    let o = meetTerms(s, m, t, next, 1.03);
    if (guaranteed(o) > m.gift.total) o = { ...o, ...splitOffer(m.gift.total, o.years, o.bonus / Math.max(1, guaranteed(o)), o.options, next, o.extra) };
    if (ok({ ...offers, [t.id]: o })) offers[t.id] = o;
  }
  // Our own free agents worth keeping: on their terms, raised as needed up to 15% more (within the budget).
  const own = m.order.map((id) => m.talks[id]!).filter((t) => t.from === me && isOpen(t) && !t.offers[me]);
  for (const t of own) {
    const p = s.players[t.id]!;
    if (ageIn(p, next) > 34 || keepValue(p, next) < 48) continue;
    const o = meetTerms(s, m, t, next);
    const trial = { ...offers, [t.id]: o };
    if (!ok(trial)) continue;
    const firm = { ...userOffers(s, m), ...Object.fromEntries(Object.entries(trial).filter((x): x is [PlayerId, FaOffer] => !!x[1])) };
    offers[t.id] = { ...o, ceiling: Math.max(guaranteed(o), Math.min(Math.round(guaranteed(o) * 1.15), maxGuaranteed(s, m, t, o, next, firm))) };
  }
  return { kind: 'faRound', offers, run: 'close' };
}

export const roundDecision = (m: FaMarket) => ({ kind: 'faRound' as const, round: m.round, day: FA.rounds[m.round]!, date: faDate(m, FA.rounds[m.round]!) });

// ── Incentives, period options, promises ─────────────────────────────────────────────────────────

/** After the season: incentives earned (games, innings, relief appearances), paid by the club and counted in the cap. */
export function payIncentives(s: LeagueState, year: number) {
  const u = s.user;
  for (const p of Object.values(s.players)) {
    const c = p.contract;
    const fa = c?.fa;
    if (!fa || !fa.options || !p.teamId) continue;
    const first = c.signedIn + 1;
    if (year < first || year >= first + fa.years || fa.paid.some((x) => x.season === year)) continue;
    const rec = p.career.find((x) => x.year === year && !x.level);
    const [full, half] = FA.incentive[fa.incentive];
    const n = fa.incentive === 'games' ? (rec?.bat?.g ?? 0) : fa.incentive === 'innings' ? Math.floor((rec?.pit?.outs ?? 0) / 3) : (rec?.pit?.g ?? 0);
    const share = n >= full ? 1 : n >= half ? 0.5 : 0;
    const amount = round100((fa.options / fa.years) * share);
    if (!amount) continue;
    fa.paid.push({ season: year, amount });
    if (u && p.teamId === u.teamId) {
      u.fund -= amount;
      u.ledger.push({ year, label: __i18n_k("league.fa.payIncentives.label.f71f60ba", { name: p.name, value: fa.incentive === 'games' ? __i18n_k("league.fa.payIncentives.label.ee19b92b", { n: n }) : fa.incentive === 'innings' ? __i18n_k("league.fa.payIncentives.label.61ad0074", { n: n }) : __i18n_k("league.fa.payIncentives.label.26ea5f59", { n: n }) }), amount: -amount });
    }
  }
}

/** Contracts whose guaranteed seasons end this winter with a period option, for the user's club (club options it decides). */
export function clubOptionsDue(s: LeagueState, teamId: TeamId, next: number) {
  return orgPlayers(s, teamId).filter((p) => {
    const c = p.contract;
    return c?.fa?.extra?.holder === 'club' && c.salaries.at(-1)?.season === next - 1;
  });
}

function takeUpOption(s: LeagueState, p: Player, next: number) {
  const c = p.contract!;
  const x = c.fa!.extra!;
  for (let i = 0; i < x.years; i++) c.salaries.push({ season: next + i, amount: x.annual });
  delete c.fa!.extra;
}

function dropOption(s: LeagueState, p: Player, next: number) {
  delete p.contract!.fa!.extra;
  p.service.optionFree = next - 1;
}

/** The user's club decides on its club options. */
export function settleClubOptions(s: LeagueState, keep: PlayerId[], ids: PlayerId[], next: number) {
  const u = s.user!;
  for (const id of ids) {
    const p = s.players[id]!;
    const x = p.contract!.fa!.extra!;
    if (keep.includes(id)) {
      (u.log ??= []).push({ year: next - 1, text: __i18n_k("league.fa.settleClubOptions.text.e324b51a", { name: p.name, years: x.years, eok: eok(x.annual) }) });
      takeUpOption(s, p, next);
    } else {
      (u.log ??= []).push({ year: next - 1, text: __i18n_k("league.fa.settleClubOptions.text.73bad423", { name: p.name }) });
      dropOption(s, p, next);
    }
  }
}

/** The rest of the winter's period options: AI clubs take theirs up when he is still worth the money; players
    with an opt-out leave when the market would pay them clearly more. */
export function settlePeriodOptions(s: LeagueState, next: number) {
  const me = s.user?.teamId;
  for (const p of Object.values(s.players)) {
    const c = p.contract;
    const x = c?.fa?.extra;
    if (!x || !p.teamId || p.status !== 'active' || c.salaries.at(-1)?.season !== next - 1) continue;
    const price = faPrice(p, next);
    const worth = guaranteed(price) / price.years;
    if (x.holder === 'player') {
      const leave = worth > x.annual * 1.1 && ageIn(p, next) <= 35;
      if (leave) dropOption(s, p, next);
      else takeUpOption(s, p, next);
      if (me && p.teamId === me) (s.user!.log ??= []).push({ year: next - 1, text: leave ? __i18n_k("league.fa.settlePeriodOptions.text.0c4aa210", { name: p.name }) : __i18n_k("league.fa.settlePeriodOptions.text.ef81981a", { name: p.name, years: x.years }) });
    } else if (p.teamId !== me) {
      if (keepValue(p, next) >= 45 && worth >= x.annual * 0.8) takeUpOption(s, p, next);
      else dropOption(s, p, next);
    }
  }
}

/** A promise kept or broken: the record, the news, and (broken) a little less trust from the fans. */
function judge(s: LeagueState, p: Player, kind: FaPromise, kept: boolean, year: number, why: string) {
  const u = s.user!;
  p.contract!.fa!.kept = { ...(p.contract!.fa!.kept ?? {}), [kind]: kept };
  (u.promises ??= []).push({ year, id: p.id, name: p.name, kind, kept });
  const what = kind === 'starter' ? __i18n_k("league.fa.judge.what.b2db18ee") : __i18n_k("league.fa.judge.what.fa44ccd8", { value: SPOT_LABEL[p.contract!.fa!.spot ?? 'SP'] });
  (u.log ??= []).push({ year, text: __i18n_k("league.fa.judge.text.7fd91005", { name: p.name, what: what, value: kept ? __i18n_k("league.fa.judge.text.f6cd632b") : __i18n_k("league.fa.judge.text.ea51b7cc", { why: why }) }) });
  if (!kept) {
    addAlert(s, {
      id: `fa-promise-${year}-${p.id}-${kind}`,
      date: kind === 'starter' ? `${year}-10-05` : `${year + 1}-02-01`,
      kind: 'fa',
      title: __i18n_k("league.fa.judge.title.868d502b", { name: p.name }),
      lines: [__i18n_k("league.fa.judge.lines.05a4a916", { what: what, why: why }), __i18n_k("league.fa.judge.lines.b17cf3e1", { winters: FA.promise.winters })],
      tone: 'bad',
      players: [p.id],
    });
    const club = clubState(s, u.teamId);
    club.interest = Math.max(-0.6, club.interest - 0.02);
  }
}

/** After his first season: did the user's club keep its promise of a starting job? (Long injuries and military service excuse it.) */
export function judgeStarterPromises(s: LeagueState, year: number) {
  const u = s.user;
  if (!u) return;
  const P = FA.promise;
  for (const p of orgPlayers(s, u.teamId)) {
    const fa = p.contract?.fa;
    if (!fa?.promises?.includes('starter') || fa.kept?.starter !== undefined || p.contract!.signedIn + 1 !== year) continue;
    const rec = p.career.find((x) => x.year === year && !x.level);
    const hurt = (p.injuries ?? []).filter((x) => x.date.startsWith(String(year))).reduce((a, x) => a + x.days, 0) >= 60;
    if (hurt) continue;
    const kept = isPitcher(p) ? (p.role === 'SP' ? (rec?.pit?.gs ?? 0) >= P.starterStarts : (rec?.pit?.g ?? 0) >= P.reliefGames) : (rec?.bat?.g ?? 0) >= P.starterGames;
    judge(s, p, 'starter', kept, year, isPitcher(p) ? __i18n_k("league.fa.judgeStarterPromises.75ced707", { value: p.role === 'SP' ? __i18n_k("league.fa.judgeStarterPromises.c8bd0af6", { value: rec?.pit?.gs ?? 0 }) : __i18n_k("league.fa.judgeStarterPromises.1e758ebb", { value: rec?.pit?.g ?? 0 }) }) : __i18n_k("league.fa.judgeStarterPromises.d57412f0", { value: rec?.bat?.g ?? 0 }));
  }
}

/** Before opening day: did the user's club reinforce the spot it promised? A newcomer there since the market
    opened, good enough to play (public grade), keeps it. */
export function judgeReinforcePromises(s: LeagueState, m: FaMarket | undefined, next: number) {
  const u = s.user;
  if (!u) return;
  for (const p of orgPlayers(s, u.teamId)) {
    const fa = p.contract?.fa;
    if (!fa?.promises?.includes('reinforce') || fa.kept?.reinforce !== undefined || p.contract!.signedIn !== next - 1 || !fa.spot) continue;
    const before = new Set(m?.baseline?.[fa.spot] ?? []);
    const added = orgPlayers(s, u.teamId).filter((x) => x.id !== p.id && spotOf(x) === fa.spot && !before.has(x.id) && currentValue(x) >= FA.promise.reinforceValue);
    judge(s, p, 'reinforce', added.length > 0, next - 1, added.length ? '' : __i18n_k("league.fa.judgeReinforcePromises.d955d2ad", { value: SPOT_LABEL[fa.spot] }));
  }
}

/** Remembers who the user's club had at each spot when the market opened (the reinforce promise's yardstick). */
export function markBaseline(s: LeagueState, m: FaMarket) {
  const u = s.user;
  if (!u) return;
  const spots: FaSpot[] = ['SP', 'RP', 'C', 'IF', 'OF'];
  m.baseline = Object.fromEntries(spots.map((sp) => [sp, orgPlayers(s, u.teamId).filter((p) => spotOf(p) === sp).map((p) => p.id)])) as Record<FaSpot, PlayerId[]>;
}
