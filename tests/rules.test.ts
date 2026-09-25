import { describe, expect, it } from 'vitest';
import { ELEVEN_CLUB_SCHEDULE as S, KBO_2026, minimumSalaryFor, salaryCapFor } from '../src/rules/kbo2026';

describe('2026 KBO rules', () => {
  it('keeps the announced salary caps and continues 5% steps after 2028', () => {
    expect(salaryCapFor(2026)).toBe(1439723);
    expect(salaryCapFor(2028)).toBe(1587294);
    expect(salaryCapFor(2029)).toBe(Math.round(1587294 * 1.05));
    expect(salaryCapFor(2020)).toBe(1371165);
  });

  it('raises the minimum salary from 2027', () => {
    expect(minimumSalaryFor(2026)).toBe(3000);
    expect(minimumSalaryFor(2027)).toBe(3300);
  });

  it('adds up the 11-club schedule to 144 games over 10 opponents', () => {
    const light = 10 - S.heavyOpponents;
    expect(S.heavyOpponents * S.heavyGames + light * S.lightGames).toBe(S.gamesPerClub);
    // Each club has exactly four 15-game opponents, so the heavy pairings form a 4-regular graph on 11 clubs.
    expect((11 * S.heavyOpponents) % 2).toBe(0);
  });

  it('lets every foreign player play', () => {
    expect(KBO_2026.foreign.regular + KBO_2026.foreign.asiaQuota).toBe(4);
    expect(KBO_2026.league.firstTeam.registered - KBO_2026.league.firstTeam.active).toBe(2);
  });
});
