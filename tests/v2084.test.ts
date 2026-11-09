/* 2.0.84 (the user's report: 장기 부상 선수를 가을 직전에 방출했더니 봄에 다른 팀에 가서 부상이 초기화됨): a released
   player keeps his injury, through the winter too; nobody signs him (he is off the market) while it has long to run. */
import { describe, expect, it } from 'vitest';
import { carryOverInjuries } from '../src/league/injuries';
import { isForeign } from '../src/league/players';
import { canSignFromPool, foreignMarket, leaveForeign, processWaivers, releasePlayer } from '../src/league/trade';
import { foreignPoolPlayers } from '../src/league/foreignpool';
import { hurtOffMarket, orgPlayers } from '../src/league/state';
import { loadSave } from './helpers';

describe('2.0.84: a released player keeps his injury', () => {
  it('a foreign player let go hurt: still hurt on the market, off the lists until near his return, and after the winter', () => {
    const s = loadSave('2.0.83');
    s.pending = null;
    const me = s.user!.teamId;
    const f = orgPlayers(s, me).find((p) => isForeign(p) && !p.contract?.temp)!;
    const until = `${s.year + 1}-06-30`;
    s.injuries[f.id] = { until, days: 200, onList: true, part: '팔꿈치', surgery: 'major' };
    leaveForeign(s, f, me);
    expect(f.teamId).toBeNull();
    expect(s.injuries[f.id]?.until).toBe(until);
    expect(s.injuries[f.id]?.onList).toBe(false);
    expect(hurtOffMarket(s, f.id)).toBe(true);
    expect(foreignPoolPlayers(s).some((p) => p.id === f.id)).toBe(false);
    const other = s.teams.find((t) => t.id !== me && s.rosters[t.id])!.id;
    expect(foreignMarket(s, other).some((p) => p.id === f.id)).toBe(false);
    // Over the winter (opening day next spring): the injury is still there.
    carryOverInjuries(s, `${s.year + 1}-03-28`);
    expect(s.injuries[f.id]?.until).toBe(until);
    // Near his return, he is back on the market.
    s.injuries[f.id]!.until = s.schedule[s.next]!.date;
    expect(foreignPoolPlayers(s).some((p) => p.id === f.id)).toBe(true);
  });

  it('a domestic player released hurt keeps it; no club claims him on waivers, and he cannot be signed from the pool while out', () => {
    const s = loadSave('2.0.83');
    s.pending = null;
    const me = s.user!.teamId;
    const p = orgPlayers(s, me).filter((x) => !isForeign(x)).sort((a, b) => b.scouting.current - a.scouting.current)[3]!;
    const until = `${s.year}-09-30`;
    s.injuries[p.id] = { until, days: 120, onList: true, part: '햄스트링' };
    releasePlayer(s, p.id);
    expect(s.injuries[p.id]?.until).toBe(until);
    expect(s.injuries[p.id]?.onList).toBe(false);
    // The waiver period runs out: nobody claims him; he goes to the pool.
    const w = s.waivers!.find((x) => x.id === p.id)!;
    processWaivers(s, w.until);
    expect(p.teamId).toBeNull();
    expect(s.pool).toContain(p.id);
    expect(canSignFromPool(s, p.id)).toContain('부상');
  });
});
