import { k as __i18n_k } from '../i18n/index';
/* News (V0.7). Articles about the user's club and the league's big moments, written from templates in
   Draft Room's sports-page style (short declarative sentences, speakers who sound like themselves).
   Every article keeps the public facts it was written from, so an optional language model can rewrite
   it later (story/); the template text is always there as the fallback. Wording draws from a hash of
   the article id, never from the simulation's random streams. */
import { hashUnit } from '../draftroom';
import type { StoredBox } from './boxscore';
import type { Player, PlayerId, TeamId } from '../model/types';
import { eulreul, eunneun, iga, wagwa } from './josa';
import { isPitcher } from './players';
import type { LeagueState } from './state';
import type { PlayEvent } from './engine/types';
import { gameDetail, monthDetail, seasonDetail } from './gamedetail';
import { isRivalry, madePostseason, seasonSeries } from './twelve';
import { newsAlert } from './alerts';
import { heroInterview, type Occasion } from './interviews';

export type NewsKind = 'game' | 'milestone' | 'month' | 'season' | 'award' | 'interview' | 'move' | 'injury' | 'allstar';

export interface Quote {
  who: string;
  role: 'player' | 'manager' | 'fan' | 'gm';
  text: string;
}

export interface NewsItem {
  id: string;
  date: string;
  kind: NewsKind;
  title: string;
  body: string;
  quotes: Quote[];
  /** Public facts the article was written from (numbers and names only). */
  facts: Record<string, string | number>;
  /** Longer fact lines (V0.7.1): a game's scoring plays and lines, a month's results, a season's leaders. */
  detail?: string[];
  players: PlayerId[];
  /** A move involving the user's club (V0.7.2): automatic AI writing covers these. */
  mine?: boolean;
  /** A language model's version, when one wrote it (the template stays as the fallback). */
  ai?: { title: string; body: string; quotes: Quote[]; provider: string; model: string };
}

const KEEP = 250;

