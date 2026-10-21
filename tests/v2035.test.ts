/* 2.0.35 (the user's request): the ability editor — true grades, hidden character, tendencies, pitches and fielding
   parts, off unless turned on. */
import { describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { ABILITY, abilityOf, checkAbilityEdit, type AbilityEdit } from '../src/league/abilityedit';
import { battingProfile } from '../src/league/battedball';
import { fieldingOf, scoutedFielding } from '../src/league/fielding';
import { fastballOf, pitchGrades, pitchingLift, repertoire, topVelocity } from '../src/league/pitches';
import { isPitcher } from '../src/league/players';
import { traitsOf } from '../src/league/traits';
import type { LeagueState } from '../src/league/state';
import { loadSave, playDays } from './helpers';

const save = () => loadSave('2.0.30');
const hitterOf = (s: LeagueState, catcher = false) => Object.values(s.players).find((p) => p.status === 'active' && p.teamId && !isPitcher(p) && (p.position === 'C') === catcher)!;
const pitcherOf = (s: LeagueState) => Object.values(s.players).find((p) => p.status === 'active' && p.teamId && p.role === 'SP' && repertoire(p).length >= 2)!;
const edit = (s: LeagueState, id: string, f: (e: AbilityEdit) => void) => {
  const e = structuredClone(abilityOf(s.players[id]!));
  f(e);
  return e;
};

describe('the ability editor (2.0.35)', () => {
  it('is off by default and refuses edits until it is turned on', () => {
    const s = save();
    expect(s.abilityEditor).toBeUndefined();
    const h = hitterOf(s);
    const e = edit(s, h.id, (x) => (x.current.power = 80));
    expect(checkAbilityEdit(s, h.id, e)).not.toBeNull();
    const before = h.hidden.current.power;
    apply(s, { kind: 'editAbility', id: h.id, edit: e });
    expect(h.hidden.current.power).toBe(before);
    apply(s, { kind: 'abilityEditor', on: true });
    expect(s.abilityEditor).toBe(true);
    expect(checkAbilityEdit(s, h.id, e)).toBeNull();
    apply(s, { kind: 'abilityEditor', on: false });
    expect(s.abilityEditor).toBeUndefined();
  });

  it('writes only what changed: an unchanged edit leaves the player as he was', () => {
    const s = save();
    apply(s, { kind: 'abilityEditor', on: true });
    for (const p of [hitterOf(s), hitterOf(s, true), pitcherOf(s)]) {
      const was = JSON.stringify(p);
      apply(s, { kind: 'editAbility', id: p.id, edit: abilityOf(p) });
      expect(JSON.stringify(p)).toBe(was);
    }
    expect(s.abilityEdits).toBeUndefined();
  });

  it('sets a hitter’s grades (the scouts read them as they are), character, tendencies and fielding parts', () => {
    const s = save();
    apply(s, { kind: 'abilityEditor', on: true });
    const h = hitterOf(s, true);
    const e = edit(s, h.id, (x) => {
      x.current.power = 72;
      x.potential.power = 78;
      x.current.contact = 31;
      x.growth = 'veryLate';
      x.traits.genius = 95;
      x.traits.temper = 3;
      x.injury = 90;
      x.pull = -2;
      x.lift = 2;
      x.field = { ...x.field, range: 77, arm: 22, lead: 66, frame: 71 };
    });
    expect(checkAbilityEdit(s, h.id, e)).toBeNull();
    apply(s, { kind: 'editAbility', id: h.id, edit: e });
    expect(h.hidden.current.power).toBe(72);
    expect(h.hidden.potential.power).toBe(78);
    expect(h.hidden.current.contact).toBe(31);
    expect(h.scouting.tools.power).toBe(70);
    expect(h.scouting.futureTools.power).toBe(80);
    expect(h.scouting.tools.contact).toBe(30);
    const t = traitsOf(h);
    expect(t.growth).toBe('veryLate');
    expect(t.genius).toBe(95);
    expect(t.temper).toBe(3);
    expect(abilityOf(h).injury).toBe(90);
    expect(battingProfile(h)).toMatchObject({ pull: -2, lift: 2 });
    expect(fieldingOf(h)).toMatchObject({ range: 77, arm: 22, lead: 66, frame: 71 });
    expect(scoutedFielding(h)).toMatchObject({ range: 77, arm: 22, lead: 66, frame: 71 });
    expect(s.abilityEdits).toBe(1);
    // What the editor shows next is what was set.
    const again = abilityOf(h);
    expect(again.current.power).toBe(72);
    expect(again.pull).toBe(-2);
    expect(again.field).toMatchObject({ range: 77, arm: 22, lead: 66, frame: 71 });
  });

  it('sets a pitcher’s velocity, fastball, pitches and tendency', () => {
    const s = save();
    apply(s, { kind: 'abilityEditor', on: true });
    const p = pitcherOf(s);
    const e = edit(s, p.id, (x) => {
      x.velocity = 158;
      x.fastball = '2SFB';
      x.lift = -2;
      x.pitches = [
        { type: 'SW', grade: 75, usage: 30 },
        { type: 'SPL', grade: 60, usage: 15 },
        { type: 'KN', grade: 45, usage: 5 },
      ];
    });
    expect(checkAbilityEdit(s, p.id, e)).toBeNull();
    apply(s, { kind: 'editAbility', id: p.id, edit: e });
    expect(topVelocity(p)).toBe(158);
    expect(fastballOf(p)).toBe('2SFB');
    expect(pitchingLift(p)).toBe(-2);
    expect(repertoire(p).map((x) => [x.type, Math.round(x.usage * 100)])).toEqual([
      ['SW', 30],
      ['SPL', 15],
      ['KN', 5],
    ]);
    expect(abilityOf(p).pitches).toEqual(e.pitches);
    // The screens: the scouts' 변화구 is his true grade in steps of five, so the pitches show near what was set.
    for (const [g, want] of pitchGrades(p).map((x, i) => [x.grade, e.pitches![i]!.grade])) expect(Math.abs(g! - want!)).toBeLessThanOrEqual(5);
  });

  it('refuses what cannot be', () => {
    const s = save();
    apply(s, { kind: 'abilityEditor', on: true });
    const h = hitterOf(s);
    const p = pitcherOf(s);
    const bad: [string, AbilityEdit][] = [
      [h.id, edit(s, h.id, (x) => (x.current.speed = 90))],
      [h.id, edit(s, h.id, (x) => (x.traits.work = 0))],
      [h.id, edit(s, h.id, (x) => (x.pull = 3))],
      [h.id, edit(s, h.id, (x) => (x.field!.hands = 12))],
      [p.id, edit(s, p.id, (x) => (x.velocity = 175))],
      [p.id, edit(s, p.id, (x) => (x.pitches = [{ type: 'SL', grade: 50, usage: 10 }, { type: 'SL', grade: 55, usage: 10 }]))],
      [p.id, edit(s, p.id, (x) => (x.pitches = []))],
      [p.id, edit(s, p.id, (x) => ((x.fastball = 'CUT'), (x.pitches = [{ type: 'CUT', grade: 50, usage: 10 }])))],
      [p.id, edit(s, p.id, (x) => (x.pitches = [{ type: 'SL', grade: 50, usage: 50 }, { type: 'CH', grade: 50, usage: 40 }]))],
    ];
    for (const [id, e] of bad) expect(checkAbilityEdit(s, id, e), JSON.stringify(e)).not.toBeNull();
    expect(ABILITY.usage.total).toBeLessThan(90);
  });

  it('keeps the season going with edited players', () => {
    const s = save();
    apply(s, { kind: 'abilityEditor', on: true });
    const team = s.user!.teamId;
    const ours = s.rosters[team]!.active.map((id) => s.players[id]!);
    for (const p of ours) {
      const e = edit(s, p.id, (x) => {
        for (const k of Object.keys(x.current) as (keyof typeof x.current)[]) x.current[k] = 75;
        if (x.pull !== null) x.pull = 2;
        if (x.pitches) x.pitches = [{ type: 'SL', grade: 70, usage: 35 }];
      });
      if (e.fastball === 'CUT' || e.fastball === '2SFB') e.fastball = '4SFB';
      expect(checkAbilityEdit(s, p.id, e), p.id).toBeNull();
      apply(s, { kind: 'editAbility', id: p.id, edit: e });
    }
    const next = s.next;
    playDays(s, 3);
    expect(s.next).toBeGreaterThan(next);
  });
});
