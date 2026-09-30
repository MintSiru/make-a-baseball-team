/* V0.7.6: the manager's lineup (optimal positions, batting order, days off) and the display settings. */
import { beforeAll, describe, expect, it } from 'vitest';
import { bootstrap } from '../src/league/history';
import { assign, lineupFor } from '../src/league/manager';
import { lineupView } from '../src/league/views';
import { rng } from '../src/draftroom';
import { fitPenalty, positionGames } from '../src/league/positions';
import type { LeagueState } from '../src/league/state';
import { applyDisplay, DEFAULT_PREFS, gradeTier, parseDisplay, PRESETS, tierColors } from '../src/ui/display';

let s: LeagueState;
beforeAll(() => {
  s = bootstrap('v076-test');
}, 120_000);

const SLOTS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

describe('assignment', () => {
  const brute = (value: number[][]) => {
    const n = value.length,
      m = value[0]!.length;
    let best = -Infinity;
    const go = (i: number, used: Set<number>, sum: number) => {
      if (i === n) return void (best = Math.max(best, sum));
      for (let j = 0; j < m; j++) if (!used.has(j)) go(i + 1, new Set([...used, j]), sum + value[i]![j]!);
    };
    go(0, new Set(), 0);
    return best;
  };

  it('finds the best total, each slot a different player', () => {
    const r = rng('assign');
    for (let k = 0; k < 40; k++) {
      const n = 2 + Math.floor(r() * 4),
        m = n + Math.floor(r() * 3);
      const value = Array.from({ length: n }, () => Array.from({ length: m }, () => Math.round(r() * 100 - 30)));
      const pick = assign(value);
      expect(new Set(pick).size).toBe(n);
      expect(pick.reduce((a, j, i) => a + value[i]![j]!, 0)).toBe(brute(value));
    }
  });

  it('leaves slots empty when there are too few players', () => {
    const pick = assign([
      [5, 1],
      [9, 2],
      [1, 1],
    ]);
    expect(pick.filter((j) => j === -1)).toHaveLength(1);
    expect(pick.filter((j) => j >= 0).sort()).toEqual([0, 1]);
  });
});

describe('the manager’s lineup', () => {
  it('fills the nine positions with nine different hitters, a catcher behind the plate', () => {
    for (const t of s.teams) {
      const ids = s.rosters[t.id]!.active;
      const lineup = lineupFor(s, ids);
      expect(lineup).toHaveLength(9);
      expect(new Set(lineup.map((b) => b.id)).size).toBe(9);
      expect(lineup.map((b) => b.pos).sort()).toEqual([...SLOTS].sort());
      const catcher = s.players[lineup.find((b) => b.pos === 'C')!.id]!;
      expect(fitPenalty(catcher, 'C', positionGames(s, catcher))).toBeLessThan(12);
    }
  });

  it('does not lead off with a catcher; of the best three, the one with more power bats fourth', () => {
    const tool = (id: string, k: 'power' | 'contact') => s.players[id]!.scouting.tools[k] ?? 30;
    const power = (id: string) => tool(id, 'power') * 0.65 + tool(id, 'contact') * 0.35;
    for (const t of s.teams) {
      for (const style of ['balanced', 'smallBall']) {
        const lineup = lineupFor(s, s.rosters[t.id]!.active, undefined, false, undefined, { style });
        expect(s.players[lineup[0]!.id]!.position).not.toBe('C');
        if (style === 'smallBall') continue;
        expect(power(lineup[3]!.id)).toBeGreaterThanOrEqual(power(lineup[1]!.id));
        expect(power(lineup[4]!.id)).toBeGreaterThanOrEqual(power(lineup[2]!.id));
      }
    }
  });

  it('gives the starting catcher about one game in five or six off in the season, never without a catcher', () => {
    const t = s.teams[0]!;
    const ids = s.rosters[t.id]!.active;
    const opening = s.schedule[0]!.date;
    const everyday = lineupFor(s, ids).find((b) => b.pos === 'C')!.id;
    let off = 0;
    for (let d = 0; d < 70; d++) {
      const date = new Date(Date.parse(opening) + d * 86400000).toISOString().slice(0, 10);
      const lineup = lineupFor(s, ids, undefined, false, undefined, { date });
      expect(lineup).toHaveLength(9);
      expect(lineup.some((b) => b.pos === 'C')).toBe(true);
      if (!lineup.some((b) => b.id === everyday)) off++;
    }
    expect(off).toBeGreaterThanOrEqual(7);
    expect(off).toBeLessThanOrEqual(16);
  });
});

describe('the lineup screen', () => {
  it('shows the order the manager really bats, and who sits out the next game', () => {
    const t = s.teams[1]!;
    const manager = s.clubs![t.id]!.staff!.manager!;
    const was = manager.style;
    manager.style = 'smallBall';
    const shown = lineupView(s, t.id, 'R')!;
    expect(shown.style).toBe('smallBall');
    expect(shown.lineup.map((b) => b.id)).toEqual(lineupFor(s, s.rosters[t.id]!.active, undefined, false, 'R', { style: 'smallBall' }).map((b) => b.id));
    manager.style = was;
    // Over the first weeks somebody is due a day off, and he is named.
    const saved = s.next;
    let named = 0;
    for (const club of s.teams)
      for (let i = 0; i < 30; i++) {
        s.next = s.schedule.findIndex((g, k) => k >= i * 5 && (g.home === club.id || g.away === club.id));
        const v = lineupView(s, club.id, 'R')!;
        if (v.resting.length) {
          named++;
          expect(v.lineup.some((b) => b.id === v.resting[0]!.id)).toBe(true);
        }
      }
    s.next = saved;
    expect(named).toBeGreaterThan(0);
  });
});

describe('display settings', () => {
  it('sorts grades into five tiers', () => {
    expect([20, 39, 40, 49, 50, 59, 60, 69, 70, 80].map(gradeTier)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('reads stored settings, keeping only valid colours and presets', () => {
    expect(parseDisplay(null)).toEqual(DEFAULT_PREFS);
    expect(parseDisplay('not json')).toEqual(DEFAULT_PREFS);
    const p = parseDisplay(JSON.stringify({ bars: 'custom', custom: ['#112233', 'red', 'url(x)', '#ABCDEF', 5], tables: true }));
    expect(p.bars).toBe('custom');
    expect(p.custom).toEqual(['#112233', DEFAULT_PREFS.custom[1], DEFAULT_PREFS.custom[2], '#ABCDEF', DEFAULT_PREFS.custom[4]]);
    expect(p.tables).toBe(true);
    expect(parseDisplay(JSON.stringify({ bars: 'toString' })).bars).toBe('club');
    expect(parseDisplay(JSON.stringify({ bars: 'rainbow' })).bars).toBe('club');
  });

  it('sets the tier colours on the page, or leaves the club colours', () => {
    const props = new Map<string, string>();
    const root = { style: { setProperty: (k: string, v: string) => props.set(k, v), removeProperty: (k: string) => props.delete(k) }, dataset: {} as Record<string, string> };
    applyDisplay({ ...DEFAULT_PREFS, bars: 'scale', tables: true }, root as unknown as HTMLElement);
    expect(props.get('--grade-4')).toBe(PRESETS.scale.colors![4]);
    expect(root.dataset).toEqual({ gradeColors: 'scale', gradeTables: 'on' });
    applyDisplay(DEFAULT_PREFS, root as unknown as HTMLElement);
    expect(props.size).toBe(0);
    expect(root.dataset).toEqual({});
    expect(tierColors({ ...DEFAULT_PREFS, bars: 'custom' })).toEqual(DEFAULT_PREFS.custom);
  });
});
