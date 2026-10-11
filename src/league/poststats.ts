import { k as __i18n_k } from '../i18n/index';
/* Postseason records (1.4.0, from the 1.3 feedback): each player's line for every postseason he played in, how far
   his club went that year, his postseason totals, and the record room's postseason boards (this postseason's
   leaders and the all-time ones). Postseason games never count toward the season's totals or awards. */
import type { BatTotals, PitTotals, Player, PlayerId, TeamId } from '../model/types';
import { addInto, emptyBat, emptyPit, type LeagueState, type SeriesResult } from './state';
import { avg, era, ip, ops } from './stats';
import { shortName } from './views';

const ORDER: SeriesResult['round'][] = ['wildcard', 'semipo', 'po', 'ks'];
const ROUND: Record<SeriesResult['round'], string> = { wildcard: __i18n_k("league.poststats.rOUND.wildcard.cbea62e5"), semipo: __i18n_k("league.poststats.rOUND.semipo.641f8233"), po: 'PO', ks: __i18n_k("league.poststats.rOUND.ks.3c8e7785") };

/** The series of a year: the history's, or this year's being played. */
export function seriesOf(s: LeagueState, year: number): SeriesResult[] {
  return s.history.find((h) => h.year === year)?.series ?? (year === s.year ? s.postseason : []);
}

/** How far a club went in a year's postseason: 우승, 준우승, the round it went out in, or 진행 중. */
export function postResult(s: LeagueState, year: number, teamId: TeamId): string {
  const live = year === s.year && s.bracket?.year === year && !s.bracket.done;
  const mine = seriesOf(s, year).filter((x) => x.high === teamId || x.low === teamId);
  if (!mine.length) return live ? __i18n_k("league.poststats.postResult.7890cafc") : '-';
  const last = mine.reduce((a, x) => (ORDER.indexOf(x.round) > ORDER.indexOf(a.round) ? x : a));
  if (last.winner !== teamId) return last.round === 'ks' ? __i18n_k("league.poststats.postResult.3660fdbb") : __i18n_k("league.poststats.postResult.80e2ba84", { value: ROUND[last.round] });
  if (last.round === 'ks') return '우승';
  return live ? __i18n_k("league.poststats.postResult.7890cafc") : __i18n_k("league.poststats.postResult.c9479131", { value: ROUND[last.round] });
}

export interface PostRow {
  year: number;
  team: string;
  result: string;
  bat: BatTotals | null;
  pit: PitTotals | null;
  current: boolean;
}

/** His postseason lines, oldest first, this postseason's (still being played or not yet filed) last. */
export function postRows(s: LeagueState, p: Player): PostRow[] {
  const rows: PostRow[] = (p.post ?? []).map((r) => ({ year: r.year, team: shortName(s, r.teamId), result: postResult(s, r.year, r.teamId), bat: r.bat, pit: r.pit, current: false }));
  const now = s.postLines?.[p.id];
  if (now && (now.bat || now.pit)) rows.push({ year: s.year, team: shortName(s, now.teamId), result: postResult(s, s.year, now.teamId), bat: now.bat, pit: now.pit, current: true });
  return rows;
}

/** Postseason totals: batting, pitching, years and titles. */
export function postTotals(rows: PostRow[]) {
  const bat = rows.some((r) => r.bat) ? emptyBat() : null,
    pit = rows.some((r) => r.pit) ? emptyPit() : null;
  for (const r of rows) {
    if (bat && r.bat) addInto(bat, r.bat);
    if (pit && r.pit) addInto(pit, r.pit);
  }
  return { bat, pit, years: new Set(rows.map((r) => r.year)).size, titles: rows.filter((r) => r.result === '우승').length };
}

type Board = { label: string; rows: { id: PlayerId; name: string; team: string; value: string; key: number }[] };

