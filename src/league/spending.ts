import { k as __i18n_k } from '../i18n/index';
/* 2.0.39 (the user's request: 구단 자금을 쓸 수 있는 소모처 증대): more to do with a large fund, each repeatable
   and each paid from the fund at once.
   - 선수단 격려금: in the season, a bonus to the first team — their form rises for a while (a month between bonuses).
   - 전세기·원정 숙소: a season of charter flights and better hotels — the road tires our players half as much.
   - 지역 사회공헌·팬 감사제: once a season — the fans' interest rises and the fan base grows a little.
   - 구단주에게 송금: money handed back to the owner of the club's own accord — its trust rises (up to a few points
     a season). It is the owner's money, so (like the owner's own dividends, sweep.ts) it is not the club's spending
     when the season is judged.
   2.0.42 (the user's request: 5,6천억이 쌓여도 쓸 곳이 없어 모기업이 가져가는 것만 구경): bigger uses.
   - 연고지 투자: the club puts money into its city (transport, tourism, new housing) — the fan base grows for good,
     more for a small market (울릉) than a big one, a little less with each investment; once a winter.
   - 구단 독립: the club buys itself out of its owner (the parent's shares, the investors', the city's) — the owner
     takes no more of the fund and can no longer fire the general manager, but pays no more support either; the
     club lives on what it earns. */
import type { ParentCompanyType } from '../club/types';
import type { TeamId } from '../model/types';
import { cityById } from '../club/cities';
import { scenarioOf } from './scenarios';
import { clubState } from './fans';
import { formOf, setForm } from './life';
import { addNews } from './news';
import { eunneun } from './josa';
import { PARENT } from './tuning';
import type { LeagueState } from './state';
import { projectedPayroll } from './market';

export type SpendKind = 'bonus' | 'charter' | 'fanDay' | 'gift' | 'city' | 'independence';

export const SPEND = {
  /** 만 원: the tiers of a bonus (form points, days), a month between them. */
  bonus: { tiers: [{ cost: 50_000, points: 1, days: 14 }, { cost: 100_000, points: 2, days: 14 }, { cost: 300_000, points: 3, days: 21 }], gap: 30 },
  /** A season of charters: its cost and the share of the road's toll it takes off. */
  charter: { cost: 500_000, share: 0.5 },
  /** A fan day: its cost, the interest and the share of fan base it adds. */
  fanDay: { cost: 200_000, interest: 0.05, popularity: 0.02 },
  /** Money handed to the owner: 100억 a trust point, up to this many points a season. */
  gift: { perPoint: 1_000_000, most: 5 },
  /** 2.0.42: investing in the city — each tier's cost (만 원), the share of fan base and the interest it adds; each
      earlier investment takes this share off the next (×), and the city's market moves it (a small one gains more). */
  city: {
    tiers: [
      { cost: 5_000_000, popularity: 0.08, interest: 0.05 },
      { cost: 20_000_000, popularity: 0.35, interest: 0.1 },
      { cost: 50_000_000, popularity: 1, interest: 0.2 },
    ],
    fade: 0.85,
    market: { mid: 50, per: 0.01, min: 0.7, max: 1.5 },
  },
  /** 2.0.42: buying the club out of its owner (만 원), by the owner's kind. */
  independence: { conglomerate: 60_000_000, midsize: 40_000_000, namingRights: 30_000_000, citizen: 30_000_000 } as Record<ParentCompanyType, number>,
};

const today = (s: LeagueState) => s.schedule[s.next]?.date ?? `${s.year}-03-20`;
/** The season a charter or a fan day is for: this one in it, the next in the winter. */
export const spendSeason = (s: LeagueState) => (s.phase === 'offseason' ? s.year + 1 : s.year);

export function costOf(kind: SpendKind, tier = 0, s?: LeagueState): number {
  if (kind === 'city') return SPEND.city.tiers[tier]?.cost ?? Infinity;
  if (kind === 'independence') return s?.user ? SPEND.independence[s.user.settings.parentType] : Infinity;
  return kind === 'bonus' ? (SPEND.bonus.tiers[tier]?.cost ?? Infinity) : kind === 'charter' ? SPEND.charter.cost : kind === 'fanDay' ? SPEND.fanDay.cost : SPEND.gift.perPoint;
}

