/* 1.8.0: the 1.7 feedback — free agency at a glance, staff contracts, asking the owner for a free agent, an
   NPB-style postseason for two leagues, and the scenario 부상병동. */
import { describe, expect, it } from 'vitest';
import { faOutlook } from '../src/league/faclock';
import { isForeign } from '../src/league/players';
import { rosterView } from '../src/league/views';
import { loadSave } from './helpers';

describe('free agency at a glance', () => {
  it('every domestic player has a season he files after, counted from his registered seasons and contract', () => {
    const s = loadSave();
    expect(s.phase).toBe('regular');
    const players = Object.values(s.players).filter((p) => p.status === 'active' && p.teamId);
    for (const p of players) {
      const fa = faOutlook(s, p);
      if (isForeign(p) || p.contract?.kind === 'development') {
        expect(fa.year).toBeNull();
        continue;
      }
      expect(fa.year).toBeGreaterThanOrEqual(s.year);
      const until = Math.max(0, ...(p.contract?.salaries ?? []).map((x) => x.season));
      expect(fa.year).toBeGreaterThanOrEqual(until);
      expect(fa.left).toBe(fa.year! - s.year + 1);
    }
    // A player one registered season short files after this one; two short, after the next.
    const p = structuredClone(players.find((x) => !isForeign(x) && x.contract?.kind !== 'development' && !x.contract?.salaries.some((y) => y.season > s.year))!);
    p.service = { ...p.service, creditedSeasons: 7, lastFreeAgencyAt: undefined };
    p.origin = { ...p.origin, entryCategory: 'highSchool' };
    expect(faOutlook(s, p).year).toBe(s.year);
    p.service.creditedSeasons = 6;
    expect(faOutlook(s, p).year).toBe(s.year + 1);
    // After a free-agent deal, four more seasons.
    p.service.lastFreeAgencyAt = 8;
    p.service.creditedSeasons = 9;
    expect(faOutlook(s, p)).toMatchObject({ again: true, year: s.year + 2 });
    // Every club's roster shows it.
    const other = s.teams.find((t) => t.id !== s.user!.teamId && s.rosters[t.id])!;
    expect(rosterView(s, other.id).active.every((r) => typeof r.fa.short === 'string')).toBe(true);
  });
});
