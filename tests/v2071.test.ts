/* 2.0.71 (the user's requests): the players a trade names as links (their ids on the transfer news and on a player's
   moves), a hitter's position changed in the season, a stop and an alert on the draft combine, our region's
   high-school players on the draft board, and a player's honours counted. */
import { describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { applyCombine, combineDay } from '../src/league/combine';
import { setEra } from '../src/league/era';
import { headlineHonors, honorCounts } from '../src/league/honorcount';
import { moveHistory, noteNewsMove } from '../src/league/moves';
import { territorialEligible, territorialPicks } from '../src/league/offseason';
import { checkPositionMove, POSITIONS } from '../src/league/positions';
import { stopsOf, watchStops } from '../src/league/stops';
import { logTransaction } from '../src/league/trade';
import { draftClass, isPitcher } from '../src/league/players';
import { loadSave } from './helpers';

describe('2.0.71', () => {
  it('keeps the ids of the players a trade names, on the news and on each player’s moves', () => {
    const s = loadSave('2.0.69');
    const [a, b] = s.teams.filter((t) => s.rosters[t.id]?.active.length);
    const x = s.rosters[a!.id]!.active[0]!,
      y = s.rosters[b!.id]!.active[0]!;
    logTransaction(s, `트레이드: ${s.players[x]!.name} ↔ ${s.players[y]!.name}`, [x, y]);
    expect(s.transactions!.at(-1)!.ids).toEqual([x, y]);
    noteNewsMove(s, { type: 'trade', a: a!.id, b: b!.id, fromA: [x], fromB: [y], cash: 0, picksA: [], picksB: [] }, `${s.year}-05-01`);
    expect(s.players[x]!.moves!.at(-1)!.ids).toEqual([y]);
    const row = moveHistory(s, s.players[y]!).find((r) => r.kind === 'trade')!;
    expect(row.ids).toEqual([x]);
    expect(row.note).toContain(s.players[x]!.name);
  });

  it('moves our hitter to another position in the season (a spot he does not list takes the season to settle)', () => {
    const s = loadSave('2.0.69');
    setEra(s);
    expect(s.phase).toBe('regular');
    const u = s.user!;
    const fresh = (q: (typeof s.players)[string]) => POSITIONS.find((pos) => pos !== 'C' && pos !== q.position && !(q.alt ?? []).includes(pos));
    const p = Object.values(s.players).find((q) => q.teamId === u.teamId && !isPitcher(q) && q.position && q.position !== 'C' && fresh(q))!;
    const was = p.position!;
    const to = fresh(p)!;
    expect(checkPositionMove(s, p.id, to)).toBeNull();
    apply(s, { kind: 'position', id: p.id, position: to });
    expect(s.players[p.id]!.position).toBe(to);
    expect(s.players[p.id]!.alt).toContain(was);
    expect(s.players[p.id]!.plan?.adaptingIn).toBe(s.year);
    // Back to his old spot, now one he lists: no more to settle.
    const pitcher = Object.values(s.players).find((q) => q.teamId === u.teamId && isPitcher(q) && !q.twoWay)!;
    expect(checkPositionMove(s, pitcher.id, '1B')).not.toBeNull();
    const other = Object.values(s.players).find((q) => q.teamId && q.teamId !== u.teamId && !isPitcher(q))!;
    expect(checkPositionMove(s, other.id, '1B')).not.toBeNull();
  });

  it('stops a run of days on the combine with an alert to pick the workouts', () => {
    const s = loadSave('2.0.69');
    setEra(s);
    expect(stopsOf(s)).toContain('combine');
    const stop = watchStops(s);
    expect(stop()).toBe(false);
    combineDay(s, `${s.year}-08-25`, () => applyCombine(s.seed, s.year, draftClass(s.seed, s.year, s.unified)));
    expect(s.alerts?.some((a) => a.id === `combine-${s.year}` && !a.minor)).toBe(true);
    expect(stop()).toBe(true);
    expect(stop()).toBe(false);
    // Turned off.
    apply(s, { kind: 'stops', kinds: stopsOf(s).filter((k) => k !== 'combine') });
    expect(stopsOf(s)).not.toContain('combine');
    expect(stopsOf(s)).toContain('offer');
  });

  it('finds our region’s high-school players in the draft class, territorial picks or not', () => {
    const s = loadSave('2.0.69');
    setEra(s);
    const pool = draftClass(s.seed, s.year, s.unified);
    const ours = pool.filter((p) => territorialEligible(s, s.user!.teamId, p));
    expect(ours.length).toBeGreaterThan(0);
    expect(ours.every((p) => p.origin.entryCategory === 'high-school')).toBe(true);
    expect(territorialPicks(s, s.year)).toBe(0);
  });

  it('counts each honour once, the big ones first', () => {
    const honors = ['2027 올스타 베스트12', '2027 MVP', '2027 골든글러브 (1루수)', '2027 홈런 1위 (41)', '2028 올스타 베스트12', '2028 골든글러브 (1루수)', '2029 골든글러브 (지명타자)', '2029 MVP', '2029 미스터 올스타'];
    const c = honorCounts(honors);
    expect(c.map((x) => [x.key, x.count])).toEqual([
      ['MVP', 2],
      ['골든글러브', 3],
      ['홈런 1위', 1],
      ['올스타 베스트12', 2],
      ['미스터 올스타', 1],
    ]);
    expect(c[1]!.times.map((t) => t.detail)).toEqual(['1루수', '1루수', '지명타자']);
    expect(headlineHonors(honors).map((x) => [x.key, x.count])).toEqual([
      ['MVP', 2],
      ['골든글러브', 3],
      ['올스타 베스트12', 2],
    ]);
  });
});
