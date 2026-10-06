/* V0.13: the settings tab's league side — renaming the ten existing clubs (real names kept by default, a
   fictional set on offer) without touching the simulation. */
import { beforeAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { existingTeams, FICTIONAL_LABELS, labelOf, labelProblems, realLabels, renameClubs } from '../src/league/clubs';
import { createLeague } from '../src/league/history';
import type { LeagueState } from '../src/league/state';
import { makeSave, serializeSave } from '../src/save/format';

let base: LeagueState;
beforeAll(() => {
  base = createLeague('v0130-test');
}, 300_000);

describe('club names', () => {
  it('a new league keeps the real names', () => {
    const real = realLabels();
    expect(real.lg!.name).toBe('LG 트윈스');
    expect(real.kia!.short).toBe('KIA');
    expect(Object.keys(real)).toHaveLength(10);
    for (const t of base.teams) expect(labelOf(t)).toEqual(real[t.id]);
  });

  it('the fictional set covers every club, with names and short names of its own', () => {
    const ids = existingTeams().map((t) => t.id).sort();
    expect(Object.keys(FICTIONAL_LABELS).sort()).toEqual(ids);
    const names = Object.values(FICTIONAL_LABELS).map((l) => l.name);
    const shorts = Object.values(FICTIONAL_LABELS).map((l) => l.short);
    expect(new Set(names).size).toBe(10);
    expect(new Set(shorts).size).toBe(10);
    // None of the real names or short names survive in it.
    const real = Object.values(realLabels());
    for (const l of Object.values(FICTIONAL_LABELS)) {
      expect(real.some((r) => r.name === l.name || r.short === l.short || r.company === l.company)).toBe(false);
    }
    expect(labelProblems(base.teams, FICTIONAL_LABELS)).toEqual([]);
    expect(labelProblems(base.teams, realLabels())).toEqual([]);
  });

  it('refuses clashes, empty or overlong names and bad colours', () => {
    const l = realLabels();
    expect(labelProblems(base.teams, { ...l, lg: { ...l.lg!, short: '두산' } }).join(' ')).toContain('약칭 "두산"을');
    expect(labelProblems(base.teams, { ...l, lg: { ...l.lg!, name: 'KIA 타이거즈' } }).join(' ')).toContain('구단명 "KIA 타이거즈"를');
    expect(labelProblems(base.teams, { ...l, lg: { ...l.lg!, name: ' ' } })).not.toEqual([]);
    expect(labelProblems(base.teams, { ...l, lg: { ...l.lg!, short: '아주긴약칭' } })).not.toEqual([]);
    expect(labelProblems(base.teams, { ...l, lg: { ...l.lg!, color: 'red' } })).not.toEqual([]);
    // Two clubs may share a ballpark (잠실).
    expect(labelProblems(base.teams, { ...l, lg: { ...l.lg!, stadium: '잠실야구장' }, doosan: { ...l.doosan!, stadium: '잠실야구장' } })).toEqual([]);
  });

  it('renames only the existing clubs and leaves everything else of the club alone', () => {
    const s = structuredClone(base);
    const before = s.teams.find((t) => t.id === 'samsung')!;
    const keep = { region: before.region, founded: before.founded, parent: before.parent.type, seats: before.stadium.capacity };
    apply(s, { kind: 'clubNames', labels: FICTIONAL_LABELS });
    const after = s.teams.find((t) => t.id === 'samsung')!;
    expect(labelOf(after)).toEqual(FICTIONAL_LABELS.samsung);
    expect({ region: after.region, founded: after.founded, parent: after.parent.type, seats: after.stadium.capacity }).toEqual(keep);
    // Back to the real names.
    apply(s, { kind: 'clubNames', labels: realLabels() });
    expect(s.teams.map(labelOf)).toEqual(base.teams.map(labelOf));
  });

  it('a bad set is refused whole', () => {
    const s = structuredClone(base);
    const l = { ...FICTIONAL_LABELS, kt: { ...FICTIONAL_LABELS.kt!, short: '' } };
    expect(() => renameClubs(s.teams, l)).toThrow();
    expect(s.teams.map(labelOf)).toEqual(base.teams.map(labelOf));
  });

  it('can be changed while a decision waits, and travels with the save', () => {
    const s = structuredClone(base);
    s.pending = { kind: 'tryout' } as unknown as LeagueState['pending'];
    apply(s, { kind: 'clubNames', labels: FICTIONAL_LABELS });
    expect(s.teams.find((t) => t.id === 'lg')!.name).toBe('솔빛 코메츠');
    const text = serializeSave(makeSave(s.seed, [], { at: { year: s.year, phase: 'regularSeason' }, state: s }));
    expect(text).toContain('솔빛 코메츠');
  });

  it('names never feed the simulation: the same seed plays the same games under other names', () => {
    const a = structuredClone(base);
    const b = structuredClone(base);
    apply(b, { kind: 'clubNames', labels: FICTIONAL_LABELS });
    apply(a, { kind: 'days', days: 20 });
    apply(b, { kind: 'days', days: 20 });
    expect(b.scores).toEqual(a.scores);
    expect(b.lines).toEqual(a.lines);
    expect(b.injuries).toEqual(a.injuries);
    expect(Object.values(b.players).map((p) => [p.id, p.teamId, p.status])).toEqual(Object.values(a.players).map((p) => [p.id, p.teamId, p.status]));
  }, 120_000);
});
