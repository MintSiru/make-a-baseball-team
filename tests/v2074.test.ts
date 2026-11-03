/* 2.0.74 (the user's requests): the official ball set by hand in the settings, and a game option (off by default)
   letting long-serving foreign players declare free agency. */
import { describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { BALL, BALL_MANUAL, ballOf, ballSeason, ballShift, ballTest, corOn, currentCor } from '../src/league/ball';
import { setEra } from '../src/league/era';
import { guaranteed, openMarket, signTalk, splitOffer } from '../src/league/fa';
import { foreignRoomAt, isForeignFreeAgent } from '../src/league/foreignfa';
import { freeAgentsFor, renewForeigners } from '../src/league/offseason';
import { isForeign } from '../src/league/players';
import type { LeagueState } from '../src/league/state';
import type { Player } from '../src/model/types';
import { loadSave } from './helpers';
import { rng } from '../src/draftroom';

const load = () => {
  const s = loadSave('2.0.72');
  setEra(s);
  return s;
};

/** A foreign player of an AI club made a nine-season veteran whose deal ends this season. */
function veteran(s: LeagueState): Player {
  const me = s.user!.teamId;
  const p = Object.values(s.players)
    .filter((q) => isForeign(q) && q.teamId && q.teamId !== me && !q.origin.asiaQuota && !q.origin.devForeign && q.status === 'active')
    .sort((a, b) => b.scouting.current - a.scouting.current)[0]!;
  p.service.creditedSeasons = 9;
  delete p.service.lastFreeAgencyAt;
  p.contract!.salaries = p.contract!.salaries.filter((x) => x.season <= s.year);
  return p;
}

describe('2.0.74: the ball set by hand', () => {
  it('holds the coefficient chosen, within its bounds, and gives the ball back to the events', () => {
    const s = load();
    const date = `${s.year}-07-01`;
    apply(s, { kind: 'ballManual', cor: 0.4234 });
    expect(s.ballManual).toBe(0.4234);
    expect(corOn(s, date)).toBe(0.4234);
    expect(currentCor(s)).toBe(0.4234);
    expect(ballShift(s, date)!.hr).toBeCloseTo((0.4234 - BALL.base) * BALL.hr, 6);
    apply(s, { kind: 'ballManual', cor: 9 });
    expect(s.ballManual).toBe(BALL_MANUAL.max);
    apply(s, { kind: 'ballManual', cor: 0 });
    expect(s.ballManual).toBe(BALL_MANUAL.min);
    apply(s, { kind: 'ballManual', cor: null });
    expect(s.ballManual).toBeUndefined();
    expect(corOn(s, date)).toBe(ballOf(s) ? (ballOf(s)!.test?.after !== undefined && date >= ballOf(s)!.test!.date ? ballOf(s)!.test!.after : ballOf(s)!.cor) : BALL.base);
  });

  it('opens a season on the ball set, with no news and no June test', () => {
    const s = load();
    s.year += 1;
    s.ball = (s.ball ?? []).filter((b) => b.year < s.year);
    apply(s, { kind: 'ballManual', cor: 0.4334 });
    const news = (s.news ?? []).length;
    ballSeason(s, `${s.year}-03-28`);
    expect(ballOf(s)).toEqual({ year: s.year, cor: 0.4334, manual: true });
    ballTest(s, `${s.year}-06-02`);
    expect(ballOf(s)!.test).toBeUndefined();
    expect((s.news ?? []).length).toBe(news);
  });
});

describe('2.0.74: long-serving foreign players’ free agency', () => {
  it('is off by default; on, a foreign veteran whose deal ends goes on the market (not the Asia quota)', () => {
    const s = load();
    const next = s.year + 1;
    const p = veteran(s);
    expect(s.foreignFa).toBeUndefined();
    expect(isForeignFreeAgent(s, p, next)).toBe(false);
    expect(freeAgentsFor(s, next).some((q) => q.id === p.id)).toBe(false);
    apply(s, { kind: 'foreignFa', on: true });
    expect(isForeignFreeAgent(s, p, next)).toBe(true);
    expect(freeAgentsFor(s, next).some((q) => q.id === p.id)).toBe(true);
    // Too few seasons, or a deal for next season: no.
    p.service.creditedSeasons = 3;
    expect(isForeignFreeAgent(s, p, next)).toBe(false);
    p.service.creditedSeasons = 9;
    p.service.lastFreeAgencyAt = 7;
    expect(isForeignFreeAgent(s, p, next)).toBe(false);
    p.service.lastFreeAgencyAt = 4;
    expect(isForeignFreeAgent(s, p, next)).toBe(true);
    p.origin.asiaQuota = true;
    expect(isForeignFreeAgent(s, p, next)).toBe(false);
  });

  it('signs him elsewhere only into an open foreign place, in dollars too, with no compensation', () => {
    const s = load();
    const next = s.year + 1;
    const p = veteran(s);
    const from = p.teamId!;
    apply(s, { kind: 'foreignFa', on: true });
    const m = openMarket(s, next);
    const t = m.talks[p.id]!;
    expect(t.foreign).toBe(true);
    expect(t.free).toBe(true);
    expect(t.grade).toBe('C');
    // Clubs with every foreign place filled for next season show no interest.
    for (const c of Object.keys(t.interest)) if (c !== from) expect(foreignRoomAt(s, c, next)).toBeGreaterThan(0);
    const other = s.teams.find((x) => x.id !== from && x.id !== s.user!.teamId && s.rosters[x.id] && foreignRoomAt(s, x.id, next) > 0)!.id;
    const queued = s.offseason?.faQueue?.length ?? 0;
    signTalk(s, m, t, other, splitOffer(guaranteed(t.price), 2, 0.3, 0, next), 1, next);
    expect(p.teamId).toBe(other);
    expect(p.contract!.kind).toBe('foreign');
    expect(p.contract!.usd!.salary).toBeGreaterThan(0);
    expect(m.signedOut[other] ?? 0).toBe(0);
    expect(s.offseason?.faQueue?.length ?? 0).toBe(queued);
    // His new club's winter renewals leave his deal alone.
    renewForeigners(s, other, next, rng('t74'));
    expect(p.teamId).toBe(other);
    expect(p.contract!.salaries.some((x) => x.season === next + 1)).toBe(true);
  });
});
