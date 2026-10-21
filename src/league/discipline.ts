import { k as __i18n_k } from '../i18n/index';
/* 2.0.36 (the user's request): 문책성 2군행 — a manager (or the general manager himself) sends a player down for a set
   time after a slump or a row in the papers. Every club's manager does it: every two weeks he looks at what each
   first-team player did since the last look (a hitter's OPS, a pitcher's ERA), and now and then sends a struggling
   one down; a player in a row (a gaffe, a feud, trouble on social media) may go down as well. The general manager can
   send one of ours down himself from the player's screen.

   He is off the first team until the date (he plays in the futures meanwhile; the KBO's ten days before he can be
   registered again are the shortest stay). A player with a short fuse (논란성, 논쟁성: traits.ts) is likelier to answer
   back in public: the stay grows, his form and the fans' fondness drop. One who takes it well may come back sharper. */
import { rng } from '../draftroom';
import type { Player, PlayerId, TeamId } from '../model/types';
import { addAlert } from './alerts';
import { eulreul, eunneun } from './josa';
import { adjustFans, note, setForm } from './life';
import { addNews } from './news';
import { isForeign, isPitcher } from './players';
import { firstTeamIds, type LeagueState } from './state';
import { temperOf, traitsOf } from './traits';

export const DISCIPLINE = {
  /** Days between the manager's looks, and the stays (the KBO's ten days at the least). */
  every: 14,
  days: { slump: 10, scandal: 10, gm: [10, 20] as const, pushback: 10 },
  /** A slump since the last look: a hitter's OPS under this in this many plate appearances; a pitcher's ERA over this
      in this many outs (a starter, a reliever). */
  slump: { pa: 35, ops: 0.45, sp: { outs: 30, era: 8 }, rp: { outs: 12, era: 9.5 } },
  /** The chance a slumping player is sent down (a club's best much less), and one in a row. */
  chance: { slump: 0.14, star: 0.3, scandal: 0.3 },
  /** Answering back: base, and per point of 논란성 / 논쟁성 above 50 (below lowers it). */
  pushback: { base: 0.08, controversy: 0.004, temper: 0.006, min: 0.02, max: 0.6 },
  /** Taking it well: the chance he comes back sharper, and by how much (grade points, days). */
  wake: { chance: 0.35, form: 1.5, days: 12 },
  form: { pushback: -1.5, days: 14 },
  fans: { pushback: -4 },
  /** A club's best players (public grade) for the managers' caution and the papers. */
  star: 62,
};

export type DisciplineWhy = 'slump' | 'scandal' | 'gm';

export interface Discipline {
  since: string;
  until: string;
  why: DisciplineWhy;
  /** He answered back in public (the stay grew). */
  pushback?: boolean;
}

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
const shortOf = (s: LeagueState, id: TeamId | null) => s.teams.find((t) => t.id === id)?.short ?? '';
const ours = (s: LeagueState, p: Player) => !!s.user && p.teamId === s.user.teamId;

/** Whether he is down for discipline on `date`. */
export const disciplined = (s: LeagueState, id: PlayerId) => !!s.discipline?.[id];

/** The chance he answers back. */
export function pushbackChance(p: Player): number {
  const P = DISCIPLINE.pushback;
  const t = traitsOf(p);
  return Math.max(P.min, Math.min(P.max, P.base + (t.controversy - 50) * P.controversy + (temperOf(p) - 50) * P.temper));
}

/** Why the general manager cannot send him down (null if he can). */
export function checkDiscipline(s: LeagueState, id: PlayerId, days: number): string | null {
  const p = s.players[id];
  if (!s.user || !p || p.teamId !== s.user.teamId) return __i18n_k("league.discipline.text.25eb910c");
  if (s.phase !== 'regular') return __i18n_k("league.discipline.text.b1c7b338");
  if (!(DISCIPLINE.days.gm as readonly number[]).includes(days)) return __i18n_k("league.discipline.text.413a9d3e");
  if (s.discipline?.[id]) return __i18n_k("league.discipline.text.f77026d0");
  if (!s.rosters[p.teamId]!.active.includes(id)) return __i18n_k("league.discipline.text.20ab4cd3");
  return null;
}

/** The general manager sends him down for `days`. */
export function gmDiscipline(s: LeagueState, id: PlayerId, days: number, date: string) {
  if (checkDiscipline(s, id, days)) return;
  sendDown(s, s.players[id]!, 'gm', days, date, rng(`${s.seed}|discipline-gm|${date}|${id}`));
}

/** A row in the papers: his manager may send him down (called by the events that make one). */
export function maybeDiscipline(s: LeagueState, p: Player, date: string, r: () => number) {
  if (s.phase !== 'regular' || !p.teamId || s.discipline?.[p.id] || !s.rosters[p.teamId]?.active.includes(p.id)) return;
  if (r() < DISCIPLINE.chance.scandal) sendDown(s, p, 'scandal', DISCIPLINE.days.scandal, date, r);
}