const pick = <T,>(xs: T[], key: string) => xs[Math.floor(hashUnit(key) * xs.length)]!;
const short = (s: LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? id;

export function addNews(s: LeagueState, item: Omit<NewsItem, 'id'> & { id?: string }) {
  const news = (s.news ??= []);
  const id = item.id ?? `${item.date}-${item.kind}-${news.length}`;
  if (news.some((n) => n.id === id)) return;
  news.push({ ...item, id });
  if (news.length > KEEP) news.splice(0, news.length - KEEP);
  // Our club's articles pop up too (V0.11).
  newsAlert(s, { ...item, id });
}

// ── Voices ───────────────────────────────────────────────────────────────────────────────────────

/** What a player says after a big day, by personality (Draft Room's eight). */
const PLAYER_VOICE: Record<string, string[]> = {
  '차분한 노력파': [__i18n_k("league.news.pLAYER_VOICE.6f28190f"), __i18n_k("league.news.pLAYER_VOICE.43437f4c")],
  '승부욕 강한 도전자': [__i18n_k("league.news.pLAYER_VOICE.a37e3e6e"), __i18n_k("league.news.pLAYER_VOICE.a8d952e7")],
  '밝은 분위기 메이커': [__i18n_k("league.news.pLAYER_VOICE.7bbd73e1"), __i18n_k("league.news.pLAYER_VOICE.71596a58")],
  '분석을 즐기는 연구형': [__i18n_k("league.news.pLAYER_VOICE.56278469"), __i18n_k("league.news.pLAYER_VOICE.8f657060")],
  '책임감 강한 리더': [__i18n_k("league.news.pLAYER_VOICE.66ebf08e"), __i18n_k("league.news.pLAYER_VOICE.48501724")],
  '말보다 행동하는 실천형': [__i18n_k("league.news.pLAYER_VOICE.67c03433"), __i18n_k("league.news.pLAYER_VOICE.fd9b828c")],
  '꾸준함을 믿는 성실형': [__i18n_k("league.news.pLAYER_VOICE.939ec82c"), __i18n_k("league.news.pLAYER_VOICE.3588afff")],
  '큰 무대를 즐기는 대담형': [__i18n_k("league.news.pLAYER_VOICE.26c3db30"), __i18n_k("league.news.pLAYER_VOICE.4ac1ef38")],
};
const PLAYER_DEFAULT = [__i18n_k("league.news.pLAYER_DEFAULT.088e0249"), __i18n_k("league.news.pLAYER_DEFAULT.d58cd953")];

const MANAGER_WIN = [__i18n_k("league.news.mANAGER_WIN.1f6f0cd0"), __i18n_k("league.news.mANAGER_WIN.63969fd3"), __i18n_k("league.news.mANAGER_WIN.4d0c2385")];
const MANAGER_LOSS = [__i18n_k("league.news.mANAGER_LOSS.2956a8f7"), __i18n_k("league.news.mANAGER_LOSS.4f3ff2ef"), __i18n_k("league.news.mANAGER_LOSS.eb065d8a")];
const RIVAL_WIN = [__i18n_k("league.news.rIVAL_WIN.5bbd84fc"), __i18n_k("league.news.rIVAL_WIN.dd6dcd5d"), __i18n_k("league.news.rIVAL_WIN.1b65c750")];
const RIVAL_LOSS = [__i18n_k("league.news.rIVAL_LOSS.cbaf73ac"), __i18n_k("league.news.rIVAL_LOSS.f117d2ab"), __i18n_k("league.news.rIVAL_LOSS.93b10d5d")];
const FANS_WIN = [__i18n_k("league.news.fANS_WIN.e9853c7e"), __i18n_k("league.news.fANS_WIN.b4b00061"), __i18n_k("league.news.fANS_WIN.c7c8b138"), __i18n_k("league.news.fANS_WIN.783dbfe5")];
const FANS_LOSS = [__i18n_k("league.news.fANS_LOSS.965e02fa"), __i18n_k("league.news.fANS_LOSS.ccd88117"), __i18n_k("league.news.fANS_LOSS.ce826874"), __i18n_k("league.news.fANS_LOSS.c7e3c650")];

export const playerQuote = (p: Player, key: string): Quote => ({ who: p.name, role: 'player', text: pick(PLAYER_VOICE[p.personality] ?? PLAYER_DEFAULT, key) });
const managerQuote = (s: LeagueState, teamId: TeamId, won: boolean, key: string): Quote => ({
  who: __i18n_k("league.news.managerQuote.who.c6d3b5b1", { value: s.clubs?.[teamId]?.staff?.manager?.name ?? '' }).trim(),
  role: 'manager',
  text: pick(won ? MANAGER_WIN : MANAGER_LOSS, key),
});
/** Two different fan reactions. */
const fanQuotes = (won: boolean, key: string): Quote[] => {
  const lines = won ? FANS_WIN : FANS_LOSS;
  const a = Math.floor(hashUnit(`${key}-0`) * lines.length);
  const b = (a + 1 + Math.floor(hashUnit(`${key}-1`) * (lines.length - 1))) % lines.length;
  return [a, b].map((i) => ({ who: __i18n_k("league.news.fanQuotes.who.724cc77d"), role: 'fan' as const, text: lines[i]! }));
};

// ── Game stories ─────────────────────────────────────────────────────────────────────────────────

/**
 * The most notable thing about the user's game, if anything (one article per game at most). With
 * `recap`, an ordinary game gets a plain recap too (the box score's "기사로 쓰기").
 */
export function gameNews(s: LeagueState, box: StoredBox, log?: PlayEvent[] | null, recap = false) {
  const u = s.user;
  if (!u || (box.home !== u.teamId && box.away !== u.teamId)) return;
  const us = box.home === u.teamId ? 1 : 0;
  const them = (1 - us) as 0 | 1;
  const [rs, rt] = [box.rhe[us][0], box.rhe[them][0]];
  const won = rs > rt;
  const opp = short(s, us ? box.away : box.home);
  const me = short(s, u.teamId);
  const key = box.id;
  const name = (id: PlayerId) => s.players[id]?.name ?? '?';
  const bat = box.bat[us],
    pit = box.pit[us];
  const hero = [...bat].sort((a, b) => b[6] * 3 + b[4] + b[5] - (a[6] * 3 + a[4] + a[5]))[0];
  const ace = pit[0];
  const facts: NewsItem['facts'] = { date: box.date, club: me, opponent: opp, runsFor: rs, runsAgainst: rt, result: won ? '승' : rs < rt ? '패' : __i18n_k("league.news.facts.result.56c5af5b"), innings: box.innings };
  const walkOff = won && us === 1 && box.line[1].length === box.line[0].length && (box.line[1].at(-1) ?? 0) > 0;
  const rivalry = /^\d{4}-\d{4}$/.test(box.id) && isRivalry(s, box.home, box.away);
  const noHit = box.rhe[them][1] === 0 && box.line[them].length >= 9;
  const multiHr = bat.find((b) => b[6] >= 2);
  const bigK = pit.find((p) => p[6] >= 10);
  const fourHits = bat.find((b) => b[4] >= 4);
  let title = '',
    body = '',
    star: PlayerId | null = null,
    // The day a reporter wants a word with him (1.2.0, interviews.ts).
    occasion: Occasion | null = null;
  if (noHit) {
    star = ace?.[0] ?? null;
    occasion = { kind: 'noHit' };
    title = __i18n_k("league.news.gameNews.82f0729a", { me: me, opp: opp });
    body = __i18n_k("league.news.gameNews.f0571619", { me: iga(me), date: box.date, opp: opp, value: ace![1] >= 27 ? __i18n_k("league.news.gameNews.bb2076c4", { name: iga(name(ace![0])) }) : __i18n_k("league.news.gameNews.11f99d62", { name: wagwa(name(ace![0])) }), value2: pit.reduce((a, p) => a + p[6], 0), rs: rs, rt: rt });
  } else if (walkOff) {
    star = hero?.[0] ?? null;
    occasion = { kind: 'walkOff' };
    title = __i18n_k("league.news.gameNews.25bd79aa", { me: me, opp: opp });
    body = __i18n_k("league.news.gameNews.4e48c56c", { me: iga(me), innings: box.innings, opp: eulreul(opp), rs: rs, rt: rt, value: hero ? __i18n_k("league.news.gameNews.9a289915", { name: iga(name(hero[0])), value: hero[4], value2: hero[5] }) : '' });
  } else if (multiHr) {
    star = multiHr[0];
    occasion = { kind: 'multiHr', hr: multiHr[6] };
    title = __i18n_k("league.news.gameNews.ba51f8bc", { name: name(multiHr[0]), value: multiHr[6] });
    body = __i18n_k("league.news.gameNews.36afd8a5", { name: iga(name(multiHr[0])), opp: opp, value: multiHr[6], value2: multiHr[5], me: eunneun(me), rs: rs, rt: rt, value3: won ? __i18n_k("league.news.gameNews.0db888fd") : rs < rt ? __i18n_k("league.news.gameNews.d70ce427") : __i18n_k("league.news.gameNews.a9c65ffa") });
  } else if (bigK) {
    star = bigK[0];
    occasion = { kind: 'bigK', k: bigK[6] };
    title = __i18n_k("league.news.gameNews.85fea935", { name: name(bigK[0]), value: bigK[6] });
    body = __i18n_k("league.news.gameNews.f39f77d8", { name: iga(name(bigK[0])), opp: opp, value: Math.floor(bigK[1] / 3), value2: bigK[6], value3: bigK[3], rs: rs, rt: rt, value4: won ? __i18n_k("league.news.gameNews.0db888fd") : rs < rt ? __i18n_k("league.news.gameNews.d70ce427") : __i18n_k("league.news.gameNews.a9c65ffa") });
  } else if (fourHits) {
    star = fourHits[0];
    occasion = { kind: 'fourHits', h: fourHits[4] };
    title = __i18n_k("league.news.gameNews.2a5aed28", { name: name(fourHits[0]), value: fourHits[4] });
    body = __i18n_k("league.news.gameNews.5d132721", { name: iga(name(fourHits[0])), opp: opp, value: fourHits[2], value2: fourHits[4], me: eunneun(me), rs: rs, rt: rt, value3: won ? __i18n_k("league.news.gameNews.0db888fd") : rs < rt ? __i18n_k("league.news.gameNews.d70ce427") : __i18n_k("league.news.gameNews.a9c65ffa") });
  } else if (Math.abs(rs - rt) >= 9) {
    title = won ? __i18n_k("league.news.gameNews.d192d58e", { me: me, opp: opp, rs: rs, rt: rt }) : __i18n_k("league.news.gameNews.c24e4216", { me: me, opp: opp, rs: rs, rt: rt });
    body = won ? __i18n_k("league.news.gameNews.f9e7ccc7", { me: me, opp: opp, value: box.rhe[us][1], rs: rs }) : __i18n_k("league.news.gameNews.a0c0d280", { me: iga(me), opp: opp, rt: rt });
    star = won ? (hero?.[0] ?? null) : null;
  } else if (box.innings >= 11 && won) {
    title = __i18n_k("league.news.gameNews.454600c1", { me: me, innings: box.innings });
    body = __i18n_k("league.news.gameNews.636411c2", { me: iga(me), opp: opp, innings: box.innings, rs: rs, rt: rt });
    star = hero?.[0] ?? null;
  } else if (recap || rivalry) {
    const sp = pit[0];
    title = __i18n_k("league.news.gameNews.bd08f8d2", { me: me, opp: opp, rs: rs, rt: rt, value: won ? __i18n_k("league.news.gameNews.90e5e4d2") : rs < rt ? __i18n_k("league.news.gameNews.e99c8bc0") : __i18n_k("league.news.gameNews.ff1b1cbc") });
    body = __i18n_k("league.news.gameNews.45bf3df5", { me: iga(me), date: box.date, opp: opp, rs: rs, rt: rt, value: won ? __i18n_k("league.news.gameNews.0db888fd") : rs < rt ? __i18n_k("league.news.gameNews.d70ce427") : __i18n_k("league.news.gameNews.a9c65ffa"), value2: sp ? __i18n_k("league.news.gameNews.c4da58d0", { name: iga(name(sp[0])), value: Math.floor(sp[1] / 3), value2: sp[3] }) : '', value3: hero && hero[4] > 0 ? __i18n_k("league.news.gameNews.fa0a0d6a", { name: iga(name(hero[0])), value: hero[4], value2: hero[5] }) : '' }).trim();
    star = won ? (hero?.[0] ?? null) : null;
  } else return;
  // Every game against the twelfth club is the rivalry (V0.9): an article, with the season series so far.
  if (rivalry) {
    const sr = seasonSeries(s);
    title = __i18n_k("league.news.gameNews.abf70fb8", { title: title });
    body = __i18n_k("league.news.gameNews.b196af61", { body: body, w: sr.w, l: sr.l, value: sr.t ? __i18n_k("league.news.gameNews.136ac74d", { value: sr.t }) : '' });
    facts.rivalry = __i18n_k("league.news.gameNews.16aaa93d", { w: sr.w, l: sr.l, value: sr.t });
  }
  const quotes: Quote[] = [];
  if (star && s.players[star]) quotes.push(playerQuote(s.players[star]!, `${key}-p`));
  quotes.push(managerQuote(s, u.teamId, won, `${key}-m`), ...(rivalry ? [{ who: __i18n_k("league.news.gameNews.who.724cc77d"), role: 'fan' as const, text: pick(won ? RIVAL_WIN : RIVAL_LOSS, `${key}-r`) }] : []), ...fanQuotes(won, `${key}-f`));
  if (star) facts.star = name(star);
  addNews(s, { id: `g-${box.id}`, date: box.date, kind: 'game', title, body, quotes, facts, detail: gameDetail(s, box, log), players: star ? [star] : [] });
  // A no-hitter or a walk-off always, the other big days now and then: the hero's interview (not for a recap).
  const iv = star && occasion && !recap ? heroInterview(s, star, box.date, occasion, box.id) : null;
  if (iv) addNews(s, iv);
}

/** The box score's "기사로 쓰기": the game's article, written now if it had none. */
export function gameRecap(s: LeagueState, boxId: string) {
  const box = s.boxes?.[boxId];
  if (box) gameNews(s, box, s.pbp?.[boxId], true);
}

/** Fact lines for an article written before V0.7.1, rebuilt while its game is still kept. */
export function detailFor(s: LeagueState, item: NewsItem): string[] | undefined {
  if (item.detail) return item.detail;
  if (item.kind === 'game' && item.id.startsWith('g-')) {
    const box = s.boxes?.[item.id.slice(2)];
    if (box) return gameDetail(s, box, s.pbp?.[box.id]);
  }
  return undefined;
}


// ── Milestones ──────────────────────────────────────────────────────────────────────────────────

const MARKS: { key: 'hr' | 'h' | 'w' | 'sv' | 'k'; label: string; steps: number[]; pitcher: boolean }[] = [
  { key: 'hr', label: __i18n_k("league.news.mARKS.label.9162d3a3"), steps: [100, 200, 300, 400, 500], pitcher: false },
  { key: 'h', label: '안타', steps: [1000, 1500, 2000, 2500, 3000], pitcher: false },
  { key: 'w', label: '승', steps: [100, 150, 200], pitcher: true },
  { key: 'sv', label: '세이브', steps: [100, 200, 300, 400], pitcher: true },
  { key: 'k', label: __i18n_k("league.news.mARKS.label.3e23c769"), steps: [1000, 1500, 2000], pitcher: true },
];

/** Career totals crossing a round number today (first-team, the user's players). */
export function milestoneNews(s: LeagueState, date: string, ids: PlayerId[]) {
  for (const id of ids) {
    const p = s.players[id];
    const line = s.lines[id];
    if (!p || !line || p.teamId !== s.user?.teamId) continue;
    for (const m of MARKS) {
      if (m.pitcher !== isPitcher(p)) continue;
      const src = (c: { bat: import('../model/types').BatTotals | null; pit: import('../model/types').PitTotals | null }) =>
        m.pitcher ? ((c.pit as unknown as Record<string, number>)?.[m.key] ?? 0) : ((c.bat as unknown as Record<string, number>)?.[m.key] ?? 0);
      const before = p.career.filter((c) => !c.level).reduce((a, c) => a + src(c), 0);
      const total = before + src(line);
      for (const step of m.steps) {
        if (total < step || before >= step) continue;
        const done = s.news?.some((n) => n.id === `m-${id}-${m.key}-${step}`);
        if (done) continue;
        addNews(s, {
          id: `m-${id}-${m.key}-${step}`,
          date,
          kind: 'milestone',
          title: __i18n_k("league.news.milestoneNews.title.1a9b62ac", { name: p.name, step: step, label: m.label }),
          body: __i18n_k("league.news.milestoneNews.body.45a649c4", { name: iga(p.name), date: date, value: eulreul(`${step}${m.label}`), proSince: p.proSince }),
          quotes: [playerQuote(p, `m-${id}-${step}`)],
          facts: { player: p.name, milestone: `${step} ${m.label}`, date },
          players: [id],
        });
        const iv = heroInterview(s, id, date, { kind: 'milestone', label: `${step}${m.label}` }, `m-${id}-${m.key}-${step}`);
        if (iv) addNews(s, iv);
      }
    }
  }
}

// ── Month and season ─────────────────────────────────────────────────────────────────────────────

/** At the first game day of a month: last month's record and the club's best hitter and pitcher. */
export function monthNews(s: LeagueState, date: string) {
  const u = s.user;
  if (!u) return;
  const month = Number(date.slice(5, 7));
  const prev = month - 1;
  if (prev < 3) return;
  const id = `month-${s.year}-${prev}`;
  if (s.news?.some((n) => n.id === id)) return;
  const games = s.scores.filter((g) => Number(g.date.slice(5, 7)) === prev && (g.home === u.teamId || g.away === u.teamId));
  if (!games.length) return;
  let w = 0,
    l = 0;
  for (const g of games) {
    const mine = g.home === u.teamId ? g.hs : g.as,
      theirs = g.home === u.teamId ? g.as : g.hs;
    if (mine > theirs) w++;
    else if (mine < theirs) l++;
  }
  const me = short(s, u.teamId);
  const rate = w + l ? w / (w + l) : 0;
  const tone = rate >= 0.6 ? __i18n_k("league.news.monthNews.tone.1b64fb41") : rate >= 0.5 ? __i18n_k("league.news.monthNews.tone.6c1c2392") : rate >= 0.4 ? __i18n_k("league.news.monthNews.tone.57082266") : __i18n_k("league.news.monthNews.tone.5989973a");
  addNews(s, {
    id,
    date,
    kind: 'month',
    title: __i18n_k("league.news.monthNews.title.408a054e", { me: me, prev: prev, w: w, l: l, tone: tone }),
    body: __i18n_k("league.news.monthNews.body.319c8653", { me: iga(me), prev: prev, length: games.length, w: w, l: l, value: rate >= 0.5 ? __i18n_k("league.news.monthNews.body.dfda2360") : __i18n_k("league.news.monthNews.body.989fa7ee") }),
    quotes: fanQuotes(rate >= 0.5, id),
    facts: { month: prev, wins: w, losses: l, club: me },
    detail: monthDetail(s, u.teamId, s.year, prev),
    players: [],
  });
}

/** The season review for the user's club and the league's MVP story. */
export function seasonNews(s: LeagueState, year: number) {
  const h = s.history.find((x) => x.year === year);
  const u = s.user;
  if (!h) return;
  const date = `${year}-11-01`;
  if (h.awards?.mvp) {
    const p = s.players[h.awards.mvp];
    const c = p?.career.find((x) => x.year === year && !x.level);
    if (p && c)
      addNews(s, {
        id: `mvp-${year}`,
        date,
        kind: 'award',
        title: `${year} MVP ${p.name}`,
        body: __i18n_k("league.news.seasonNews.body.3359bd5d", { short: short(s, c.teamId), name: iga(p.name), year: year, value: c.war.toFixed(1), value2: c.bat ? __i18n_k("league.news.seasonNews.body.98221e8d", { value: (c.bat.ab ? c.bat.h / c.bat.ab : 0).toFixed(3).replace(/^0/, ''), hr: c.bat.hr }) : '', value3: c.pit ? __i18n_k("league.news.seasonNews.body.ceefa5de", { w: c.pit.w, value: c.pit.k }) : '' }),
        quotes: [playerQuote(p, `mvp-${year}`)],
        facts: { year, player: p.name, club: short(s, c.teamId), war: c.war },
        players: [p.id],
      });
  }
  if (!u) return;
  const row = h.table.find((r) => r.teamId === u.teamId);
  if (!row) return;
  const me = short(s, u.teamId);
  const champ = h.champion === u.teamId;
  const report = s.clubs?.[u.teamId]?.reports.find((r) => r.year === year);
  addNews(s, {
    id: `season-${year}`,
    date,
    kind: 'season',
    title: champ ? __i18n_k("league.news.seasonNews.title.fb55bde9", { me: me, year: year }) : __i18n_k("league.news.seasonNews.title.59683b08", { me: me, year: year, rank: row.rank }),
    body: __i18n_k("league.news.seasonNews.body.dc29c896", { me: iga(me), year: year, w: row.w, l: row.l, value: row.t, rank: row.rank, value2: champ ? __i18n_k("league.news.seasonNews.body.7e48ca85") : madePostseason(h, u.teamId) ? __i18n_k("league.news.seasonNews.body.43e0a52e") : __i18n_k("league.news.seasonNews.body.f2c6c109"), value3: report?.homeGames ? __i18n_k("league.news.seasonNews.body.64acfad3", { value: Math.round(report.fans / report.homeGames).toLocaleString('ko-KR') }) : '' }),
    quotes: [managerQuote(s, u.teamId, row.pct >= 0.5, `season-${year}`), ...fanQuotes(row.pct >= 0.5, `season-${year}`)],
    facts: { year, club: me, rank: row.rank, wins: row.w, losses: row.l, champion: champ ? __i18n_k("league.news.facts.champion.a842629a") : __i18n_k("league.news.facts.champion.cfef357d") },
    detail: seasonDetail(s, u.teamId, year),
    players: [],
  });
}

// ── Interviews on request ────────────────────────────────────────────────────────────────────────

/** A short interview the general manager asks for: this season so far, in the player's own voice. */
export function interviewNews(s: LeagueState, id: PlayerId, date: string) {
  const p = s.players[id];
  if (!p) return;
  const line = s.lines[id];
  const key = `iv-${id}-${date}`;
  const good = line?.bat ? line.bat.pa > 30 && (line.bat.h + line.bat.bb) / Math.max(1, line.bat.pa) > 0.34 : line?.pit ? line.pit.outs > 30 && (27 * line.pit.er) / line.pit.outs < 4 : false;
  const q1 = good ? __i18n_k("league.news.interviewNews.q1.f481ec23") : __i18n_k("league.news.interviewNews.q1.10793648");
  const a1 = good ? pick(PLAYER_VOICE[p.personality] ?? PLAYER_DEFAULT, key) : pick([__i18n_k("league.news.interviewNews.a1.66bfcd95"), __i18n_k("league.news.interviewNews.a1.b3a23a87"), __i18n_k("league.news.interviewNews.a1.52c16524")], key);
  addNews(s, {
    id: key,
    date,
    kind: 'interview',
    title: __i18n_k("league.news.interviewNews.title.3fc9d6c5", { name: p.name }),
    body: __i18n_k("league.news.interviewNews.body.6a739d6c", { q1: q1, a1: a1, pick: pick([__i18n_k("league.news.interviewNews.body.1be6ebe9"), __i18n_k("league.news.interviewNews.body.c32b651a"), __i18n_k("league.news.interviewNews.body.528c32ea")], `${key}-2`) }),
    quotes: [],
    facts: { player: p.name, personality: p.personality, ...(line?.bat ? { pa: line.bat.pa, h: line.bat.h, hr: line.bat.hr } : {}), ...(line?.pit ? { outs: line.pit.outs, er: line.pit.er, k: line.pit.k } : {}) },
    detail: interviewDetail(s, p, date),
    players: [id],
  });
}

/** An interview's facts: the season so far, the last five games from the kept box scores, the record. */
function interviewDetail(s: LeagueState, p: Player, date: string): string[] {
  const out: string[] = [];
  const line = s.lines[p.id];
  const team = p.teamId ? short(s, p.teamId) : '';
  out.push(__i18n_k("league.news.interviewDetail.e6604ece", { team: team, name: p.name, personality: p.personality, proSince: p.proSince }));
  const b = line?.bat,
    q = line?.pit;
  if (b?.pa) out.push(__i18n_k("league.news.interviewDetail.2d34ef43", { g: b.g, pa: b.pa, value: (b.ab ? b.h / b.ab : 0).toFixed(3).replace(/^0/, ''), hr: b.hr, rbi: b.rbi, sb: b.sb }));
  if (q?.outs) out.push(__i18n_k("league.news.interviewDetail.2fdb2812", { g: q.g, w: q.w, l: q.l, sv: q.sv, hld: q.hld, value: Math.floor(q.outs / 3), value2: ((27 * q.er) / q.outs).toFixed(2), value3: q.k }));
  const games = Object.values(s.boxes ?? {})
    .filter((x) => x.date <= date && (x.bat[0].some((r) => r[0] === p.id) || x.bat[1].some((r) => r[0] === p.id) || x.pit[0].some((r) => r[0] === p.id) || x.pit[1].some((r) => r[0] === p.id)))
    .sort((a, c) => c.date.localeCompare(a.date))
    .slice(0, 5);
  for (const g of games) {
    const side = g.bat[0].some((r) => r[0] === p.id) || g.pit[0].some((r) => r[0] === p.id) ? 0 : 1;
    const opp = short(s, side ? g.away : g.home);
    const br = g.bat[side].find((r) => r[0] === p.id);
    const pr = g.pit[side].find((r) => r[0] === p.id);
    if (br) out.push(__i18n_k("league.news.interviewDetail.83d8ec09", { value: g.date.slice(5), opp: opp, value2: br[2], value3: br[4], value4: br[5], value5: br[6] ? __i18n_k("league.news.interviewDetail.6b677dfe", { value: br[6] }) : '' }));
    if (pr) out.push(__i18n_k("league.news.interviewDetail.d923bce5", { value: g.date.slice(5), opp: opp, value2: Math.floor(pr[1] / 3), value3: pr[3], value4: pr[6], value5: pr[9] ? __i18n_k("league.news.interviewDetail.8ed13072", { value: { W: '승', L: '패', S: '세이브', H: __i18n_k("league.news.interviewDetail.h.9329045a") }[pr[9]] }) : '' }));
  }
  for (const h of (p.honors ?? []).slice(-3)) out.push(__i18n_k("league.news.interviewDetail.c9e13086", { h: h }));
  return out;
}
