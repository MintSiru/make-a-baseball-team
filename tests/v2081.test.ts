/* 2.0.81 (the user's reports): ① the foreign market's list is not twenty pitchers to six hitters, nor six Asia-quota
   players: released players shown at most so many of a kind, new faces filling each kind; ② an AI club does not
   trade away its franchise icon (a one-club man long there, a legend). */
import { describe, expect, it } from 'vitest';
import { FOREIGN_LIST, foreignKindOf, type ForeignKind } from '../src/league/foreignpool';
import { aiNotForSale, franchiseIcon } from '../src/league/nfs';
import { isForeign, isPitcher, makeForeign } from '../src/league/players';
import { checkTrade, foreignMarket } from '../src/league/trade';
import { firstTeamIds, registeredIds } from '../src/league/state';
import { loadSave } from './helpers';

describe('2.0.81: the foreign market balanced', () => {
  it('a pool of released pitchers does not crowd out the hitters and the Asia quota', () => {
    const s = loadSave('2.0.80');
    const me = s.user!.teamId;
    // Twenty-five released pitchers on the market.
    s.foreignPool = [];
    for (let i = 0; i < 25; i++) {
      const p = makeForeign(s.seed, `v2081-pool-${i}`, s.year, { kind: 'pitcher', asiaQuota: false });
      p.status = 'freeAgent';
      p.teamId = null;
      s.players[p.id] = p;
      s.foreignPool.push({ id: p.id, since: s.year - 1, from: 'kia', usd: 500_000 });
    }
    const list = foreignMarket(s, me);
    const n: Record<ForeignKind, number> = { P: 0, H: 0, AP: 0, AH: 0 };
    for (const p of list) n[foreignKindOf(p)]++;
    const shape = FOREIGN_LIST.season;
    // The released ones: no more than the cap; new pitchers still at least the minimum.
    expect(list.filter((p) => s.foreignPool!.some((e) => e.id === p.id)).length).toBe(shape.cap.P);
    expect(n.P).toBe(shape.cap.P + shape.min.P);
    expect(n.H).toBeGreaterThanOrEqual(shape.target.H);
    expect(n.AP + n.AH).toBeGreaterThanOrEqual(shape.target.AP + shape.target.AH);
    // The same list asked again (the ids stay put).
    expect(foreignMarket(s, me).map((p) => p.id)).toEqual(list.map((p) => p.id));
    expect(list.filter((p) => !isPitcher(p)).every((p) => isForeign(p))).toBe(true);
  });
});

describe('2.0.81: an AI club keeps its franchise icon', () => {
  it('a one-club man of twelve seasons with an MVP is not for sale; one who moved once is not an icon', () => {
    const s = loadSave('2.0.80');
    s.pending = null;
    const club = firstTeamIds(s).find((id) => id !== s.user!.teamId)!;
    const kept = new Set(aiNotForSale(s, club));
    const p = registeredIds(s, club)
      .map((id) => s.players[id]!)
      .find((x) => !isForeign(x) && !kept.has(x.id) && x.contract?.kind !== 'development')!;
    expect(franchiseIcon(s, p, club)).toBe(false);
    // His career made a twelve-season one-club man's, an MVP once.
    p.career = p.career.filter((c) => c.level);
    for (let y = s.year - 12; y < s.year; y++) p.career.push({ year: y, teamId: club, age: 24 + y - s.year + 12, days: 170, bat: { g: 130 } as never, pit: null, war: 2 });
    p.honors = [`${s.year - 5} MVP`, `${s.year - 4} 올스타전 MVP`];
    expect(franchiseIcon(s, p, club)).toBe(true);
    expect(aiNotForSale(s, club)).toContain(p.id);
    const me = s.user!.teamId;
    const mine = registeredIds(s, me).map((id) => s.players[id]!).filter((x) => !isForeign(x)).slice(0, 3);
    expect(checkTrade(s, club, mine.map((x) => x.id), [p.id])).not.toBeNull();
    // A season elsewhere: no longer a one-club man (his honours alone do not make him one).
    p.career[0] = { ...p.career[0]!, teamId: firstTeamIds(s).find((id) => id !== club && id !== me)! };
    expect(franchiseIcon(s, p, club)).toBe(false);
    // Only the all-star game's MVP: not enough without the record.
    p.career[0] = { ...p.career[0]!, teamId: club };
    p.honors = [`${s.year - 4} 올스타전 MVP`];
    for (const c of p.career) c.war = 0.5;
    expect(franchiseIcon(s, p, club)).toBe(false);
  });
});
