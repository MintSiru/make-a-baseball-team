import { k as __i18n_k } from '../i18n/index';
/* 2.0.37 (the user's request): talking a player out of going abroad. Two kinds of our players want to go: one who
   has asked to be posted (MLB, or NPB when the majors pass on him), and a free agent Japan is about to sign. The
   general manager may try to talk him round; the chance is his: loyalty helps, youth and a big name (the dream is
   bigger) hurt, and a club that played in October is easier to stay at.
   Talked round, he stays without a grudge (his form a little up as the season opens) and does not ask again for two
   winters — a free agent stays on the KBO market, where we may re-sign him. Not talked round, he sulks (form down at
   the start of the season, his fans a little cooler); a posting candidate simply refused sulks a little too. */
import { rng } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { eunneun, iga } from './josa';
import { adjustFans, note, setForm } from './life';
import { addNews } from './news';
import { ageIn } from './players';
import type { LeagueState } from './state';
import { traitsOf } from './traits';

export const ABROAD = {
  base: 0.4,
  /** Per point of loyalty over 50; per year under 28; per grade point over 60. */
  loyalty: 0.008,
  youth: 0.03,
  grade: 0.015,
  /** Our club played in last year's postseason. */
  winner: 0.1,
  min: 0.05,
  max: 0.85,
  /** Winters he does not ask again after agreeing to stay. */
  stay: 2,
  form: { kept: 1, failed: -1.5, refused: -1, days: 30 },
  fans: -3,
};

/** He agreed to stay a winter or two ago and does not ask (or listen to Japan) now. */
export const staysHome = (s: Pick<LeagueState, 'abroadStay'>, id: PlayerId, next: number) => {
  const y = s.abroadStay?.[id];
  return y !== undefined && next - 1 - y < ABROAD.stay;
};

/** The chance he listens. */
export function persuadeAbroadChance(s: LeagueState, p: Player, next: number): number {
  const A = ABROAD;
  const t = traitsOf(p);
  const age = ageIn(p, next);
  const lastYear = s.history.find((h) => h.year === next - 1);
  const me = s.user?.teamId;
  const october = !!lastYear?.series.some((x) => x.high === me || x.low === me);
  const x = A.base + (t.loyalty - 50) * A.loyalty - Math.max(0, 28 - age) * A.youth - Math.max(0, p.scouting.current - 60) * A.grade + (october ? A.winner : 0);
  return Math.round(Math.min(A.max, Math.max(A.min, x)) * 100) / 100;
}

const opening = (next: number) => `${next}-04-01`;

/** He tried and it worked: stays, a little lifted. */
function kept(s: LeagueState, p: Player, next: number, why: 'posting' | 'japan') {
  (s.abroadStay ??= {})[p.id] = next - 1;
  setForm(p, ABROAD.form.kept, opening(next), ABROAD.form.days, __i18n_k("league.abroad.text.8e78b5ac"));
  const title = why === 'posting' ? __i18n_k("league.abroad.text.709f0dc5", { name: p.name }) : __i18n_k("league.abroad.text.3b56e509", { name: p.name });
  const body = why === 'posting' ? __i18n_k("league.abroad.text.f0d35e8f", { name: iga(p.name) }) : __i18n_k("league.abroad.text.78f4d76b", { name: iga(p.name) });
  const date = `${next - 1}-11-${why === 'posting' ? '08' : '11'}`;
  note(p, date, title, 'good');
  addNews(s, { id: `abroad-kept-${next - 1}-${p.id}`, date, kind: 'move', title, body, quotes: [], facts: { player: p.name }, players: [p.id], mine: true });
}

/** He tried and it did not work, or was not asked: sulks into the new season. */
function sulks(s: LeagueState, p: Player, next: number, tried: boolean) {
  setForm(p, tried ? ABROAD.form.failed : ABROAD.form.refused, opening(next), ABROAD.form.days, __i18n_k("league.abroad.text.9a7a688a"));
  const date = `${next - 1}-11-08`;
  if (tried) {
    adjustFans(p, ABROAD.fans);
    const title = __i18n_k("league.abroad.text.e58a2bec", { name: p.name });
    note(p, date, title, 'bad');
    addNews(s, { id: `abroad-sulk-${next - 1}-${p.id}`, date, kind: 'move', title, body: __i18n_k("league.abroad.text.8f1c4f9d", { name: eunneun(p.name) }), quotes: [], facts: { player: p.name }, players: [p.id], mine: true });
  } else note(p, date, __i18n_k("league.abroad.text.2504be7c"), 'bad');
}

/** Our posting candidates we did not post: talked to (those in `persuade`) or simply refused. */
export function postingPersuasion(s: LeagueState, candidates: PlayerId[], posted: PlayerId[], persuade: PlayerId[], next: number) {
  for (const id of candidates) {
    if (posted.includes(id)) continue;
    const p = s.players[id];
    if (!p) continue;
    if (persuade.includes(id)) {
      if (rng(`${s.seed}|abroad-persuade|${next - 1}|${id}`)() < persuadeAbroadChance(s, p, next)) kept(s, p, next, 'posting');
      else sulks(s, p, next, true);
    } else sulks(s, p, next, false);
  }
}

/** Our free agents Japan is about to sign: talked to or let go (toJapan moves those left). */
export function japanPersuasion(s: LeagueState, ids: PlayerId[], persuade: PlayerId[], next: number) {
  for (const id of ids) {
    const p = s.players[id];
    if (!p || !persuade.includes(id)) continue;
    if (rng(`${s.seed}|abroad-japan|${next - 1}|${id}`)() < persuadeAbroadChance(s, p, next)) kept(s, p, next, 'japan');
  }
}
