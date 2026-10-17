/* 2.0.1: batted-ball data (exit velocity, launch angle, direction, distance, expected stats) and the hitters'
   tendencies. */
import { beforeAll, describe, expect, it } from 'vitest';
import { addBatted, battedRates, battingProfile, distanceOf, drawBall, emptyBatted, expectedOf, isBarrel } from '../src/league/battedball';
import { rng } from '../src/draftroom';
import { createLeague } from '../src/league/history';
import { pitchFeed } from '../src/league/pitchfeed';
import { isPitcher } from '../src/league/players';
import { playDay, playGame } from '../src/league/season';
import type { LeagueState } from '../src/league/state';
import type { PlayEvent } from '../src/league/engine/types';

describe('the ball in the air', () => {
  it('draws hard, high balls for home runs and soft ones for pop-ups, from its own stream', () => {
    const r = rng('v201-balls');
    const mid = { pull: 0, lift: 0, edge: 0 };
    const many = (res: Parameters<typeof drawBall>[0]) => Array.from({ length: 400 }, () => drawBall(res, 0, mid, false, r));
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const hr = many('HR'),
      go = many('GO');
    expect(mean(hr.map((b) => b.ev))).toBeGreaterThan(160);
    expect(mean(hr.map((b) => b.dist!))).toBeGreaterThan(110);
    expect(mean(hr.map((b) => b.dist!))).toBeLessThan(130);
    expect(mean(go.map((b) => b.la))).toBeLessThan(5);
    expect(go.every((b) => b.dist === undefined)).toBe(true);
    // A left-handed batter's pull side is right field.
    const lefty = Array.from({ length: 400 }, () => drawBall('GO', 0, { pull: -2, lift: 0, edge: 0 }, true, r));
    expect(mean(lefty.map((b) => b.dir))).toBeGreaterThan(5);
  });

  it('reads barrels, distance and expected stats the way the tables go', () => {
    expect(isBarrel(165, 28)).toBe(true);
    expect(isBarrel(150, 28)).toBe(false);
    expect(isBarrel(165, 5)).toBe(false);
    expect(distanceOf(170, 28)).toBeGreaterThan(distanceOf(155, 28));
    expect(expectedOf(170, 28).woba).toBeGreaterThan(expectedOf(130, 28).woba);
    expect(expectedOf(150, 15).ba).toBeGreaterThan(expectedOf(150, -10).ba);
  });

  it('sums seasons keeping the hardest ball and the longest home run', () => {
    const a = { ...emptyBatted(), n: 2, ev: 3000, evMax: 1700, hrN: 1, hrDist: 120, hrMax: 120 };
    const b = { ...emptyBatted(), n: 1, ev: 1500, evMax: 1600, hrN: 1, hrDist: 130, hrMax: 130 };
    const t = addBatted(addBatted(emptyBatted(), a), b);
    expect(t.n).toBe(3);
    expect(t.evMax).toBe(1700);
    expect(t.hrMax).toBe(130);
    expect(battedRates(t)!.ev).toBe(150);
    expect(battedRates(emptyBatted())).toBeNull();
  });
});

