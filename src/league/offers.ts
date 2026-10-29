import { k as __i18n_k } from '../i18n/index';
/* 2.0.28 (the user's request): the AI clubs come to us with trades. A few times before the deadline a club looks at
   our roster with its plan (strategy.ts) — a contender for a ready player at the spot it lacks most, a rebuilding club
   for a young one, the rest for whoever helps most — and offers the most it would still give for him (checkTrade, its
   own view), one or two of its players and maybe a pick. The offer waits ten days in the market's trade screen; we
   take it, turn it down, or let it lapse. Nothing changes for a league without a user club.

   2.0.45 (the user's request: 에이스에게도 계속 트레이드 요청이 온다 — NFS): the general manager can mark players not for
   sale. The clubs then look past them for the next player they would want, and an offer standing for one of them is
   withdrawn. We can still trade him ourselves. 2.0.46: a club never offers one of its own not-for-sale players (nfs.ts). */
import type { PlayerId, TeamId } from '../model/types';
import { addAlert } from './alerts';
import { tradeBarred } from './dynasty';
import { today } from './entry';
import { iga } from './josa';
import { currentValue, ageIn, futureValue } from './players';
import { aiNotForSale, notForSale } from './nfs';
import { firstTeamIds, type LeagueState, type TradeExtras } from './state';
import { clubStrategy, planFactor, spotOf, SPOT_LABEL } from './strategy';
import { checkTrade, extrasText, makeTrade, pickValue, tradablePicks, tradableOf, tradeValue, tradeWindow } from './trade';

export interface TradeOffer {
  id: string;
  teamId: TeamId;
  date: string;
  /** The last day it stands. */
  expires: string;
  /** Ours they ask for, and theirs they give (with cash or picks, from our side: `picksIn` theirs to us). */
  give: PlayerId[];
  get: PlayerId[];
  extras: TradeExtras;
  why: string;
  /** 2.0.59: brought by the trade block. */
  block?: boolean;
}

