/* V0.7.9: the Olympics and the Asian Games go on after the scheduled ones. */
import { describe, expect, it } from 'vitest';
import { INTERNATIONAL } from '../src/league/international';

describe('national-team events', () => {
  it('come every two years, alternating Asian Games and Olympics, long after the known schedule', () => {
    const later = INTERNATIONAL.filter((e) => e.year >= 2026 && e.year <= 2200);
    expect(later.map((e) => e.year)).toEqual(Array.from({ length: 88 }, (_, i) => 2026 + 2 * i));
    for (const e of later) expect(e.kind).toBe((e.year - 2026) % 4 === 0 ? 'asianGames' : 'olympics');
    // One event a year at most, and the real results before 2026 stay as they were.
    expect(new Set(INTERNATIONAL.map((e) => e.year)).size).toBe(INTERNATIONAL.length);
    expect(INTERNATIONAL.filter((e) => e.year < 2026).every((e) => e.result !== null)).toBe(true);
  });

  it('keep the known names and give later ones in-season dates and the usual squad rules', () => {
    expect(INTERNATIONAL.find((e) => e.year === 2032)?.name).toBe('브리즈번 올림픽');
    const ag = INTERNATIONAL.find((e) => e.year === 2050)!;
    expect(ag).toMatchObject({ kind: 'asianGames', result: null, squad: 24, dates: { from: '2050-09-15', to: '2050-09-29' } });
    expect(ag.limit).toMatchObject({ maxAge: 25, wildcards: 3 });
    const og = INTERNATIONAL.find((e) => e.year === 2052)!;
    expect(og).toMatchObject({ kind: 'olympics', limit: null, dates: { from: '2052-07-24' } });
  });
});
