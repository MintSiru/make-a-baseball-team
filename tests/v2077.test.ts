/* 2.0.77 (the user's request): a free agent who went abroad comes home onto the winter's free-agent market, not the
   pool of unattached players — there an AI club seldom looked at him, and unsigned all season he retired. */
import { describe, expect, it } from 'vitest';
import { closeMarket, openMarket, playRound, signTalk } from '../src/league/fa';
import { joinMlb } from '../src/league/mlb';
import { freeAgentsFor, lastKboClub, leaveLeague } from '../src/league/offseason';
import { isForeign } from '../src/league/players';
import { freeAgentHomecomings, homeToMarket } from '../src/league/returnees';
import type { LeagueState } from '../src/league/state';
import { clearPool } from '../src/league/trade';
import type { Player } from '../src/model/types';
import { loadSave } from './helpers';

/** The league's veterans who signed abroad as free agents some winters ago, their deals over: home this winter. */
function abroad(s: LeagueState, n: number): Player[] {
  const year = s.year;
  const gone = Object.values(s.players)
    .filter((p) => p.status === 'active' && p.teamId !== s.user!.teamId && !isForeign(p) && p.career.filter((c) => !c.level).length >= 8 && p.scouting.current >= 55)
    .slice(0, n);
  for (const p of gone) {
    leaveLeague(s, p, 'overseas');
    joinMlb(p, year - 4, { years: 2, total: 4_000_000 });
    p.mlb!.via = 'fa';
    p.birthday = `${year - 31}-05-01`;
    // His old club: the last he played a season for (the fixture is mid-season, so not always today's).
    expect(s.rosters[lastKboClub(s, p)!]).toBeDefined();
  }
  return gone;
}

describe('2.0.77: a free agent home from abroad is on the free-agent market', () => {
  it('comes home unattached, onto the market with no compensation and his old club keenest; signed, or left over', () => {
    const s = loadSave('2.0.76');
    const year = s.year;
    const next = year + 1;
    const gone = abroad(s, 30);
    s.phase = 'offseason';
    s.pending = null;
    const free = freeAgentHomecomings(s, next);
    const back = gone.filter((p) => p.mlb!.back === year);
    expect(back.length).toBeGreaterThan(5);
    // (and the save's own, abroad already)
    expect(free.map((p) => p.id)).toEqual(expect.arrayContaining(back.map((p) => p.id)));
    // Nobody signs him at once, and he is not in the pool: the market has him.
    for (const p of back) {
      expect(p.teamId).toBeNull();
      expect(s.pool ?? []).not.toContain(p.id);
    }
    expect(s.alerts!.find((a) => a.id === `fa-home-${next}`)!.lines.join(' ')).toContain('FA 시장');
    expect(freeAgentsFor(s, next).map((p) => p.id)).toEqual(expect.arrayContaining(back.map((p) => p.id)));
    const m = openMarket(s, next);
    for (const p of back) {
      const t = m.talks[p.id]!;
      expect(t.home).toBe(true);
      expect(t.free).toBe(true);
      expect(t.grade).toBe('C');
      expect(t.from).toBe(lastKboClub(s, p));
    }
    // Japan does not take one just home.
    for (const p of back) expect(p.status).toBe('freeAgent');
    while (!m.closed) playRound(s, m, next);
    closeMarket(s, m, next);
    // The AI clubs sign the useful ones; whoever is left waits unattached (FA 미아).
    const signed = back.filter((p) => p.teamId);
    expect(signed.length).toBeGreaterThan(back.length / 3);
    for (const p of signed) {
      expect(p.status).toBe('active');
      expect(p.contract!.teamId).toBe(p.teamId);
      expect(s.rosters[p.teamId!]!.futures.concat(s.rosters[p.teamId!]!.active, s.rosters[p.teamId!]!.third)).toContain(p.id);
      // His free agency starts over.
      expect(p.service.lastFreeAgencyAt).toBe(p.service.creditedSeasons);
      expect(p.service.homeFree).toBeUndefined();
      // A returnee's article, not a free agent's move from his old club.
      expect(s.news?.some((n) => n.players?.includes(p.id) && n.kind === 'move')).toBe(true);
    }
    for (const p of back.filter((x) => !x.teamId)) expect(s.pool).toContain(p.id);
    // No compensation, outside no club's limit.
    const outside = Object.values(m.signedOut).reduce((a, n) => a + n, 0);
    const outsideMoves = m.order.map((id) => m.talks[id]!).filter((t) => t.signed && t.signed.teamId !== t.from && !t.foreign && !t.home).length;
    expect(outside).toBe(outsideMoves);
    expect(s.offseason?.faQueue?.some((q) => back.some((p) => p.id === q.fa)) ?? false).toBe(false);
  });

  it('signed by us, he is not one of our outside free agents', () => {
    const s = loadSave('2.0.76');
    const me = s.user!.teamId;
    const next = s.year + 1;
    const [p] = abroad(s, 1) as [Player];
    leaveMlbHome(s, p);
    s.phase = 'offseason';
    const m = openMarket(s, next);
    const t = m.talks[p.id]!;
    signTalk(s, m, t, me, t.price, 0, next);
    expect(p.teamId).toBe(me);
    expect(p.status).toBe('active');
    expect(m.signedOut[me] ?? 0).toBe(0);
    expect(m.news.at(-1)!.text).toContain('해외 복귀');
  });

  it('a save’s returnee from before, left in the pool all season, is on the next winter’s market', () => {
    const s = loadSave('2.0.76');
    const [p] = abroad(s, 1) as [Player];
    // As 2.0.67–2.0.76 left him: home last winter, unattached in the pool.
    p.mlb!.back = s.year - 1;
    p.status = 'freeAgent';
    (s.pool ??= []).push(p.id);
    clearPool(s);
    expect(p.status).toBe('freeAgent');
    expect(p.service.homeFree).toBe(s.year);
    expect(freeAgentsFor(s, s.year + 1).map((x) => x.id)).toContain(p.id);
    // One who was on a market and still went unsigned retires, as before.
    const [r] = abroad(s, 1) as [Player];
    r.mlb!.back = s.year - 1;
    r.status = 'freeAgent';
    (r.life ??= {}).unsigned = s.year - 1;
    s.pool = [r.id];
    clearPool(s);
    expect(r.status).toBe('retired');
  });
});

/** Home from abroad this winter (the market's step after the posting step). */
function leaveMlbHome(s: LeagueState, p: Player) {
  p.mlb!.back = s.year;
  homeToMarket(p, s.year);
}
