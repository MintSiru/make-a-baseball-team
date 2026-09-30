/* V0.7.8: trades with cash and draft picks; the foreign players' salary cap. */
import { beforeAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { autoDecision, EXPANSION_ID } from '../src/league/expansion';
import { asiaCapFor, booksOf, capPlayers, foreignCap, settleForeignCap, tenureWith } from '../src/league/foreigncap';
import { createLeague } from '../src/league/history';
import { standardSlots } from '../src/league/offseason';
import { isForeign } from '../src/league/players';
import { firstTeamIds, orgPlayers, registeredIds, type LeagueState } from '../src/league/state';
import { applyPickTrades, checkTrade, makeTrade, pickValue, tradablePicks, tradeValue } from '../src/league/trade';
import { KBO_2026 } from '../src/rules/kbo2026';

let s: LeagueState;
beforeAll(() => {
  s = createLeague('v078-test');
  apply(s, { kind: 'toFounding' });
  apply(s, {
    kind: 'found',
    settings: { name: '울산 고래단', short: '고래', color: '#1f6fb2', cityId: 'ulsan', parentType: 'conglomerate', parentName: '가상', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null },
  });
  const decide = () => {
    while (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
  };
  decide();
  apply(s, { kind: 'regularEnd' });
  apply(s, { kind: 'postseason' });
  apply(s, { kind: 'nextSeason' });
  decide();
  apply(s, { kind: 'days', days: 20 });
}, 480_000);

const tradable = (teamId: string) =>
  registeredIds(s, teamId)
    .map((id) => s.players[id]!)
    .filter((p) => !isForeign(p) && p.proSince <= s.year)
    .sort((a, b) => tradeValue(s, b) - tradeValue(s, a));

describe('trades with cash and draft picks', () => {
  it('values picks by round and by the club’s place in the order', () => {
    const clubs = firstTeamIds(s).filter((id) => id !== EXPANSION_ID);
    for (const c of clubs) for (let r = 1; r < KBO_2026.draft.rounds; r++) expect(pickValue(s, c, r)).toBeGreaterThanOrEqual(pickValue(s, c, r + 1));
    const byFirst = clubs.map((c) => pickValue(s, c, 1)).sort((a, b) => a - b);
    expect(byFirst.at(-1)!).toBeGreaterThan(byFirst[0]!);
  });

  it('follows the KBO rules: picks only with players, cash one way, no more than the fund', () => {
    const other = firstTeamIds(s).find((id) => id !== EXPANSION_ID)!;
    const theirs = tradable(other).at(-1)!;
    expect(checkTrade(s, other, [], [], { picksOut: [5], cashIn: 10_000 }).problem).toMatch(/선수/);
    expect(checkTrade(s, other, [], [theirs.id], { cashOut: 10_000, cashIn: 10_000 }).problem).toMatch(/한쪽/);
    expect(checkTrade(s, other, [], [theirs.id], { cashOut: s.user!.fund + 10_000 }).problem).toBeTruthy();
    expect(checkTrade(s, other, [], [theirs.id], { picksOut: [1, 2, 3] }).problem).toMatch(/2장/);
    // A fringe player for cash is a deal the other club takes.
    expect(checkTrade(s, other, [], [theirs.id], { cashOut: 100_000 }).accepted).toBe(true);
  });

  it('moves the cash and the picks, and the draft gives the pick to the club that holds it', () => {
    const other = firstTeamIds(s).find((id) => id !== EXPANSION_ID)!;
    const give = tradable(EXPANSION_ID).at(-1)!;
    const get = tradable(other).at(-1)!;
    const fund = s.user!.fund;
    const extras = { cashOut: 30_000, picksOut: [4], picksIn: [2] };
    const c = checkTrade(s, other, [give.id], [get.id], extras);
    expect(c.problem).toBeNull();
    // Make it worth their while if it is not.
    const sweetened = c.accepted ? extras : { ...extras, cashOut: 200_000, picksIn: [9] };
    expect(makeTrade(s, other, [give.id], [get.id], sweetened)).toBe(true);
    expect(s.user!.fund).toBe(fund - sweetened.cashOut);
    expect(s.players[get.id]!.teamId).toBe(EXPANSION_ID);
    expect(tradablePicks(s, EXPANSION_ID)).not.toContain(4);
    // Two of our picks of this draft may go; one is gone.
    expect(tradablePicks(s, EXPANSION_ID).length).toBeGreaterThan(0);
    const slots = applyPickTrades(s, s.year, standardSlots(firstTeamIds(s)));
    const ours4 = slots.filter((x) => x.label.startsWith('4R') && x.via === EXPANSION_ID);
    expect(ours4).toHaveLength(1);
    expect(ours4[0]!.teamId).toBe(other);
    const theirs = slots.find((x) => x.via === other);
    expect(theirs?.teamId).toBe(EXPANSION_ID);
    expect(s.news?.some((n) => n.facts.type === '트레이드' && String(n.facts[`고래 보냄`] ?? '').includes('지명권'))).toBe(true);
  });
});

describe('the foreign salary cap', () => {
  it('is $4M for three, more for each season a re-signed player has with the club', () => {
    for (const teamId of firstTeamIds(s)) {
      const players = capPlayers(s, teamId, s.year);
      const slots = teamId === EXPANSION_ID ? 1 : 0;
      const tenure = players.reduce((a, p) => a + tenureWith(p, teamId, s.year), 0);
      expect(foreignCap(s, teamId, s.year)).toBe(4_000_000 + slots * 1_000_000 + tenure * 100_000);
    }
    const asia = Object.values(s.players).find((p) => p.origin.asiaQuota && p.teamId && p.career.length)!;
    expect(asiaCapFor(asia, asia.teamId!, s.year + 1)).toBe(200_000 + 100_000 * tenureWith(asia, asia.teamId!, s.year + 1));
  });

  it('AI clubs stay under it', () => {
    for (const teamId of firstTeamIds(s)) {
      if (teamId === EXPANSION_ID) continue;
      const b = booksOf(s, teamId);
      expect(b.spent).toBeLessThanOrEqual(b.cap);
    }
  });

  it('a club over it pays the levy after the season; twice running costs a second-round pick', () => {
    const x = structuredClone(s);
    const me = EXPANSION_ID;
    x.foreignBooks = { ...(x.foreignBooks ?? {}), [me]: { season: x.year, spent: 5_000_000, cap: 4_000_000 } };
    const fund = x.user!.fund;
    settleForeignCap(x, x.year);
    const rec = x.foreignCap![me]!.at(-1)!;
    expect(rec).toMatchObject({ over: 1_000_000, streak: 1 });
    expect(x.user!.fund).toBeLessThan(fund);
    expect(x.alerts?.some((a) => a.id === `foreign-cap-${x.year}`)).toBe(true);
    // The next season over again.
    x.year += 1;
    x.foreignBooks = { [me]: { season: x.year, spent: 4_500_000, cap: 4_000_000 } };
    settleForeignCap(x, x.year);
    expect(x.foreignCap![me]!.at(-1)).toMatchObject({ streak: 2 });
    expect(x.foreignPickDrop?.[x.year + 1]).toContain(me);
  });

  it('the user’s foreign players are counted, and every club has at most three against the cap', () => {
    for (const teamId of firstTeamIds(s)) expect(capPlayers(s, teamId, s.year).length).toBeLessThanOrEqual(teamId === EXPANSION_ID ? 4 : 3);
    expect(orgPlayers(s, EXPANSION_ID).some(isForeign)).toBe(true);
  });
});
