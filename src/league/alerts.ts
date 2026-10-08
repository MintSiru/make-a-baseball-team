import { k as __i18n_k } from '../i18n/index';
/* Event alerts (V0.7.4): the moments the general manager should hear about right away — national team
   picks and results, how the free-agent market went, awards, the hall of fame, the season's end, the
   owner's verdict, postings and achievements. Since V0.11 also our retirements and every article about our
   club and players (games, records, injuries, moves, life off the field) as minor alerts the screen can
   leave out of the pop-ups. The screen shows new ones in a pop-up and keeps the list in the club's news.
   Only in a game with the player's club, and never part of the simulation. */
import type { Player, PlayerId, TeamId } from '../model/types';
import type { SeasonAwards } from './awards';
import type { NewsItem, NewsKind } from './news';
import { ageIn } from './players';
import type { LeagueState } from './state';

export type AlertKind = 'national' | 'fa' | 'award' | 'hall' | 'season' | 'owner' | 'posting' | 'achievement' | 'injury' | 'military' | 'retire' | 'move' | 'life' | 'game' | 'record' | 'scandal' | 'dispute' | 'allstar';

export interface Alert {
  id: string;
  date: string;
  kind: AlertKind;
  title: string;
  lines: string[];
  /** Good news for the club (a medal, a signing, an award) or bad (a loss). */
  tone?: 'good' | 'bad';
  players?: PlayerId[];
  /** An article about our club turned into an alert (V0.11): the screen can keep these out of the pop-ups. */
  minor?: boolean;
  seen?: boolean;
}

const KEEP = 200;

export function addAlert(s: LeagueState, a: Omit<Alert, 'seen'>) {
  if (!s.user) return;
  const list = (s.alerts ??= []);
  const i = list.findIndex((x) => x.id === a.id);
  if (i >= 0) {
    // The article came first (same id): the full alert takes its place.
    if (list[i]!.minor && !a.minor) list[i] = { ...a, ...(list[i]!.seen ? { seen: true } : {}) };
    return;
  }
  list.push(a);
  if (list.length > KEEP) list.splice(0, list.length - KEEP);
}

/** Our club's articles that also pop up (V0.11), by the article's kind. Season reviews and awards have alerts of
    their own; an interview the user asked for is already on screen. */
const FROM_NEWS: Partial<Record<NewsKind, AlertKind>> = { game: 'game', milestone: 'record', interview: 'life', injury: 'injury', move: 'move' };
/** Kinds written only about our club (the rest carry `mine` when they are ours). */
const OURS_ONLY: NewsKind[] = ['game', 'milestone'];

export function newsAlert(s: LeagueState, n: NewsItem) {
  const kind = FROM_NEWS[n.kind];
  if (!s.user || !kind || n.id.startsWith('iv-')) return;
  if (!n.mine && !OURS_ONLY.includes(n.kind)) return;
  addAlert(s, { id: n.id, date: n.date, kind, title: n.title, lines: n.body.split('\n').filter(Boolean), minor: true, ...(n.players.length ? { players: n.players } : {}) });
}

export const unseenAlerts = (s: LeagueState) => (s.alerts ?? []).filter((a) => !a.seen);

/** Marks alerts as read (all of them without `ids`). */
export function markAlertsSeen(s: LeagueState, ids?: string[]) {
  for (const a of s.alerts ?? []) if (!ids || ids.includes(a.id)) a.seen = true;
}

