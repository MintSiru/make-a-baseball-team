/* 2.0.67 (the user's reports and requests): the free-agency outlook under the board's rule, free agents who do not ask
   to be posted but may go abroad (the majors too) as free agents, and development players let go in the winter. */
import { describe, expect, it } from 'vitest';
import { hashUnit } from '../src/draftroom';
import { setEra } from '../src/league/era';
import { abroadDeal } from '../src/league/fa';
import { faOutlook } from '../src/league/faclock';
import { isFreeAgent } from '../src/league/offseason';
import { isForeign } from '../src/league/players';
import { postingCandidates } from '../src/league/posting';
import { canRelease, releasePlayer } from '../src/league/trade';
import type { LeagueState } from '../src/league/state';
import type { Player } from '../src/model/types';
import { loadSave } from './helpers';

/** One of ours, domestic and on an ordinary deal that ends this season, made a high-school player. */
function ourPlayer(s: LeagueState, pick: (p: Player) => boolean = () => true): Player {
  const p = Object.values(s.players).find((x) => x.teamId === s.user!.teamId && x.status === 'active' && !isForeign(x) && x.contract?.kind !== 'development' && pick(x))!;
  p.origin.entryCategory = 'highSchool';
  p.contract = { ...p.contract!, kind: 'standard', salaries: [{ season: s.year, amount: 10_000 }] };
  delete p.service.lastFreeAgencyAt;
  delete p.service.postedIn;
  delete p.service.optionFree;
  return p;
}

describe('the free-agency outlook under the board’s rule (2.0.67, user report)', () => {
  it('counts the seasons the board set, as the market does', () => {
    const s = loadSave('2.0.65');
    const p = ourPlayer(s);
    // Seven registered seasons after this one: free agency after this season under a board's seven, not the next.
    p.service.creditedSeasons = 6;
    setEra(s);
    expect(faOutlook(s, p).year).toBe(s.year + 1);
    s.board = { ...(s.board ?? {}), changes: [{ from: s.year - 3, item: 'faSeasons', value: 7 }] } as LeagueState['board'];
    setEra(s);
    expect(faOutlook(s, p).year).toBe(s.year);
    // And the market agrees once the season is in.
    p.service.creditedSeasons = 7;
    expect(isFreeAgent(p, s.year + 1)).toBe(true);
    setEra(0);
  });
});

describe('free agents and the posting (2.0.67, user request)', () => {
  it('a free agent this winter does not ask to be posted', () => {
    const s = loadSave('2.0.65');
    setEra(s);
    const dreamer = (x: Player) => hashUnit(`${x.id}-mlb-dream`) < 0.5;
    const p = ourPlayer(s, dreamer);
    p.scouting.current = 70;
    p.birthday = `${s.year - 26}-05-01`;
    p.service.creditedSeasons = 7;
    // Seven seasons, not a free agent yet (eight): he may ask.
    expect(postingCandidates(s, s.user!.teamId, s.year + 1).map((x) => x.id)).toContain(p.id);
    // A free agent now: he goes to the market instead.
    p.service.creditedSeasons = 9;
    expect(isFreeAgent(p, s.year + 1)).toBe(true);
    expect(postingCandidates(s, s.user!.teamId, s.year + 1).map((x) => x.id)).not.toContain(p.id);
    // As a free agent he may sign in the majors (a dreamer, good and young enough), with no posting.
    let mlb = 0;
    for (const x of Object.values(s.players).filter((q) => !isForeign(q) && q.status === 'active').slice(0, 400)) {
      const keep = { g: x.scouting.current, b: x.birthday };
      x.scouting.current = 72;
      x.birthday = `${s.year - 26}-05-01`;
      const d = abroadDeal(s, x, s.year + 1);
      if (d?.league === 'mlb') {
        mlb++;
        expect(dreamer(x)).toBe(true);
      }
      x.scouting.current = keep.g;
      x.birthday = keep.b;
    }
    expect(mlb).toBeGreaterThan(20);
    setEra(0);
  });
});

describe('development players let go in the winter (2.0.67, user request)', () => {
  it('may be released in the offseason; a registered player may not', () => {
    const s = loadSave('2.0.65');
    const u = s.user!;
    const dev = Object.values(s.players).find((p) => p.teamId === u.teamId && p.contract?.kind === 'development')!;
    const reg = Object.values(s.players).find((p) => p.teamId === u.teamId && p.status === 'active' && p.contract?.kind !== 'development')!;
    expect(dev).toBeTruthy();
    s.phase = 'offseason';
    s.pending = null;
    expect(canRelease(s, dev.id)).toBeNull();
    expect(canRelease(s, reg.id)).not.toBeNull();
    releasePlayer(s, dev.id);
    expect(dev.teamId).toBeNull();
    expect(s.pool).toContain(dev.id);
    expect(Object.values(s.rosters[u.teamId]!).flat()).not.toContain(dev.id);
  });
});
