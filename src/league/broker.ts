import { k as __i18n_k } from '../i18n/index';
/* 2.0.41 (the user's request: 브로커가 접근해서 병역 서류 조작이나 약물 코디네이터 같은 하이리스크 하이리턴 구단 이벤트): now and
   then, in the season, a broker comes to the general manager with an offer the club should refuse.
   - 병역 서류 조작: for money, papers that get one of our players (a domestic regular who has not served) out of
     military service — he never has to go. The papers can come out for some seasons after: then he is banned as
     for dodging the draft, must serve after all, and the club is fined and shamed.
   - 약물 코디네이터: for money, a program for a few of our best — their power (a pitcher's stuff) rises for a season's
     part, the KBO's tests are dodged far more often than a player alone dodges them, and the signs are hidden. A
     positive test, or the ring coming out in a later season, brings the doping penalty and the club's.
   Refusing costs nothing. Each season at most one offer, on a day of its own (May to mid-July), and the deals
   already made may come out on that day too. */
import { hashUnit } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { addAlert } from './alerts';
import { clubState } from './fans';
import { addNews } from './news';
import { ageIn, isForeign, isPitcher } from './players';
import { brokerIncident } from './scandals';
import { firstTeamIds, orgPlayers, type Decision, type LeagueState } from './state';
import { PARENT } from './tuning';

export type BrokerOffer = 'military' | 'doping';

export const BROKER = {
  /** Chance of an offer in a season, and the days it may come on (month-day). */
  chance: 0.15,
  from: '05-01',
  span: 75,
  military: {
    /** 만 원 (20억). */
    cost: 200_000,
    /** Whom: a domestic player who has not served, at least this good, of an age to be called up. */
    grade: 50,
    age: [22, 29] as const,
    /** Chance the papers come out in each later season, for this many seasons. */
    exposure: 0.18,
    seasons: 5,
  },
  doping: {
    cost: 150_000,
    players: 3,
    boost: 5,
    /** Days the program runs, and the share of the KBO's tests it dodges (×). */
    days: 120,
    testShare: 0.35,
    exposure: 0.15,
    seasons: 3,
  },
  /** When a deal comes out: the KBO's fine on the club (만 원), the owner's trust, the fans' interest. */
  caught: { fine: 300_000, trust: 15, interest: 0.15 },
};

export interface BrokerDeal {
  id: string;
  offer: BrokerOffer;
  ids: PlayerId[];
  year: number;
  /** The last season it can still come out. */
  until: number;
  out?: boolean;
}

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
const won = (n: number) => Math.round(n / 10_000);

/** The day of this season the broker comes (or the deals come out). */
export const brokerDate = (s: LeagueState, year: number) => addDays(`${year}-${BROKER.from}`, Math.floor(hashUnit(`${s.seed}|broker-day|${year}`) * BROKER.span));

/** Whom the broker has in mind for each offer, best first. */
export function brokerTargets(s: LeagueState, offer: BrokerOffer): Player[] {
  const u = s.user!;
  const year = s.year;
  const [lo, hi] = BROKER.military.age;
  const ours = orgPlayers(s, u.teamId).filter((p) => p.status === 'active' && !s.suspended?.[p.id]);
  const best = (list: Player[]) => list.sort((a, b) => b.scouting.current - a.scouting.current);
  if (offer === 'military')
    return best(ours.filter((p) => !isForeign(p) && p.service.military === 'pending' && p.scouting.current >= BROKER.military.grade && ageIn(p, year) >= lo && ageIn(p, year) <= hi)).slice(0, 1);
  const first = new Set(s.rosters[u.teamId]?.active ?? []);
  return best(ours.filter((p) => first.has(p.id) && !p.life?.suspicion)).slice(0, BROKER.doping.players);
}