const short = (s: LeagueState, id: TeamId | null | undefined) => s.teams.find((t) => t.id === id)?.short ?? '';
const POS: Record<string, string> = { C: __i18n_k("league.alerts.pOS.c.5f31470d"), '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: __i18n_k("league.alerts.pOS.sS.3e24c7f1"), LF: __i18n_k("league.alerts.pOS.lF.73836db2"), CF: __i18n_k("league.alerts.pOS.cF.56780b2a"), RF: __i18n_k("league.alerts.pOS.rF.a28a0ef8") };
const posOf = (p: Player) => (p.position ? POS[p.position]! : p.role === 'SP' ? __i18n_k("league.alerts.posOf.cd036b1a") : __i18n_k("league.alerts.posOf.ac3cc00a"));

// ── The free-agent market ────────────────────────────────────────────────────────────────────────

/** After the market: our bids, our own free agents, and the league's biggest moves. */
// ── Awards, the hall of fame, the season ─────────────────────────────────────────────────────────

export function awardAlert(s: LeagueState, year: number, a: SeasonAwards) {
  const u = s.user;
  if (!u) return;
  const teamOf = (id: PlayerId) => s.players[id]?.career.find((c) => c.year === year && !c.level)?.teamId;
  const who = (id: PlayerId) => `${s.players[id]?.name ?? ''} (${short(s, teamOf(id))})`;
  const ours = (id: PlayerId | null) => !!id && teamOf(id) === u.teamId;
  const lines: string[] = [];
  if (a.mvp) lines.push(__i18n_k("league.alerts.awardAlert.fc4f0cc6", { who: who(a.mvp), value: ours(a.mvp) ? __i18n_k("league.alerts.awardAlert.d4edc9a9") : '' }));
  if (a.rookie) lines.push(__i18n_k("league.alerts.awardAlert.df7df0d2", { who: who(a.rookie), value: ours(a.rookie) ? __i18n_k("league.alerts.awardAlert.d4edc9a9") : '' }));
  const gg = a.goldenGloves.filter((g) => ours(g.id));
  if (gg.length) lines.push(__i18n_k("league.alerts.awardAlert.1de783e9", { value: gg.map((g) => `${s.players[g.id]?.name} (${g.pos})`).join(', ') }));
  const titles = a.titles.filter((t) => ours(t.id));
  if (titles.length) lines.push(__i18n_k("league.alerts.awardAlert.83d48366", { value: titles.map((t) => `${t.label} ${s.players[t.id]?.name} (${t.value})`).join(', ') }));
  if (!gg.length && !titles.length && !ours(a.mvp) && !ours(a.rookie)) lines.push(__i18n_k("league.alerts.awardAlert.669efa7f"));
  const mine = [a.mvp, a.rookie, ...gg.map((g) => g.id), ...titles.map((t) => t.id)].filter((id): id is PlayerId => ours(id));
  addAlert(s, { id: `awards-${year}`, date: `${year}-11-01`, kind: 'award', title: __i18n_k("league.alerts.awardAlert.title.ae600b12", { year: year }), lines, tone: mine.length ? 'good' : undefined, players: [...new Set(mine)] });
}

export function hallAlert(s: LeagueState, p: Player, entry: { year: number; war: number; seasons: number; teams: TeamId[]; line: string }) {
  const u = s.user;
  if (!u) return;
  const ours = entry.teams.includes(u.teamId);
  addAlert(s, {
    id: `hof-${p.id}`,
    date: `${entry.year}-11-10`,
    kind: 'hall',
    title: __i18n_k("league.alerts.hallAlert.title.e6f29807", { name: p.name }),
    lines: [__i18n_k("league.alerts.hallAlert.lines.9171e8ea", { seasons: entry.seasons, value: entry.war.toFixed(1), line: entry.line }), __i18n_k("league.alerts.hallAlert.lines.7b1d533f", { value: entry.teams.map((t) => short(s, t)).join(', '), value2: ours ? __i18n_k("league.alerts.hallAlert.lines.99bec7e4") : '' }), ...(p.honors ?? []).slice(-3)],
    tone: ours ? 'good' : undefined,
    players: [p.id],
  });
}

const ROUND: Record<string, string> = { wildcard: __i18n_k("league.alerts.rOUND.wildcard.82702aa7"), semipo: __i18n_k("league.alerts.rOUND.semipo.42e1bde5"), po: __i18n_k("league.alerts.rOUND.po.4651993c"), ks: __i18n_k("league.alerts.rOUND.ks.3c8e7785") };

/** The season is over: our finish and how far we went in the postseason. */
export function seasonAlert(s: LeagueState, year: number) {
  const u = s.user;
  const h = s.history.find((x) => x.year === year);
  if (!u || !h) return;
  const row = h.table.find((r) => r.teamId === u.teamId);
  if (!row) return;
  const ours = h.series.filter((x) => x.high === u.teamId || x.low === u.teamId);
  const last = ours.at(-1);
  const champ = h.champion === u.teamId;
  const post = champ ? __i18n_k("league.alerts.seasonAlert.post.79bb4235") : last ? __i18n_k("league.alerts.seasonAlert.post.68bad297", { value: ROUND[last.round], short: short(s, last.winner), value2: last.high === u.teamId ? last.highWins : last.lowWins, value3: last.high === u.teamId ? last.lowWins : last.highWins }) : __i18n_k("league.alerts.seasonAlert.post.6e2e4bc5");
  addAlert(s, {
    id: `season-${year}`,
    date: `${year}-11-01`,
    kind: 'season',
    title: champ ? __i18n_k("league.alerts.seasonAlert.title.6d2cc1c8", { year: year }) : __i18n_k("league.alerts.seasonAlert.title.bbec6400", { year: year, rank: row.rank }),
    lines: [__i18n_k("league.alerts.seasonAlert.lines.a0aa0b54", { w: row.w, l: row.l, value: row.t, rank: row.rank }), post, ...(h.champion && !champ ? [__i18n_k("league.alerts.seasonAlert.lines.abf1791a", { short: short(s, h.champion) })] : [])],
    tone: champ || ours.length || (!h.series.length && row.rank <= 5) ? 'good' : 'bad',
  });
}

export function ownerAlert(s: LeagueState, year: number, ev: { lines: { label: string; ok: boolean; text: string }[]; change: number; trust: number }) {
  addAlert(s, {
    id: `owner-${year}`,
    date: `${year}-11-01`,
    kind: 'owner',
    title: __i18n_k("league.alerts.ownerAlert.title.edddeaa5", { year: year }),
    lines: [...ev.lines.map((l) => __i18n_k("league.alerts.ownerAlert.lines.8b54ad3a", { value: l.ok ? __i18n_k("league.alerts.ownerAlert.lines.f3b8c1b4") : __i18n_k("league.alerts.ownerAlert.lines.a72490af"), label: l.label, text: l.text })), __i18n_k("league.alerts.ownerAlert.lines.08a9fcad", { value: ev.change >= 0 ? '+' : '', value2: Math.round(ev.change * 100), value3: Math.round(ev.trust) })],
    tone: ev.change >= 0 ? 'good' : 'bad',
  });
}

export function postingAlert(s: LeagueState, p: Player, teamId: TeamId, year: number, deal: { years: number; total: string; fee: string } | null) {
  if (teamId !== s.user?.teamId) return;
  addAlert(s, {
    id: `posting-${p.id}`,
    date: `${year}-11-10`,
    kind: 'posting',
    title: deal ? __i18n_k("league.alerts.postingAlert.title.600fe52c", { name: p.name }) : __i18n_k("league.alerts.postingAlert.title.e7f21cb1", { name: p.name }),
    lines: deal ? [__i18n_k("league.alerts.postingAlert.lines.2eae5956", { years: deal.years, total: deal.total }), __i18n_k("league.alerts.postingAlert.lines.3b73ea6a", { fee: deal.fee })] : [__i18n_k("league.alerts.postingAlert.lines.987a347a")],
    tone: deal ? 'good' : 'bad',
    players: [p.id],
  });
}

/** Our players who retire this winter, and the ones the club talked into another season (V0.11). */
export function retirementAlert(s: LeagueState, gone: Player[], stayed: PlayerId[], year: number) {
  const u = s.user;
  if (!u) return;
  const ours = gone.filter((p) => p.teamId === u.teamId);
  const kept = stayed.map((id) => s.players[id]).filter((p): p is Player => !!p && p.teamId === u.teamId);
  if (!ours.length && !kept.length) return;
  const line = (p: Player) => {
    const major = p.career.filter((c) => !c.level);
    const war = major.reduce((a, c) => a + c.war, 0);
    return __i18n_k("league.alerts.retirementAlert.line.9f031b8a", { name: p.name, ageIn: ageIn(p, year + 1), posOf: posOf(p), value: major.length ? __i18n_k("league.alerts.retirementAlert.line.047c30e3", { length: major.length, value: war.toFixed(1) }) : __i18n_k("league.alerts.retirementAlert.line.12ca5e35") });
  };
  addAlert(s, {
    id: `retire-${year}`,
    date: `${year}-11-05`,
    kind: 'retire',
    title: ours.length ? __i18n_k("league.alerts.retirementAlert.title.5ed37459", { year: year, length: ours.length }) : __i18n_k("league.alerts.retirementAlert.title.6e6119c9"),
    lines: [...ours.map(line), ...(kept.length ? [__i18n_k("league.alerts.retirementAlert.lines.c0d118a6", { value: kept.map((p) => p.name).join(', ') })] : [])],
    tone: kept.length && !ours.length ? 'good' : undefined,
    players: [...ours, ...kept].map((p) => p.id),
  });
}

export function achievementAlert(s: LeagueState, id: string, label: string, note: string, date: string, detail: string) {
  addAlert(s, { id: `ach-${id}`, date, kind: 'achievement', title: __i18n_k("league.alerts.achievementAlert.title.272861ce", { label: label }), lines: [note, ...(detail ? [detail] : [])], tone: 'good' });
}
