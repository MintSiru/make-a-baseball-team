import { k as __i18n_k } from '../i18n/index';
/* Transaction news (V0.7.2): trades, releases and waivers, unattached signings, foreign replacements,
   postings, free-agent contracts and the second draft become articles, with each player's public record
   as fact lines for an optional language model. Written only in a game with the player's club (the
   generated history and a spectated league keep the transaction log only). The club's own moves are
   always written; between other clubs every trade, foreign replacement and posting deal, and A-grade
   free agents. Wording draws from a hash of the article id, never from the simulation's random streams. */
import { hashUnit, ROLE_LABELS } from '../draftroom';
import type { BatTotals, PitTotals, Player, PlayerId, TeamId } from '../model/types';
import { salaryIn } from './contracts';
import { today } from './entry';
import { usd } from './foreign';
import { recordThrough } from './gamedetail';
import { eulreul, eunneun, iga, ro, wagwa } from './josa';
import { addNews, type Quote } from './news';
import { ageIn, isForeign, isPitcher } from './players';
import { addInto, emptyBat, emptyPit, type LeagueState } from './state';
import { avg, era, obp, slg } from './stats';

export type Move =
  /** V0.7.8: `cash` (만 원) paid by A (negative: by B), and rounds of the coming draft each side gives. */
  | { type: 'trade'; a: TeamId; b: TeamId; fromA: PlayerId[]; fromB: PlayerId[]; cash?: number; picksA?: number[]; picksB?: number[] }
  | { type: 'release'; teamId: TeamId; id: PlayerId; waiver: boolean; owed: number }
  | { type: 'claim'; teamId: TeamId; from: TeamId; id: PlayerId }
  | { type: 'pool'; teamId: TeamId; id: PlayerId; salary: number }
  /** `out` is passed whole: a foreign player with no first-team record leaves the player list. */
  | { type: 'foreign'; teamId: TeamId; out: Player; in: PlayerId; price: number }
  | { type: 'posting'; teamId: TeamId; id: PlayerId; deal: { years: number; total: number; fee: number } | null }
  /** A free-agent deal: since V0.8 with its bonus, incentives and period option. */
  | { type: 'fa'; from: TeamId; to: TeamId; id: PlayerId; years: number; annual: number; grade: string; bonus?: number; options?: number; extra?: { years: number; holder: 'club' | 'player' } }
  | { type: 'secondDraft'; teamId: TeamId; from: TeamId; id: PlayerId; round: number }
  /** A posted player back from the majors (V0.7.3): with the club that posted him (`own`) or another. */
  | { type: 'returnee'; teamId: TeamId; id: PlayerId; years: number; annual: number; abroad: number; own: boolean };