describe('batted balls in a season', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = createLeague('v201-season');
    for (let d = 0; d < 40; d++) playDay(s);
  }, 300_000);

  it('gives every hitter a tendency on both scales, most of them in the middle', () => {
    const hitters = Object.values(s.players).filter((p) => !isPitcher(p) && p.status === 'active');
    const profiles = hitters.map(battingProfile);
    for (const x of profiles) for (const v of [x.pull, x.lift]) expect([-2, -1, 0, 1, 2]).toContain(v);
    const share = (k: 'pull' | 'lift', v: number) => profiles.filter((x) => x[k] === v).length / profiles.length;
    for (const k of ['pull', 'lift'] as const) {
      expect(share(k, 0)).toBeGreaterThan(0.3);
      expect(share(k, -2)).toBeGreaterThan(0);
      expect(share(k, 2)).toBeGreaterThan(0);
    }
    // Centred on the league: neither end outweighs the other by much.
    const mean = (k: 'pull' | 'lift') => profiles.reduce((a, x) => a + x[k], 0) / profiles.length;
    expect(Math.abs(mean('lift'))).toBeLessThan(0.35);
    // The engine reads the edge (his lift beyond his bat's), centred on zero.
    expect(Math.abs(profiles.reduce((t, x) => t + x.edge, 0) / profiles.length)).toBeLessThan(0.1);
  });

  it('keeps a line of balls in play for each first-team hitter and pitcher, matching his at-bats', () => {
    let hitters = 0;
    let bip = 0,
      balls = 0;
    const total = emptyBatted();
    for (const l of Object.values(s.lines)) {
      const b = l.bat;
      if (!b || !b.bip || b.pa < 20) continue;
      hitters++;
      // Every at-bat that is not a strikeout is a ball in play, with the sacrifice flies; a bunt is not tracked.
      bip += b.ab - b.k + b.sf;
      balls += b.bip.n;
      addBatted(total, b.bip);
    }
    expect(hitters).toBeGreaterThan(100);
    expect(balls).toBe(bip);
    const r = battedRates(total)!;
    expect(r.ev).toBeGreaterThan(135);
    expect(r.ev).toBeLessThan(147);
    expect(r.hard).toBeGreaterThan(18);
    expect(r.hard).toBeLessThan(40);
    expect(r.barrel).toBeGreaterThan(2);
    expect(r.barrel).toBeLessThan(10);
    expect(r.gb + r.ld + r.fb + r.pu).toBeCloseTo(100, 0);
    expect(r.pull).toBeGreaterThan(r.oppo);
    expect(r.xwcon).toBeGreaterThan(0.3);
    expect(r.xwcon).toBeLessThan(0.42);
    // The pitchers' side of the same balls.
    const sum = (f: (l: (typeof s.lines)[string]) => number) => Object.values(s.lines).reduce((a, l) => a + f(l), 0);
    expect(sum((l) => l.pit?.bip?.n ?? 0)).toBe(sum((l) => l.bat?.bip?.n ?? 0));
  });

  it('puts ground-ball hitters on the ground and fly-ball hitters in the air', () => {
    const by = (lift: number) => {
      const t = emptyBatted();
      for (const [id, l] of Object.entries(s.lines)) if (l.bat?.bip && battingProfile(s.players[id]!).lift === lift) addBatted(t, l.bat.bip);
      return battedRates(t);
    };
    const low = by(-1),
      high = by(1);
    expect(low && high).toBeTruthy();
    expect(low!.gb).toBeGreaterThan(high!.gb);
  });

  it('writes the flight into the play-by-play and the relay', () => {
    const teams = s.teams.filter((t) => t.firstTeamFrom !== null).map((t) => t.id);
    const log: PlayEvent[] = [];
    const id = `${s.year}-v201-check`;
    playGame(s, teams[0]!, teams[1]!, id, s.schedule[s.next]?.date ?? `${s.year}-06-01`, 12, log);
    const pas = log.filter((e): e is Extract<PlayEvent, { k: 'pa' }> => e.k === 'pa');
    const inPlay = pas.filter((e) => !['K', 'BB', 'HBP', 'SH'].includes(e.res));
    expect(inPlay.length).toBeGreaterThan(20);
    expect(inPlay.every((e) => e.ball)).toBe(true);
    expect(pas.filter((e) => e.res === 'K').every((e) => !e.ball)).toBe(true);
    for (const e of pas.filter((x) => x.res === 'HR')) expect(e.ball!.dist).toBeGreaterThan(80);
    (s.pbp ??= {})[id] = log;
    const frames = pitchFeed(s, id)!;
    const results = frames.filter((f) => f.kind === 'result' && f.hit);
    expect(results.length).toBe(pas.filter((e) => !['K', 'BB', 'HBP'].includes(e.res)).length);
    expect(results.some((f) => f.text.includes('km/h'))).toBe(true);
  });
});
