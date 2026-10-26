/* 2.0.50 (the user's request: check again what the legacy start must keep shut): in a league that plays the KBO's
   history, development contracts (육성선수) from 2005, the salary cap and the foreign players' cap from 2023, the
   injury replacement foreign player from 2024, the free agents' grades from 2021, the Asia Series from 2005, and the
   development foreign players' rule only once there are both foreign players and development contracts. Every other
   game has them all from the start. */
import { afterAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { playAsiaSeries } from '../src/league/asiaseries';
import { setEra } from '../src/league/era';
import { capRoomFor } from '../src/league/fa';
import { devForeignClosed, developmentClosed, developmentOpen, featureOpen, salaryCapOn } from '../src/league/features';
import { foreignCap, foreignCapOn } from '../src/league/foreigncap';
import { createLeague } from '../src/league/history';
import { LEGACY_ERA } from '../src/league/legacy1982';
import { faGrades } from '../src/league/market';
import { isForeign } from '../src/league/players';
import { withScenario } from '../src/league/scenarios';
import { firstTeamIds, orgPlayers, registeredIds } from '../src/league/state';
import { canMakeDevelopment } from '../src/league/trade';
import { loadSave } from './helpers';

const legacy = () => {
  const s = createLeague('v2050', undefined, LEGACY_ERA);
  apply(s, { kind: 'toFounding' });
  apply(s, { kind: 'found', settings: withScenario({ name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'afterFutures', difficulty: 'normal', scenario: null }, 'legacy') });
  return s;
};
const history = () => setEra({ era: LEGACY_ERA, historical: true });
afterAll(() => setEra(0));

describe('the legacy start keeps later rules shut (2.0.50)', () => {
  it('each in its own year', () => {
    history();
    expect(developmentOpen(2004)).toBe(false);
    expect(developmentOpen(2005)).toBe(true);
    expect(developmentClosed(1990)).toContain('2005');
    expect(salaryCapOn(2022)).toBe(false);
    expect(salaryCapOn(2023)).toBe(true);
    expect(foreignCapOn(2022)).toBe(false);
    expect(foreignCapOn(2023)).toBe(true);
    expect(featureOpen('tempForeign', 2023)).toBe(false);
    expect(featureOpen('tempForeign', 2024)).toBe(true);
    expect(featureOpen('faGrades', 2020)).toBe(false);
    expect(featureOpen('asiaSeries', 2004)).toBe(false);
    expect(devForeignClosed(1990)).toContain('1998');
    expect(devForeignClosed(2000)).toContain('2005');
    expect(devForeignClosed(2005)).toBeNull();
    // Any other game: all of them from the start.
    setEra(0);
    for (const y of [1990, 2004, 2026]) {
      expect(developmentOpen(y)).toBe(true);
      expect(salaryCapOn(y)).toBe(true);
      expect(featureOpen('tempForeign', y)).toBe(true);
      expect(devForeignClosed(y)).toBeNull();
    }
  });

  it('the 1982 league has no development players, and none can be made', { timeout: 120_000 }, () => {
    const s = legacy();
    expect(Object.values(s.players).filter((p) => p.teamId && p.contract?.kind === 'development')).toEqual([]);
    const me = s.user!.teamId;
    s.phase = 'offseason';
    s.offseason = { year: s.year, step: 0 } as never;
    s.pending = null;
    const p = registeredIds(s, firstTeamIds(s).find((t) => t !== me)!).map((id) => s.players[id]!)[0]!;
    p.teamId = me;
    p.contract = { ...p.contract!, kind: 'standard' };
    expect(canMakeDevelopment(s, p.id)).toContain('2005');
    // The Asia Series is not played before 2005, even when turned on.
    s.asiaSeries = true;
    expect(playAsiaSeries(s, 1990, firstTeamIds(s)[0]!)).toBeNull();
  });

  it('no salary cap, foreign cap or free-agent grades before their years', () => {
    const s = loadSave('2.0.46');
    const team = s.user!.teamId;
    history();
    expect(capRoomFor(s, team, 2010)).toBe(Infinity);
    expect(foreignCap(s, team, 2010)).toBe(Number.MAX_SAFE_INTEGER);
    const fas = firstTeamIds(s).flatMap((t) => orgPlayers(s, t).filter((p) => !isForeign(p)).slice(0, 6));
    expect(new Set(Object.values(faGrades(s, 2010, fas)))).toEqual(new Set(['A']));
    setEra(0);
    expect(capRoomFor(s, team, 2028)).toBeLessThan(Infinity);
    expect(new Set(Object.values(faGrades(s, 2028, fas))).size).toBeGreaterThan(1);
  });
});
