import { k as __i18n_k } from '../i18n/index';
/* The owner takes the surplus (1.8.2, from the 1.8 feedback: 모기업이 보유금을 가져가는 이벤트). A club that has
   added to its fund three seasons running and sits on a large fund may see the owner take part of it back in the
   winter: a dividend for a parent company, the investors' share for a naming-rights club, the city's share for a
   citizen club. The owner takes a share of what is above the level it lets the club keep, more readily the more is
   piled up, and not again until three more seasons of surplus. The general manager hears of it afterwards; it
   pleases the owner a little. */
import { rng } from '../draftroom';
import type { ParentCompanyType } from '../club/types';
import { addAlert } from './alerts';
import { iga } from './josa';
import { addNews } from './news';
import type { LeagueState } from './state';
import { PARENT } from './tuning';

export const SWEEP = {
  /** Seasons of surplus in a row it takes. */
  years: 3,
  /** The fund (만 원) above which the owner looks at it, and what it lets the club keep. */
  threshold: { conglomerate: 3_000_000, midsize: 2_500_000, namingRights: 2_000_000, citizen: 2_000_000 } as Record<ParentCompanyType, number>,
  keep: { conglomerate: 2_000_000, midsize: 1_500_000, namingRights: 1_200_000, citizen: 1_200_000 } as Record<ParentCompanyType, number>,
  /** Share of the fund above `keep` it takes. */
  share: { conglomerate: 0.6, midsize: 0.5, namingRights: 0.4, citizen: 0.5 } as Record<ParentCompanyType, number>,
  /** The chance in an eligible winter, and how much likelier per 100억 over the threshold. */
  chance: 0.5,
  perHundred: 0.15,
  /** Trust the owner gains. */
  trust: 2,
} as const;

/** What a season added to the fund (만 원): every entry of that year but building work and earlier sweeps. */
export function seasonSurplus(s: LeagueState, year: number): number {
  return s.user!.ledger.filter((l) => l.year === year && !l.capital && !l.sweep).reduce((a, l) => a + l.amount, 0);
}

/** Why the owner would not take any now, or null if it may. */
export function sweepProblem(s: LeagueState, year: number): string | null {
  const u = s.user;
  if (!u) return 'no club';
  // 2.0.42: an independent club has no owner to take it (spending.ts).
  if (u.independent) return 'independent';
  const type = u.settings.parentType;
  if (u.fund < SWEEP.threshold[type]) return 'fund below the threshold';
  const last = u.sweeps?.at(-1)?.year ?? -Infinity;
  for (let y = year - SWEEP.years + 1; y <= year; y++) {
    if (y < u.firstTeamYear || y <= last) return 'not enough seasons';
    if (seasonSurplus(s, y) <= 0) return 'a season in deficit';
  }
  return null;
}

/** In the winter after the owner's verdict: perhaps the owner takes part of the fund. Returns the amount taken. */
export function ownerSweep(s: LeagueState, year: number): number {
  const u = s.user;
  if (!u || sweepProblem(s, year)) return 0;
  const type = u.settings.parentType;
  const over = (u.fund - SWEEP.threshold[type]) / 1_000_000;
  if (rng(`${s.seed}|sweep|${year}`)() >= Math.min(0.95, SWEEP.chance + over * SWEEP.perHundred)) return 0;
  const amount = Math.round(((u.fund - SWEEP.keep[type]) * SWEEP.share[type]) / 10_000) * 10_000;
  if (amount <= 0) return 0;
  u.fund -= amount;
  const who = type === 'citizen' ? __i18n_k("league.sweep.text.a7762a23") : type === 'namingRights' ? __i18n_k("league.sweep.text.455b9ad1") : __i18n_k("league.sweep.text.cf76b767");
  const label = type === 'citizen' ? __i18n_k("league.sweep.text.10be9b03") : type === 'namingRights' ? __i18n_k("league.sweep.text.ac0c0577") : __i18n_k("league.sweep.text.c0de68bc");
  u.ledger.push({ year, label, amount: -amount, sweep: true });
  (u.sweeps ??= []).push({ year, amount });
  u.trust = Math.min(100, (u.trust ?? PARENT.startTrust) + SWEEP.trust);
  const eok = (n: number) => __i18n_k("league.sweep.text.db0fc332", { value: Math.round(n / 10_000) });
  const parent = s.teams.find((t) => t.id === u.teamId)?.parent.name ?? who;
  const title = __i18n_k("league.sweep.text.186c8990", { who: parent, amount: eok(amount) });
  const lines = [
    __i18n_k("league.sweep.text.b692d735", { years: SWEEP.years, fund: eok(u.fund + amount), who: iga(who), amount: eok(amount) }),
    __i18n_k("league.sweep.text.30e3f6c0", { left: eok(u.fund), who }),
  ];
  const date = `${year}-12-15`;
  addAlert(s, { id: `sweep-${year}`, date, kind: 'owner', title, lines, tone: 'bad' });
  addNews(s, { id: `sweep-${year}`, date, kind: 'season', title, body: lines.join(' '), quotes: [], facts: { amount: eok(amount) }, players: [], mine: true });
  (u.log ??= []).push({ year, text: title });
  return amount;
}