function sendDown(s: LeagueState, p: Player, why: DisciplineWhy, days: number, date: string, r: () => number) {
  const team = p.teamId!;
  const push = r() < pushbackChance(p);
  const until = addDays(date, days + (push ? DISCIPLINE.days.pushback : 0));
  (s.discipline ??= {})[p.id] = { since: date, until, why, ...(push ? { pushback: true } : {}) };
  // Down today: the manager fills the place from the futures (manager.ts goes by offRoster).
  const roster = s.rosters[team]!;
  roster.active = roster.active.filter((x) => x !== p.id);
  if (!roster.futures.includes(p.id)) roster.futures.push(p.id);
  (s.demoted ??= {})[p.id] = date;
  const mine = ours(s, p);
  // His form and his fans are kept for our players only (life.ts).
  if (push && mine) {
    setForm(p, DISCIPLINE.form.pushback, date, DISCIPLINE.form.days, __i18n_k("league.discipline.text.89eea76e"));
    adjustFans(p, DISCIPLINE.fans.pushback);
  }
  const who = why === 'gm' ? __i18n_k("league.discipline.text.e8338240") : __i18n_k("league.discipline.text.daec431c");
  const reason = why === 'slump' ? __i18n_k("league.discipline.text.5989973a") : why === 'scandal' ? __i18n_k("league.discipline.text.8ab841fb") : __i18n_k("league.discipline.text.8979fee5");
  const title = push ? __i18n_k("league.discipline.text.68a7776b", { name: p.name }) : __i18n_k("league.discipline.text.98d9def8", { club: shortOf(s, team), name: p.name });
  const back = until.slice(5).replace('-', '/');
  const body = push
    ? __i18n_k("league.discipline.text.37439858", { club: shortOf(s, team), who: eunneun(who), reason, name: eulreul(p.name), player: eunneun(p.name), until: back })
    : __i18n_k("league.discipline.text.b00ef1b1", { club: shortOf(s, team), who: eunneun(who), reason, name: eulreul(p.name), until: back });
  if (mine) note(p, date, title, 'bad');
  // The papers: ours always, another club's only when he is one of its best or answered back.
  if (mine || push || p.scouting.current >= DISCIPLINE.star)
    addNews(s, { id: `discipline-${date}-${p.id}`, date, kind: 'interview', title, body, quotes: [], facts: { player: p.name, club: shortOf(s, team), reason, until }, players: [p.id], ...(mine ? { mine: true } : {}) });
  if (mine) addAlert(s, { id: `discipline-${date}-${p.id}`, date, kind: 'life', title, lines: [body], tone: 'bad', players: [p.id] });
}

/** A first-team line as numbers to take one look from the next: [pa, on-base, total bases, ab, outs, er]. */
function markOf(s: LeagueState, id: PlayerId): number[] {
  const l = s.lines[id];
  const b = l?.bat,
    p = l?.pit;
  return [b?.pa ?? 0, b ? b.h + b.bb + b.hbp : 0, b ? b.h + b.d + 2 * b.t + 3 * b.hr : 0, b ? b.ab + b.bb + b.hbp + b.sf : 0, b?.ab ?? 0, p?.outs ?? 0, p?.er ?? 0];
}

/** A day of the season: stays that ran out end; every two weeks each manager looks at his first team. */
export function disciplineDay(s: LeagueState, date: string) {
  if (s.phase !== 'regular') return;
  for (const [id, d] of Object.entries(s.discipline ?? {})) {
    if (d.until > date) continue;
    delete s.discipline![id];
    const p = s.players[id];
    // Taking it well: back sharper now and then.
    if (p && ours(s, p) && !d.pushback && rng(`${s.seed}|discipline-wake|${id}|${d.since}`)() < DISCIPLINE.wake.chance) setForm(p, DISCIPLINE.wake.form, date, DISCIPLINE.wake.days, __i18n_k("league.discipline.text.4fcf156a"));
  }
  const mark = (s.formMark ??= { date, lines: {} });
  if (mark.date > date) s.formMark = { date, lines: {} };
  const days = (Date.parse(date) - Date.parse(s.formMark!.date)) / 86400000;
  if (days < DISCIPLINE.every) return;
  const r = rng(`${s.seed}|discipline|${date}`);
  const S = DISCIPLINE.slump;
  const next: Record<PlayerId, number[]> = {};
  for (const team of firstTeamIds(s)) {
    for (const id of s.rosters[team]?.active ?? []) {
      const p = s.players[id];
      if (!p) continue;
      const now = markOf(s, id);
      next[id] = now;
      const was = s.formMark!.lines[id];
      if (!was || s.discipline?.[id]) continue;
      const [pa, ob, tb, den, ab, outs, er] = now.map((x, i) => x - was[i]!) as [number, number, number, number, number, number, number];
      let slump = false;
      if (isPitcher(p)) {
        const lim = p.role === 'SP' ? S.sp : S.rp;
        slump = outs >= lim.outs && (27 * er) / outs >= lim.era;
      } else slump = pa >= S.pa && ob / Math.max(1, den) + tb / Math.max(1, ab) < S.ops;
      if (!slump) continue;
      const chance = DISCIPLINE.chance.slump * (p.scouting.current >= DISCIPLINE.star || isForeign(p) ? DISCIPLINE.chance.star : 1);
      if (r() < chance) sendDown(s, p, 'slump', DISCIPLINE.days.slump, date, r);
    }
  }
  s.formMark = { date, lines: next };
}
