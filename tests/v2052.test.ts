/* 2.0.52 (the user's request): our club's best nine, rotation and bullpen year by year (clubsquad.ts). */
import { describe, expect, it } from 'vitest';
import { clubSquad, squadYears, SQUAD, SQUAD_POSITIONS } from '../src/league/clubsquad';
import { firstTeamIds } from '../src/league/state';
import { loadSave } from './helpers';

describe('a club’s season by its players (2.0.52)', () => {
  it('a past season: the most starts at each position, five starters, the closer first', () => {
    const s = loadSave('2.0.46');
    const team = firstTeamIds(s).find((t) => t !== s.user!.teamId)!;
    const years = squadYears(s, team);
    expect(years[0]).toBe(s.year);
    const past = years.find((y) => y < s.year)!;
    const sq = clubSquad(s, team, past);
    expect(sq.current).toBe(false);
    expect(sq.nine.length).toBe(SQUAD_POSITIONS.length);
    const nine = sq.nine.filter((h) => h)!;
    expect(nine.length).toBeGreaterThanOrEqual(8);
    expect(new Set(nine.map((h) => h!.id)).size).toBe(nine.length);
    for (const h of nine) {
      const c = s.players[h!.id]!.career.find((x) => x.year === past && x.teamId === team && !x.level)!;
      expect(c.bat?.posG?.[h!.pos]).toBe(h!.starts);
    }
    expect(sq.rotation.length).toBe(SQUAD.rotation);
    for (let i = 1; i < sq.rotation.length; i++) expect(sq.rotation[i - 1]!.pit!.gs).toBeGreaterThanOrEqual(sq.rotation[i]!.pit!.gs);
    expect(sq.bullpen.length).toBeGreaterThan(3);
    expect(sq.bullpen.length).toBeLessThanOrEqual(SQUAD.bullpen);
    const closer = sq.bullpen[0]!;
    expect(closer.role).toBe('closer');
    for (const l of sq.bullpen) expect(l.pit!.sv).toBeLessThanOrEqual(closer.pit!.sv);
    for (const l of [...sq.rotation, ...sq.bullpen]) expect(sq.rotation.filter((r) => r.id === l.id).length + sq.bullpen.filter((r) => r.id === l.id).length).toBe(1);
  });

  it('this season so far, without WAR yet', () => {
    const s = loadSave('2.0.46');
    const sq = clubSquad(s, s.user!.teamId, s.year);
    expect(sq.current).toBe(true);
    expect(sq.rotation.length).toBeGreaterThan(0);
    expect(sq.rotation.every((l) => Number.isNaN(l.war))).toBe(true);
    for (const l of sq.rotation) expect(s.lines[l.id]!.teamId).toBe(s.user!.teamId);
  });
});
