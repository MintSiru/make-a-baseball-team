/* 2.0.12: two-way players who pitch and hit, and players turned around (pitcher ↔ hitter). */
import { beforeAll, describe, expect, it } from 'vitest';
import { createLeague } from '../src/league/history';
import { lineupFor, bullpenFor } from '../src/league/manager';
import { isPitcher } from '../src/league/players';
import type { LeagueState, UserClub } from '../src/league/state';
import { asOther, checkSwitch, convert, otherSide, peekOther, switchPlayer, TWO_WAY, twoWayWinter } from '../src/league/twoway';
import { ageIn } from '../src/league/players';

describe('two-way players', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = createLeague('v2012-two-way');
  }, 300_000);

  it('bats a two-way pitcher and pitches a two-way hitter', () => {
    const team = s.teams[0]!.id;
    const ids = s.rosters[team]!.active;
    const pitcher = ids.map((id) => s.players[id]!).find(isPitcher)!;
    const hitter = ids.map((id) => s.players[id]!).find((p) => !isPitcher(p))!;
    // Make both two-way with a strong other side, so the manager uses them.
    for (const p of [pitcher, hitter]) {
      p.twoWay = true;
      const o = otherSide(p);
      for (const k of Object.keys(o.current) as (keyof typeof o.current)[]) o.current[k] = o.tools[k] = 80;
    }
    expect(lineupFor(s, ids, undefined, false, 'R').some((b) => b.id === pitcher.id)).toBe(true);
    expect(bullpenFor(s, team, ids, '2026-05-01', new Set()).some((r) => r.id === hitter.id)).toBe(true);
    // As the other side: a hitter's tools for the pitcher, a pitcher's for the hitter.
    expect(isPitcher(asOther(pitcher))).toBe(false);
    expect(isPitcher(asOther(hitter))).toBe(true);
  });

  it('draws the other side the same way every time, and grows it over the winter', () => {
    const p = Object.values(s.players).find((x) => x.status === 'active' && !x.other && ageIn(x, s.year) <= 24)!;
    const a = JSON.stringify(peekOther(p));
    expect(JSON.stringify(peekOther(p))).toBe(a);
    expect(p.other).toBeUndefined();
    const o = otherSide(p);
    const before = Object.values(o.current).reduce((x, y) => x! + y!, 0)!;
    twoWayWinter(s, s.year);
    const after = Object.values(p.other!.current).reduce((x, y) => x! + y!, 0)!;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it('turns a player around and keeps his old side as the other', () => {
    const p = Object.values(s.players).find((x) => x.status === 'active' && isPitcher(x) && !x.twoWay)!;
    const stuff = p.hidden.current.stuff;
    convert(p, s.year);
    expect(isPitcher(p)).toBe(false);
    expect(p.position).not.toBeNull();
    expect(p.hidden.current.contact).toBeDefined();
    expect(p.other!.current.stuff).toBe(stuff);
    expect(p.switched!.at(-1)!.to).toBe('hitter');
    convert(p, s.year + 1);
    expect(isPitcher(p)).toBe(true);
    expect(p.hidden.current.stuff).toBe(stuff);
  });

  it('lets the general manager choose for our young players only, turning around in the winter', () => {
    const team = s.teams[1]!.id;
    s.user = { teamId: team } as UserClub;
    const mine = Object.values(s.players).filter((p) => p.teamId === team && p.status === 'active' && !p.twoWay);
    const young = mine.find((p) => ageIn(p, s.year) <= TWO_WAY.switchMaxAge)!;
    const old = mine.find((p) => ageIn(p, s.year) > TWO_WAY.switchMaxAge + 1)!;
    expect(checkSwitch(s, old.id, 'convert')).not.toBeNull();
    expect(checkSwitch(s, young.id, 'convert')).not.toBeNull(); // not the winter
    const theirs = Object.values(s.players).find((p) => p.teamId && p.teamId !== team)!;
    expect(checkSwitch(s, theirs.id, 'twoWayOff')).not.toBeNull();
    const o = otherSide(young);
    for (const k of Object.keys(o.tools) as (keyof typeof o.tools)[]) o.tools[k] = 60;
    switchPlayer(s, young.id, 'twoWayOn');
    expect(young.twoWay).toBe(true);
    switchPlayer(s, young.id, 'twoWayOff');
    expect(young.twoWay).toBe(false);
    s.user = null;
  });
});
