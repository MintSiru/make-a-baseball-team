/* 2.0.17: the board's draft lottery, ABS (full, challenges, none: a catcher's framing counts with the umpires), and a
   full-time or club national-team manager. */
import { beforeAll, describe, expect, it } from 'vitest';
import { absLevel, absText, currentValue, framingWeight, fullTimeManager, motionText, ruleValueText, setRule } from '../src/league/board';
import { setEra } from '../src/league/era';
import { fieldingOf, scoutedFielding } from '../src/league/fielding';
import { createLeague } from '../src/league/history';
import { lotteryOrder, LOTTERY } from '../src/league/lottery';
import type { LeagueState, UserClub } from '../src/league/state';
import { simulateGame } from '../src/league/engine/game';
import type { TeamIn } from '../src/league/engine/types';
import { rng } from '../src/draftroom';

describe('the board motions of 2.0.17', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = createLeague('v2017-board');
    s.user = { teamId: s.teams[0]!.id } as UserClub;
  }, 300_000);

  it('starts with today’s rules: no lottery, full ABS, a full-time manager', () => {
    setEra(s);
    const next = s.year + 1;
    expect(currentValue(s, 'lottery', next)).toBe(0);
    expect(absLevel(next)).toBe(2);
    expect(framingWeight(next)).toBe(0);
    expect(fullTimeManager(next)).toBe(true);
    expect(ruleValueText('abs', 0)).toBe(absText(0));
    expect(motionText({ item: 'abs', value: 0, now: 2 })).toContain('→');
  });

  it('lets the general manager take ABS away, to challenges and to none', () => {
    const season = s.year + 1;
    setRule(s, 'abs', 1);
    setEra(s);
    expect(framingWeight(season)).toBe(0.5);
    setRule(s, 'abs', 0);
    setEra(s);
    expect(framingWeight(season)).toBe(1);
    setRule(s, 'nationalManager', 0);
    setEra(s);
    expect(fullTimeManager(season)).toBe(false);
    setRule(s, 'abs', 2);
    setRule(s, 'nationalManager', 1);
    setEra(s);
    expect(s.board!.changes.some((c) => c.item === 'abs' || c.item === 'nationalManager')).toBe(false);
    setEra(0);
  });

  it('draws the first picks among the clubs out of the postseason, the rest from the bottom up', () => {
    const order = s.history.at(-1)!.table.map((r) => r.teamId).reverse();
    const res = lotteryOrder(s, s.year, order);
    expect(res.after).toHaveLength(order.length);
    expect(new Set(res.after)).toEqual(new Set(order));
    const out = order.length - 5;
    expect(res.drawn).toEqual(order.slice(0, out));
    for (const id of res.after.slice(0, LOTTERY.draws)) expect(res.drawn).toContain(id);
    const rest = res.after.slice(LOTTERY.draws);
    expect(rest).toEqual(order.filter((id) => !res.after.slice(0, LOTTERY.draws).includes(id)));
    // The worst club wins the first pick most often over many draws.
    const firsts = new Map<string, number>();
    for (let y = 0; y < 300; y++) {
      const t = lotteryOrder(s, 3000 + y, order).after[0]!;
      firsts.set(t, (firsts.get(t) ?? 0) + 1);
    }
    expect(firsts.get(order[0]!)!).toBeGreaterThan(firsts.get(order[out - 1]!) ?? 0);
  });

  it('gives catchers a framing grade and no one else', () => {
    const players = Object.values(s.players).filter((p) => p.status === 'active' && p.teamId);
    const c = players.find((p) => p.position === 'C')!;
    expect(fieldingOf(c).frame).not.toBeNull();
    expect(scoutedFielding(c).frame).not.toBeNull();
    const ss = players.find((p) => p.position === 'SS' && !(p.alt ?? []).includes('C'))!;
    expect(fieldingOf(ss).frame).toBeNull();
  });
});

describe('framing in the engine', () => {
  const POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'] as const;
  const team = (id: string, frame: number): TeamIn => ({
    teamId: id,
    lineup: POS.map((pos, i) => ({ id: `${id}-${i}`, bats: 'R', contact: 50, power: 50, eye: 50, speed: 50, defense: 50, pos, ...(pos === 'C' ? { frame } : {}) })),
    starter: { id: `${id}-sp`, throws: 'R', stuff: 50, command: 50, breaking: 50, stamina: 60, pitchLimit: 100 },
    bullpen: Array.from({ length: 5 }, (_, i) => ({ id: `${id}-r${i}`, throws: 'R' as const, stuff: 50, command: 50, breaking: 50, stamina: 40, pitchLimit: 30, role: i ? ('MU' as const) : ('CL' as const) })),
  });
  // The walks and strikeouts our pitchers get with a good (80) or a poor (20) framer behind the plate.
  const run = (frame: number, framing: number) => {
    let bb = 0,
      k = 0,
      bf = 0;
    for (let g = 0; g < 400; g++) {
      const out = simulateGame({ gameId: `f${g}`, home: team('H', frame), away: team('A', 50), maxInnings: 12, park: 1, framing }, rng(`frame|${g}`));
      for (const p of out.home.pitching) {
        bb += p.bb;
        k += p.k;
        bf += p.bf;
      }
    }
    return { bb: bb / bf, k: k / bf };
  };

  it('counts with the umpires and not with the full ABS', () => {
    const good = run(80, 1),
      poor = run(20, 1);
    expect(good.k).toBeGreaterThan(poor.k);
    expect(good.bb).toBeLessThan(poor.bb);
    expect(run(80, 0)).toEqual(run(20, 0));
  }, 120_000);
});
