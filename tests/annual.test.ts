/* The user's club year after year (V0.4): every winter's decisions, taken as the scouts suggest. */
import { beforeAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { autoDecision, checkDecision, EXPANSION_ID } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { rosterLimit } from '../src/league/offseason';
import { developmentIds, registeredIds, type Decision, type LeagueState } from '../src/league/state';
import { OFFSEASON } from '../src/league/tuning';

let s: LeagueState;
const seen: Decision[] = [];

function decideAll() {
  while (s.pending) {
    seen.push(s.pending);
    const input = autoDecision(s)!;
    expect(checkDecision(s, input), `${s.pending.kind} suggestion must be valid`).toBeNull();
    apply(s, { kind: 'decide', input });
  }
}

beforeAll(() => {
  s = createLeague('annual-test');
  apply(s, { kind: 'toFounding' });
  apply(s, {
    kind: 'found',
    settings: { name: '테스트 구단', short: '테스트', color: '#1f6fb2', cityId: 'ulsan', parentType: 'midsize', parentName: '가상', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null },
  });
  decideAll();
  while (s.year < 2031) {
    apply(s, { kind: 'regularEnd' });
    apply(s, { kind: 'postseason' });
    apply(s, { kind: 'nextSeason' });
    decideAll();
  }
}, 300_000);

describe('the user club every winter', () => {
  it('asks about rookies, development players, military service and spring camp', () => {
    const kinds = new Set(seen.map((d) => d.kind));
    for (const k of ['rookieBonus', 'development', 'military', 'camp', 'draftPick', 'salaries', 'foreignRenew', 'secondProtect'] as const) expect(kinds, k).toContain(k);
    expect(seen.filter((d) => d.kind === 'camp').length).toBeGreaterThanOrEqual(4);
  });

  it('keeps the club inside the rules and the money positive', () => {
    expect(registeredIds(s, EXPANSION_ID).length).toBeLessThanOrEqual(rosterLimit(s.year));
    expect(developmentIds(s, EXPANSION_ID).length).toBeLessThanOrEqual(OFFSEASON.development.cap);
    expect(developmentIds(s, EXPANSION_ID).length).toBeGreaterThan(0);
    expect(s.user!.fund).toBeGreaterThan(0);
    expect(s.user!.ledger.some((l) => l.label.includes('운영 결산'))).toBe(true);
    expect(s.user!.ledger.some((l) => l.label.startsWith('모기업 지원'))).toBe(true);
    expect(s.user!.ledger.some((l) => l.label.startsWith('신인 계약금'))).toBe(true);
  });

  it('sends players to the army and 상무, who play for 상무 in the futures league', () => {
    const served = Object.values(s.players).filter((p) => p.teamId === EXPANSION_ID && (p.status === 'military' || p.service.military === 'served'));
    expect(served.length).toBeGreaterThan(0);
    expect(s.user!.log?.some((l) => l.text.includes('상무') || l.text.includes('현역'))).toBe(true);
  });

  it('plays a futures league with every club and 상무', () => {
    const h = s.history.at(-1)!;
    expect(h.futures).toHaveLength(12);
    for (const row of h.futures!) expect(row.w + row.l + row.t).toBeGreaterThanOrEqual(110);
  });
});
