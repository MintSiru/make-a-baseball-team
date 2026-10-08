/* 1.6.0: a game started ten years earlier (백 투 더 패스트, era.ts) and the runaway AI's five years (살려야 한다,
   rogue.ts). In a file of their own: the calendar is set for the module while a league is made or acted on. */
import { afterAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { setEra } from '../src/league/era';
import { foundingDate } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { withScenario } from '../src/league/scenarios';
import { firstTeamIds, type ExpansionSettings, type LeagueState } from '../src/league/state';
import { salaryCapFor } from '../src/rules/kbo2026';

const free: ExpansionSettings = { name: '검증 고래', short: '검증', color: '#1f6fb2', cityId: 'ulsan', parentType: 'conglomerate', parentName: '검증그룹', stadium: 'existing', promotion: 'afterFutures', difficulty: 'normal', scenario: null };
afterAll(() => setEra(0));

describe('백 투 더 패스트', () => {
  it('builds the league to 2016 with today’s ten clubs, rules and money, and founds the club that summer', () => {
    const s = createLeague('v160-past', undefined, -10);
    expect(s.era).toBe(-10);
    expect(s.year).toBe(2016);
    expect(s.history.map((h) => h.year)).toEqual(Array.from({ length: 11 }, (_, i) => 2005 + i));
    expect(firstTeamIds(s, 2016)).toHaveLength(10);
    const cap2016 = salaryCapFor(2016);
    setEra(0);
    expect(cap2016).toBe(salaryCapFor(2026));
    setEra(-10);
    const f = apply(apply(s, { kind: 'toFounding' }), { kind: 'found', settings: withScenario(free, 'past') });
    expect(f.schedule[f.next]!.date >= foundingDate()).toBe(true);
    expect(foundingDate()).toBe('2016-07-01');
    expect(f.user!.firstTeamYear).toBe(2018);
    expect(f.pending?.kind).toBe('tryout');
  }, 300_000);
});

describe('살려야 한다', () => {
  let s: LeagueState;
  it('the AI runs the first five years by itself and hands over in the winter of 2030', () => {
    setEra(0);
    s = apply(apply(createLeague('v160-rescue'), { kind: 'toFounding' }), { kind: 'found', settings: withScenario({ ...free, tutorial: true }, 'rescue') });
    expect(s.user!.settings.tutorial).toBe(false);
    s = apply(s, { kind: 'rogue' });
    expect(s.phase).toBe('offseason');
    expect(s.offseason!.year).toBe(2030);
    const st = s.user!.scenario!;
    expect(st.takeover).toBe(2030);
    expect(st.damage!.length).toBeGreaterThan(3);
    expect(s.news?.some((n) => n.id.startsWith('rogue-trade-'))).toBe(true);
    expect(s.user!.trust).toBe(60);
    // Five years of pop-ups are old news; the takeover is the one to read.
    expect((s.alerts ?? []).filter((a) => !a.seen).map((a) => a.id)).toEqual(['rogue-2030']);
    // Acting again does nothing.
    expect(apply(s, { kind: 'rogue' }).offseason!.year).toBe(2030);
  }, 600_000);
});
