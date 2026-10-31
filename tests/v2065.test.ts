/* 2.0.65 (the user's request): the 1982 legacy start's national team, 1982–2015 — the KBO's real events and results
   (the amateurs' until 1998, with no league player in them), and a legacy save from before taking them in. */
import { describe, expect, it } from 'vitest';
import { apply, regularOver } from '../src/league/actions';
import { autoDecision } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { LEGACY_ERA } from '../src/league/legacy1982';
import { withScenario } from '../src/league/scenarios';
import type { ExpansionSettings, LeagueState } from '../src/league/state';
import { setEra } from '../src/league/era';
import { eventById, eventsIn, realFinish } from '../src/league/international';
import { finishEvent } from '../src/league/national';
import { nationalView } from '../src/league/legacy';
import { repairState } from '../src/save/migrate';

const settings = (): ExpansionSettings =>
  withScenario({ name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'afterFutures', difficulty: 'normal', scenario: null }, 'legacy');

/** A legacy game founded in 1982 and played to 1983's opening day. */
function legacy(): LeagueState {
  const s = createLeague('v2065', undefined, LEGACY_ERA);
  apply(s, { kind: 'toFounding' });
  apply(s, { kind: 'found', settings: settings() });
  for (let g = 0; g < 5000 && !(s.year === 1983 && s.phase === 'regular'); g++) {
    if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
    else if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
    else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
    else apply(s, { kind: 'nextSeason' });
  }
  return s;
}

describe('the KBO’s national team in the 1982 legacy start (2.0.65)', () => {
  it('has the real events in the legacy game only, with their real results through 2015', () => {
    setEra({ era: LEGACY_ERA, historical: true });
    expect(eventsIn(1982).map((e) => e.id)).toEqual(['1982-worldCup']);
    expect(eventsIn(2006).map((e) => e.id)).toEqual(['2006-wbc', '2006-asianGames']);
    expect(realFinish(eventById('2008-olympics')!)).toBe('champion');
    expect(realFinish(eventById('2015-premier12')!)).toBe('champion');
    // After 2015 the game's own.
    expect(realFinish(eventById('2017-wbc')!)).toBeNull();
    setEra(0);
    // Every other game's past stays its own.
    expect(eventsIn(2006)).toEqual([]);
    expect(eventsIn(1982)).toEqual([]);
    expect(eventsIn(2014).map((e) => e.id)).toEqual(['2014-asianGames']);
  });

  it('records the 1982 world championship with no league player, and plays the professionals’ events', { timeout: 900_000 }, () => {
    const s = legacy();
    setEra(s);
    const wc = s.international.find((x) => x.id === '1982-worldCup')!;
    expect(wc).toBeTruthy();
    expect(wc.finish).toBe('champion');
    expect(wc.squad).toEqual([]);
    expect(wc.amateur).toBe(true);
    expect(wc.medal).toBe(false);
    // The 2006 WBC's real semifinal: the exemption it brought.
    const wbc = finishEvent(s, eventById('2006-wbc')!);
    expect(wbc.finish).toBe('third');
    expect(wbc.medal).toBe(true);
    expect(wbc.squad.length).toBeGreaterThan(20);
    const ag = finishEvent(s, eventById('2006-asianGames')!);
    expect(ag.finish).toBe('third');
    expect(ag.medal).toBe(false);
    const row = nationalView(s).rows.find((r) => r.id === '1982-worldCup')!;
    expect(row.note).toBeTruthy();

    // A legacy save from before 2.0.65, in the 2001 winter: the events gone by on record, in order, once.
    const old = JSON.parse(JSON.stringify(s)) as LeagueState;
    old.international = [];
    old.year = 2001;
    old.phase = 'offseason';
    repairState(old);
    const ids = old.international.map((x) => x.id);
    expect(ids).toEqual(['1982-worldCup', '1984-olympics', '1988-olympics', '1994-asianGames', '1996-olympics', '1998-asianGames', '2000-olympics']);
    const bangkok = old.international.find((x) => x.id === '1998-asianGames')!;
    expect(bangkok.recordOnly).toBe(true);
    expect(bangkok.medal).toBe(true);
    expect(bangkok.squad).toEqual([]);
    repairState(old);
    expect(old.international.length).toBe(ids.length);
    setEra(0);
  });
});
