/* 2.0.3: fielding in parts (range with speed, hands, arm, a catcher's game-calling), sprint speed and pop time, each
   ball's fielder, OAA and the fielding runs in WAR. */
import { beforeAll, describe, expect, it } from 'vitest';
import { addField, emptyField, fielderFor, fieldingFrom, fieldingOf, fieldingRuns, popTime, sprintSpeed } from '../src/league/fielding';
import { rng } from '../src/draftroom';
import { createLeague } from '../src/league/history';
import { pitchingLift } from '../src/league/pitches';
import { isPitcher } from '../src/league/players';
import { playDay } from '../src/league/season';
import type { LeagueState } from '../src/league/state';
import { batterWar, defensiveWar, leagueContext } from '../src/league/stats';
import { addInto, emptyBat, emptyPit } from '../src/league/state';

describe('fielding in parts', () => {
  it('moves range with speed, keeps the grade near the average of the parts, and gives only catchers a lead', () => {
    const slow = fieldingFrom('x', 60, 30, false),
      fast = fieldingFrom('x', 60, 70, false);
    expect(fast.range - slow.range).toBe(20);
    expect(fast.hands).toBe(slow.hands);
    expect(slow.lead).toBeNull();
    expect(fieldingFrom('x', 60, 50, true).lead).not.toBeNull();
    const s = createLeague('v203-parts');
    const hitters = Object.values(s.players).filter((p) => !isPitcher(p) && p.status === 'active');
    const mean = (f: (p: (typeof hitters)[number]) => number) => hitters.reduce((a, p) => a + f(p), 0) / hitters.length;
    expect(Math.abs(mean((p) => fieldingOf(p).hands) - mean((p) => p.hidden.current.defense ?? 30))).toBeLessThan(2);
    // Sprint speed and pop time in a plausible span, faster runners faster.
    const speeds = hitters.map((p) => ({ s: p.hidden.current.speed ?? 40, v: sprintSpeed(p) }));
    for (const x of speeds) {
      expect(x.v).toBeGreaterThan(6.5);
      expect(x.v).toBeLessThan(9.8);
    }
    const quick = speeds.filter((x) => x.s >= 60),
      slowRunners = speeds.filter((x) => x.s <= 40);
    expect(quick.reduce((a, x) => a + x.v, 0) / quick.length).toBeGreaterThan(slowRunners.reduce((a, x) => a + x.v, 0) / slowRunners.length + 0.5);
    for (const p of hitters.filter((x) => x.position === 'C')) {
      expect(popTime(p)).toBeGreaterThan(1.75);
      expect(popTime(p)).toBeLessThan(2.25);
    }
  });

  it('sends the ball to a fielder by where the hitter pulls it', () => {
    const r = rng('v203-fielders');
    const count = (pull: number, lefty: boolean) => {
      const n: Record<string, number> = {};
      for (let i = 0; i < 4000; i++) {
        const pos = fielderFor(r, 0.5, pull, lefty);
        n[pos] = (n[pos] ?? 0) + 1;
      }
      return n;
    };
    const pullR = count(-2, false),
      oppoR = count(2, false),
      pullL = count(-2, true);
    expect(pullR['3B']!).toBeGreaterThan(oppoR['3B']!);
    expect(pullL['1B']!).toBeGreaterThan(pullR['1B']!);
    expect((pullR['3B']! + pullR['SS']! + pullR['2B']! + pullR['1B']!) / 4000).toBeCloseTo(0.5, 1);
  });

  it('counts fielding runs and puts them in WAR', () => {
    const f = { ...emptyField(), ch: 400, po: 300, oaa: 10_000, arm: 2_000, csaa: 0, lead: 0 };
    expect(fieldingRuns(f)).toBeCloseTo(10, 5);
    expect(fieldingRuns(addField(emptyField(), f))).toBeCloseTo(10, 5);
    const bat = addInto(emptyBat(), { g: 140, pa: 600, ab: 540, h: 150, d: 30, hr: 15, bb: 50, k: 100 });
    const lg = leagueContext(bat, emptyPit());
    const plain = batterWar(bat, 'SS', lg);
    expect(batterWar({ ...bat, fld: f }, 'SS', lg)).toBeCloseTo(plain + 1, 0);
    expect(defensiveWar({ ...bat, fld: f }, 'SS')).toBeGreaterThan(defensiveWar(bat, 'SS'));
  });
});

describe('fielding in a season', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = createLeague('v203-season');
    for (let d = 0; d < 50; d++) playDay(s);
  }, 300_000);

  it('credits every ball in play to a fielder, centred on the league: as many outs above as below average', () => {
    let ch = 0,
      po = 0,
      oaa = 0,
      inPlay = 0,
      cpa = 0,
      pa = 0,
      sh = 0;
    for (const l of Object.values(s.lines)) {
      const b = l.bat;
      if (!b) continue;
      pa += b.pa;
      sh += b.sh;
      if (b.bip) inPlay += b.bip.n - b.hr;
      if (!b.fld) continue;
      ch += b.fld.ch;
      po += b.fld.po;
      oaa += b.fld.oaa;
      cpa += b.fld.cpa;
    }
    // Every ball in play but the home runs is someone's chance (a substitute's included).
    expect(ch).toBe(inPlay);
    expect(po / ch).toBeGreaterThan(0.6);
    expect(Math.abs(oaa / 1000 / ch)).toBeLessThan(0.01);
    // A catcher behind the plate for every plate appearance but the sacrifice bunts (his game-calling moves strikeouts
    // and walks).
    expect(cpa).toBe(pa - sh);
  });

  it('splits the pitchers from extreme ground-ball to extreme fly-ball, and their balls go that way', () => {
    const arms = Object.values(s.players).filter((p) => isPitcher(p) && p.status === 'active');
    const steps = arms.map(pitchingLift);
    for (const k of [-2, -1, 0, 1, 2]) expect(steps.filter((x) => x === k).length).toBeGreaterThan(0);
    expect(Math.abs(steps.reduce((a, b) => a + b, 0) / steps.length)).toBeLessThan(0.25);
    const gb = (k: number[]) => {
      let g = 0,
        n = 0;
      for (const [id, l] of Object.entries(s.lines)) {
        const t = l.pit?.bip;
        if (!t || !k.includes(pitchingLift(s.players[id]!))) continue;
        g += t.gb;
        n += t.n;
      }
      return g / n;
    };
    expect(gb([-2, -1])).toBeGreaterThan(gb([1, 2]) + 0.04);
  });

  it('gives the better ranges more outs above average', () => {
    const rows = Object.entries(s.lines)
      .filter(([, l]) => (l.bat?.fld?.ch ?? 0) >= 60)
      .map(([id, l]) => ({ range: fieldingOf(s.players[id]!).range, rate: l.bat!.fld!.oaa / l.bat!.fld!.ch }));
    const good = rows.filter((x) => x.range >= 65),
      poor = rows.filter((x) => x.range <= 50);
    const mean = (xs: typeof rows) => xs.reduce((a, x) => a + x.rate, 0) / Math.max(1, xs.length);
    expect(good.length).toBeGreaterThan(3);
    expect(poor.length).toBeGreaterThan(3);
    expect(mean(good)).toBeGreaterThan(mean(poor));
  });
});
