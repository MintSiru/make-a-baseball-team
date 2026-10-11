import { k as __i18n_k } from '../i18n/index';
/* Fact lines for articles (V0.7.1): what happened in a game, a month or a season, written as short
   public statements a language model can build a longer story from — starters' lines, the line score,
   the big bats, every scoring play in order with the outs and runners, late pitching changes, and the
   records afterwards. Nothing hidden (no true abilities); the play wording is the same the text relay
   shows. */
import type { StoredBox } from './boxscore';
import type { PlayEvent } from './engine/types';
import type { TeamId } from '../model/types';
import { halfLabel, playText } from './playtext';
import type { LeagueState } from './state';

const short = (s: LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? id;
const ip = (outs: number) => `${Math.floor(outs / 3)}${outs % 3 ? ` ${outs % 3}/3` : ''}`;
const DEC: Record<string, string> = { W: __i18n_k("league.gamedetail.dEC.w.c3dced7f"), L: __i18n_k("league.gamedetail.dEC.l.2c36ac4f"), S: '세이브', H: __i18n_k("league.gamedetail.dEC.h.9329045a") };

const OUTS = [__i18n_k("league.gamedetail.oUTS.94b68ac8"), __i18n_k("league.gamedetail.oUTS.fe872114"), __i18n_k("league.gamedetail.oUTS.e8ecb314")];
const basesText = (b: [boolean, boolean, boolean]) => {
  const on = b.map((x, i) => (x ? `${i + 1}` : '')).filter(Boolean);
  return on.length === 0 ? __i18n_k("league.gamedetail.basesText.47e356eb") : on.length === 3 ? __i18n_k("league.gamedetail.basesText.5caa3550") : __i18n_k("league.gamedetail.basesText.f8ddeccd", { value: on.join('·') });
};

/** A club's record through `date` (wins, losses, ties). */
export function recordThrough(s: LeagueState, teamId: TeamId, date: string) {
  let w = 0,
    l = 0,
    t = 0;
  for (const g of s.scores) {
    if (g.date > date || (g.home !== teamId && g.away !== teamId)) continue;
    const mine = g.home === teamId ? g.hs : g.as,
      theirs = g.home === teamId ? g.as : g.hs;
    if (mine > theirs) w++;
    else if (mine < theirs) l++;
    else t++;
  }
  return { w, l, t };
}

export function gameDetail(s: LeagueState, box: StoredBox, log?: PlayEvent[] | null): string[] {
  const name = (id: string) => s.players[id]?.name ?? '?';
  const clubs = [short(s, box.away), short(s, box.home)] as const;
  const home = s.teams.find((t) => t.id === box.home);
  const out: string[] = [];
  out.push(__i18n_k("league.gamedetail.gameDetail.4e13dcfd", { date: box.date, value: home?.stadium.name ?? '', value2: clubs[0], value3: box.rhe[0][0], value4: box.rhe[1][0], value5: clubs[1], value6: box.innings > 9 ? __i18n_k("league.gamedetail.gameDetail.b0900d9e", { innings: box.innings }) : '', value7: box.att ? __i18n_k("league.gamedetail.gameDetail.8d16dbe5", { value: box.att.toLocaleString('ko-KR') }) : '' }));
  out.push(__i18n_k("league.gamedetail.gameDetail.f55f5df1", { value: clubs[0], value2: box.line[0].join(' '), value3: clubs[1], value4: box.line[1].join(' ') }));
  out.push(__i18n_k("league.gamedetail.gameDetail.fa511798", { value: clubs[0], value2: box.rhe[0][1], value3: clubs[1], value4: box.rhe[1][1], value5: clubs[0], value6: box.rhe[0][2], value7: clubs[1], value8: box.rhe[1][2] }));
  for (const i of [0, 1] as const) {
    const [sp, ...pen] = box.pit[i];
    if (sp) out.push(__i18n_k("league.gamedetail.gameDetail.de5344df", { value: clubs[i], name: name(sp[0]), ip: ip(sp[1]), value2: sp[2], value3: sp[3], value4: sp[4], value5: sp[5], value6: sp[6], value7: sp[8], value8: sp[9] ? ` (${DEC[sp[9]]})` : '' }));
    for (const r of pen.filter((x) => x[9] || x[3] > 0 || x[1] >= 6)) out.push(__i18n_k("league.gamedetail.gameDetail.297d63af", { value: clubs[i], name: name(r[0]), ip: ip(r[1]), value2: r[3], value3: r[6], value4: r[9] ? ` (${DEC[r[9]]})` : '' }));
    for (const b of box.bat[i].filter((x) => x[4] >= 2 || x[6] > 0 || x[5] >= 2 || x[11] > 0)) {
      const extra = [b[9] ? __i18n_k("league.gamedetail.gameDetail.extra.1402b002", { value: b[9] }) : '', b[10] ? __i18n_k("league.gamedetail.gameDetail.extra.f13dab8d", { value: b[10] }) : '', b[6] ? __i18n_k("league.gamedetail.gameDetail.extra.b7f57be3", { value: b[6] }) : '', b[11] ? __i18n_k("league.gamedetail.gameDetail.extra.0f6c81e4", { value: b[11] }) : ''].filter(Boolean).join(', ');
      out.push(__i18n_k("league.gamedetail.gameDetail.cbe430d4", { value: clubs[i], name: name(b[0]), value2: b[2], value3: b[4], value4: b[5], value5: b[3], value6: extra ? ` (${extra})` : '' }));
    }
  }
  if (log?.length) {
    // Scoring plays in order, with the situation before the play; late pitching changes.
    let outs = 0,
      bases: [boolean, boolean, boolean] = [false, false, false],
      half = '';
    log.forEach((e, n) => {
      const h = halfLabel(e.i, e.top);
      if (h !== half) {
        half = h;
        outs = 0;
        bases = [false, false, false];
      }
      if (e.k === 'pitch') {
        if (e.i >= 7) out.push(`${h} ${playText(e, `${box.id}-${n}`, name)}`);
        return;
      }
      if (e.runs > 0) out.push(__i18n_k("league.gamedetail.gameDetail.478e76e4", { h: h, value: OUTS[outs] ?? __i18n_k("league.gamedetail.gameDetail.e8ecb314"), basesText: basesText(bases), playText: playText(e, `${box.id}-${n}`, name), value2: clubs[0], value3: e.score[0], value4: e.score[1], value5: clubs[1] }));
      outs = e.outs;
      bases = e.bases;
    });
  }
  for (const i of [0, 1] as const) {
    const r = recordThrough(s, i ? box.home : box.away, box.date);
    out.push(__i18n_k("league.gamedetail.gameDetail.19c370ba", { value: clubs[i], w: r.w, l: r.l, value2: r.t }));
  }
  return out;
}

/** A month of the user's club: every result, the record and the best in its box scores. */
export function monthDetail(s: LeagueState, teamId: TeamId, year: number, month: number): string[] {
  const me = short(s, teamId);
  const out: string[] = [];
  const games = s.scores.filter((g) => Number(g.date.slice(0, 4)) === year && Number(g.date.slice(5, 7)) === month && (g.home === teamId || g.away === teamId));
  for (const g of games) {
    const home = g.home === teamId;
    const mine = home ? g.hs : g.as,
      theirs = home ? g.as : g.hs;
    out.push(__i18n_k("league.gamedetail.monthDetail.98aa655c", { value: g.date.slice(5), value2: home ? __i18n_k("league.gamedetail.monthDetail.13a46f96") : __i18n_k("league.gamedetail.monthDetail.ef6b033f"), short: short(s, home ? g.away : g.home), mine: mine, theirs: theirs, value3: mine > theirs ? '승' : mine < theirs ? '패' : __i18n_k("league.gamedetail.monthDetail.56c5af5b") }));
  }
  // The month's best from the kept box scores.
  const bat = new Map<string, { ab: number; h: number; hr: number; rbi: number }>();
  const pit = new Map<string, { outs: number; er: number; k: number; w: number; sv: number }>();
  for (const b of Object.values(s.boxes ?? {})) {
    if (Number(b.date.slice(0, 4)) !== year || Number(b.date.slice(5, 7)) !== month) continue;
    if (b.home !== teamId && b.away !== teamId) continue;
    const i: 0 | 1 = b.home === teamId ? 1 : 0;
    for (const r of b.bat[i]) {
      const x = bat.get(r[0]) ?? { ab: 0, h: 0, hr: 0, rbi: 0 };
      x.ab += r[2];
      x.h += r[4];
      x.hr += r[6];
      x.rbi += r[5];
      bat.set(r[0], x);
    }
    for (const r of b.pit[i]) {
      const x = pit.get(r[0]) ?? { outs: 0, er: 0, k: 0, w: 0, sv: 0 };
      x.outs += r[1];
      x.er += r[4];
      x.k += r[6];
      x.w += r[9] === 'W' ? 1 : 0;
      x.sv += r[9] === 'S' ? 1 : 0;
      pit.set(r[0], x);
    }
  }
  const name = (id: string) => s.players[id]?.name ?? '?';
  const hitters = [...bat.entries()].filter(([, x]) => x.ab >= 30).sort((a, b) => b[1].h / b[1].ab - a[1].h / a[1].ab).slice(0, 3);
  for (const [id, x] of hitters) out.push(__i18n_k("league.gamedetail.monthDetail.86a1b206", { me: me, month: month, name: name(id), ab: x.ab, h: x.h, value: (x.h / x.ab).toFixed(3).replace(/^0/, ''), hr: x.hr, rbi: x.rbi }));
  const arms = [...pit.entries()].filter(([, x]) => x.outs >= 30).sort((a, b) => a[1].er / a[1].outs - b[1].er / b[1].outs).slice(0, 2);
  for (const [id, x] of arms) out.push(__i18n_k("league.gamedetail.monthDetail.72928296", { me: me, month: month, name: name(id), ip: ip(x.outs), value: ((27 * x.er) / x.outs).toFixed(2), value2: x.k, w: x.w, value3: x.sv ? __i18n_k("league.gamedetail.monthDetail.addf22ee", { sv: x.sv }) : '' }));
  const last = games.at(-1);
  if (last) {
    const r = recordThrough(s, teamId, last.date);
    out.push(__i18n_k("league.gamedetail.monthDetail.da519988", { me: me, month: month, w: r.w, l: r.l, value: r.t }));
  }
  return out;
}

/** A season of the user's club: the finish, the leaders, awards, crowds and the postseason. */
export function seasonDetail(s: LeagueState, teamId: TeamId, year: number): string[] {
  const me = short(s, teamId);
  const h = s.history.find((x) => x.year === year);
  const out: string[] = [];
  if (!h) return out;
  const row = h.table.find((r) => r.teamId === teamId);
  if (row) out.push(__i18n_k("league.gamedetail.seasonDetail.d794e72e", { me: me, year: year, rank: row.rank, w: row.w, l: row.l, value: row.t, value2: row.pct.toFixed(3).replace(/^0/, ''), rs: row.rs, ra: row.ra }));
  const top = h.table[0];
  if (top && top.teamId !== teamId) out.push(__i18n_k("league.gamedetail.seasonDetail.a462a9ca", { short: short(s, top.teamId), w: top.w, l: top.l }));
  for (const x of h.series.filter((x) => x.high === teamId || x.low === teamId)) {
    const round = { wildcard: __i18n_k("league.gamedetail.round.wildcard.cbea62e5"), semipo: __i18n_k("league.gamedetail.round.semipo.42e1bde5"), po: __i18n_k("league.gamedetail.round.po.4651993c"), ks: __i18n_k("league.gamedetail.round.ks.3c8e7785") }[x.round];
    const opp = x.high === teamId ? x.low : x.high;
    const [mine, theirs] = x.high === teamId ? [x.highWins, x.lowWins] : [x.lowWins, x.highWins];
    out.push(__i18n_k("league.gamedetail.seasonDetail.f0727363", { round: round, short: short(s, opp), mine: mine, theirs: theirs, value: x.winner === teamId ? __i18n_k("league.gamedetail.seasonDetail.66409b62") : __i18n_k("league.gamedetail.seasonDetail.bbd3d203") }));
  }
  if (h.champion) out.push(__i18n_k("league.gamedetail.seasonDetail.4a910612", { year: year, short: short(s, h.champion) }));
  const recs = Object.values(s.players)
    .map((p) => ({ p, c: p.career.find((c) => c.year === year && !c.level && c.teamId === teamId) }))
    .filter((x): x is { p: (typeof x)['p']; c: NonNullable<(typeof x)['c']> } => !!x.c);
  for (const { p, c } of recs.filter((x) => x.c.bat && x.c.bat.pa >= 300).sort((a, b) => b.c.war - a.c.war).slice(0, 3)) {
    const b = c.bat!;
    out.push(__i18n_k("league.gamedetail.seasonDetail.a6b15ef0", { me: me, name: p.name, value: (b.ab ? b.h / b.ab : 0).toFixed(3).replace(/^0/, ''), hr: b.hr, rbi: b.rbi, sb: b.sb, value2: c.war.toFixed(1) }));
  }
  for (const { p, c } of recs.filter((x) => x.c.pit && x.c.pit.outs >= 150).sort((a, b) => b.c.war - a.c.war).slice(0, 3)) {
    const q = c.pit!;
    out.push(__i18n_k("league.gamedetail.seasonDetail.8d17b56d", { me: me, name: p.name, w: q.w, l: q.l, sv: q.sv, hld: q.hld, ip: ip(q.outs), value: ((27 * q.er) / Math.max(1, q.outs)).toFixed(2), value2: q.k, value3: c.war.toFixed(1) }));
  }
  const a = h.awards;
  if (a) {
    const ours = (id: string | null) => !!id && recs.some((x) => x.p.id === id);
    if (ours(a.mvp)) out.push(`MVP ${s.players[a.mvp!]!.name}`);
    if (ours(a.rookie)) out.push(__i18n_k("league.gamedetail.seasonDetail.0e7cc42d", { name: s.players[a.rookie!]!.name }));
    for (const g of a.goldenGloves.filter((g) => ours(g.id))) out.push(__i18n_k("league.gamedetail.seasonDetail.933ff1b2", { pos: g.pos, name: s.players[g.id]!.name }));
    for (const t of a.titles.filter((t) => ours(t.id))) out.push(__i18n_k("league.gamedetail.seasonDetail.44754ad4", { label: t.label, name: s.players[t.id]!.name, value: t.value }));
  }
  const report = s.clubs?.[teamId]?.reports.find((r) => r.year === year);
  if (report?.homeGames) out.push(__i18n_k("league.gamedetail.seasonDetail.cca20f95", { value: report.fans.toLocaleString('ko-KR'), value2: Math.round(report.fans / report.homeGames).toLocaleString('ko-KR'), value3: report.sellouts ?? 0 }));
  return out;
}