/** One postseason's or every postseason's leaders. */
function boards(s: LeagueState, lines: { p: Player; teamId: TeamId; bat: BatTotals | null; pit: PitTotals | null }[], n: number, minPa: number, minOuts: number): Board[] {
  const by = new Map<PlayerId, { p: Player; teamId: TeamId; bat: BatTotals; pit: PitTotals }>();
  for (const x of lines) {
    const t = by.get(x.p.id) ?? { p: x.p, teamId: x.teamId, bat: emptyBat(), pit: emptyPit() };
    if (x.bat) addInto(t.bat, x.bat);
    if (x.pit) addInto(t.pit, x.pit);
    t.teamId = x.teamId;
    by.set(x.p.id, t);
  }
  const all = [...by.values()];
  const board = (label: string, pick: (t: (typeof all)[number]) => number | null, show: (v: number) => string, low = false): Board => ({
    label,
    rows: all
      .flatMap((t) => {
        const v = pick(t);
        return v == null || (!low && v <= 0) ? [] : [{ id: t.p.id, name: t.p.name, team: shortName(s, t.teamId), value: show(v), key: v }];
      })
      .sort((a, b) => (low ? a.key - b.key : b.key - a.key))
      .slice(0, n),
  });
  const count = (v: number) => `${v}`;
  return [
    board('안타', (t) => t.bat.h, count),
    board(__i18n_k("league.poststats.boards.9162d3a3"), (t) => t.bat.hr, count),
    board(__i18n_k("league.poststats.boards.fed1c588"), (t) => t.bat.rbi, count),
    board(__i18n_k("league.poststats.boards.5f589bdc", { minPa: minPa }), (t) => (t.bat.pa >= minPa ? avg(t.bat) : null), (v) => v.toFixed(3).replace(/^0/, '')),
    board(__i18n_k("league.poststats.boards.f18c1e6a", { minPa: minPa }), (t) => (t.bat.pa >= minPa ? ops(t.bat) : null), (v) => v.toFixed(3).replace(/^0/, '')),
    board('승', (t) => t.pit.w, count),
    board('세이브', (t) => t.pit.sv, count),
    board(__i18n_k("league.poststats.boards.3e23c769"), (t) => t.pit.k, count),
    board(__i18n_k("league.poststats.boards.639a1f2f"), (t) => t.pit.outs, ip),
    board(__i18n_k("league.poststats.boards.600ac049", { value: Math.round(minOuts / 3) }), (t) => (t.pit.outs >= minOuts ? era(t.pit) : null), (v) => v.toFixed(2), true),
  ];
}

/** The record room's postseason page: the latest postseason's leaders and every postseason's. */
export function postseasonBoards(s: LeagueState) {
  const players = Object.values(s.players);
  let year: number | null = null;
  let latest: { p: Player; teamId: TeamId; bat: BatTotals | null; pit: PitTotals | null }[] = [];
  const now = Object.entries(s.postLines ?? {});
  if (now.length) {
    year = s.year;
    latest = now.flatMap(([id, l]) => (s.players[id] ? [{ p: s.players[id]!, teamId: l.teamId, bat: l.bat, pit: l.pit }] : []));
  } else {
    year = players.reduce<number | null>((m, p) => p.post?.reduce<number | null>((a, r) => (a == null || r.year > a ? r.year : a), m) ?? m, null);
    if (year != null) latest = players.flatMap((p) => (p.post ?? []).filter((r) => r.year === year).map((r) => ({ p, teamId: r.teamId, bat: r.bat, pit: r.pit })));
  }
  const ever = [
    ...players.flatMap((p) => (p.post ?? []).map((r) => ({ p, teamId: r.teamId, bat: r.bat, pit: r.pit }))),
    ...now.flatMap(([id, l]) => (s.players[id] ? [{ p: s.players[id]!, teamId: l.teamId, bat: l.bat, pit: l.pit }] : [])),
  ];
  const first = players.reduce<number | null>((m, p) => p.post?.reduce<number | null>((a, r) => (a == null || r.year < a ? r.year : a), m) ?? m, null);
  return {
    year,
    latest: year == null ? [] : boards(s, latest, 5, 10, 15),
    ever: boards(s, ever, 10, 50, 60),
    since: first ?? year,
  };
}
