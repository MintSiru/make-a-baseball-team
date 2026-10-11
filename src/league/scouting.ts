import { k as __i18n_k } from '../i18n/index';
/* A future that moves (V0.12). A young player's ceiling is not fixed at the draft: every winter it can jump (a
   breakout), stall, or drift a little, and a season that says so makes the jump or the stall likelier. During
   the season the scouts revised a young player's future grade month by month until 1.6; since 1.7.0 it moves
   once a season, with the winter's report, and our players' moves make one report in the news. */
import type { Player, PlayerId } from '../model/types';
import { addNews } from './news';
import { ageIn, isForeign, isPitcher } from './players';
import type { LeagueState } from './state';
import { era, obp, slg } from './stats';
import { SCOUTING as S } from './tuning';
import { breakoutFactor } from './traits';

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const normal = (r: () => number) => (r() + r() + r() - 1.5) / 1.5;
const young = (p: Player, season: number) => !isForeign(p) && ageIn(p, season) <= S.maxAge;

/** What last season said about him: +1 a season that points up, −1 one that points down, 0 otherwise. */
function lastSeasonSignal(p: Player, year: number): number {
  const major = p.career.find((c) => c.year === year && !c.level);
  const minor = p.career.find((c) => c.year === year && c.level === 'futures');
  const W = S.winter;
  if (major && ((major.bat?.pa ?? 0) >= W.majorPA || (major.pit?.outs ?? 0) >= W.majorOuts)) return major.war >= W.goodWar ? 1 : major.war <= W.badWar ? -1 : 0;
  if (minor?.bat && minor.bat.pa >= W.minorPA) {
    const ops = obp(minor.bat) + slg(minor.bat);
    return ops >= W.goodOps ? 1 : ops <= W.badOps ? -1 : 0;
  }
  if (minor?.pit && minor.pit.outs >= W.minorOuts) {
    const e = era(minor.pit);
    return e <= W.goodEra ? 1 : e >= W.badEra ? -1 : 0;
  }
  return 0;
}

/**
 * The winter's move of a young player's hidden ceiling: a breakout lifts one or two abilities, a stall lowers
 * them (never below what he can already do), and every ability drifts a little. Before the year's growth.
 */
export function driftPotential(p: Player, year: number, r: () => number) {
  if (!young(p, year + 1) || p.status === 'retired') return;
  const D = S.winter;
  const signal = lastSeasonSignal(p, year);
  const keys = Object.keys(p.hidden.potential) as (keyof Player['hidden']['potential'])[];
  const pickKeys = () => {
    const n = r() < 0.5 ? 1 : 2;
    return [...keys].sort(() => r() - 0.5).slice(0, n);
  };
  const set = (k: (typeof keys)[number], v: number) => (p.hidden.potential[k] = clamp(v, p.hidden.current[k] ?? 20, 80));
  const roll = r();
  const breakout = D.breakout * (signal > 0 ? D.signalBoost : 1) * (ageIn(p, year + 1) <= 23 ? 1.3 : 1) * breakoutFactor(p);
  const stall = D.stall * (signal < 0 ? D.signalBoost : 1);
  if (roll < breakout) for (const k of pickKeys()) set(k, (p.hidden.potential[k] ?? 40) + D.jump[0] + r() * (D.jump[1] - D.jump[0]));
  else if (roll < breakout + stall) for (const k of pickKeys()) set(k, (p.hidden.potential[k] ?? 40) - D.jump[0] - r() * (D.jump[1] - D.jump[0]));
  for (const k of keys) set(k, (p.hidden.potential[k] ?? 40) + normal(r) * D.drift);
}

// ── The winter report (1.7.0) ───────────────────────────────────────────────────────────────────
// Until 1.6 the scouts revised the future grade month by month in the season; since 1.7.0 it moves once a
// season, with the winter's report (rescout after the year's growth, the season's numbers already in the drift).

/** Every active domestic young player's future grade before the winter's growth. */
export function futureBefore(s: LeagueState): Map<PlayerId, number> {
  const out = new Map<PlayerId, number>();
  for (const p of Object.values(s.players)) if (p.status === 'active' && young(p, s.year)) out.set(p.id, p.scouting.futureValue);
  return out;
}

/** After the winter's growth: the moves show on each player's screen, and ours make one report in the news. */
export function winterReport(s: LeagueState, year: number, before: Map<PlayerId, number>) {
  const date = `${year}-12-01`;
  const mine: { p: Player; from: number; to: number }[] = [];
  for (const [id, from] of before) {
    const p = s.players[id];
    if (!p || p.status === 'retired') continue;
    const to = p.scouting.futureValue;
    if (to === from) continue;
    p.scouting.moved = { date, from, to };
    if (p.teamId && p.teamId === s.user?.teamId && Math.abs(to - from) >= 5) mine.push({ p, from, to });
  }
  if (!mine.length) return;
  mine.sort((a, b) => b.to - b.from - (a.to - a.from) || b.to - a.to);
  const up = mine.filter((x) => x.to > x.from);
  const down = mine.filter((x) => x.to < x.from);
  const list = (xs: typeof mine) => xs.map((x) => __i18n_k("league.scouting.text.fde7a7f7", { name: x.p.name, from: x.from, to: x.to })).join(', ');
  addNews(s, {
    id: `scout-winter-${year}`,
    date,
    kind: 'interview',
    title: __i18n_k("league.scouting.text.fb251a9e", { year, up: up.length, down: down.length }),
    body: [
      __i18n_k("league.scouting.text.34340af3"),
      up.length ? __i18n_k("league.scouting.text.b6c86823", { list: list(up) }) : '',
      down.length ? __i18n_k("league.scouting.text.3ce0ee17", { list: list(down) }) : '',
    ]
      .filter(Boolean)
      .join(' '),
    quotes: [],
    facts: { [__i18n_k("league.scouting.text.c13573d9")]: String(up.length), [__i18n_k("league.scouting.text.5356f002")]: String(down.length) },
    players: mine.map((x) => x.p.id),
    mine: true,
  });
}
