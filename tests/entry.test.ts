/* The general manager's first team: manual mode, the ten-day rule and development registrations. */
import { beforeAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { canMove, canRegister, MIN_FIRST_TEAM, REREGISTER_DAYS, today } from '../src/league/entry';
import { autoDecision, EXPANSION_ID } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { firstTeamSize } from '../src/league/manager';
import { developmentIds, squadOf, type LeagueState } from '../src/league/state';

let s: LeagueState;
beforeAll(() => {
  s = createLeague('entry-test');
  apply(s, { kind: 'toFounding' });
  apply(s, {
    kind: 'found',
    settings: { name: '테스트', short: '테스트', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '가상', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null },
  });
  const decide = () => {
    while (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
  };
  decide();
  apply(s, { kind: 'regularEnd' });
  apply(s, { kind: 'postseason' });
  apply(s, { kind: 'nextSeason' });
  decide();
}, 180_000);

describe('running the first team by hand', () => {
  it('needs manual mode', () => {
    const id = s.rosters[EXPANSION_ID]!.active[0]!;
    expect(canMove(s, id, 'futures')).toMatch(/직접 관리/);
    apply(s, { kind: 'entryMode', mode: 'manual' });
    expect(canMove(s, id, 'futures')).toBeNull();
  });

  it('sends a player down and keeps him down for ten days', () => {
    const r = s.rosters[EXPANSION_ID]!;
    const id = r.active.find((x) => !s.players[x]!.origin.kind.startsWith('foreign'))!;
    apply(s, { kind: 'move', id, to: 'futures' });
    expect(squadOf(s, id)).toBe('futures');
    expect(canMove(s, id, 'active')).toMatch(/10일/);
    apply(s, { kind: 'days', days: REREGISTER_DAYS + 2 });
    if (s.rosters[EXPANSION_ID]!.active.length < firstTeamSize(s, EXPANSION_ID) && !s.injuries[id]) expect(canMove(s, id, 'active')).toBeNull();
  }, 60_000);

  it('keeps a minimum first team and fills injured places', () => {
    const r = s.rosters[EXPANSION_ID]!;
    while (r.active.length > MIN_FIRST_TEAM) apply(s, { kind: 'move', id: r.active.at(-1)!, to: 'third' });
    expect(canMove(s, r.active[0]!, 'futures')).toMatch(/최소/);
    apply(s, { kind: 'days', days: 20 });
    expect(r.active.length).toBeGreaterThanOrEqual(MIN_FIRST_TEAM);
    expect(r.active.every((id) => !s.injuries[id])).toBe(true);
  }, 60_000);

  it('registers development players only from May 1', () => {
    const dev = developmentIds(s, EXPANSION_ID)[0]!;
    expect(dev).toBeDefined();
    expect(canMove(s, dev, 'active')).toMatch(/육성선수/);
    if (today(s) < `${s.year}-05-01`) {
      expect(canRegister(s, dev)).toMatch(/5월 1일/);
      apply(s, { kind: 'days', days: 40 });
    }
    expect(today(s) >= `${s.year}-05-01`).toBe(true);
    const room = canRegister(s, dev);
    if (room === null) {
      apply(s, { kind: 'register', id: dev });
      expect(s.players[dev]!.contract!.kind).toBe('standard');
    } else expect(room).toMatch(/소속선수/);
  }, 60_000);
});
