import { k as __i18n_k } from '../i18n/index';
/* 2.0.26 (the user's request: the balance once a club has grown up — 반동탁연맹, the wealth shared out). Two things
   each winter, when the books close:

   - The anti-dynasty alliance (반독주 연맹). A club that won three titles running, or five in the last ten seasons,
     has the others close ranks against it: none of them trades with it while the alliance stands, and it pays a
     balance contribution into the league's fund. With the board meeting it is put and carried as an urgent motion;
     the players' association speaks up for fairness. It stands two seasons and is renewed while the club keeps
     winning; it ends once the club has gone two seasons without a title.
   - The balance fund (균형 분배금). The salary cap's levies (every club's: the AI clubs' owners pay theirs) and the
     dynasty's contribution are shared out among the three clubs at the bottom of the table. Our club takes its share
     into the fund; another club's makes it bolder in next winter's free-agent market.

   Game rules, not the KBO's (its levies go to a youth fund). 2.0.27: the alliance is part of the dynamic difficulty —
   with that setting off there is none (it formed whatever the setting before); the balance fund from the cap's levies
   is shared out either way. */
import type { TeamId } from '../model/types';
import { addAlert } from './alerts';
import { milestone } from './milestones';
import { addNews } from './news';
import { firstTeamIds, type LeagueState } from './state';

export const DYNASTY = {
  /** Titles running, or titles in the window, that make a dynasty. */
  streak: 3,
  window: 10,
  titles: 5,
  /** Seasons the alliance stands, and seasons without a title that end it early. */
  seasons: 2,
  dry: 2,
  /** The dynasty's yearly contribution (만원) and the clubs that share the fund. */
  contribution: 300_000,
  bottom: 3,
  /** A share makes an AI club this much keener in free agency (FA appetite). */
  faBoost: 0.15,
};

export interface Alliance {
  target: TeamId;
  since: number;
  until: number;
}

