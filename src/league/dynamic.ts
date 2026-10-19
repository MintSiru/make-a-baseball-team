import { k as __i18n_k } from '../i18n/index';
/* 2.0.25 (the user's request: a difficulty that moves, and the balance once our club has grown up): an optional game
   setting. Each winter the league looks at our club's last three seasons — titles, where it finished, how much money
   it sits on — and sets a level from −2 (struggling: a hand up) to 3 (a dynasty: the others close ranks). The level
   moves the owner's support and the payroll budget for the season ahead, and how keen free agents are on us. The
   difficulty chosen in the settings stays as it is; this comes on top. */
import type { LeagueState } from './state';

export const DYNAMIC = {
  /** Per level: the owner's support, the payroll budget and free agents' liking of us. */
  support: 0.06,
  payroll: 0.04,
  faFit: 0.025,
  min: -2,
  max: 3,
  /** Rich: a fund this many times the payroll budget. */
  richFund: 2,
};

/** Our club's level this season (0 with the setting off). */
export const handicap = (s: Pick<LeagueState, 'user' | 'dynamicDifficulty'>) => (s.dynamicDifficulty ? (s.user?.handicap ?? 0) : 0);

/** The winter's level from the last three seasons. */
export function measureHandicap(s: LeagueState, year: number): number {
  const u = s.user;
  if (!u) return 0;
  const seasons = s.history.filter((h) => h.year > year - 3 && h.year <= year && h.table.some((r) => r.teamId === u.teamId));
  if (!seasons.length) return 0;
  const titles = seasons.filter((h) => h.champion === u.teamId).length;
  const ranks = seasons.map((h) => h.table.find((r) => r.teamId === u.teamId)!.rank);
  const clubs = seasons.at(-1)!.table.length;
  const rank = ranks.reduce((a, b) => a + b, 0) / ranks.length;
  let score = titles;
  score += rank <= 2 ? 1 : rank <= 3 ? 0.5 : 0;
  score -= rank >= clubs - 1 ? 1 : rank >= clubs - 2 ? 0.5 : 0;
  score += u.fund > u.payrollBudget * DYNAMIC.richFund ? 0.5 : u.fund < 0 ? -0.5 : 0;
  return Math.max(DYNAMIC.min, Math.min(DYNAMIC.max, Math.round(score)));
}

/** What the level does, in words (for the settings). */
export function handicapText(level: number): string {
  if (level === 0) return __i18n_k("league.dynamic.text.73814c6e");
  const pct = (x: number) => Math.round(Math.abs(x * level) * 100);
  return level > 0
    ? __i18n_k("league.dynamic.text.e5eba92d", { level, support: pct(DYNAMIC.support), payroll: pct(DYNAMIC.payroll), fa: pct(DYNAMIC.faFit) })
    : __i18n_k("league.dynamic.text.81dac229", { level: -level, support: pct(DYNAMIC.support), payroll: pct(DYNAMIC.payroll), fa: pct(DYNAMIC.faFit) });
}
