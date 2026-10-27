/* 2.0.53 (the user's requests): a button that plays the spring games to the last; a run of days stops when another
   club offers a trade. */
import { describe, expect, it } from 'vitest';
import { apply, regularOver } from '../src/league/actions';
import { exhibitionDate } from '../src/league/exhibition';
import { autoDecision } from '../src/league/expansion';
import { stopsOf, watchStops } from '../src/league/stops';
import type { LeagueState } from '../src/league/state';
import { loadSave } from './helpers';

const may = (): LeagueState => {
  const s = loadSave('2.0.41');
  s.pending = null;
  s.user!.tradeOffers = [];
  s.next = s.schedule.findIndex((g) => g.date >= `${s.year}-05-10`);
  return s;
};

describe('the spring games to the last (2.0.53)', () => {
  it('plays them all and stops before opening day', { timeout: 300_000 }, () => {
    const s = loadSave('2.0.46');
    s.pending = null;
    for (let g = 0; g < 3000 && !(s.phase === 'regular' && exhibitionDate(s)); g++) {
      if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
      else if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
      else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
      else apply(s, { kind: 'nextSeason' });
    }
    expect(exhibitionDate(s)).toBeTruthy();
    const year = s.year;
    apply(s, { kind: 'exhibitionEnd' });
    expect(exhibitionDate(s)).toBeNull();
    expect(s.exhibition!.next).toBe(s.exhibition!.games.length);
    expect(s.year).toBe(year);
    expect(s.next).toBe(0);
    expect(s.scores.length).toBe(0);
  });
});

describe('a trade offer stops the run (2.0.53)', () => {
  it('when one arrives, unless turned off; a save that chose its stops before has it on', () => {
    const s = may();
    const u = s.user!;
    const stop = watchStops(s);
    expect(stop()).toBe(false);
    const offer = { id: 'offer-test', teamId: 'lg', date: `${s.year}-05-10`, expires: `${s.year}-05-20`, give: [], get: [], why: '' } as never;
    u.tradeOffers!.push(offer);
    expect(stop()).toBe(true);
    expect(stop()).toBe(false);
    // Turned off in the settings.
    apply(s, { kind: 'stops', kinds: stopsOf(s).filter((k) => k !== 'offer') });
    expect(stopsOf(s)).not.toContain('offer');
    const quiet = watchStops(s);
    u.tradeOffers!.push({ ...(offer as object), id: 'offer-test-2' } as never);
    expect(quiet()).toBe(false);
    // An older save with its own stops: the offer's on.
    delete u.settings.offerStop;
    u.settings.stops = ['injury'];
    expect(stopsOf(s)).toEqual(['injury', 'offer']);
  });
});

describe('the ability editor starts from values it accepts (2.0.53)', () => {
  it('every player, a pitch thrown rarely or most of the time included', async () => {
    const { abilityOf, checkAbilityEdit } = await import('../src/league/abilityedit');
    for (const v of ['2.0.46', '2.0.50']) {
      const s = loadSave(v);
      s.abilityEditor = true;
      const refused = Object.values(s.players)
        .filter((p) => p.status === 'active')
        .map((p) => checkAbilityEdit(s, p.id, abilityOf(p)))
        .filter((x) => x);
      expect(refused).toEqual([]);
    }
  });
});
