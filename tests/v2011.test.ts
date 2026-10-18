/* 2.0.11: the national team's games and each player's line; break and spin that follow a pitch's grade. */
import { beforeAll, describe, expect, it } from 'vitest';
import { createLeague } from '../src/league/history';
import { nationalLinesOf, NATIONAL_GAMES } from '../src/league/nationalgames';
import { nationalView } from '../src/league/legacy';
import { pitchGrades } from '../src/league/pitches';
import { isPitcher } from '../src/league/players';
import type { LeagueState } from '../src/league/state';
import { trackingOf } from '../src/league/tracking';

describe('national team lines', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = createLeague('v2011-national');
  }, 300_000);

  it('plays each finished event to its finish and keeps the squad’s lines', () => {
    const done = s.international.filter((e) => e.finish);
    expect(done.length).toBeGreaterThan(0);
    for (const e of done) {
      expect(e.lines).toBeDefined();
      const n = (e.kind === 'apbc' ? NATIONAL_GAMES.short : NATIONAL_GAMES.games)[e.finish!];
      expect(e.games).toBe(n);
      // Only the squad has lines; nine hitters start every game.
      for (const id of Object.keys(e.lines!)) expect(e.squad).toContain(id);
      const pa = Object.values(e.lines!).reduce((a, l) => a + (l.bat?.pa ?? 0), 0);
      expect(pa).toBeGreaterThanOrEqual(e.games! * 27);
      const gs = Object.values(e.lines!).reduce((a, l) => a + (l.pit?.gs ?? 0), 0);
      expect(gs).toBe(e.games);
    }
  });

  it('shows a player his events and the history its best', () => {
    const e = s.international.find((x) => x.lines)!;
    const [id] = Object.keys(e.lines!);
    const rows = nationalLinesOf(s, id!);
    expect(rows.some((r) => r.id === e.id)).toBe(true);
    const v = nationalView(s);
    expect(v.rows.some((r) => r.stars.length > 0)).toBe(true);
  });

  it('draws nothing from the league’s streams: the same seed gives the same lines', () => {
    const again = createLeague('v2011-national');
    expect(JSON.stringify(again.international)).toBe(JSON.stringify(s.international));
  }, 300_000);
});

describe('break and spin by grade', () => {
  it('moves a better pitch further from the fastball', () => {
    const s = createLeague('v2011-track');
    const p = Object.values(s.players).find((x) => isPitcher(x) && pitchGrades(x).some((g) => g.type === 'SL' || g.type === 'CB') && trackingOf(x))!;
    const type = pitchGrades(p).find((g) => g.type === 'SL' || g.type === 'CB')!.type;
    const read = () => {
      const t = trackingOf(p)!;
      const fb = t.pitches[0]!;
      const x = t.pitches.find((q) => q.type === type)!;
      return { gap: Math.hypot(x.vertical - fb.vertical, x.horizontal - fb.horizontal), spin: x.spin };
    };
    const keep = p.scouting.tools.breaking;
    const hidden = p.hidden.current.breaking;
    p.scouting.tools.breaking = 30;
    p.hidden.current.breaking = 30;
    const low = read();
    p.scouting.tools.breaking = 75;
    p.hidden.current.breaking = 75;
    const high = read();
    p.scouting.tools.breaking = keep;
    p.hidden.current.breaking = hidden;
    expect(high.gap).toBeGreaterThan(low.gap);
    expect(high.spin).toBeGreaterThan(low.spin);
  }, 300_000);
});
