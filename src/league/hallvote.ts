import { k as __i18n_k } from '../i18n/index';
/* 2.0.76 (the user's request: 「명예의 전당 자동 확정이 아니라 심의해서」): the hall of fame's committee votes every winter.
   A retired player is on the ballot from the winter after his last season, for ten winters, when his career is at
   least near the hall's bar (awards.ts hallScore); match fixing bars him for good. His share of the vote follows how
   far his career clears the bar, grows a little with each winter on the ballot, and loses what his record of offenses
   weighs (conduct.ts: doping and drug use most, drunk driving, violence, gambling and the rest less). 75% enters the
   hall; under 5%, or ten winters without, drops him from the ballot. */
import { hashUnit } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { addAlert } from './alerts';
import { hallScore, induct } from './awards';
import { conductWeight } from './conduct';
import { addNews } from './news';
import type { LeagueState } from './state';

export interface HallVoteRow {
  id: PlayerId;
  name: string;
  /** Share of the vote (%). */
  pct: number;
  /** His winter on the ballot (1 to 10). */
  on: number;
  result: 'in' | 'stay' | 'out';
  /** What his record of offenses took off (points). */
  conduct?: number;
}
export interface HallVote {
  year: number;
  rows: HallVoteRow[];
}

/** The share to enter and to stay, the winters on the ballot, the career a candidate needs (of the bar), the vote's
    curve (half at `mid` of the bar, steeper with `slope`), what each further winter adds, and the vote's spread. */
export const HALL_VOTE = { in: 75, out: 5, years: 10, min: 0.45, mid: 0.88, slope: 10, perYear: 2.5, noise: 5, keep: 30 };

/** His last first-team season. */
const lastSeason = (p: Player) => Math.max(...p.career.filter((c) => !c.level).map((c) => c.year));

/** His winter on the ballot in `year` (0: not on it). */
export function ballotWinter(s: LeagueState, p: Player, year: number): number {
  if (p.status !== 'retired' || !p.career.some((c) => !c.level)) return 0;
  if (s.hallOfFame?.some((h) => h.id === p.id) || s.hallDropped?.includes(p.id)) return 0;
  const on = year - lastSeason(p);
  if (on < 1 || on > HALL_VOTE.years) return 0;
  if (conductWeight(p) === Infinity || hallScore(s, p) < HALL_VOTE.min) return 0;
  return on;
}

/** This winter's ballot. */
export const ballot = (s: LeagueState, year: number) =>
  Object.values(s.players)
    .map((p) => ({ p, on: ballotWinter(s, p, year) }))
    .filter((x) => x.on > 0);

/** His share of the vote (%). */
export function hallSupport(s: LeagueState, p: Player, year: number, on: number): { pct: number; conduct: number } {
  const V = HALL_VOTE;
  const base = 100 / (1 + Math.exp(-(hallScore(s, p) - V.mid) * V.slope));
  const conduct = conductWeight(p);
  const noise = (hashUnit(`${s.seed}|hall-vote|${p.id}|${year}`) - 0.5) * 2 * V.noise;
  const pct = Math.max(0, Math.min(100, base + V.perYear * (on - 1) + noise - conduct));
  return { pct: Math.round(pct * 10) / 10, conduct };
}

/** The winter's vote: who enters, who stays on the ballot, who drops off; the news of it. */
export function hallVote(s: LeagueState, year: number) {
  if (s.hallVotes?.some((v) => v.year === year)) return;
  const rows: HallVoteRow[] = ballot(s, year)
    .map(({ p, on }) => {
      const { pct, conduct } = hallSupport(s, p, year, on);
      const result: HallVoteRow['result'] = pct >= HALL_VOTE.in ? 'in' : pct < HALL_VOTE.out || on >= HALL_VOTE.years ? 'out' : 'stay';
      return { id: p.id, name: p.name, pct, on, result, ...(conduct ? { conduct } : {}) };
    })
    .sort((a, b) => b.pct - a.pct || a.id.localeCompare(b.id));
  if (!rows.length) return;
  const list = (s.hallVotes ??= []);
  list.push({ year, rows });
  if (list.length > HALL_VOTE.keep) list.splice(0, list.length - HALL_VOTE.keep);
  for (const r of rows) {
    if (r.result === 'in') induct(s, s.players[r.id]!, year, r.pct);
    else if (r.result === 'out') (s.hallDropped ??= []).push(r.id);
  }
  const inducted = rows.filter((r) => r.result === 'in');
  const title = inducted.length ? __i18n_k("league.hallvote.text.74228fd3", { year, names: inducted.map((r) => r.name).join(', ') }) : __i18n_k("league.hallvote.text.ad77c219", { year });
  const top = rows.slice(0, 6).map((r) => __i18n_k("league.hallvote.text.b5f98ef3", { name: r.name, pct: r.pct.toFixed(1), on: r.on }));
  const body = [__i18n_k("league.hallvote.text.4ccc3b71", { n: rows.length, need: HALL_VOTE.in }), top.join(' · ')].join(' ');
  addNews(s, { id: `hall-vote-${year}`, date: `${year}-12-05`, kind: 'award', title, body, quotes: [], facts: { 후보: rows.length, 헌액: inducted.length }, players: rows.slice(0, 6).map((r) => r.id), mine: false });
  // Ours on the ballot: the result, as an article.
  const me = s.user?.teamId;
  const ours = me ? rows.filter((r) => s.players[r.id]!.career.some((c) => !c.level && c.teamId === me)) : [];
  if (ours.length)
    addAlert(s, {
      id: `hall-vote-${year}`,
      date: `${year}-12-05`,
      kind: 'hall',
      title,
      lines: ours.map((r) => `${__i18n_k("league.hallvote.text.b5f98ef3", { name: r.name, pct: r.pct.toFixed(1), on: r.on })} · ${r.result === 'in' ? __i18n_k("league.hallvote.text.90a76354") : r.result === 'out' ? __i18n_k("league.hallvote.text.82508a1b") : __i18n_k("league.hallvote.text.88a22cbb")}`),
      minor: true,
      players: ours.map((r) => r.id),
    });
}

/** His latest vote, when he has had one. */
export function lastVote(s: LeagueState, id: PlayerId): (HallVoteRow & { year: number }) | undefined {
  for (const v of [...(s.hallVotes ?? [])].reverse()) {
    const r = v.rows.find((x) => x.id === id);
    if (r) return { ...r, year: v.year };
  }
  return undefined;
}