/** The broker's day: the old deals may come out, then perhaps a new offer. True when the club must answer. */
export function brokerDay(s: LeagueState, date: string): boolean {
  const u = s.user;
  if (!u || s.pending || !firstTeamIds(s, s.year).includes(u.teamId)) return false;
  const b = (u.broker ??= { deals: [] });
  if (b.seen === s.year || date < brokerDate(s, s.year)) return false;
  b.seen = s.year;
  if (exposures(s, date)) return true;
  if (hashUnit(`${s.seed}|broker|${s.year}`) >= BROKER.chance) return false;
  const military = brokerTargets(s, 'military');
  const offer: BrokerOffer = military.length && hashUnit(`${s.seed}|broker-kind|${s.year}`) < 0.5 ? 'military' : 'doping';
  const targets = offer === 'military' ? military : brokerTargets(s, 'doping');
  if (!targets.length) return false;
  const cost = BROKER[offer].cost;
  const names = targets.map((p) => p.name).join(', ');
  const lines =
    offer === 'military'
      ? [
          __i18n_k("league.broker.text.b6ab4651", { name: targets[0]!.name }),
          __i18n_k("league.broker.text.9c948c5b", { cost: won(cost), name: targets[0]!.name }),
          __i18n_k("league.broker.text.d477848d", { seasons: BROKER.military.seasons, chance: Math.round(BROKER.military.exposure * 100), fine: won(BROKER.caught.fine), trust: BROKER.caught.trust }),
        ]
      : [
          __i18n_k("league.broker.text.e5c78610", { names }),
          __i18n_k("league.broker.text.339b9061", { cost: won(cost), days: BROKER.doping.days }),
          __i18n_k("league.broker.text.8d798dc0", { seasons: BROKER.doping.seasons, chance: Math.round(BROKER.doping.exposure * 100), fine: won(BROKER.caught.fine), trust: BROKER.caught.trust }),
        ];
  s.pending = { kind: 'broker', offer, ids: targets.map((p) => p.id), cost, date, lines };
  addAlert(s, { id: `broker-${s.year}`, date, kind: 'scandal', title: offer === 'military' ? __i18n_k("league.broker.text.410cd9bf") : __i18n_k("league.broker.text.e01450a5"), lines, tone: 'bad', players: targets.map((p) => p.id) });
  return true;
}

/** Why the club cannot answer so, or null. */
export function checkBroker(s: LeagueState, d: Extract<Decision, { kind: 'broker' }>, answer: string): string | null {
  if (answer !== 'accept' && answer !== 'refuse') return __i18n_k("league.broker.text.20384fde");
  if (answer === 'accept' && s.user!.fund < d.cost) return __i18n_k("league.broker.text.28f75cea");
  return null;
}

/** Take the offer or show the broker out. */
export function resolveBroker(s: LeagueState, d: Extract<Decision, { kind: 'broker' }>, answer: 'accept' | 'refuse') {
  const u = s.user!;
  const year = Number(d.date.slice(0, 4));
  const log = (text: string) => (u.log ??= []).push({ year, text });
  const players = d.ids.map((id) => s.players[id]).filter((p): p is Player => !!p && p.teamId === u.teamId);
  if (answer === 'refuse' || !players.length) {
    log(d.offer === 'military' ? __i18n_k("league.broker.text.7a05b0e6") : __i18n_k("league.broker.text.fdf15b56"));
    return;
  }
  u.fund -= d.cost;
  // On the books it is a consultant's fee.
  u.ledger.push({ year, label: __i18n_k("league.broker.text.ef18ebb8"), amount: -d.cost });
  const b = (u.broker ??= { deals: [] });
  const deal: BrokerDeal = { id: `${d.offer}-${d.date}`, offer: d.offer, ids: players.map((p) => p.id), year, until: year + BROKER[d.offer].seasons };
  b.deals.push(deal);
  if (d.offer === 'military') {
    const p = players[0]!;
    p.service.military = 'exempt';
    p.service.exam = { year, grade: 5, reason: __i18n_k("league.broker.text.8190c179"), surgeries: p.service.exam?.surgeries ?? 0 };
    log(__i18n_k("league.broker.text.9e0492f2", { name: p.name, cost: won(d.cost) }));
  } else {
    for (const p of players) {
      const life = (p.life ??= {});
      const tool = isPitcher(p) ? 'stuff' : 'power';
      p.hidden.current[tool] = (p.hidden.current[tool] ?? 40) + BROKER.doping.boost;
      life.suspicion = { since: d.date, signs: 0, real: true, next: addDays(d.date, 30), boost: { tool, delta: BROKER.doping.boost }, broker: true };
    }
    log(__i18n_k("league.broker.text.5f9503dd", { names: players.map((p) => p.name).join(', '), cost: won(d.cost) }));
  }
}