const short = (s: LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? id;
const pick = <T,>(xs: T[], key: string) => xs[Math.floor(hashUnit(key) * xs.length)]!;
const f3 = (x: number) => x.toFixed(3).replace(/^0/, '');
const innings = (outs: number) => `${Math.floor(outs / 3)}${outs % 3 ? ` ${outs % 3}/3` : ''}`;
/** 만 원 as "1억 7,500만 원". */
const won = (manwon: number) => {
  const eok = Math.floor(manwon / 10000),
    rest = manwon % 10000;
  return __i18n_k("league.movenews.won.39a51a17", { value: eok ? __i18n_k("league.movenews.won.af42578f", { eok: eok, value: rest ? ' ' : '' }) : '', value2: rest || !eok ? __i18n_k("league.movenews.won.cd1481f0", { value: rest.toLocaleString('ko-KR') }) : '' });
};
const POS: Record<string, string> = { C: __i18n_k("league.movenews.pOS.c.5f31470d"), '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: __i18n_k("league.movenews.pOS.sS.3e24c7f1"), LF: __i18n_k("league.movenews.pOS.lF.73836db2"), CF: __i18n_k("league.movenews.pOS.cF.56780b2a"), RF: __i18n_k("league.movenews.pOS.rF.a28a0ef8") };
const posOf = (p: Player) => (p.position ? POS[p.position]! : ROLE_LABELS[p.role]);

const batLine = (b: BatTotals) => __i18n_k("league.movenews.batLine.10efcb20", { g: b.g, f3: f3(avg(b)), hr: b.hr, rbi: b.rbi, sb: b.sb, f32: f3(obp(b) + slg(b)) });
const pitLine = (q: PitTotals) => __i18n_k("league.movenews.pitLine.77140cde", { g: q.g, w: q.w, l: q.l, value: q.sv ? __i18n_k("league.movenews.pitLine.addf22ee", { sv: q.sv }) : '', value2: q.hld ? __i18n_k("league.movenews.pitLine.dcf052c7", { hld: q.hld }) : '', innings: innings(q.outs), value3: era(q).toFixed(2), value4: q.k });
const lineOf = (p: Player, c: { bat: BatTotals | null; pit: PitTotals | null }) => (isPitcher(p) ? (c.pit?.outs ? pitLine(c.pit) : null) : c.bat?.pa ? batLine(c.bat) : null);

/** A short record for the article body: this season so far, else his last first-team season. */
function recent(s: LeagueState, p: Player): string | null {
  const now = s.phase === 'regular' ? s.lines[p.id] : undefined;
  const cur = now ? lineOf(p, now) : null;
  if (cur) return __i18n_k("league.movenews.recent.f16774cc", { cur: cur });
  const last = p.career.filter((c) => !c.level).at(-1);
  const prev = last ? lineOf(p, last) : null;
  return prev ? __i18n_k("league.movenews.recent.68b5c538", { year: last!.year, prev: prev }) : null;
}

/** A player's public facts: who he is, this season, his last first-team season, his career, pay and honours. */
function playerFacts(s: LeagueState, p: Player, season: number): string[] {
  const out: string[] = [];
  const bg = p.origin.background;
  out.push(__i18n_k("league.movenews.playerFacts.b1c1eb6b", { name: p.name, ageIn: ageIn(p, season), posOf: posOf(p), throws: p.throws, bats: p.bats, value: isForeign(p) ? __i18n_k("league.movenews.playerFacts.3b4f377d", { proSince: p.proSince, value: bg ? __i18n_k("league.movenews.playerFacts.a0a41a84", { text: bg.text }) : '' }) : __i18n_k("league.movenews.playerFacts.73ecbc1f", { proSince: p.proSince }) }));
  const now = s.phase === 'regular' ? s.lines[p.id] : undefined;
  const cur = now ? lineOf(p, now) : null;
  if (cur) out.push(__i18n_k("league.movenews.playerFacts.7dbb8460", { name: p.name, cur: cur }));
  const majors = p.career.filter((c) => !c.level);
  const last = majors.at(-1);
  const lastLine = last ? lineOf(p, last) : null;
  if (last && lastLine) out.push(__i18n_k("league.movenews.playerFacts.dbf633df", { name: p.name, year: last.year, short: short(s, last.teamId), lastLine: lastLine, value: last.war.toFixed(1) }));
  if (majors.length > 1) {
    const tot = { bat: majors.reduce((a, c) => (c.bat ? addInto(a, c.bat) : a), emptyBat()), pit: majors.reduce((a, c) => (c.pit ? addInto(a, c.pit) : a), emptyPit()) };
    const total = lineOf(p, tot);
    if (total) out.push(__i18n_k("league.movenews.playerFacts.0004b697", { name: p.name, length: majors.length, total: total }));
  }
  if (!majors.length && !cur) {
    const fut = p.career.filter((c) => c.level === 'futures').at(-1);
    const futLine = fut ? lineOf(p, fut) : null;
    out.push(futLine ? __i18n_k("league.movenews.playerFacts.ad46ecc5", { name: p.name, year: fut!.year, futLine: futLine }) : __i18n_k("league.movenews.playerFacts.b3832c33", { name: p.name }));
  }
  const pay = salaryIn(p, season);
  if (pay && !isForeign(p)) out.push(__i18n_k("league.movenews.playerFacts.7dfae5e2", { name: p.name, season: season, won: won(pay) }));
  for (const h of (p.honors ?? []).slice(-3)) out.push(__i18n_k("league.movenews.playerFacts.c6d66467", { name: p.name, h: h }));
  return out;
}

const clubFacts = (s: LeagueState, ids: TeamId[], date: string) =>
  s.phase === 'regular'
    ? ids.map((id) => {
        const r = recordThrough(s, id, date);
        return __i18n_k("league.movenews.clubFacts.53f33d02", { short: short(s, id), w: r.w, l: r.l, value: r.t });
      })
    : [];

const said = (x: Player, text: string): Quote => ({ who: x.name, role: 'player', text });
const managerOf = (s: LeagueState, teamId: TeamId) => __i18n_k("league.movenews.managerOf.c6d3b5b1", { value: s.clubs?.[teamId]?.staff?.manager?.name ?? '' }).trim();
const fans = (lines: string[], key: string): Quote[] => {
  const a = Math.floor(hashUnit(`${key}-f0`) * lines.length);
  const b = (a + 1 + Math.floor(hashUnit(`${key}-f1`) * (lines.length - 1))) % lines.length;
  return [a, b].map((i) => ({ who: __i18n_k("league.movenews.fans.who.724cc77d"), role: 'fan' as const, text: lines[i]! }));
};

const MANAGER = {
  trade: [__i18n_k("league.movenews.mANAGER.trade.0845cfc8"), __i18n_k("league.movenews.mANAGER.trade.1cbf14cd"), __i18n_k("league.movenews.mANAGER.trade.184b53ca")],
  release: [__i18n_k("league.movenews.mANAGER.release.c5ae9f6b"), __i18n_k("league.movenews.mANAGER.release.b35650c3"), __i18n_k("league.movenews.mANAGER.release.b8488a56")],
  signing: [__i18n_k("league.movenews.mANAGER.signing.f5cfc796"), __i18n_k("league.movenews.mANAGER.signing.e33123ca")],
  foreign: [__i18n_k("league.movenews.mANAGER.foreign.5aa8039f"), __i18n_k("league.movenews.mANAGER.foreign.0725543f"), __i18n_k("league.movenews.mANAGER.foreign.c0f28a59")],
};
const ARRIVAL = [__i18n_k("league.movenews.aRRIVAL.04ac12e4"), __i18n_k("league.movenews.aRRIVAL.c9e5ad99"), __i18n_k("league.movenews.aRRIVAL.345d9ee4")];
const STAY = [__i18n_k("league.movenews.sTAY.9c03fe1f"), __i18n_k("league.movenews.sTAY.59767d1d")];
const HOME = [__i18n_k("league.movenews.hOME.fc8e9162"), __i18n_k("league.movenews.hOME.4bffa8a0"), __i18n_k("league.movenews.hOME.0df6cd46")];
const MLB = [__i18n_k("league.movenews.mLB.3155855f"), __i18n_k("league.movenews.mLB.37f6a18b")];
const FANS = {
  trade: [__i18n_k("league.movenews.fANS.trade.4aaf915b"), __i18n_k("league.movenews.fANS.trade.4a03cef0"), __i18n_k("league.movenews.fANS.trade.baec33e0"), __i18n_k("league.movenews.fANS.trade.294c17f4")],
  release: [__i18n_k("league.movenews.fANS.release.210891eb"), __i18n_k("league.movenews.fANS.release.f3d64097"), __i18n_k("league.movenews.fANS.release.98a8881a")],
  signing: [__i18n_k("league.movenews.fANS.signing.6655582c"), __i18n_k("league.movenews.fANS.signing.216514bf"), __i18n_k("league.movenews.fANS.signing.4f88a104")],
  foreign: [__i18n_k("league.movenews.fANS.foreign.47176c83"), __i18n_k("league.movenews.fANS.foreign.010f0252"), __i18n_k("league.movenews.fANS.foreign.32c6683e")],
  leaving: [__i18n_k("league.movenews.fANS.leaving.7a55a5cf"), __i18n_k("league.movenews.fANS.leaving.63e7c2be"), __i18n_k("league.movenews.fANS.leaving.31f2f81b")],
  stay: [__i18n_k("league.movenews.fANS.stay.8e5cd693"), __i18n_k("league.movenews.fANS.stay.d0550b49"), __i18n_k("league.movenews.fANS.stay.55e4ffdd")],
  home: [__i18n_k("league.movenews.fANS.home.026e2b8e"), __i18n_k("league.movenews.fANS.home.f06c4909"), __i18n_k("league.movenews.fANS.home.cc4a80bf")],
};

/** Writes the article for a move (see the header for which ones). */
export function moveNews(s: LeagueState, m: Move, date = s.phase === 'regular' ? today(s) : `${s.year}-11-01`) {
  const u = s.user?.teamId;
  if (!u) return;
  const season = s.phase === 'regular' ? s.year : s.year + 1;
  const p = (id: PlayerId) => s.players[id];
  const names = (ids: PlayerId[]) => ids.map((id) => p(id)?.name ?? '').join('·');
  const base = { date, kind: 'move' as const };
  switch (m.type) {
    case 'trade': {
      const mine = m.a === u || m.b === u;
      const [A, B] = [short(s, m.a), short(s, m.b)];
      const id = `mv-trade-${date}-${[...m.fromA, ...m.fromB].join('-')}`;
      const everyone = [...m.fromA, ...m.fromB].map(p).filter((x): x is Player => !!x);
      const about = everyone.map((x) => {
        const r = recent(s, x);
        return __i18n_k("league.movenews.moveNews.about.dfd559e3", { name: eunneun(x.name), ageIn: ageIn(x, season), posOf: posOf(x), value: r ? __i18n_k("league.movenews.moveNews.about.f7542594", { r: r }) : __i18n_k("league.movenews.moveNews.about.c94aacfd") });
      });
      // Seen from the user's club when it is part of the deal, else from the first club.
      const home = m.b === u ? m.b : m.a;
      const arriving = (home === m.a ? m.fromB : m.fromA).map(p).find((x): x is Player => !!x);
      // Cash and draft picks (V0.7.8) go with the players on each side.
      const draft = s.year + 1;
      const and = (xs: string[]) => xs.filter(Boolean).reduce((a, x) => (a ? `${wagwa(a)} ${x}` : x), '');
      const extra = (money: number, picks: number[] = []) => [money > 0 ? __i18n_k("league.movenews.moveNews.extra.58195e3f", { value: Math.round(money / 1000) / 10 }) : '', ...picks.map((r) => __i18n_k("league.movenews.moveNews.extra.160cfca6", { draft: draft, r: r }))];
      const sideA = and([m.fromA.length ? names(m.fromA) : '', ...extra(Math.max(0, m.cash ?? 0), m.picksA)]);
      const sideB = and([m.fromB.length ? names(m.fromB) : '', ...extra(Math.max(0, -(m.cash ?? 0)), m.picksB)]);
      const shape = m.fromA.length && m.fromB.length ? __i18n_k("league.movenews.moveNews.shape.758c3ee1", { length: m.fromA.length, length2: m.fromB.length }) : '';
      addNews(s, {
        ...base,
        id,
        title: __i18n_k("league.movenews.moveNews.title.3a3b06ed", { a: A, b: B, sideA: sideA, sideB: sideB }),
        body: __i18n_k("league.movenews.moveNews.body.8aa2d67d", { a: iga(A), b: B, sideA: eulreul(sideA), sideB: eulreul(sideB), shape: shape, value: about.join(' ') }),
        quotes: [{ who: managerOf(s, home), role: 'manager', text: pick(MANAGER.trade, id) }, ...(arriving ? [said(arriving, pick(ARRIVAL, `${id}-a`))] : []), ...(mine ? fans(FANS.trade, id) : [])],
        facts: { type: __i18n_k("league.movenews.facts.type.428749ee"), date, clubA: A, clubB: B, [__i18n_k("league.movenews.moveNews.facts.85647161", { a: A })]: sideA, [__i18n_k("league.movenews.moveNews.facts.bd3cc4f9", { b: B })]: sideB },
        detail: [...everyone.flatMap((x) => playerFacts(s, x, season)), ...clubFacts(s, [m.a, m.b], date)],
        players: everyone.map((x) => x.id),
        mine,
      });
      return;
    }
    case 'release': {
      const x = p(m.id);
      if (!x || m.teamId !== u) return;
      const club = short(s, m.teamId);
      const id = `mv-release-${date}-${m.id}`;
      const r = recent(s, x);
      addNews(s, {
        ...base,
        id,
        title: m.waiver && !isForeign(x) ? __i18n_k("league.movenews.moveNews.title.1de39ecc", { club: club, name: x.name }) : __i18n_k("league.movenews.moveNews.title.4abcfa12", { club: club, name: x.name }),
        body: __i18n_k("league.movenews.moveNews.body.07df8b6d", { club: iga(club), ageIn: ageIn(x, season), posOf: posOf(x), name: eulreul(x.name), value: isForeign(x)
            ? __i18n_k("league.movenews.moveNews.body.5655575c")
            : m.waiver
              ? __i18n_k("league.movenews.moveNews.body.c7192411")
              : __i18n_k("league.movenews.moveNews.body.70449be5"), value2: r ? ` ${r}.` : '', value3: m.owed ? __i18n_k("league.movenews.moveNews.body.37b5ddcf", { won: won(m.owed), club: iga(club) }) : '' }),
        quotes: [{ who: managerOf(s, m.teamId), role: 'manager', text: pick(MANAGER.release, id) }, ...fans(FANS.release, id)],
        facts: { type: m.waiver && !isForeign(x) ? __i18n_k("league.movenews.facts.type.29e07476") : __i18n_k("league.movenews.facts.type.e16b5dd5"), date, club, player: x.name, ...(m.owed ? { owed: won(m.owed) } : {}) },
        detail: [...playerFacts(s, x, season), ...clubFacts(s, [m.teamId], date)],
        players: [x.id],
        mine: true,
      });
      return;
    }
    case 'claim': {
      const x = p(m.id);
      if (!x || (m.teamId !== u && m.from !== u)) return;
      const [club, from] = [short(s, m.teamId), short(s, m.from)];
      const id = `mv-claim-${date}-${m.id}`;
      const r = recent(s, x);
      addNews(s, {
        ...base,
        id,
        title: __i18n_k("league.movenews.moveNews.title.bf84b148", { club: club, name: x.name }),
        body: __i18n_k("league.movenews.moveNews.body.e68b1c4a", { club: iga(club), from: from, name: eulreul(x.name), value: r ? __i18n_k("league.movenews.moveNews.body.0bc32b32", { name: x.name, r: r }) : '' }),
        quotes: [said(x, pick(ARRIVAL, id))],
        facts: { type: __i18n_k("league.movenews.facts.type.f49fc0c2"), date, club, from, player: x.name },
        detail: [...playerFacts(s, x, season), ...clubFacts(s, [m.teamId], date)],
        players: [x.id],
        mine: true,
      });
      return;
    }
    case 'pool': {
      const x = p(m.id);
      if (!x || m.teamId !== u) return;
      const club = short(s, m.teamId);
      const id = `mv-pool-${date}-${m.id}`;
      const r = recent(s, x);
      addNews(s, {
        ...base,
        id,
        title: __i18n_k("league.movenews.moveNews.title.ce89613e", { club: club, name: x.name }),
        body: __i18n_k("league.movenews.moveNews.body.c032c789", { club: iga(club), ageIn: ageIn(x, season), posOf: posOf(x), name: eulreul(x.name), won: won(m.salary), value: r ? __i18n_k("league.movenews.moveNews.body.0bc32b32", { name: x.name, r: r }) : '' }),
        quotes: [{ who: managerOf(s, m.teamId), role: 'manager', text: pick(MANAGER.signing, id) }, ...fans(FANS.signing, id)],
        facts: { type: __i18n_k("league.movenews.facts.type.47ddc1fc"), date, club, player: x.name, salary: won(m.salary) },
        detail: [...playerFacts(s, x, season), ...clubFacts(s, [m.teamId], date)],
        players: [x.id],
        mine: true,
      });
      return;
    }
    case 'foreign': {
      const x = p(m.in);
      if (!x) return;
      const mine = m.teamId === u;
      const club = short(s, m.teamId);
      const id = `mv-foreign-${date}-${m.out.id}`;
      const r = recent(s, m.out);
      const bg = x.origin.background;
      addNews(s, {
        ...base,
        id,
        title: __i18n_k("league.movenews.moveNews.title.1148392f", { club: club, name: m.out.name, name2: x.name }),
        body: __i18n_k("league.movenews.moveNews.body.eaca8c2d", { club: iga(club), name: eulreul(m.out.name), name2: eulreul(x.name), name3: eunneun(x.name), ageIn: ageIn(x, season), posOf: posOf(x), value: bg ? __i18n_k("league.movenews.moveNews.body.1acd0595", { text: bg.text }) : '', usd: usd(m.price), value2: r ? __i18n_k("league.movenews.moveNews.body.0bc32b32", { name: m.out.name, r: r }) : '' }),
        quotes: [{ who: managerOf(s, m.teamId), role: 'manager', text: pick(MANAGER.foreign, id) }, ...(mine ? fans(FANS.foreign, id) : [])],
        facts: { type: __i18n_k("league.movenews.facts.type.c49c1d92"), date, club, out: m.out.name, in: x.name, price: usd(m.price) },
        detail: [...playerFacts(s, m.out, season), ...playerFacts(s, x, season), ...clubFacts(s, [m.teamId], date)],
        players: [x.id, ...(s.players[m.out.id] ? [m.out.id] : [])],
        mine,
      });
      return;
    }
    case 'posting': {
      const x = p(m.id);
      const mine = m.teamId === u;
      if (!x || (!m.deal && !mine)) return;
      const club = short(s, m.teamId);
      const id = `mv-posting-${date}-${m.id}`;
      const r = recent(s, x);
      const d = m.deal;
      addNews(s, {
        ...base,
        id,
        title: d ? __i18n_k("league.movenews.moveNews.title.415f7ac3", { name: x.name, years: d.years, usd: usd(d.total) }) : __i18n_k("league.movenews.moveNews.title.09a1152c", { name: x.name, club: club }),
        body: d
          ? __i18n_k("league.movenews.moveNews.body.c6e0374e", { club: club, name: iga(x.name), years: d.years, usd: usd(d.total), club2: eunneun(club), usd2: usd(d.fee), value: r ? __i18n_k("league.movenews.moveNews.body.85330a1d", { name: x.name, r: r }) : '' })
          : __i18n_k("league.movenews.moveNews.body.b661cdba", { club: club, name: iga(x.name), name2: eunneun(x.name), club2: club }),
        quotes: [said(x, d ? pick(MLB, id) : __i18n_k("league.movenews.moveNews.quotes.17c3607e")), ...(mine && d ? fans(FANS.leaving, id) : [])],
        facts: { type: __i18n_k("league.movenews.facts.type.6734925e"), date, club, player: x.name, ...(d ? { years: d.years, total: usd(d.total), fee: usd(d.fee) } : { result: __i18n_k("league.movenews.facts.result.98fac7f9") }) },
        detail: playerFacts(s, x, season),
        players: [x.id],
        mine,
      });
      return;
    }
    case 'fa': {
      const x = p(m.id);
      const mine = m.to === u || m.from === u;
      if (!x || (!mine && m.grade !== 'A')) return;
      const [to, from] = [short(s, m.to), short(s, m.from)];
      const stay = m.to === m.from;
      const id = `mv-fa-${date}-${m.id}`;
      const r = recent(s, x);
      const bonus = m.bonus ?? 0,
        options = m.options ?? 0;
      const total = bonus + m.annual * m.years + options + (m.extra ? m.annual * m.extra.years : 0);
      const len = m.extra ? __i18n_k("league.movenews.moveNews.len.1538dc1f", { years: m.years, years2: m.extra.years }) : __i18n_k("league.movenews.moveNews.len.044a2535", { years: m.years });
      const terms = bonus || options ? __i18n_k("league.movenews.moveNews.terms.e9388db1", { len: len, won: won(total) }) : __i18n_k("league.movenews.moveNews.terms.5253a19f", { len: len, won: won(m.annual) });
      const parts = [bonus ? __i18n_k("league.movenews.moveNews.parts.2c68d3e0", { won: won(bonus) }) : '', __i18n_k("league.movenews.moveNews.parts.ffaecbf6", { won: won(m.annual) }), options ? __i18n_k("league.movenews.moveNews.parts.1d8c1f09", { won: won(options) }) : ''].filter(Boolean).join(', ');
      const option = m.extra ? (m.extra.holder === 'club' ? __i18n_k("league.movenews.moveNews.option.5fa83554", { years: m.years, years2: m.extra.years }) : __i18n_k("league.movenews.moveNews.option.6afda4c9", { years: m.years })) : '';
      addNews(s, {
        ...base,
        id,
        title: stay ? __i18n_k("league.movenews.moveNews.title.c4fb97e2", { to: to, name: x.name, terms: terms }) : __i18n_k("league.movenews.moveNews.title.d45d16f9", { name: x.name, to: ro(to), terms: terms }),
        body: __i18n_k("league.movenews.moveNews.body.b0de8e91", { grade: m.grade, name: iga(x.name), value: stay ? __i18n_k("league.movenews.moveNews.body.6756de1b", { to: to }) : __i18n_k("league.movenews.moveNews.body.de7f3f81", { from: eulreul(from), to: wagwa(to) }), terms: terms, value2: bonus || options ? ` (${parts})` : '', option: option, value3: r ? __i18n_k("league.movenews.moveNews.body.0bc32b32", { name: x.name, r: r }) : '', value4: !stay ? __i18n_k("league.movenews.moveNews.body.ac5d7b33", { from: eunneun(from) }) : '' }),
        quotes: [said(x, pick(stay ? STAY : ARRIVAL, id)), ...(mine ? fans(stay ? FANS.stay : m.from === u ? FANS.leaving : FANS.signing, id) : [])],
        facts: { type: __i18n_k("league.movenews.facts.type.b30dac4a"), date, player: x.name, grade: m.grade, from, to, years: m.years, annual: won(m.annual), ...(bonus ? { bonus: won(bonus) } : {}), ...(options ? { options: won(options) } : {}), ...(m.extra ? { option: __i18n_k("league.movenews.facts.option.ef136004", { years: m.extra.years, value: m.extra.holder === 'club' ? __i18n_k("league.movenews.facts.option.58756112") : __i18n_k("league.movenews.facts.option.c37450d6") }) } : {}), total: won(total) },
        detail: playerFacts(s, x, season),
        players: [x.id],
        mine,
      });
      return;
    }
    case 'returnee': {
      const x = p(m.id);
      const mine = m.teamId === u;
      if (!x) return;
      const club = short(s, m.teamId);
      const id = `mv-home-${date}-${m.id}`;
      const posted = x.service.postedIn;
      const terms = __i18n_k("league.movenews.moveNews.terms.eecf3803", { years: m.years, won: won(m.annual) });
      const r = recent(s, x);
      addNews(s, {
        ...base,
        id,
        title: __i18n_k("league.movenews.moveNews.title.3d83607a", { name: x.name, abroad: m.abroad, club: club, terms: terms }),
        body: __i18n_k("league.movenews.moveNews.body.898f8b68", { name: iga(x.name), abroad: m.abroad, club: wagwa(club), terms: terms, value: posted !== undefined ? __i18n_k("league.movenews.moveNews.body.d0cf0dda", { posted: posted }) : '', value2: m.own ? __i18n_k("league.movenews.moveNews.body.e152bb11", { club: club }) : __i18n_k("league.movenews.moveNews.body.eef964a6", { club: ro(club) }), value3: r ? __i18n_k("league.movenews.moveNews.body.1da4805b", { r: r }) : '' }),
        quotes: [said(x, pick(HOME, id)), ...(mine ? fans(FANS.home, id) : [])],
        facts: { type: __i18n_k("league.movenews.facts.type.49a5efe3"), date, club, player: x.name, abroad: m.abroad, years: m.years, annual: won(m.annual), ...(posted !== undefined ? { posted } : {}) },
        detail: playerFacts(s, x, season),
        players: [x.id],
        mine,
      });
      return;
    }
    case 'secondDraft': {
      const x = p(m.id);
      if (!x || (m.teamId !== u && m.from !== u)) return;
      const [club, from] = [short(s, m.teamId), short(s, m.from)];
      const id = `mv-2nd-${date}-${m.id}`;
      const r = recent(s, x);
      addNews(s, {
        ...base,
        id,
        title: m.teamId === u ? __i18n_k("league.movenews.moveNews.title.b52dbe46", { club: club, round: m.round, name: x.name }) : __i18n_k("league.movenews.moveNews.title.7bd27361", { name: x.name, club: ro(club) }),
        body: __i18n_k("league.movenews.moveNews.body.26591a58", { club: iga(club), round: m.round, from: from, name: eulreul(x.name), name2: eunneun(x.name), ageIn: ageIn(x, season), posOf: posOf(x), value: r ? __i18n_k("league.movenews.moveNews.body.4fcd47ae", { r: r }) : '' }),
        quotes: [said(x, pick(ARRIVAL, id))],
        facts: { type: __i18n_k("league.movenews.facts.type.7021a262"), date, club, from, player: x.name, round: m.round },
        detail: playerFacts(s, x, season),
        players: [x.id],
        mine: true,
      });
      return;
    }
  }
}

