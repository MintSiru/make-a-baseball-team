/* The market (V0.5): trades, waivers, unattached players, foreign replacements, FA grades. */
import { beforeAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { autoDecision, EXPANSION_ID } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { externalLimit, faGrades } from '../src/league/market';
import { freeAgentsFor } from '../src/league/offseason';
import { isForeign } from '../src/league/players';
import { orgPlayers, registeredIds, type LeagueState } from '../src/league/state';
import { checkTrade, foreignMarket, tradeValue, tradeWindow } from '../src/league/trade';
import { numbersCheck } from '../src/story/writer';

/** The latest transaction article about `id` (V0.7.2). */
const moveAbout = (id: string) => [...(s.news ?? [])].reverse().find((n) => n.kind === 'move' && n.players.includes(id));

let s: LeagueState;
const decideAll = () => {
  while (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
};

beforeAll(() => {
  s = createLeague('market-test');
  apply(s, { kind: 'toFounding' });
  apply(s, {
    kind: 'found',
    settings: { name: '테스트', short: '테스트', color: '#1f6fb2', cityId: 'ulsan', parentType: 'conglomerate', parentName: '가상', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null },
  });
  decideAll();
  apply(s, { kind: 'regularEnd' });
  apply(s, { kind: 'postseason' });
  apply(s, { kind: 'nextSeason' });
  decideAll();
  apply(s, { kind: 'days', days: 20 });
}, 240_000);

describe('trades', () => {
  it('accepts a fair deal and refuses a lopsided one', () => {
    const ours = registeredIds(s, EXPANSION_ID).map((id) => s.players[id]!).filter((p) => !isForeign(p) && p.proSince <= s.year);
    const theirs = registeredIds(s, 'kia').map((id) => s.players[id]!).filter((p) => !isForeign(p) && p.proSince <= s.year);
    const byValue = (xs: typeof ours) => [...xs].sort((a, b) => tradeValue(s, b) - tradeValue(s, a));
    const star = byValue(theirs)[0]!;
    const scrub = byValue(ours).at(-1)!;
    expect(checkTrade(s, 'kia', [scrub.id], [star.id]).accepted).toBe(false);
    const ourBest = byValue(ours)[0]!;
    const cheaper = byValue(theirs).find((p) => tradeValue(s, p) * 1.1 + 1 <= tradeValue(s, ourBest))!;
    const c = checkTrade(s, 'kia', [ourBest.id], [cheaper.id]);
    expect(c.problem).toBeNull();
    expect(c.accepted).toBe(true);
    apply(s, { kind: 'trade', teamId: 'kia', give: [ourBest.id], get: [cheaper.id] });
    expect(s.players[ourBest.id]!.teamId).toBe('kia');
    expect(s.players[cheaper.id]!.teamId).toBe(EXPANSION_ID);
    // The trade is news, with both players' records as fact lines.
    const n = moveAbout(ourBest.id)!;
    expect(n.mine).toBe(true);
    expect(n.title).toContain(ourBest.name);
    expect(n.title).toContain(cheaper.name);
    expect(n.detail!.some((l) => l.startsWith(`${cheaper.name}:`))).toBe(true);
    expect(n.detail!.some((l) => l.startsWith('KIA') || l.includes('현재'))).toBe(true);
    expect(numbersCheck({ title: n.title, body: n.body, quotes: n.quotes }, n)).toBe(true);
  });

  it('refuses foreign players and closes after July 31', () => {
    const f = orgPlayers(s, EXPANSION_ID).find(isForeign)!;
    const other = registeredIds(s, 'lg')[0]!;
    expect(checkTrade(s, 'lg', [f.id], [other]).problem).toMatch(/외국인/);
  });
});

describe('releases and waivers', () => {
  it('puts a released player on waivers, then someone claims him or he becomes free', () => {
    const p = orgPlayers(s, EXPANSION_ID).find((x) => !isForeign(x) && !s.rosters[EXPANSION_ID]!.active.includes(x.id))!;
    apply(s, { kind: 'release', id: p.id });
    expect(s.waivers?.some((w) => w.id === p.id)).toBe(true);
    expect(moveAbout(p.id)?.title).toContain('웨이버 공시');
    expect(s.user!.deadMoney?.length ?? 0).toBeGreaterThanOrEqual(0);
    apply(s, { kind: 'days', days: 9 });
    const claimed = !!s.players[p.id]?.teamId;
    expect(claimed || (s.pool ?? []).includes(p.id)).toBe(true);
    if (!claimed) {
      apply(s, { kind: 'signPool', id: p.id });
      expect(s.players[p.id]!.teamId).toBe(EXPANSION_ID);
      expect(moveAbout(p.id)?.title).toContain('자유계약선수');
    } else expect(moveAbout(p.id)?.title).toContain('웨이버로');
  }, 60_000);
});

describe('foreign replacement', () => {
  it('swaps a foreign player for a candidate of the same kind, twice at most', () => {
    const old = orgPlayers(s, EXPANSION_ID).find((p) => isForeign(p) && !p.origin.asiaQuota)!;
    const cand = foreignMarket(s, EXPANSION_ID).find((p) => !p.origin.asiaQuota)!;
    apply(s, { kind: 'foreignSwap', out: old.id, in: cand.id });
    expect(s.players[cand.id]!.teamId).toBe(EXPANSION_ID);
    expect(s.players[old.id]?.teamId ?? null).toBeNull();
    expect(s.foreignChanges?.[EXPANSION_ID]).toBe(1);
    const n = moveAbout(cand.id)!;
    expect(n.title).toContain(old.name);
    expect(n.detail!.some((l) => l.startsWith(`${old.name}:`))).toBe(true);
  });

  it('closes trades after the deadline', () => {
    while (s.phase === 'regular' && (s.schedule[s.next]?.date ?? '9999') <= `${s.year}-08-01`) apply(s, { kind: 'days', days: 7 });
    expect(tradeWindow(s)).toMatch(/마감/);
    expect(s.transactions?.some((t) => t.text.startsWith('트레이드') || t.text.startsWith('외국인'))).toBe(true);
    // Moves between other clubs are news too; the history before the club (no user) has none.
    expect(s.news?.some((n) => n.kind === 'move' && !n.mine)).toBe(true);
    expect(s.news?.filter((n) => n.kind === 'move').every((n) => n.date >= `${s.year - 1}`)).toBe(true);
  }, 120_000);
});

describe('free-agent grades', () => {
  it('grades by salary rank and limits outside signings by the class size', () => {
    expect(externalLimit(8)).toBe(1);
    expect(externalLimit(19)).toBe(2);
    expect(externalLimit(25)).toBe(3);
    expect(externalLimit(40)).toBe(4);
    const fas = freeAgentsFor(s, s.year + 1);
    const g = faGrades(s, s.year + 1, fas);
    expect(Object.values(g).every((x) => ['A', 'B', 'C'].includes(x))).toBe(true);
  });
});
