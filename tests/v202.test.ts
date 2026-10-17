/* 2.0.2: ballpark layouts — fence distance and height by field, their home-run effect, and our club's layout editor. */
import { describe, expect, it } from 'vitest';
import { createLeague } from '../src/league/history';
import { checkLayout, clearance, fenceAt, homeRunFactor, layoutCost, layoutEffects, layoutOf, LAYOUTS, NEUTRAL, shifted } from '../src/league/layout';
import { playGame } from '../src/league/season';
import type { PlayEvent } from '../src/league/engine/types';

describe('ballpark layouts', () => {
  it('ranks the real parks the way their fences go: 잠실 and 창원 hold the ball in, 문학 and 라이온즈파크 let it out', () => {
    expect(homeRunFactor(LAYOUTS.lg!)).toBeLessThan(1);
    expect(homeRunFactor(LAYOUTS.nc!)).toBeLessThan(1);
    expect(homeRunFactor(LAYOUTS.ssg!)).toBeGreaterThan(1.1);
    expect(homeRunFactor(LAYOUTS.samsung!)).toBeGreaterThan(1.1);
    // Centred on the league: today's parks average to about nothing.
    const mean = Object.values(LAYOUTS).reduce((a, l) => a + layoutEffects(l).hr, 0) / Object.keys(LAYOUTS).length;
    expect(Math.abs(mean)).toBeLessThan(0.005);
    expect(Math.abs(layoutEffects(NEUTRAL).hr)).toBeLessThan(0.08);
  });

  it('reads the fence between zones and asks more of a ball over a high wall', () => {
    const l = LAYOUTS.hanwha!;
    expect(fenceAt(l, -45).dist).toBe(99);
    expect(fenceAt(l, 0).dist).toBe(122);
    expect(fenceAt(l, 11.25).dist).toBeCloseTo((122 + 112) / 2, 5);
    // The 8 m wall in right: a shorter fence than left, but more carry to clear it.
    expect(fenceAt(l, 45).dist).toBeLessThan(fenceAt(l, -45).dist);
    expect(clearance(l, 45)).toBeGreaterThan(clearance(l, -45));
  });

  it('moves a park of before by its run factor, and prices the editor by the metre', () => {
    expect(homeRunFactor(shifted(NEUTRAL, 1.08))).toBeGreaterThan(homeRunFactor(NEUTRAL));
    expect(homeRunFactor(shifted(NEUTRAL, 0.94))).toBeLessThan(homeRunFactor(NEUTRAL));
    expect(layoutCost(NEUTRAL, NEUTRAL)).toBe(0);
    const closer = { dist: NEUTRAL.dist.map((d) => d - 2) as typeof NEUTRAL.dist, wall: [...NEUTRAL.wall] as typeof NEUTRAL.wall };
    const higher = { dist: [...NEUTRAL.dist] as typeof NEUTRAL.dist, wall: NEUTRAL.wall.map((w) => w + 4) as typeof NEUTRAL.wall };
    expect(layoutCost(NEUTRAL, closer)).toBeGreaterThan(0);
    expect(homeRunFactor(closer)).toBeGreaterThan(homeRunFactor(NEUTRAL));
    expect(homeRunFactor(higher)).toBeLessThan(homeRunFactor(NEUTRAL));
    expect(checkLayout(closer)).toBeNull();
    expect(checkLayout({ dist: [80, 117, 122, 117, 98], wall: [3, 3, 3, 3, 3] })).toBeTruthy();
    expect(checkLayout({ dist: [98, 117, 122, 117, 98], wall: [3, 3, 3, 3, 30] })).toBeTruthy();
  });

  it('gives every club its park, a moved fence of before included', () => {
    const s = createLeague('v202');
    for (const t of s.teams) expect(layoutOf(t).dist).toHaveLength(5);
    const lg = s.teams.find((t) => t.id === 'lg')!;
    expect(layoutOf(lg)).toEqual(LAYOUTS.lg);
    expect(homeRunFactor(layoutOf({ ...lg, stadium: { ...lg.stadium, park: 1.02 } }))).toBeGreaterThan(homeRunFactor(LAYOUTS.lg!));
  });

  it('plays more home runs in a small park, and every one of them over the fence where it went', () => {
    const s = createLeague('v202-games');
    const date = s.schedule[s.next]!.date;
    const lg = s.teams.find((t) => t.id === 'lg')!;
    const run = (layout: typeof NEUTRAL) => {
      lg.stadium = { ...lg.stadium, layout };
      let hr = 0;
      for (let i = 0; i < 150; i++) {
        const log: PlayEvent[] = [];
        const out = playGame(s, 'lg', 'doosan', `v202-${i}`, date, 12, log)!;
        hr += out.home.batting.reduce((a, b) => a + b.hr, 0) + out.away.batting.reduce((a, b) => a + b.hr, 0);
        for (const e of log) if (e.k === 'pa' && e.res === 'HR') expect(e.ball!.dist!).toBeGreaterThanOrEqual(clearance(layout, e.ball!.dir));
      }
      return hr;
    };
    const small = { dist: [92, 108, 116, 108, 92], wall: [2.4, 2.4, 2.4, 2.4, 2.4] } as typeof NEUTRAL;
    const big = { dist: [104, 125, 130, 125, 104], wall: [5, 5, 5, 5, 5] } as typeof NEUTRAL;
    expect(run(small)).toBeGreaterThan(run(big) * 1.3);
  });
});
