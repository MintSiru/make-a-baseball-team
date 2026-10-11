import { k as __i18n_k } from '../i18n/index';
/* The rivalry (V0.9): the user's club against the twelfth club. Their games draw bigger crowds (fans.ts), every
   one of them gets an article (news.ts), the season series moves both fan bases, and a player who crosses from
   one to the other stirs the fans. */
import type { Player, TeamId } from '../model/types';
import { addAlert } from './alerts';
import { clubState } from './fans';
import { addNews } from './news';
import { seasonSeries, twelveClubs } from './twelve';
import { FANS, RIVAL } from './tuning';

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const short = (s: import('./state').LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? id;
type LeagueState = import('./state').LeagueState;

/** The rivalry's record over the years, from the user's side (this season included while it is played). */
export function allTime(s: LeagueState): { w: number; l: number; t: number; seasons: number } {
  const out = { w: 0, l: 0, t: 0, seasons: 0 };
  for (const x of s.twelve?.h2h ?? []) {
    out.w += x.w;
    out.l += x.l;
    out.t += x.t;
    out.seasons++;
  }
  if (s.phase !== 'offseason' && !(s.twelve?.h2h ?? []).some((x) => x.year === s.year)) {
    const now = seasonSeries(s);
    if (now.w + now.l + now.t) {
      out.w += now.w;
      out.l += now.l;
      out.t += now.t;
      out.seasons++;
    }
  }
  return out;
}

/** After the season: the series goes into the record, the fans of the winning side feel it, and an article. */
export function closeRivalry(s: LeagueState, year: number) {
  const tw = s.twelve,
    u = s.user;
  if (!tw || !u || !twelveClubs(s, year)) return;
  const r = seasonSeries(s);
  if (r.w + r.l + r.t === 0) return;
  tw.h2h = [...(tw.h2h ?? []).filter((x) => x.year !== year), { year, ...r }];
  const R = RIVAL.rivalry;
  const k = clamp((r.w - r.l) * R.perGame, -R.most, R.most);
  for (const [id, sign] of [
    [u.teamId, 1],
    [tw.teamId, -1],
  ] as const) {
    const c = clubState(s, id);
    c.interest = clamp(c.interest + sign * k, FANS.interestMin, FANS.interestMax);
  }
  const me = short(s, u.teamId),
    them = short(s, tw.teamId);
  const total = allTime(s);
  const verdict = r.w > r.l ? __i18n_k("league.rivalry.closeRivalry.verdict.3896cfcd", { me: me }) : r.w < r.l ? __i18n_k("league.rivalry.closeRivalry.verdict.d817524d", { them: them }) : __i18n_k("league.rivalry.closeRivalry.verdict.e157d122");
  addNews(s, {
    date: `${year}-10-31`,
    kind: 'season',
    title: __i18n_k("league.rivalry.closeRivalry.title.84e8fae8", { year: year, me: me, w: r.w, l: r.l, value: r.t ? __i18n_k("league.rivalry.closeRivalry.title.136ac74d", { value: r.t }) : '', verdict: verdict }),
    body:
      __i18n_k("league.rivalry.closeRivalry.body.e9aa4a94", { value: __i18n_k("league.rivalry.closeRivalry.body.8cc8a5fe", { me: me, them: them, year: year, w: r.w, l: r.l, value: r.t ? __i18n_k("league.rivalry.closeRivalry.body.136ac74d", { value: r.t }) : '' }), value2: __i18n_k("league.rivalry.closeRivalry.body.bf3d0ab0", { seasons: total.seasons, w: total.w, l: total.l, value: total.t ? __i18n_k("league.rivalry.closeRivalry.body.136ac74d", { value: total.t }) : '' }), value3: (k > 0 ? __i18n_k("league.rivalry.closeRivalry.body.d5099eb4") : k < 0 ? __i18n_k("league.rivalry.closeRivalry.body.01569cf7") : '') }),
    quotes: [],
    facts: { year, wins: r.w, losses: r.l, ties: r.t, allTimeWins: total.w, allTimeLosses: total.l },
    players: [],
    mine: true,
  });
}

/** How much the fans care about a player: his last season, a star's years, and whether he grew up in the club. */
function fondness(p: Player, from: TeamId): number {
  const recent = p.career.filter((c) => !c.level && c.teamId === from).slice(-3);
  const war = recent.reduce((a, c) => a + c.war, 0);
  const homeGrown = !!p.origin.draftYear && p.career.filter((c) => !c.level).every((c) => c.teamId === from);
  return clamp(war / 8, 0, 1) + (homeGrown ? 0.3 : 0);
}

/**
 * A player crossing between the user's club and the twelfth club (a free agent, the special draft, a trade): the
 * fans he leaves take it hard when he was one of theirs, and the club he joins gets a little lift.
 */
export function crossing(
  s: LeagueState,
  p: Player,
  from: TeamId,
  to: TeamId,
  how: string,
  date = s.phase === 'regular' ? (s.schedule[Math.max(0, s.next - 1)]?.date ?? `${s.year}-04-01`) : `${s.year}-11-01`,
  alert = true,
) {
  const tw = s.twelve,
    u = s.user;
  if (!tw || !u) return;
  const pair = (from === u.teamId && to === tw.teamId) || (from === tw.teamId && to === u.teamId);
  if (!pair) return;
  const f = fondness(p, from);
  if (f < 0.2) return;
  const hit = RIVAL.rivalry.crossing * f;
  const left = clubState(s, from),
    joined = clubState(s, to);
  left.interest = clamp(left.interest - hit, FANS.interestMin, FANS.interestMax);
  joined.interest = clamp(joined.interest + hit / 2, FANS.interestMin, FANS.interestMax);
  const leaving = from === u.teamId;
  addNews(s, {
    date,
    kind: 'move',
    title: leaving ? __i18n_k("league.rivalry.crossing.title.da3ad73e", { name: p.name, short: short(s, to), short2: short(s, from) }) : __i18n_k("league.rivalry.crossing.title.ac32eb0d", { name: p.name, short: short(s, to) }),
    body: leaving
      ? __i18n_k("league.rivalry.crossing.body.98e7e1a2", { short: short(s, from), name: p.name, how: how, short2: short(s, to) })
      : __i18n_k("league.rivalry.crossing.body.e78b1d11", { short: short(s, from), name: p.name, how: how, short2: short(s, to), short3: short(s, to) }),
    quotes: [{ who: __i18n_k("league.rivalry.quotes.who.724cc77d"), role: 'fan', text: leaving ? __i18n_k("league.rivalry.quotes.text.cf35737e") : __i18n_k("league.rivalry.quotes.text.efbf1392") }],
    facts: { player: p.name, from: short(s, from), to: short(s, to), how },
    players: [p.id],
    mine: true,
  });
  if (leaving && alert)
    addAlert(s, {
      id: `rival-cross-${p.id}-${date}`,
      date,
      kind: 'season',
      title: __i18n_k("league.rivalry.crossing.title.fd8f34df", { name: p.name }),
      lines: [__i18n_k("league.rivalry.crossing.lines.aa5d9c16", { name: p.name, how: how, short: short(s, to) })],
      tone: 'bad',
      players: [p.id],
    });
}