export const OFFERS = {
  /** When the clubs look (before the July 31 deadline). */
  dates: ['05-10', '06-05', '07-01', '07-24'],
  /** A club's chance to come to us on one of those days, how many may, and how many can stand at once. */
  chance: 0.3,
  perRound: 2,
  open: 3,
  days: 10,
  /** What they give at least, against what they ask (by trade value): less is not an offer. */
  fair: 0.8,
};

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
const shortOf = (s: LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? id;

/** The offers still standing: not lapsed, and still possible (for the screen; it changes nothing). */
export function liveOffers(s: LeagueState): TradeOffer[] {
  const now = today(s);
  return (s.user?.tradeOffers ?? []).filter((o) => o.expires >= now && !checkTrade(s, o.teamId, o.give, o.get, o.extras).problem);
}

/** The same, the rest dropped from the save. */
export function standingOffers(s: LeagueState): TradeOffer[] {
  const u = s.user;
  if (!u?.tradeOffers?.length) return [];
  return (u.tradeOffers = liveOffers(s));
}

export { isNotForSale, notForSale } from './nfs';

/** Marks one of ours not for sale, or lifts it; an offer standing for him is withdrawn. */
export function setNotForSale(s: LeagueState, id: PlayerId, on: boolean) {
  const u = s.user;
  if (!u || s.players[id]?.teamId !== u.teamId) return;
  const list = notForSale(s).filter((x) => x !== id);
  if (on) list.push(id);
  u.notForSale = list;
  if (on && u.tradeOffers) u.tradeOffers = u.tradeOffers.filter((o) => !o.give.includes(id));
  // Not for sale is off the trade block.
  if (on) u.tradeBlock = tradeBlock(s).filter((x) => x !== id);
}

/** 2.0.59 (the user's request): ours on the trade block — still ours. */
export const tradeBlock = (s: LeagueState): PlayerId[] => (s.user?.tradeBlock ?? []).filter((id) => s.players[id]?.teamId === s.user!.teamId);

/** How many clubs come with an offer for a player on the block. */
export const BLOCK = { clubs: 3 };

/** We put one of ours on the trade block (or take him off): up to three clubs that want him make their best offer at
    once — what they would still give for him, of fair value (package_) — and on the later offer days the clubs look
    again when none of his offers stands. Off the block, the offers it brought are withdrawn. */
export function setTradeBlock(s: LeagueState, id: PlayerId, on: boolean) {
  const u = s.user;
  if (!u || s.players[id]?.teamId !== u.teamId) return;
  u.tradeBlock = tradeBlock(s).filter((x) => x !== id);
  if (!on) {
    if (u.tradeOffers) u.tradeOffers = u.tradeOffers.filter((o) => !(o.block && o.give.includes(id)));
    return;
  }
  u.tradeBlock.push(id);
  u.notForSale = notForSale(s).filter((x) => x !== id);
  blockOffers(s, id, today(s));
}

/** The clubs' offers for one of ours on the block: the best fair offer of each club that wants him, the best three. */
export function blockOffers(s: LeagueState, id: PlayerId, date: string): number {
  const u = s.user;
  const p = s.players[id];
  if (!u || !p || tradeWindow(s)) return 0;
  const standing = standingOffers(s);
  const deals = firstTeamIds(s)
    .filter((teamId) => teamId !== u.teamId && s.rosters[teamId] && !tradeBarred(s, u.teamId, teamId) && !standing.some((o) => o.teamId === teamId && o.give.includes(id)))
    .map((teamId) => ({ teamId, deal: package_(s, teamId, id) }))
    .filter((x): x is { teamId: TeamId; deal: NonNullable<ReturnType<typeof package_>> } => !!x.deal)
    .sort((a, b) => b.deal.v - a.deal.v || a.teamId.localeCompare(b.teamId))
    .slice(0, Math.max(0, BLOCK.clubs - standing.filter((o) => o.give.includes(id)).length));
  for (const { teamId, deal } of deals) {
    const offer: TradeOffer = { id: `block-${date}-${teamId}-${id}`, teamId, date, expires: addDays(date, OFFERS.days), give: [id], get: deal.get, extras: deal.extras, why: __i18n_k("league.offers.text.6a939700"), block: true };
    (u.tradeOffers ??= []).push(offer);
  }
  addAlert(s, {
    id: `block-${date}-${id}`,
    date,
    kind: 'move',
    title: __i18n_k("league.offers.text.20f77778", { name: p.name }),
    lines: deals.length
      ? [...deals.map((x) => offerText(s, u.tradeOffers!.find((o) => o.id === `block-${date}-${x.teamId}-${id}`)!)), __i18n_k("league.offers.text.d91240b6", { date: addDays(date, OFFERS.days) })]
      : [__i18n_k("league.offers.text.ce628c92")],
    players: [id, ...deals.flatMap((x) => x.deal.get)],
  });
  return deals.length;
}

/** The player `teamId` wants from us, and why. */
function wanted(s: LeagueState, teamId: TeamId, r: () => number) {
  const u = s.user!;
  const plan = clubStrategy(s, teamId);
  const kept = new Set(notForSale(s));
  const fits = tradableOf(s, u.teamId).filter((p) =>
    !kept.has(p.id) && (plan.mode === 'rebuild' ? ageIn(p, s.year) <= 24 && futureValue(p) >= 50 : currentValue(p) >= 48 && (plan.mode === 'balanced' || ageIn(p, s.year) >= 24) && (!plan.needs.length || plan.needs.includes(spotOf(p)))),
  );
  const ranked = fits.map((p) => ({ p, v: tradeValue(s, p) * planFactor(s, plan, p) })).filter((x) => x.v > 2).sort((a, b) => b.v - a.v);
  const pick = ranked[Math.floor(r() * Math.min(3, ranked.length))];
  if (!pick) return null;
  const why = plan.mode === 'rebuild' ? __i18n_k("league.offers.text.f25c6a05") : plan.needs.includes(spotOf(pick.p)) ? __i18n_k("league.offers.text.d0cd519f", { spot: SPOT_LABEL[spotOf(pick.p)] }) : __i18n_k("league.offers.text.eade3bfa");
  return { p: pick.p, why };
}

/** The most `teamId` would still give for `target`: one of its players, two, or one and a pick of its own. */
function package_(s: LeagueState, teamId: TeamId, target: PlayerId) {
  const vt = tradeValue(s, s.players[target]!);
  const spot = spotOf(s.players[target]!);
  const kept = new Set(aiNotForSale(s, teamId));
  const theirs = tradableOf(s, teamId)
    .filter((p) => !kept.has(p.id) && (spotOf(p) !== spot || s.players[target]!.position !== p.position))
    .map((p) => ({ p, v: tradeValue(s, p) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, 12);
  const ok = (get: PlayerId[], extras: TradeExtras = {}) => checkTrade(s, teamId, [target], get, extras).accepted;
  const tries: { get: PlayerId[]; extras: TradeExtras; v: number }[] = [];
  for (const x of theirs) tries.push({ get: [x.p.id], extras: {}, v: x.v });
  for (let i = 0; i < theirs.length; i++) for (let j = i + 1; j < Math.min(theirs.length, 8); j++) tries.push({ get: [theirs[i]!.p.id, theirs[j]!.p.id], extras: {}, v: theirs[i]!.v + theirs[j]!.v });
  // A player a little short of fair, with the pick that makes up the rest.
  const picks = tradablePicks(s, teamId)
    .map((round) => ({ round, v: pickValue(s, teamId, round) }))
    .sort((a, b) => a.v - b.v);
  for (const x of theirs) {
    const gap = vt * OFFERS.fair - x.v;
    const pick = gap > 0 ? picks.find((k) => k.v >= gap) : undefined;
    if (pick) tries.push({ get: [x.p.id], extras: { picksIn: [pick.round] }, v: x.v + pick.v });
  }
  // The best for us they would still sign off on, and nothing less than fair.
  return tries.filter((t) => t.v >= vt * OFFERS.fair).sort((a, b) => b.v - a.v).find((t) => ok(t.get, t.extras)) ?? null;
}

/** On the offer days, a club or two comes to us. */
export function aiOffers(s: LeagueState, date: string, r: () => number) {
  const u = s.user;
  if (!u || tradeWindow(s)) return;
  // 2.0.59: the clubs look again at ours on the block whose offers have all gone.
  for (const id of tradeBlock(s)) if (!standingOffers(s).some((o) => o.give.includes(id))) blockOffers(s, id, date);
  const open = standingOffers(s);
  const clubs = firstTeamIds(s)
    .filter((id) => id !== u.teamId && s.rosters[id] && !tradeBarred(s, u.teamId, id) && !open.some((o) => o.teamId === id))
    .map((id) => ({ id, k: r() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.id);
  let made = 0;
  for (const teamId of clubs) {
    if (made >= OFFERS.perRound || open.filter((o) => !o.block).length >= OFFERS.open) break;
    if (r() > OFFERS.chance) continue;
    const want = wanted(s, teamId, r);
    if (!want || open.some((o) => o.give.includes(want.p.id))) continue;
    const deal = package_(s, teamId, want.p.id);
    if (!deal) continue;
    const offer: TradeOffer = { id: `offer-${date}-${teamId}`, teamId, date, expires: addDays(date, OFFERS.days), give: [want.p.id], get: deal.get, extras: deal.extras, why: want.why };
    (u.tradeOffers ??= []).push(offer);
    made++;
    const club = shortOf(s, teamId);
    addAlert(s, {
      id: offer.id,
      date,
      kind: 'move',
      title: __i18n_k("league.offers.text.35f9059c", { club }),
      lines: [offerText(s, offer), __i18n_k("league.offers.text.57791162", { club: iga(club), why: want.why }), __i18n_k("league.offers.text.d91240b6", { date: offer.expires })],
      players: [...offer.give, ...offer.get],
    });
  }
}

/** "우리 김선수 ↔ 서울 이선수 + 2027 신인 3라운드 지명권". */
export function offerText(s: LeagueState, o: TradeOffer) {
  const names = (ids: PlayerId[]) => ids.map((id) => s.players[id]?.name ?? '?').join('·');
  const theirs = [names(o.get), extrasText(s, o.extras.cashIn ?? 0, o.extras.picksIn ?? [])].filter(Boolean).join(' + ');
  return __i18n_k("league.offers.text.8e2d9a69", { ours: names(o.give), club: shortOf(s, o.teamId), theirs });
}

/** We take the offer (if it still stands) or turn it down. */
export function answerOffer(s: LeagueState, id: string, accept: boolean) {
  const u = s.user;
  if (!u) return;
  const offer = standingOffers(s).find((o) => o.id === id);
  u.tradeOffers = (u.tradeOffers ?? []).filter((o) => o.id !== id);
  if (!offer) return;
  const club = shortOf(s, offer.teamId);
  if (!accept) {
    (u.log ??= []).push({ year: s.year, text: __i18n_k("league.offers.text.eda643c4", { club, deal: offerText(s, offer) }) });
    return;
  }
  // Their view may have changed since (an injury, a slump): then the offer is off.
  if (!checkTrade(s, offer.teamId, offer.give, offer.get, offer.extras).accepted) {
    (u.log ??= []).push({ year: s.year, text: __i18n_k("league.offers.text.1d55bab7", { club }) });
    return;
  }
  makeTrade(s, offer.teamId, offer.give, offer.get, offer.extras);
}
