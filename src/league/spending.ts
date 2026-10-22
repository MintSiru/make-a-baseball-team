import { k as __i18n_k } from '../i18n/index';
/* 2.0.39 (the user's request: 구단 자금을 쓸 수 있는 소모처 증대): more to do with a large fund, each repeatable
   and each paid from the fund at once.
   - 선수단 격려금: in the season, a bonus to the first team — their form rises for a while (a month between bonuses).
   - 전세기·원정 숙소: a season of charter flights and better hotels — the road tires our players half as much.
   - 지역 사회공헌·팬 감사제: once a season — the fans' interest rises and the fan base grows a little.
   - 구단주에게 송금: money handed back to the owner of the club's own accord — its trust rises (up to a few points
     a season). It is the owner's money, so (like the owner's own dividends, sweep.ts) it is not the club's spending
     when the season is judged. */
import type { TeamId } from '../model/types';
import { clubState } from './fans';
import { formOf, setForm } from './life';
import { PARENT } from './tuning';
import type { LeagueState } from './state';

export type SpendKind = 'bonus' | 'charter' | 'fanDay' | 'gift';

export const SPEND = {
  /** 만 원: the tiers of a bonus (form points, days), a month between them. */
  bonus: { tiers: [{ cost: 50_000, points: 1, days: 14 }, { cost: 100_000, points: 2, days: 14 }, { cost: 300_000, points: 3, days: 21 }], gap: 30 },
  /** A season of charters: its cost and the share of the road's toll it takes off. */
  charter: { cost: 500_000, share: 0.5 },
  /** A fan day: its cost, the interest and the share of fan base it adds. */
  fanDay: { cost: 200_000, interest: 0.05, popularity: 0.02 },
  /** Money handed to the owner: 100억 a trust point, up to this many points a season. */
  gift: { perPoint: 1_000_000, most: 5 },
};

const today = (s: LeagueState) => s.schedule[s.next]?.date ?? `${s.year}-03-20`;
/** The season a charter or a fan day is for: this one in it, the next in the winter. */
export const spendSeason = (s: LeagueState) => (s.phase === 'offseason' ? s.year + 1 : s.year);

export function costOf(kind: SpendKind, tier = 0): number {
  return kind === 'bonus' ? (SPEND.bonus.tiers[tier]?.cost ?? Infinity) : kind === 'charter' ? SPEND.charter.cost : kind === 'fanDay' ? SPEND.fanDay.cost : SPEND.gift.perPoint;
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Why the club cannot spend this now, or null. */
export function checkSpend(s: LeagueState, kind: SpendKind, tier = 0): string | null {
  const u = s.user;
  if (!u) return __i18n_k("league.spending.text.272add95");
  const sp = u.spending ?? {};
  if (u.fund < costOf(kind, tier)) return __i18n_k("league.spending.text.28f75cea");
  switch (kind) {
    case 'bonus':
      if (s.phase !== 'regular' || s.next >= s.schedule.length) return __i18n_k("league.spending.text.724f5a91");
      if (!SPEND.bonus.tiers[tier]) return __i18n_k("league.spending.text.5dc6c038");
      if (sp.bonusDate && daysBetween(sp.bonusDate, today(s)) < SPEND.bonus.gap) return __i18n_k("league.spending.text.95e1f1ad", { days: SPEND.bonus.gap });
      return null;
    case 'charter':
      return sp.charter === spendSeason(s) ? __i18n_k("league.spending.text.fdd2034c") : null;
    case 'fanDay':
      return sp.fanDay === spendSeason(s) ? __i18n_k("league.spending.text.8abbad48") : null;
    case 'gift':
      return (sp.giftYear === s.year ? (sp.giftPoints ?? 0) : 0) >= SPEND.gift.most ? __i18n_k("league.spending.text.13c2d4cc") : (u.trust ?? PARENT.startTrust) >= 100 ? __i18n_k("league.spending.text.262903e1") : null;
  }
}

/** Spends: the money leaves the fund now and the effect starts. */
export function spend(s: LeagueState, kind: SpendKind, tier = 0) {
  if (checkSpend(s, kind, tier)) return;
  const u = s.user!;
  const sp = (u.spending ??= {});
  const cost = costOf(kind, tier);
  u.fund -= cost;
  switch (kind) {
    case 'bonus': {
      const t = SPEND.bonus.tiers[tier]!;
      const date = today(s);
      sp.bonusDate = date;
      for (const id of s.rosters[u.teamId]?.active ?? []) {
        const p = s.players[id];
        if (p && formOf(p, date) < t.points) setForm(p, t.points, date, t.days, __i18n_k("league.spending.text.3480e2b9"));
      }
      u.ledger.push({ year: s.year, label: __i18n_k("league.spending.text.e8cd6e73"), amount: -cost });
      break;
    }
    case 'charter':
      sp.charter = spendSeason(s);
      u.ledger.push({ year: s.year, label: __i18n_k("league.spending.text.352fbd23", { season: sp.charter }), amount: -cost });
      break;
    case 'fanDay': {
      sp.fanDay = spendSeason(s);
      const c = clubState(s, u.teamId);
      c.interest += SPEND.fanDay.interest;
      c.popularity = Math.round(c.popularity * (1 + SPEND.fanDay.popularity));
      u.ledger.push({ year: s.year, label: __i18n_k("league.spending.text.9c546993"), amount: -cost });
      break;
    }
    case 'gift':
      if (sp.giftYear !== s.year) sp.giftPoints = 0;
      sp.giftYear = s.year;
      sp.giftPoints = (sp.giftPoints ?? 0) + 1;
      u.trust = Math.min(100, (u.trust ?? PARENT.startTrust) + 1);
      u.ledger.push({ year: s.year, label: __i18n_k("league.spending.text.bceb4b9f"), amount: -cost, sweep: true });
      break;
  }
}

/** A season of charters halves the road's toll on the club (travel.ts). */
export const charterShare = (s: LeagueState, teamId: TeamId) => (s.user?.teamId === teamId && s.user.spending?.charter === s.year ? SPEND.charter.share : 0);
