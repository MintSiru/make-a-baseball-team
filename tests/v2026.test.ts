/* 2.0.26: the anti-dynasty alliance, the balance fund, and the players' strike. */
import { describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { holdMeeting } from '../src/league/board';
import { currentValue } from '../src/league/board';
import { dynastyOf, dynastyWinter, tradeBarred } from '../src/league/dynasty';
import { createLeague } from '../src/league/history';
import { setEra } from '../src/league/era';
import { measureHandicap, setHandicap, squadRank } from '../src/league/dynamic';
import type { LeagueState } from '../src/league/state';

const found = (s: LeagueState, board = false) => {
  apply(s, { kind: 'toFounding' });
  apply(s, { kind: 'found', settings: { name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null, ...(board ? { board: true } : {}) } });
};

describe('the anti-dynasty alliance', () => {
  it('forms against three titles running, bars trades with the club and makes it pay into the fund', () => {
    const s = createLeague('v2026-alliance');
    found(s);
    const me = s.user!.teamId;
    const base = s.history.at(-1)!;
    for (const y of [2030, 2031, 2032]) s.history.push({ ...base, year: y, champion: me });
    expect(dynastyOf(s, 2031)).toBeNull();
    expect(dynastyOf(s, 2032)).toBe(me);
    const fund = s.user!.fund;
    s.year = 2032;
    dynastyWinter(s, 2032);
    expect(s.alliance?.target).toBe(me);
    expect(tradeBarred(s, me, 'lg')).toBe(true);
    expect(tradeBarred(s, 'lg', 'doosan')).toBe(false);
    expect(s.user!.fund).toBeLessThan(fund);
    // The bottom three share the fund.
    expect(Object.keys(s.balanceShare ?? {})).toHaveLength(3);
    expect(Object.keys(s.balanceShare ?? {})).not.toContain(me);
    // Two seasons without a title: it ends.
    for (const y of [2033, 2034]) s.history.push({ ...base, year: y, champion: 'lg' });
    s.year = 2034;
    dynastyWinter(s, 2034);
    expect(s.alliance).toBeUndefined();
  });
});

describe('the players’ strike', () => {
  it('now and then cuts the next season short when a rule against the players stands', () => {
    const s = createLeague('v2026-strike');
    found(s, true);
    // The board's changes read as the game reads them (bound when a game loads).
    setEra(s);
    let strikes = 0;
    for (let y = 2030; y < 2090; y++) {
      holdMeeting(s, y, [{ item: 'faSeasons', value: 9, now: 8, by: null, push: 3 }]);
      const rec = s.board!.log.at(-1)!;
      if (rec.strike) {
        strikes++;
        expect(rec.withdrawn).toBeUndefined();
        expect(currentValue(s, 'games', y + 1)).toBe(currentValue(s, 'games', y + 2) - 8);
      }
    }
    expect(strikes).toBeGreaterThan(3);
    expect(strikes).toBeLessThan(40);
    expect((s.news ?? []).some((n) => n.id.startsWith('strike-'))).toBe(true);
    setEra(0);
  });
});

describe('the dynamic difficulty (2.0.26)', () => {
  it('counts the squad and tells us when the level moves', () => {
    const s = createLeague('v2026-dynamic');
    found(s);
    s.dynamicDifficulty = true;
    const me = s.user!.teamId;
    const year = s.year + 1; // the founded club plays on the first team from the next season
    const sq = squadRank(s, year);
    expect(sq).not.toBeNull();
    if (!sq) return;
    expect(sq.rank).toBeGreaterThanOrEqual(1);
    expect(sq.rank).toBeLessThanOrEqual(sq.clubs);
    // Three titles and the league's best squad: the level goes up, with an alert. (A new club's squad is drafted
    // later; borrow one.)
    s.rosters[me]!.active = s.rosters.lg!.active.slice();
    for (const id of s.rosters[me]!.active) for (const k of Object.keys(s.players[id]!.hidden.current)) (s.players[id]!.hidden.current as unknown as Record<string, number>)[k] = 80;
    expect(squadRank(s, year)!.rank).toBe(1);
    const base = s.history.at(-1)!;
    const table = [{ ...base.table[0]!, teamId: me, rank: 1 }, ...base.table.slice(1)];
    for (const y of [year - 2, year - 1, year]) s.history.push({ ...base, year: y, champion: me, table });
    s.user!.handicap = 0;
    expect(measureHandicap(s, year)).toBe(3);
    setHandicap(s, year);
    expect(s.user!.handicap).toBe(3);
    expect(s.alerts?.some((a) => a.id === `handicap-${year}`)).toBe(true);
  });
});
