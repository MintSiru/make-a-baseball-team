/* 2.0.25: hit batters, payback, the benches clearing and the KBO's discipline (brawl.ts). */
import { describe, expect, it } from 'vitest';
import { brawlGame } from '../src/league/brawl';
import { createLeague } from '../src/league/history';
import { isPitcher } from '../src/league/players';
import type { LeagueState } from '../src/league/state';

const box = (s: LeagueState, teamId: string, hbpBatter: boolean, hbpPitcher: boolean) => {
  const mine = Object.values(s.players).filter((p) => p.teamId === teamId && p.status === 'active');
  const bat = mine.filter((p) => !isPitcher(p)).slice(0, 9);
  const pit = mine.filter(isPitcher).slice(0, 2);
  return {
    teamId,
    runs: 0,
    hits: 0,
    errors: 0,
    lineScore: [],
    batting: bat.map((p, i) => ({ id: p.id, hbp: hbpBatter && i === 0 ? 1 : 0 })),
    pitching: pit.map((p, i) => ({ id: p.id, hbp: hbpPitcher && i === 1 ? 1 : 0 })),
  };
};

describe('the benches clearing', () => {
  it('comes far more often when both sides hit someone, and suspends whoever threw it back', () => {
    const s = createLeague('v2025-brawl');
    s.suspended = {};
    let single = 0,
      both = 0,
      paid = 0;
    for (let i = 0; i < 2000; i++) {
      // The home batter hit by an away pitcher only.
      const one = { home: box(s, 'lg', true, false), away: box(s, 'doosan', false, true) } as never;
      if (brawlGame(s, one, `t1-${i}`, '2026-05-01')) single++;
      // Both sides hit.
      const two = { home: box(s, 'lg', true, true), away: box(s, 'doosan', true, true) } as never;
      const b = brawlGame(s, two, `t2-${i}`, '2026-05-01');
      if (b) {
        both++;
        if (b.back) {
          paid++;
          expect(b.bans.some((x) => x.why === 'payback')).toBe(true);
        }
      }
    }
    // (2.0.27: about half as often as at first.)
    expect(single).toBeGreaterThan(3);
    expect(single).toBeLessThan(60);
    expect(both).toBeGreaterThan(single * 2);
    expect(paid).toBeGreaterThan(20);
    expect(Object.keys(s.suspended).length).toBeGreaterThan(0);
    expect(Object.values(s.suspended).every((x) => (x.games ?? 0) >= 3)).toBe(true);
    expect((s.news ?? []).some((n) => n.id.startsWith('brawl-'))).toBe(true);
  });

  it('does nothing when no batter was hit', () => {
    const s = createLeague('v2025-quiet');
    expect(brawlGame(s, { home: box(s, 'lg', false, false), away: box(s, 'doosan', false, false) } as never, 'q', '2026-05-01')).toBeNull();
  });
});

describe('the booth in the live relay', () => {
  it('speaks up now and then, after a play or before a big at-bat', async () => {
    const { playGame } = await import('../src/league/season');
    const { pitchFeed } = await import('../src/league/pitchfeed');
    const s = createLeague('v2025-talk');
    const date = s.schedule[s.next]!.date;
    let talk = 0,
      frames = 0;
    for (let i = 0; i < 20; i++) {
      const log: import('../src/league/engine/types').PlayEvent[] = [];
      playGame(s, 'lg', 'doosan', `talk-${i}`, date, 12, log);
      (s.pbp ??= {})[`talk-${i}`] = log as never;
      const f = pitchFeed(s, `talk-${i}`)!;
      frames += f.length;
      talk += f.filter((x) => x.kind === 'talk').length;
    }
    // A few lines a game, never more than a small share of the relay.
    expect(talk / 20).toBeGreaterThan(2);
    expect(talk / frames).toBeLessThan(0.06);
  });
});