/** The scouts never take a broker's offer. */
export const autoBroker = (): 'refuse' => 'refuse';

/** The deals of earlier seasons may come out today. True when the club must answer for one of its players. */
function exposures(s: LeagueState, date: string): boolean {
  const b = s.user!.broker!;
  for (const deal of b.deals) {
    if (deal.out || s.year <= deal.year || s.year > deal.until) continue;
    if (hashUnit(`${s.seed}|broker-out|${deal.id}|${s.year}`) >= BROKER[deal.offer].exposure) continue;
    return expose(s, deal, date);
  }
  return false;
}

/** A deal comes out: each player's penalty (the first still ours answers, unless one already does), and the club's. */
function expose(s: LeagueState, deal: BrokerDeal, date: string, tested?: PlayerId): boolean {
  const u = s.user!;
  deal.out = true;
  let asked = !!tested;
  for (const id of deal.ids) {
    const p = s.players[id];
    if (!p || p.status === 'retired' || id === tested) continue;
    if (deal.offer === 'military') {
      if (p.service.military === 'exempt') p.service.military = 'pending';
      delete p.service.exam;
    } else if (p.life?.suspicion?.broker) {
      const x = p.life.suspicion;
      if (x.boost) p.hidden.current[x.boost.tool] = (p.hidden.current[x.boost.tool] ?? 40) - x.boost.delta;
      delete p.life.suspicion;
    }
    if (p.teamId !== u.teamId) continue;
    if (brokerIncident(s, p, deal.offer === 'military' ? 'draftDodge' : 'doping', date, !asked)) asked = true;
  }
  clubPenalty(s, deal.offer, date);
  return asked;
}

/** A player of a broker's program failed the KBO's test (scandals.ts, his own penalty already given): the ring comes out. */
export function brokerTested(s: LeagueState, p: Player, date: string) {
  const deal = s.user?.broker?.deals.find((x) => x.offer === 'doping' && !x.out && x.ids.includes(p.id));
  if (deal) expose(s, deal, date, p.id);
}

/** The club's share when a broker's deal comes out: a fine, the owner's trust, the fans. */
function clubPenalty(s: LeagueState, offer: BrokerOffer, date: string) {
  const u = s.user!;
  const year = Number(date.slice(0, 4));
  u.fund -= BROKER.caught.fine;
  u.ledger.push({ year, label: offer === 'military' ? __i18n_k("league.broker.text.cc6a15d4") : __i18n_k("league.broker.text.b4d3dade"), amount: -BROKER.caught.fine });
  u.trust = Math.max(0, (u.trust ?? PARENT.startTrust) - BROKER.caught.trust);
  clubState(s, u.teamId).interest -= BROKER.caught.interest;
  const club = s.teams.find((t) => t.id === u.teamId)?.name ?? '';
  const title = offer === 'military' ? __i18n_k("league.broker.text.e9f5d343", { club }) : __i18n_k("league.broker.text.8bce2c73", { club });
  const lines = [
    offer === 'military' ? __i18n_k("league.broker.text.655d6dd0") : __i18n_k("league.broker.text.1708dea9"),
    __i18n_k("league.broker.text.5044bb96", { fine: won(BROKER.caught.fine), trust: BROKER.caught.trust }),
  ];
  (u.log ??= []).push({ year, text: title });
  addNews(s, { id: `broker-out-${offer}-${date}`, date, kind: 'move', title, body: lines.join(' '), quotes: [], facts: {}, players: [], mine: true });
  addAlert(s, { id: `broker-out-${offer}-${date}`, date, kind: 'scandal', title, lines, tone: 'bad' });
}
