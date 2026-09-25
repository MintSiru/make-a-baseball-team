/* Older saves carry forward: a snapshot shaped like 0.3 (no third squads, no absences, the user's
   futures year only) loads under the current rules and keeps playing. */
import { describe, expect, it } from 'vitest';
import { SIM_VERSION } from '../src/core/version';
import { apply } from '../src/league/actions';
import { createLeague } from '../src/league/history';
import { makeSave, parseSave, SaveError, serializeSave } from '../src/save/format';

describe('carrying older saves forward', () => {
  it('loads a 0.3-shaped snapshot and plays on', () => {
    const s = createLeague('migrate-test');
    const old = JSON.parse(JSON.stringify(s)) as Record<string, unknown> & { rosters: Record<string, Record<string, unknown>> };
    for (const r of Object.values(old.rosters)) delete r.third;
    delete old.away;
    old.sim = '0.3';
    const text = serializeSave({ ...makeSave(s.seed, [], { at: { year: 2026, phase: 'regularSeason' }, state: old }), sim: '0.3' });
    const save = parseSave(text);
    expect(save.migratedFrom).toBe('0.3');
    expect(save.sim).toBe(SIM_VERSION);
    const state = save.snapshot!.state as typeof s;
    expect(state.rosters.kia!.third).toEqual([]);
    apply(state, { kind: 'days', days: 30 });
    expect(state.scores.length).toBeGreaterThan(100);
  }, 120_000);

  it('loads a 0.5 snapshot: numbers, hands and splits follow', () => {
    const s = createLeague('migrate-05');
    const old = JSON.parse(JSON.stringify(s)) as typeof s;
    const lefty = Object.values(old.players).find((p) => p.throws === '좌' && p.status === 'active')!;
    lefty.bats = '우';
    for (const p of Object.values(old.players)) {
      delete p.number;
      delete p.numberTeam;
    }
    const text = serializeSave({ ...makeSave(s.seed, [], { at: { year: 2026, phase: 'regularSeason' }, state: old }), sim: '0.5' });
    const state = parseSave(text).snapshot!.state as typeof s;
    expect(['좌', '우']).toContain(state.players[lefty.id]!.bats);
    apply(state, { kind: 'days', days: 10 });
    const org = state.rosters.kia!.active.map((id) => state.players[id]!);
    expect(org.every((p) => p.number != null)).toBe(true);
    expect(org.some((p) => p.career.length === 0 || state.lines[p.id]?.bat?.split || state.lines[p.id]?.pit?.split)).toBe(true);
  }, 120_000);

  it('still refuses versions it cannot carry', () => {
    const text = serializeSave({ ...makeSave('x', [], { at: { year: 2026, phase: 'regularSeason' }, state: { teams: [] } }), sim: '0.1' });
    expect(() => parseSave(text)).toThrow(SaveError);
  });
});
