/* 2.0.75: a long run drifted to the pitchers (the user: 2점대 투수 20명 가까이, OPS 3위 .8xx). The talent was as it
   always was; a deader ball came in one winter and stayed for years. The farther the ball is from the middle, the
   likelier a winter brings it back (and a step back stops near the middle rather than crossing to a lively ball).
   And the records' ball line, over the winter, shows the ball the season was played with, not a value set by hand
   for the next. */
import { describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { BALL, ballOf, ballSeason, seasonBall } from '../src/league/ball';
import { setEra } from '../src/league/era';
import type { LeagueState } from '../src/league/state';
import { loadSave } from './helpers';

const load = () => {
  const s = loadSave('2.0.74');
  setEra(s);
  return s;
};

/** The winter after a season played with `cor`, over many leagues: how often the ball changed, toward where, and
    whether a step back crossed the middle. */
function winters(s: LeagueState, cor: number, n = 400) {
  const year = s.year + 1;
  let changed = 0,
    toward = 0,
    crossed = 0;
  const seed = s.seed;
  for (let i = 0; i < n; i++) {
    s.seed = `${seed}|w${i}`;
    s.year = year;
    s.ball = [{ year: year - 1, cor }];
    ballSeason(s, `${year}-03-28`);
    const b = ballOf(s)!;
    if (b.change) changed++;
    if (Math.abs(b.cor - BALL.base) < Math.abs(cor - BALL.base) - 1e-9) toward++;
    if (cor !== BALL.base && Math.sign(b.cor - BALL.base) !== Math.sign(cor - BALL.base) && Math.abs(b.cor - BALL.base) > 0.002 + 1e-9) crossed++;
  }
  s.seed = seed;
  s.year = year - 1;
  return { changed: changed / n, toward: changed ? toward / changed : 0, crossed };
}

describe('2.0.75: a dead or lively ball era does not last for years', () => {
  it('brings a ball far from the middle back sooner, and stops a step back near the middle', () => {
    const s = load();
    const dead = winters(s, 0.4051);
    expect(dead.changed).toBeGreaterThan(0.45);
    expect(dead.changed).toBeLessThan(0.7);
    expect(dead.toward).toBeGreaterThan(0.75);
    expect(dead.crossed).toBe(0);
    const lively = winters(s, 0.4214);
    expect(lively.changed).toBeGreaterThan(0.45);
    expect(lively.toward).toBeGreaterThan(0.75);
    expect(lively.crossed).toBe(0);
    // A little lively (the long era the user's league could have had): likelier to change than the usual ball.
    const little = winters(s, 0.418);
    expect(little.changed).toBeGreaterThan(0.28);
    expect(little.toward).toBeGreaterThan(0.6);
    expect(little.crossed).toBe(0);
    // The usual ball changes as seldom as before.
    const usual = winters(s, BALL.base);
    expect(usual.changed).toBeGreaterThan(0.08);
    expect(usual.changed).toBeLessThan(0.22);
  });

  it('shows, over the winter, the ball the season was played with', () => {
    const s = load();
    s.ball = [...(s.ball ?? []).filter((b) => b.year !== s.year), { year: s.year, cor: 0.4084, test: { date: `${s.year}-06-02`, cor: 0.4086 } }];
    s.offseason ??= { year: s.year } as LeagueState['offseason'];
    apply(s, { kind: 'ballManual', cor: 0.4234 });
    expect(seasonBall(s, `${s.year}-11-20`)).toEqual({ cor: 0.4084, manual: false });
    // A season played with a ball set by hand says so.
    ballOf(s)!.manual = true;
    expect(seasonBall(s, `${s.year}-11-20`)).toEqual({ cor: 0.4084, manual: true });
    // In season, the ball in play today.
    s.offseason = null;
    expect(seasonBall(s, `${s.year}-07-01`)).toEqual({ cor: 0.4234, manual: true });
  });
});
