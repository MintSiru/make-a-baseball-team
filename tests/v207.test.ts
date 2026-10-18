/* 2.0.7: great single-game feats and their nicknames' records, run values, usage by the hitter's side. */
import { beforeAll, describe, expect, it } from 'vitest';
import type { GameOut, TeamBox } from '../src/league/engine/types';
import { featsGame, featText } from '../src/league/feats';
import { createLeague } from '../src/league/history';
import { isPitcher } from '../src/league/players';
import { batterValues, groupValues, pitchingRunValue, pitchValues, usageBySide } from '../src/league/runvalue';
import { valuesOf } from '../src/league/savant';
import { playDay } from '../src/league/season';
import type { LeagueState } from '../src/league/state';
import { addInto, emptyBat, emptyPit } from '../src/league/state';
import { leagueContext } from '../src/league/stats';

const line = (id: string, x: Partial<{ h: number; d: number; t: number; hr: number; bb: number; hbp: number; hrSeq: number[] }> = {}) => ({ id, h: 0, d: 0, t: 0, hr: 0, bb: 0, hbp: 0, ...x });
const box = (teamId: string, o: Partial<TeamBox> & { bat?: ReturnType<typeof line>[]; pit?: string[] }): TeamBox =>
  ({ teamId, runs: 0, hits: 0, errors: 0, lineScore: [], batting: o.bat ?? [], pitching: (o.pit ?? []).map((id) => ({ id })), ...o }) as unknown as TeamBox;

describe('feats', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = createLeague('v207-feats');
  }, 300_000);
  const ids = () => Object.values(s.players).slice(0, 6).map((p) => p.id);

  it('tells a perfect game from a no-hitter and a staff’s no-hitter', () => {
    const [a, b, c] = ids();
    const [h, w] = [s.teams[0]!.id, s.teams[1]!.id];
    const game = (home: TeamBox, away: TeamBox): GameOut => ({ gameId: 'g', innings: 9, home, away, result: 'home' });
    featsGame(s, game(box(h, { runs: 3, hits: 8, pit: [a!] }), box(w, { bat: [line('x')] })), '2030-05-01');
    expect(s.players[a!]!.feats!.at(-1)!.kind).toBe('perfect');
    featsGame(s, game(box(h, { runs: 1, hits: 5, pit: [b!] }), box(w, { bat: [line('x', { bb: 1 })] })), '2030-05-02');
    expect(s.players[b!]!.feats!.at(-1)!.kind).toBe('noHitter');
    featsGame(s, game(box(h, { runs: 1, hits: 5, pit: [c!, a!] }), box(w, { bat: [line('x')] })), '2030-05-03');
    expect(s.players[c!]!.feats!.at(-1)!.kind).toBe('teamNoHitter');
    expect(featText(s, s.players[a!]!.feats![0]!)).toContain('2030-05-01');
    expect((s.news ?? []).some((n) => n.id === `feat-perfect-${a}-2030-05-01`)).toBe(true);
  });

  it('counts a cycle, three homers in a game and home runs in a row across games', () => {
    const [, , , d, e] = ids();
    const [h, w] = [s.teams[0]!.id, s.teams[1]!.id];
    const game = (bat: ReturnType<typeof line>[]): GameOut => ({ gameId: 'g', innings: 9, home: box(h, { runs: 5, hits: 9, bat }), away: box(w, { runs: 4, hits: 7 }), result: 'home' });
    featsGame(s, game([line(d!, { h: 4, d: 1, t: 1, hr: 1 })]), '2030-06-01');
    expect(s.players[d!]!.feats!.some((f) => f.kind === 'cycle')).toBe(true);
    featsGame(s, game([line(e!, { h: 3, hr: 3, hrSeq: [0, 1, 1] })]), '2030-06-02');
    expect(s.players[e!]!.feats!.some((f) => f.kind === 'hr3' && f.n === 3)).toBe(true);
    featsGame(s, game([line(e!, { h: 2, hr: 2, hrSeq: [1, 1, 0] })]), '2030-06-03');
    const run = s.players[e!]!.feats!.find((f) => f.kind === 'hrStreak')!;
    expect(run.n).toBe(4);
    expect(s.hrRuns?.[e!]).toBeUndefined();
  });

  it('finds feats in the league’s own seasons now and then', () => {
    const fresh = createLeague('v207-league');
    const all = Object.values(fresh.players).flatMap((p) => p.feats ?? []);
    expect(all.length).toBeGreaterThan(0);
    expect(all.length).toBeLessThan(400);
  }, 300_000);
});

describe('run values', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = createLeague('v207-values');
    for (let d = 0; d < 40; d++) playDay(s);
  }, 300_000);

  it('splits a pitcher’s run value among his pitches, adding up to the whole', () => {
    const bat = emptyBat(),
      pit = emptyPit();
    for (const l of Object.values(s.lines)) {
      if (l.bat) addInto(bat, l.bat);
      if (l.pit) addInto(pit, l.pit);
    }
    const lg = leagueContext(bat, pit);
    const [id, l] = Object.entries(s.lines).find(([pid, x]) => x.pit && x.pit.outs > 100 && isPitcher(s.players[pid]!))!;
    const p = s.players[id]!;
    const rows = pitchValues(p, l.pit!, lg);
    expect(rows.reduce((a, x) => a + x.rv, 0)).toBeCloseTo(pitchingRunValue(l.pit!, lg), 6);
    const g = groupValues(rows);
    expect((g.fastball ?? 0) + (g.breaking ?? 0) + (g.offspeed ?? 0)).toBeCloseTo(pitchingRunValue(l.pit!, lg), 6);
    // More breaking balls to his own side, more offspeed to the other.
    const u = usageBySide(p, rows);
    const sum = (x: Record<string, number>) => Object.values(x).reduce((a, b) => a + b, 0);
    expect(sum(u.vsL)).toBeCloseTo(100, 0);
    expect(sum(u.vsR)).toBeCloseTo(100, 0);
    const same = p.throws === '좌' ? u.vsL : u.vsR,
      other = p.throws === '좌' ? u.vsR : u.vsL;
    const share = (x: Record<string, number>, grp: string) => rows.filter((r) => r.group === grp).reduce((a, r) => a + x[r.type]!, 0);
    if (rows.some((r) => r.group === 'breaking')) expect(share(same, 'breaking')).toBeGreaterThan(share(other, 'breaking'));
    // A hitter's run values add up.
    const [, hb] = Object.entries(s.lines).find(([pid, x]) => x.bat && x.bat.pa > 100 && !isPitcher(s.players[pid]!))!;
    const v = batterValues(hb.bat!, lg);
    expect(v.total).toBeCloseTo(v.batting + v.running + v.fielding, 6);
  });

  it('ranks run values from 1 to 100 among the regulars', () => {
    for (const [id, l] of Object.entries(s.lines).filter(([, x]) => (x.bat?.pa ?? 0) > 100 || (x.pit?.outs ?? 0) > 100).slice(0, 20)) {
      const v = valuesOf(s, id);
      if (!v) continue;
      expect(v.rows.length).toBeGreaterThan(0);
      for (const r of v.rows) {
        expect(r.pct).toBeGreaterThanOrEqual(1);
        expect(r.pct).toBeLessThanOrEqual(100);
      }
      if (l.pit && isPitcher(s.players[id]!)) expect(v.pitches!.length).toBeGreaterThan(0);
    }
  });
});
