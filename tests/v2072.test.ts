/* 2.0.72 (the user's request): foreign staff — former KBO foreign players back on the bench, foreign coaches with no
   KBO past, the help they give our foreign players settling in, and the news of a foreign manager. */
import { describe, expect, it } from 'vitest';
import { alumniFor, alumnusHired, alumnusStaff, fameOf, mainClub } from '../src/league/alumni';
import { setEra } from '../src/league/era';
import { foreignStaffHelp } from '../src/league/foreignstaff';
import { isForeign, isPitcher } from '../src/league/players';
import { makeStaff, staffOf, staffSalary } from '../src/league/staff';
import { ALUMNI } from '../src/league/tuning';
import { loadSave } from './helpers';

const load = () => {
  const s = loadSave('2.0.70');
  setEra(s);
  return s;
};

/** A foreign player of the league made a former one: two KBO seasons, home since, forty years old. */
function formerForeign(s: ReturnType<typeof load>) {
  const p = Object.values(s.players).find((q) => isForeign(q) && q.teamId && q.career.some((c) => !c.level))!;
  const row = p.career.find((c) => !c.level)!;
  p.career = [
    { ...row, year: s.year - 4 },
    { ...row, year: s.year - 3 },
  ];
  p.status = 'overseas';
  for (const r of Object.values(s.rosters)) for (const k of ['active', 'futures', 'third'] as const) r[k] = r[k].filter((id) => id !== p.id);
  p.teamId = null;
  p.contract = null;
  p.birthday = `${s.year - 41}-05-01`;
  return p;
}

describe('2.0.72', () => {
  it('brings a former KBO foreign player back as a coach or manager, at a little more pay', () => {
    const s = load();
    const p = formerForeign(s);
    const role = isPitcher(p) ? 'pitching' : 'hitting';
    expect(alumniFor(s, role, s.year).some((a) => a.p.id === p.id)).toBe(true);
    expect(alumniFor(s, 'manager', s.year).some((a) => a.p.id === p.id)).toBe(true);
    // Not the scouting director or the futures manager.
    expect(alumniFor(s, 'scouting', s.year).some((a) => a.p.id === p.id)).toBe(false);
    expect(alumniFor(s, 'farm', s.year).some((a) => a.p.id === p.id)).toBe(false);
    // One KBO season is not enough.
    p.career = p.career.slice(0, 1);
    expect(alumniFor(s, role, s.year).some((a) => a.p.id === p.id)).toBe(false);
    p.career = [p.career[0]!, { ...p.career[0]!, year: s.year - 3 }];
    const m = alumnusStaff(s, { p, fame: fameOf(s, p), club: mainClub(p) }, role, 'test', s.year, 0, staffSalary);
    expect(m.foreign).toBe(p.origin.nationality);
    expect(m.playerId).toBe(p.id);
    expect(m.salary).toBeGreaterThan(staffSalary(role, m.rating));
  });

  it('hires a foreign coach with no KBO past now and then, never as the scouting director or head trainer', () => {
    const s = load();
    const hires = Array.from({ length: 300 }, (_, i) => makeStaff(s, 'pitching', `t72-${i}`, s.year));
    const foreign = hires.filter((m) => m.foreign && !m.playerId);
    expect(foreign.length).toBeGreaterThan(5);
    expect(foreign.length).toBeLessThan(60);
    expect(foreign.every((m) => m.name && !/[a-z]/i.test(m.name))).toBe(true);
    for (const role of ['scouting', 'medical', 'farm'] as const) expect(Array.from({ length: 200 }, (_, i) => makeStaff(s, role, `t72-${role}-${i}`, s.year)).some((m) => m.foreign && !m.playerId)).toBe(false);
  });

  it('helps our foreign players settle: the manager for all, the coach of his side, more for one who played here', () => {
    const s = load();
    const me = s.user!.teamId;
    const staff = staffOf(s, me);
    for (const m of Object.values(staff)) delete m.foreign;
    expect(foreignStaffHelp(s, me, true)).toBe(0);
    staff.manager.foreign = 'USA';
    expect(foreignStaffHelp(s, me, true)).toBe(ALUMNI.foreign.adapt);
    expect(foreignStaffHelp(s, me, false)).toBe(ALUMNI.foreign.adapt);
    staff.pitching.foreign = 'USA';
    staff.pitching.playerId = 'someone';
    expect(foreignStaffHelp(s, me, true)).toBe(Math.min(ALUMNI.foreign.adaptMax, 2 * ALUMNI.foreign.adapt + ALUMNI.foreign.kbo));
    expect(foreignStaffHelp(s, me, false)).toBe(ALUMNI.foreign.adapt);
  });

  it('tells the news of a foreign manager', () => {
    const s = load();
    const me = s.user!.teamId;
    const m = { ...staffOf(s, me).manager, id: 'st-t72', name: '존 스미스', foreign: 'USA' };
    delete m.playerId;
    alumnusHired(s, me, m, `${s.year}-11-20`);
    const added = (s.news ?? []).filter((n) => n.id.startsWith(`foreign-staff-${me}-manager-st-t72`));
    expect(added.length).toBe(1);
    expect(added[0]!.title).toContain('존 스미스');
    expect(added[0]!.mine).toBe(true);
    // A foreign coach at another club with no KBO past is not news.
    const other = s.teams.find((t) => t.id !== me)!.id;
    alumnusHired(s, other, { ...m, id: 'st-t72b', role: 'hitting' }, `${s.year}-11-20`);
    expect((s.news ?? []).some((n) => n.id.includes('st-t72b'))).toBe(false);
  });
});
