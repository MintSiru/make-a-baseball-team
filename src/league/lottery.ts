import { k as __i18n_k } from '../i18n/index';
/* 2.0.17 (the user's request): the rookie draft by lottery (로터리 픽), when the board brings it in (board.ts). The clubs
   that missed the postseason go into the draw, the worst with the most chances; the first picks are drawn and the
   rest follow last season's table from the bottom, as without a lottery. The order holds for every round. */
import { rng } from '../draftroom';
import type { TeamId } from '../model/types';
import { rulesFor } from '../rules/history';
import { addAlert } from './alerts';
import { addNews } from './news';
import type { LeagueState } from './state';

export const LOTTERY = {
  /** Picks drawn. */
  draws: 3,
  /** A club's chances: the worst `n`, the next `n - 1`, and so on (n the clubs in the draw). */
};

export interface LotteryResult {
  year: number;
  /** The order without the draw (the bottom club first), and with it. */
  before: TeamId[];
  after: TeamId[];
  /** The clubs that were in the draw. */
  drawn: TeamId[];
}

/** The draft order of `draftYear` after the draw (`order`: the bottom club first). */
export function lotteryOrder(s: LeagueState, draftYear: number, order: TeamId[]): LotteryResult {
  const fmt = rulesFor(draftYear).postseason;
  const places = fmt === 'five' ? 5 : 4;
  const out = Math.max(0, order.length - places);
  const pool = order.slice(0, Math.max(out, Math.min(2, order.length)));
  const r = rng(`${s.seed}|lottery|${draftYear}`);
  const chances = new Map(pool.map((id, i) => [id, pool.length - i]));
  const first: TeamId[] = [];
  for (let k = 0; k < Math.min(LOTTERY.draws, pool.length); k++) {
    const left = pool.filter((id) => !first.includes(id));
    const total = left.reduce((a, id) => a + chances.get(id)!, 0);
    let x = r() * total;
    first.push(left.find((id) => (x -= chances.get(id)!) < 0) ?? left.at(-1)!);
  }
  const after = [...first, ...order.filter((id) => !first.includes(id))];
  return { year: draftYear, before: order, after, drawn: pool };
}

/** Tells the league (and our club, when it is in the draw). */
export function lotteryNews(s: LeagueState, res: LotteryResult) {
  const short = (id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? id;
  const lines = res.after.slice(0, LOTTERY.draws).map((id, i) => __i18n_k("league.lottery.text.99764c50", { n: i + 1, club: short(id), was: res.before.indexOf(id) + 1 }));
  const title = __i18n_k("league.lottery.text.b9733d2e", { year: res.year, club: short(res.after[0]!) });
  addNews(s, { id: `lottery-${res.year}`, date: `${res.year}-09-01`, kind: 'season', title, body: lines.join(' · '), quotes: [], facts: { year: res.year, first: short(res.after[0]!) }, players: [], mine: false });
  const me = s.user?.teamId;
  if (me && res.drawn.includes(me)) {
    const moved = res.before.indexOf(me) - res.after.indexOf(me);
    addAlert(s, { id: `lottery-${res.year}`, date: `${res.year}-09-01`, kind: 'season', title, lines: [...lines, __i18n_k("league.lottery.text.4444a6c6", { was: res.before.indexOf(me) + 1, now: res.after.indexOf(me) + 1 })], tone: moved > 0 ? 'good' : moved < 0 ? 'bad' : undefined });
  }
}
