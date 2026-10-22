/* 2.0.38 (the user's request): managers and coaches age and retire. */
import { describe, expect, it } from 'vitest';
import { staffOf, STAFF_ROLES } from '../src/league/staff';
import { retireChance, STAFF_AGE, staffAgeWinter } from '../src/league/staffage';
import { loadSave } from './helpers';

describe('staff ageing and retirement (2.0.38)', () => {
  it('no one under 60 retires; the chance rises with age, halves under contract, and is sure at 75', () => {
    const s = loadSave('2.0.37');
    const m = { ...staffOf(s, s.user!.teamId).manager, interim: false };
    const at = (age: number, until: number) => retireChance({ ...m, age, until }, 2030);
    expect(at(59, 2030)).toBe(0);
    expect(at(61, 2030)).toBeGreaterThan(at(60, 2030));
    expect(at(64, 2032)).toBeCloseTo(at(64, 2030) * STAFF_AGE.underContract, 6);
    expect(at(STAFF_AGE.last, 2032)).toBe(1);
    expect(retireChance({ ...m, age: 80, interim: true }, 2030)).toBe(0);
  });

  it('ours: an interim takes the post until the staff decision, with a pop-up; another club hires at once', () => {
    const s = loadSave('2.0.37');
    const me = s.user!.teamId;
    const other = s.teams.find((t) => t.id !== me && s.clubs?.[t.id])!.id;
    const mine = staffOf(s, me).manager;
    const theirs = staffOf(s, other).manager;
    mine.age = 80;
    theirs.age = 80;
    const year = s.year;
    staffAgeWinter(s, year);
    const now = staffOf(s, me).manager;
    expect(now.name).not.toBe(mine.name);
    expect(now.interim).toBe(true);
    expect(now.until).toBe(year);
    expect((s.alerts ?? []).some((a) => a.id === `staff-retire-${year}-${me}-manager` && !a.minor)).toBe(true);
    const next = staffOf(s, other).manager;
    expect(next.name).not.toBe(theirs.name);
    expect(next.interim).toBeFalsy();
    expect(s.clubs![me]!.retiredStaff?.at(-1)).toMatchObject({ name: mine.name, role: 'manager', age: 80, year });
  });

  it('young heads now and then improve, old ones fade, within the scale', () => {
    const s = loadSave('2.0.37');
    let up = 0,
      down = 0;
    for (let y = 0; y < 20; y++)
      for (const t of s.teams) {
        if (!s.clubs?.[t.id]) continue;
        const staff = staffOf(s, t.id);
        for (const role of STAFF_ROLES) {
          staff[role].interim = false;
          staff[role].age = role === 'manager' ? 40 : 68;
          staff[role].until = 9999;
        }
        const before = STAFF_ROLES.map((r) => staff[r].rating);
        staffAgeWinter(s, s.year + y);
        STAFF_ROLES.forEach((r, i) => {
          const after = staffOf(s, t.id)[r];
          if (after.name !== staff[r].name) return;
          if (after.rating > before[i]!) up++;
          if (after.rating < before[i]!) down++;
          expect(after.rating).toBeGreaterThanOrEqual(20);
          expect(after.rating).toBeLessThanOrEqual(80);
        });
      }
    expect(up).toBeGreaterThan(0);
    expect(down).toBeGreaterThan(0);
  });
});