const short = (s: LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? id;
const titlesIn = (s: LeagueState, id: TeamId, from: number, to: number) => s.history.filter((h) => h.year >= from && h.year <= to && h.champion === id).length;

/** The club that dominates after `year`, if one does. */
export function dynastyOf(s: LeagueState, year: number): TeamId | null {
  const last = s.history.find((h) => h.year === year)?.champion;
  if (!last) return null;
  const streak = s.history.filter((h) => h.year > year - DYNASTY.streak && h.year <= year).every((h) => h.champion === last) && s.history.filter((h) => h.year > year - DYNASTY.streak && h.year <= year).length === DYNASTY.streak;
  return streak || titlesIn(s, last, year - DYNASTY.window + 1, year) >= DYNASTY.titles ? last : null;
}

/** The alliance standing against `teamId` now, if any (only with the dynamic difficulty on). */
export const allianceAgainst = (s: Pick<LeagueState, 'alliance' | 'year' | 'dynamicDifficulty'>, teamId: TeamId) => !!s.dynamicDifficulty && !!s.alliance && s.alliance.target === teamId && s.year <= s.alliance.until;

/** Whether a trade between the two clubs is barred by the alliance. */
export const tradeBarred = (s: Pick<LeagueState, 'alliance' | 'year' | 'dynamicDifficulty'>, a: TeamId, b: TeamId) => allianceAgainst(s, a) || allianceAgainst(s, b);

/** The winter: the alliance formed, renewed or ended, and the balance fund shared out. */
export function dynastyWinter(s: LeagueState, year: number) {
  const me = s.user?.teamId;
  const date = `${year}-11-05`;
  // 2.0.27: no alliance with the dynamic difficulty off (one from before quietly lapses); the fund is still shared.
  if (!s.dynamicDifficulty) {
    delete s.alliance;
    shareFund(s, year);
    return;
  }
  const a = s.alliance;
  // An alliance ends once its target has gone two seasons without a title, or runs out.
  if (a && (year >= a.until || titlesIn(s, a.target, year - DYNASTY.dry + 1, year) === 0)) {
    const title = __i18n_k("league.dynasty.text.af84a389", { club: short(s, a.target) });
    addNews(s, { id: `alliance-end-${year}`, date, kind: 'season', title, body: title, quotes: [], facts: { club: short(s, a.target) }, players: [], mine: a.target === me });
    if (me) addAlert(s, { id: `alliance-end-${year}`, date, kind: 'season', title, lines: [title] });
    delete s.alliance;
  }
  const king = dynastyOf(s, year);
  if (king && (!s.alliance || s.alliance.target !== king)) {
    s.alliance = { target: king, since: year, until: year + DYNASTY.seasons };
    const titles = titlesIn(s, king, year - DYNASTY.window + 1, year);
    const board = !!s.board?.on;
    const title = __i18n_k("league.dynasty.text.0981bff3", { club: short(s, king) });
    const lines = [
      board ? __i18n_k("league.dynasty.text.8bf0e00b", { club: short(s, king) }) : __i18n_k("league.dynasty.text.06e206ed", { club: short(s, king) }),
      __i18n_k("league.dynasty.text.04f42f97", { club: short(s, king), window: DYNASTY.window, titles, seasons: DYNASTY.seasons, eok: DYNASTY.contribution / 10_000 }),
      __i18n_k("league.dynasty.text.a6c10ff4"),
    ];
    addNews(s, { id: `alliance-${year}`, date, kind: 'season', title, body: lines.join(' '), quotes: [], facts: { club: short(s, king), titles }, players: [], mine: king === me });
    if (me) addAlert(s, { id: `alliance-${year}`, date, kind: king === me ? 'owner' : 'season', title, lines, ...(king === me ? { tone: 'bad' as const } : {}) });
    if (king === me) milestone(s, year, title, `alliance-${year}`);
  } else if (king && s.alliance?.target === king) {
    // Still winning: the alliance stands two more seasons.
    s.alliance.until = year + DYNASTY.seasons;
  }
  shareFund(s, year);
}

/** The balance fund: the cap's levies and the dynasty's contribution, to the bottom three. */
function shareFund(s: LeagueState, year: number) {
  const me = s.user?.teamId;
  const levies = Object.values(s.cap ?? {}).reduce((a, rows) => a + (rows.find((r) => r.year === year)?.levy ?? 0), 0);
  const target = s.dynamicDifficulty && s.alliance && year <= s.alliance.until ? s.alliance.target : null;
  const contribution = target ? DYNASTY.contribution : 0;
  if (target === me && s.user) {
    s.user.fund -= contribution;
    s.user.ledger.push({ year, label: __i18n_k("league.dynasty.text.0e95bea2"), amount: -contribution });
  }
  const pool = levies + contribution;
  delete s.balanceShare;
  if (pool <= 0) return;
  const table = s.history.find((h) => h.year === year)?.table ?? [];
  const ids = firstTeamIds(s, year);
  const bottom = [...table].filter((r) => ids.includes(r.teamId) && r.teamId !== target).sort((a, b) => b.rank - a.rank).slice(0, DYNASTY.bottom).map((r) => r.teamId);
  if (!bottom.length) return;
  const each = Math.round(pool / bottom.length);
  s.balanceShare = Object.fromEntries(bottom.map((id) => [id, each]));
  if (me && bottom.includes(me) && s.user) {
    s.user.fund += each;
    s.user.ledger.push({ year, label: __i18n_k("league.dynasty.text.54eab073"), amount: each });
  }
  const title = __i18n_k("league.dynasty.text.9b4844d1", { eok: Math.round(pool / 10_000), n: bottom.length });
  const body = __i18n_k("league.dynasty.text.f1886c6d", { dynasty: contribution ? __i18n_k("league.dynasty.text.43fcbad4") : '', eok: Math.round(pool / 10_000), clubs: bottom.map((id) => short(s, id)).join(', ') });
  addNews(s, { id: `balance-${year}`, date: `${year}-11-06`, kind: 'season', title, body, quotes: [], facts: { pool: Math.round(pool / 10_000) }, players: [], mine: !!me && bottom.includes(me) });
}

/** An AI club's free-agent keenness this winter (1, or more with a share of the balance fund). */
export const balanceBoost = (s: Pick<LeagueState, 'balanceShare'>, teamId: TeamId) => (s.balanceShare?.[teamId] ? 1 + DYNASTY.faBoost : 1);
