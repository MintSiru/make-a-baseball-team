/* V0.7.9: the Olympics and the Asian Games go on after the scheduled ones (V0.12: with the WBC, the Premier12 and
   the APBC beside them). */
import { describe, expect, it } from 'vitest';
import { INTERNATIONAL } from '../src/league/international';

describe('national-team events', () => {
  it('come every two years, alternating Asian Games and Olympics, long after the known schedule', () => {
    const games = INTERNATIONAL.filter((e) => e.year >= 2026 && e.year <= 2200 && (e.kind === 'asianGames' || e.kind === 'olympics'));
    expect(games.map((e) => e.year)).toEqual(Array.from({ length: 88 }, (_, i) => 2026 + 2 * i));
    for (const e of games) expect(e.kind).toBe((e.year - 2026) % 4 === 0 ? 'asianGames' : 'olympics');
    // One event of a kind a year at most, and the real results before 2026 stay as they were.
    expect(new Set(INTERNATIONAL.map((e) => e.id)).size).toBe(INTERNATIONAL.length);
    expect(INTERNATIONAL.filter((e) => e.year < 2026).every((e) => e.finish !== null)).toBe(true);
  });

  it('keep the known names and give later ones in-season dates and the usual squad rules', () => {
    expect(INTERNATIONAL.find((e) => e.year === 2032 && e.kind === 'olympics')?.name).toBe('브리즈번 올림픽');
    const ag = INTERNATIONAL.find((e) => e.year === 2050 && e.kind === 'asianGames')!;
    expect(ag).toMatchObject({ kind: 'asianGames', finish: null, squad: 24, perClub: 3, dates: { from: '2050-09-15', to: '2050-09-29' } });
    expect(ag.limit).toMatchObject({ maxAge: 25, wildcards: 3 });
    const og = INTERNATIONAL.find((e) => e.year === 2052 && e.kind === 'olympics')!;
    expect(og).toMatchObject({ kind: 'olympics', limit: null, dates: { from: '2052-07-24' } });
  });
});
