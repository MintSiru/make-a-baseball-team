/* 2.0.5: a club's all-time records — its seasons year by year, its own career and single-season leaders, its managers. */
import { EXHIBITION } from '../src/league/exhibition';
import { beforeAll, describe, expect, it } from 'vitest';
import { clubRecords, clubYears } from '../src/league/clubrecords';
import { createLeague } from '../src/league/history';
import { closeSeason } from '../src/league/offseason';
import { currentStandings, playDay } from '../src/league/season';
import type { LeagueState } from '../src/league/state';
import { recordRoom } from '../src/league/views';

describe('a club’s records', () => {
  let s: LeagueState;
  let team: string;
  beforeAll(() => {
    s = createLeague('v205-club');
    team = s.history.at(-1)!.table[0]!.teamId;
  }, 300_000);

  it('lists its seasons from the tables, the latest first, with the postseason it reached', () => {
    const years = clubYears(s, team);
    const played = s.history.filter((h) => h.table.some((r) => r.teamId === team));
    expect(years.length).toBe(played.length);
    expect(years[0]!.year).toBe(played.at(-1)!.year);
    for (const y of years) {
      const h = s.history.find((x) => x.year === y.year)!;
      const row = h.table.find((r) => r.teamId === team)!;
      expect([y.w, y.l, y.t]).toEqual([row.w, row.l, row.t]);
      expect(y.rank).toBeGreaterThanOrEqual(1);
      expect(!!y.post?.won).toBe(h.champion === team);
    }
    const r = clubRecords(s, team);
    expect(r.totals.w).toBe(years.reduce((a, y) => a + y.w, 0));
    expect(r.totals.titles).toBe(s.history.filter((h) => h.champion === team).length);
  });

  it('counts only what a man did for the club', () => {
    const mine = recordRoom(s, team);
    const all = recordRoom(s);
    const hr = (room: typeof mine) => room.career.find((c) => c.rows.length && c.rows[0]!.value.includes('개'))!;
    // Every leader of the club's own list played for it, and no club total is above the league's best.
    for (const board of mine.season)
      for (const row of board.rows) expect(s.players[row.id]!.career.some((c) => c.year === row.year && c.teamId === team && !c.level)).toBe(true);
    expect(mine.career.length).toBe(all.career.length + 2);
    expect(hr(mine)).toBeDefined();
  });

  it('keeps each club’s manager when the season closes, and shows the season being played', () => {
    // 2.0.30: past the spring games (exhibition.ts) into the season.
    for (let d = 0; d < 10 + EXHIBITION.days; d++) playDay(s);
    const now = clubYears(s, team)[0]!;
    expect(now.current).toBe(true);
    const row = currentStandings(s).find((r) => r.teamId === team)!;
    expect(now.w + now.l + now.t).toBe(row.w + row.l + row.t);
    // The man in charge for the season (a club may change him later that winter).
    const before = Object.fromEntries(s.teams.map((t) => [t.id, s.clubs?.[t.id]?.staff?.manager?.name]));
    closeSeason(s);
    const staff = s.history.at(-1)!.staff!;
    const named = s.teams.filter((t) => before[t.id]);
    expect(named.length).toBeGreaterThan(0);
    for (const t of named) expect(staff[t.id]?.manager).toBe(before[t.id]);
    expect(clubYears(s, team)[0]!.manager).toBe(staff[team]?.manager ?? null);
  });
});
