/* 2.0.70 (the user's request): the official ball's liveliness — livelier or deader now and then over a winter, the
   KBO's June test of the balls and its corrections, and the home runs it moves. */
import { describe, expect, it } from 'vitest';
import { BALL, ballOf, ballSeason, ballShift, ballTest, corOn, inRange } from '../src/league/ball';
import { setEra, startYear } from '../src/league/era';
import { playGame } from '../src/league/season';
import { firstTeamIds } from '../src/league/state';
import { loadSave } from './helpers';

describe('the official ball (2.0.70)', () => {
  it('stays the usual ball in a game’s first season, and changes now and then after', () => {
    const s = loadSave('2.0.68');
    setEra(s);
    const year0 = s.year;
    s.year = startYear();
    delete s.ball;
    ballSeason(s, `${s.year}-03-28`);
    expect(ballOf(s)).toEqual({ year: s.year, cor: BALL.base });
    const changes: string[] = [];
    const first = s.year;
    for (let y = first + 1; y < first + 80; y++) {
      s.year = y;
      ballSeason(s, `${y}-03-28`);
      const b = ballOf(s)!;
      if (b.change) changes.push(b.change);
      // A ball out of the range is seldom kept two seasons.
      expect(Math.abs(b.cor - BALL.base)).toBeLessThanOrEqual(BALL.range + BALL.step[1] + 1e-9);
    }
    expect(changes.filter((c) => c === 'up').length).toBeGreaterThan(1);
    expect(changes.filter((c) => c === 'down').length).toBeGreaterThan(1);
    expect(s.ball!.length).toBeLessThanOrEqual(30);
    // The news of it.
    expect(s.news?.some((n) => /공인구 반발계수/.test(n.title))).toBe(true);
    s.year = year0;
  });

  it('fails the June test out of the range and brings the second half’s balls halfway back', () => {
    const s = loadSave('2.0.68');
    setEra(s);
    s.ball = [{ year: s.year, cor: BALL.base + 0.016, change: 'up' }];
    ballTest(s, `${s.year}-05-20`);
    expect(ballOf(s)!.test).toBeUndefined();
    ballTest(s, `${s.year}-06-02`);
    const b = ballOf(s)!;
    expect(inRange(b.test!.cor)).toBe(false);
    expect(b.test!.after).toBeCloseTo(BALL.base + 0.008, 4);
    expect(corOn(s, `${s.year}-05-31`)).toBe(b.cor);
    expect(corOn(s, `${s.year}-07-01`)).toBe(b.test!.after);
    expect(s.alerts?.some((a) => a.id === `ball-test-${s.year}` && a.tone === 'bad')).toBe(true);
    // A ball in the range passes: an article, nothing changes.
    s.ball = [{ year: s.year, cor: BALL.base }];
    ballTest(s, `${s.year}-06-02`);
    expect(ballOf(s)!.test!.after).toBeUndefined();
    expect(ballShift(s, `${s.year}-07-01`)).toBeUndefined();
  });

  it('a livelier ball brings more home runs, a deader one fewer', { timeout: 300_000 }, () => {
    const s = loadSave('2.0.68');
    setEra(s);
    const [a, b] = firstTeamIds(s);
    const date = s.schedule[s.next]?.date ?? `${s.year}-07-01`;
    const homers = (cor: number) => {
      s.ball = [{ year: s.year, cor }];
      let hr = 0;
      for (let g = 0; g < 120; g++) {
        const out = playGame(s, a!, b!, `ball-test-${g}`, date, 9)!;
        hr += [...out.home.batting, ...out.away.batting].reduce((x, l) => x + l.hr, 0);
      }
      return hr;
    };
    const usual = homers(BALL.base);
    const live = homers(BALL.base + 0.012);
    const dead = homers(BALL.base - 0.012);
    expect(live).toBeGreaterThan(usual * 1.25);
    expect(dead).toBeLessThan(usual * 0.8);
  });
});
