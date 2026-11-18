/* 2.0.87 (the user's request: 이사회에서 가을야구 팀 늘리는 투표): the board may vote a sixth postseason place — two wild card
   series (3rd v 6th, 4th v 5th, the better club a win up), their winners in the semi-playoff, then the 2nd and the 1st. */
import { afterEach, describe, expect, it } from 'vitest';
import { BOARD_ITEMS, committeeMotions, currentValue } from '../src/league/board';
import { setEraBoard } from '../src/league/era';
import { lotteryOrder } from '../src/league/lottery';
import { bracketView, playPostseason } from '../src/league/postseason';
import { currentStandings } from '../src/league/season';
import { postseasonPlaces } from '../src/rules/history';
import { endRegular, loadSave } from './helpers';

afterEach(() => setEraBoard([]));

describe('2.0.87: six postseason places by the board', () => {
  it('the board may put it; voted, the rules read six', () => {
    const s = loadSave('2.0.86');
    expect(BOARD_ITEMS.postseason.max).toBe(6);
    expect(currentValue(s, 'postseason', s.year)).toBe(5);
    // Some winter the committee puts a sixth place.
    let up = false;
    for (let y = s.year; y < s.year + 60 && !up; y++) up = committeeMotions(s, y).some((m) => m.item === 'postseason' && m.value === 6);
    expect(up).toBe(true);
    setEraBoard([{ from: s.year, item: 'postseason', value: 6 }]);
    expect(currentValue(s, 'postseason', s.year)).toBe(6);
    expect(postseasonPlaces(s.year)).toBe(6);
  });

  it('plays the six: two wild card series, their winners, the 2nd, the 1st', () => {
    const s = loadSave('2.0.86');
    // Voted at the board (the league keeps its changes; every action reads them).
    const changes = [{ from: s.year, item: 'postseason' as const, value: 6 }];
    s.board = { on: true, since: s.year - 1, changes, log: [] };
    setEraBoard(changes);
    endRegular(s);
    const table = currentStandings(s).map((r) => r.teamId);
    // Before a game: the bracket shows the two wild card series waiting.
    playPostseason(s);
    const wc = s.postseason.filter((x) => x.round === 'wildcard');
    expect(wc.length).toBe(2);
    expect(wc.map((x) => [x.high, x.low]).sort()).toEqual(
      [
        [table[2], table[5]],
        [table[3], table[4]],
      ].sort(),
    );
    const semi = s.postseason.find((x) => x.round === 'semipo')!;
    expect([semi.high, semi.low].sort()).toEqual(wc.map((x) => x.winner).sort());
    // The better seed at home.
    expect(table.indexOf(semi.high)).toBeLessThan(table.indexOf(semi.low));
    const po = s.postseason.find((x) => x.round === 'po')!;
    expect(po.high).toBe(table[1]);
    expect(po.low).toBe(semi.winner);
    const ks = s.postseason.find((x) => x.round === 'ks')!;
    expect(ks.high).toBe(table[0]);
    expect(bracketView(s)!.rounds.find((r) => r.round === 'wildcard')!.series.length).toBe(2);
    // The lottery draws among the clubs out of the six.
    const order = [...table].reverse();
    const lot = lotteryOrder(s, s.year, order);
    for (const id of lot.drawn) expect(table.indexOf(id)).toBeGreaterThanOrEqual(6);
  }, 240_000);
});