describe('a dome', () => {
  it('is built with the city over four seasons and keeps the summer crowds', async () => {
    const { openProjects, projectOptions, startProject } = await import('../src/league/ballpark');
    const { apply } = await import('../src/league/actions');
    const { BALLPARK } = await import('../src/league/tuning');
    const s = createLeague('v2025-dome');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: { name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null } });
    s.phase = 'offseason';
    s.offseason = { year: s.year, step: 0, done: [] } as never;
    s.user!.fund = BALLPARK.domeCost * 2;
    const o = projectOptions(s).find((x) => x.kind === 'dome')!;
    expect(o.blocked).toBeNull();
    startProject(s, 'dome');
    expect(projectOptions(s).find((x) => x.kind === 'dome')!.blocked).not.toBeNull();
    openProjects(s, o.opens);
    const team = s.teams.find((t) => t.id === s.user!.teamId)!;
    expect(team.stadium.size).toBe('dome');
    expect(team.stadium.capacity).toBe(BALLPARK.domeSeats);
    expect(o.opens).toBe(s.year + BALLPARK.domeYears);
  });
});

describe('hot and cold zones', () => {
  it('gives each hitter and pitcher nine zones around his average, the middle hottest on the whole', async () => {
    const { hitterZones, pitcherZones } = await import('../src/league/zones');
    const s = createLeague('v2025-zones');
    const hitters = Object.values(s.players).filter((p) => p.status === 'active' && !isPitcher(p)).slice(0, 60);
    let middle = 0,
      corner = 0;
    for (const p of hitters) {
      const g = hitterZones(s, p);
      expect(g).toHaveLength(3);
      expect(g.flat().every((x) => x > 0.05 && x < 0.55)).toBe(true);
      middle += g[1]![1]!;
      corner += (g[0]![0]! + g[0]![2]! + g[2]![0]! + g[2]![2]!) / 4;
    }
    expect(middle).toBeGreaterThan(corner);
    // Not every hitter the same.
    expect(new Set(hitters.map((p) => hitterZones(s, p)[0]![0]!.toFixed(3))).size).toBeGreaterThan(10);
    const arm = Object.values(s.players).find((p) => p.status === 'active' && isPitcher(p))!;
    expect(pitcherZones(s, arm).flat()).toHaveLength(9);
  });
});

describe('the players’ association', () => {
  it('puts motions of its own, and gets some rules against the players taken back', async () => {
    const { committeeMotions, holdMeeting, playersView } = await import('../src/league/board');
    const { apply } = await import('../src/league/actions');
    expect(playersView('minSalary', true)).toBe(1);
    expect(playersView('faSeasons', true)).toBe(-1);
    expect(playersView('lottery', true)).toBe(0);
    const s = createLeague('v2025-union');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: { name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null, board: true } });
    let own = 0;
    for (let y = 2030; y < 2050; y++) if (committeeMotions(s, y).some((m) => m.union)) own++;
    expect(own).toBeGreaterThan(6);
    // Later free agency forced through every winter: the players get it taken back now and then.
    let withdrawn = 0;
    for (let y = 2030; y < 2070; y++) {
      holdMeeting(s, y, [{ item: 'faSeasons', value: 9, now: 8, by: null, push: 3 }]);
      if (s.board!.log.at(-1)!.withdrawn) withdrawn++;
    }
    expect(withdrawn).toBeGreaterThan(4);
    expect(withdrawn).toBeLessThan(30);
    expect(s.board!.changes.filter((c) => c.item === 'faSeasons').length).toBe(40 - withdrawn);
  });
});

describe('the dynamic difficulty', () => {
  it('holds a dynasty back and gives a struggling club a hand, only when on', async () => {
    const { handicap, measureHandicap } = await import('../src/league/dynamic');
    const { apply } = await import('../src/league/actions');
    const s = createLeague('v2025-dynamic');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: { name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null } });
    const me = s.user!.teamId;
    const base = s.history.at(-1)!;
    const season = (year: number, rank: number, champ: boolean) => ({ ...base, year, champion: champ ? me : base.champion, table: [...base.table.filter((r) => r.teamId !== me), { ...base.table[0]!, teamId: me, rank }] });
    s.history.push(season(2030, 1, true), season(2031, 1, true), season(2032, 2, true));
    s.user!.fund = s.user!.payrollBudget * 3;
    expect(measureHandicap(s, 2032)).toBe(3);
    s.history.push(season(2033, 11, false), season(2034, 11, false), season(2035, 10, false));
    s.user!.fund = -1;
    expect(measureHandicap(s, 2035)).toBeLessThan(0);
    s.user!.handicap = 2;
    expect(handicap(s)).toBe(0);
    apply(s, { kind: 'dynamicDifficulty', on: true });
    expect(s.dynamicDifficulty).toBe(true);
  });
});
