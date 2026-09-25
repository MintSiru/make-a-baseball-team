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

  it('still refuses versions it cannot carry', () => {
    const text = serializeSave({ ...makeSave('x', [], { at: { year: 2026, phase: 'regularSeason' }, state: { teams: [] } }), sim: '0.1' });
    expect(() => parseSave(text)).toThrow(SaveError);
  });
});
