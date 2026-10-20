/* 2.0.31: the training screen's record of programmes abroad can be cleared; the trips stay for the season's limits and
   for each player's own page. */
import { describe, expect, it } from 'vitest';
import { createLeague } from '../src/league/history';
import { apply } from '../src/league/actions';
import { firstTeamIds } from '../src/league/state';
import { SITE_IDS, tripRecord } from '../src/league/training';

describe('clearing the record of programmes abroad (2.0.31)', () => {
  it('empties the list of finished programmes, keeps one still on, and keeps the limits', () => {
    const s = createLeague('v2031');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: { name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null } });
    s.user!.teamId = firstTeamIds(s)[0]!;
    s.pending = null;
    const ids = s.rosters[s.user!.teamId]!.active.slice(0, 3);
    const site = SITE_IDS[0]!;
    const trip = (id: string, season: number, done: boolean) => ({ id, site, season, from: `${season - 1}-12-01`, until: `${season}-01-15`, cost: 1, inSeason: false, ...(done ? { result: { gains: {}, text: '-' } } : {}) });
    s.user!.trips = [trip(ids[0]!, s.year - 1, true), trip(ids[1]!, s.year, true), trip(ids[2]!, s.year, false)];
    expect(tripRecord(s)).toHaveLength(3);
    apply(s, { kind: 'clearTrips' });
    // The one still on stays listed; the finished ones are gone from the record but not from the club.
    expect(tripRecord(s).map((t) => t.id)).toEqual([ids[2]]);
    expect(s.user!.trips).toHaveLength(3);
    // New programmes are listed again.
    s.user!.trips.push(trip(ids[0]!, s.year, true));
    expect(tripRecord(s).map((t) => t.id)).toEqual([ids[0], ids[2]]);
  });
});