/** 2.0.42: the share of fan base a city investment of this tier adds now (after the earlier ones, for this market). */
export function cityGain(s: LeagueState, tier: number): number {
  const u = s.user!;
  const M = SPEND.city.market;
  const market = cityById(u.settings.cityId)?.market ?? M.mid;
  const k = Math.max(M.min, Math.min(M.max, 1 + (M.mid - market) * M.per));
  return (SPEND.city.tiers[tier]?.popularity ?? 0) * SPEND.city.fade ** (u.spending?.cityCount ?? 0) * k;
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Why the club cannot spend this now, or null. */
export function checkSpend(s: LeagueState, kind: SpendKind, tier = 0): string | null {
  const u = s.user;
  if (!u) return __i18n_k("league.spending.text.272add95");
  const sp = u.spending ?? {};
  if (u.fund < costOf(kind, tier, s)) return __i18n_k("league.spending.text.28f75cea");
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
    case 'city':
      if (!SPEND.city.tiers[tier]) return __i18n_k("league.spending.text.33ad251e");
      return s.phase !== 'offseason' ? __i18n_k("league.spending.text.e4ccb4f2") : sp.cityYear === s.year ? __i18n_k("league.spending.text.e9b3165e") : null;
    case 'independence':
      if (u.independent) return __i18n_k("league.spending.text.3ae4e97b");
      if (scenarioOf(s)?.locked.includes('firing')) return __i18n_k("league.spending.text.efc4d27a");
      return s.phase !== 'offseason' ? __i18n_k("league.spending.text.f1db2998") : null;
    case 'gift':
      if (u.independent) return __i18n_k("league.spending.text.e2f3223b");
      return (sp.giftYear === s.year ? (sp.giftPoints ?? 0) : 0) >= SPEND.gift.most ? __i18n_k("league.spending.text.13c2d4cc") : (u.trust ?? PARENT.startTrust) >= 100 ? __i18n_k("league.spending.text.262903e1") : null;
  }
}

/** Spends: the money leaves the fund now and the effect starts. */
export function spend(s: LeagueState, kind: SpendKind, tier = 0) {
  if (checkSpend(s, kind, tier)) return;
  const u = s.user!;
  const sp = (u.spending ??= {});
  const cost = costOf(kind, tier, s);
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
    case 'city': {
      const gain = cityGain(s, tier);
      const t = SPEND.city.tiers[tier]!;
      const c = clubState(s, u.teamId);
      c.popularity = Math.round(c.popularity * (1 + gain));
      c.interest += t.interest;
      sp.cityYear = s.year;
      sp.cityCount = (sp.cityCount ?? 0) + 1;
      sp.cityTotal = (sp.cityTotal ?? 0) + cost;
      u.ledger.push({ year: s.year, label: __i18n_k("league.spending.text.f6661869"), amount: -cost, capital: true });
      (u.log ??= []).push({ year: s.year, text: __i18n_k("league.spending.text.a6216900", { cost: Math.round(cost / 10_000), pct: Math.round(gain * 100) }) });
      break;
    }
    case 'independence': {
      u.independent = s.year;
      delete u.goals;
      // Its budget from now on is its own (the fund after the price, paid above).
      independentBudget(s, s.phase === 'offseason' && s.offseason ? s.offseason.year + 1 : s.year);
      u.ledger.push({ year: s.year, label: __i18n_k("league.spending.text.4b6e83eb"), amount: -cost, capital: true });
      const team = s.teams.find((x) => x.id === u.teamId)!;
      const text = __i18n_k("league.spending.text.bb7e52cf", { club: team.name, owner: u.settings.parentName });
      (u.log ??= []).push({ year: s.year, text });
      addNews(s, { id: `independence-${s.year}`, date: `${s.year}-12-20`, kind: 'move', title: text, body: __i18n_k("league.spending.text.0c072254", { club: eunneun(team.name), cost: Math.round(cost / 10_000) }), quotes: [], facts: {}, players: [], mine: true });
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

/** 2.0.64 (the user's report): an independent club's payroll budget for `season` — what it already pays then and the
    fund it has (no owner's budget, no floor, no owner's free agents on top). Set when it becomes independent and each
    winter; new contracts use it up as they would an owner's. */
export function independentBudget(s: LeagueState, season: number) {
  const u = s.user;
  if (!u?.independent) return;
  u.payrollBudget = Math.round((projectedPayroll(s, u.teamId, season) + Math.max(0, u.fund)) / 1000) * 1000;
  delete u.budgetWhy;
}
