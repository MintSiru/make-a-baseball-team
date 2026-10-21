/* 2.0.33 (the user's request): the 상무 results pop up — passed and failed together, one alert a winter. */
import { describe, expect, it } from 'vitest';
import { createLeague } from '../src/league/history';
import { apply } from '../src/league/actions';
import { resolveAnnual } from '../src/league/userclub';
import { sangmuChance } from '../src/league/offseason';
import { ageIn } from '../src/league/players';

describe('상무 results as a popup (2.0.33)', () => {
  it('lists every applicant, accepted or not, with the count in the title', () => {
    const s = createLeague('v2033');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: { name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null } });
    s.pending = null;
    s.phase = 'offseason';
    s.offseason = { year: s.year, step: 0, draft: null, released: [], done: [] };
    const next = s.year + 1;
    // Young players of ours: some the 상무 is likely to take, some it cannot (too weak).
    const pool = Object.values(s.players).filter((p) => p.status === 'active' && p.teamId && ageIn(p, next) <= 26 && p.service.military === 'pending');
    const likely = pool.filter((p) => sangmuChance(p, next) >= 0.3).slice(0, 4);
    const never = pool.filter((p) => sangmuChance(p, next) === 0).slice(0, 2);
    const ids = [...likely, ...never].map((p) => p.id);
    for (const p of [...likely, ...never]) p.teamId = s.user!.teamId;
    resolveAnnual(s, { kind: 'military', candidates: ids, forced: [never[0]!.id] }, { kind: 'military', orders: Object.fromEntries(ids.map((id) => [id, 'sangmu'])) });
    const alert = s.alerts!.find((a) => a.id === `sangmu-${s.year}`)!;
    expect(alert.kind).toBe('military');
    expect(alert.lines).toHaveLength(ids.length);
    expect(new Set(alert.players)).toEqual(new Set(ids));
    const passed = ids.filter((id) => s.players[id]!.service.route === 'sangmu').length;
    expect(passed).toBeLessThanOrEqual(likely.length);
    // The one who had to go and was turned down goes to the army; the other stays a year.
    expect(s.players[never[0]!.id]!.service.route).toBe('army');
    expect(s.players[never[1]!.id]!.status).toBe('active');
    expect(alert.title).toMatch(passed ? /합격 \d+명 · 불합격 \d+명|합격/ : /불합격/);
    expect(alert.tone).toBe(passed ? undefined : 'bad');
  });

  it('makes no popup when nobody applied', () => {
    const s = createLeague('v2033b');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: { name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null } });
    s.phase = 'offseason';
    s.offseason = { year: s.year, step: 0, draft: null, released: [], done: [] };
    resolveAnnual(s, { kind: 'military', candidates: [], forced: [] }, { kind: 'military', orders: {} });
    expect((s.alerts ?? []).some((a) => a.id.startsWith('sangmu-'))).toBe(false);
  });
});
