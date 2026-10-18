/* 2.0.15: home and road, each ballpark, and the park-adjusted wRC+, ERA- and FIP-. */
import { beforeAll, describe, expect, it } from 'vitest';
import { createLeague } from '../src/league/history';
import { playDay } from '../src/league/season';
import type { LeagueState } from '../src/league/state';
import { emptyBat, emptyPit, addInto } from '../src/league/state';
import { eraMinus, fipMinus, rateContext, wrcPlus } from '../src/league/stats';
import { addVenues, emptyVenues, parkFactorIn, playerPark } from '../src/league/venues';

describe('venues', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = createLeague('v2015-venues');
    for (let d = 0; d < 30; d++) playDay(s);
  }, 300_000);

  it('splits every plate appearance and out between home and road, and among the ballparks', () => {
    let checked = 0;
    for (const line of Object.values(s.lines)) {
      const v = line.venues;
      if (!v) continue;
      if (line.bat?.pa) {
        expect((v.home.bat?.pa ?? 0) + (v.away.bat?.pa ?? 0)).toBe(line.bat.pa);
        expect(Object.values(v.parks).reduce((a, x) => a + (x.bat?.pa ?? 0), 0)).toBe(line.bat.pa);
        expect((v.home.bat?.hr ?? 0) + (v.away.bat?.hr ?? 0)).toBe(line.bat.hr);
      }
      if (line.pit?.outs) {
        expect((v.home.pit?.outs ?? 0) + (v.away.pit?.outs ?? 0)).toBe(line.pit.outs);
        expect((v.home.pit?.er ?? 0) + (v.away.pit?.er ?? 0)).toBe(line.pit.er);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('adds a season into a career', () => {
    const [line] = Object.values(s.lines).filter((l) => l.venues && l.bat?.pa);
    const career = emptyVenues();
    addVenues(career, line!.venues!);
    addVenues(career, line!.venues!);
    expect(career.home.bat!.pa).toBe(2 * (line!.venues!.home.bat?.pa ?? 0));
  });

  it('adjusts for the ballpark: a hitters’ park takes some back, a pitchers’ park gives some', () => {
    const bat = emptyBat(),
      pit = emptyPit();
    for (const l of Object.values(s.lines)) {
      if (l.bat) addInto(bat, l.bat);
      if (l.pit) addInto(pit, l.pit);
    }
    const rc = rateContext(bat, pit);
    const [b] = Object.values(s.lines).filter((l) => (l.bat?.pa ?? 0) > 80);
    expect(wrcPlus(b!.bat!, rc, 1.05)).toBeLessThan(wrcPlus(b!.bat!, rc, 1));
    expect(wrcPlus(b!.bat!, rc, 0.95)).toBeGreaterThan(wrcPlus(b!.bat!, rc, 1));
    const [q] = Object.values(s.lines).filter((l) => (l.pit?.outs ?? 0) > 60);
    expect(eraMinus(q!.pit!, rc, 1.05)).toBeLessThanOrEqual(eraMinus(q!.pit!, rc, 1));
    expect(fipMinus(q!.pit!, rc, 1)).toBeGreaterThan(0);
    // League average is 100.
    expect(Math.abs(eraMinus(pit, rc) - 100)).toBeLessThanOrEqual(1);
    const team = s.teams[0]!.id;
    expect(playerPark(s, team, s.year)).toBeCloseTo((parkFactorIn(s, team, s.year) + 1) / 2, 6);
  });
});
