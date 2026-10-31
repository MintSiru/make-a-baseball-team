/* 2.0.64 (the user's requests): a player's last ten games and his season by month, and a season split between clubs
   when he moves in it — kept beside his season line, which stays whole. */
import { beforeAll, describe, expect, it } from 'vitest';
import { bootstrap } from '../src/league/history';
import { playDay } from '../src/league/season';
import { closeSeason } from '../src/league/offseason';
import { GAMELOG } from '../src/league/gamelog';
import type { LeagueState } from '../src/league/state';
import { emptyBat } from '../src/league/state';
import { addInto } from '../src/league/state';
import { apply } from '../src/league/actions';
import { isPitcher } from '../src/league/players';
import { loadSave, playDays } from './helpers';
import { retireCandidates } from '../src/league/numbers';

let s: LeagueState;
let moved: string;
let from: string, to: string;

const playUntil = (done: () => boolean, max = 400) => {
  for (let i = 0; i < max && !done(); i++) if (!playDay(s)) break;
};

beforeAll(() => {
  s = bootstrap('v2064-test');
  // Into the regular season with a month or so of games behind.
  playUntil(() => s.phase === 'regular' && s.scores.length > 120);
  // A regular of one club goes to another (as a trade would move him).
  const ids = s.teams.filter((t) => s.rosters[t.id]?.active.length).map((t) => t.id);
  from = ids[0]!;
  to = ids[1]!;
  moved = s.rosters[from]!.active.find((id) => (s.lines[id]?.bat?.pa ?? 0) > 40 && s.players[id]!.role !== 'SP' && s.players[id]!.role !== 'RP')!;
  s.rosters[from]!.active = s.rosters[from]!.active.filter((id) => id !== moved);
  s.rosters[to]!.active.push(moved);
  s.players[moved]!.teamId = to;
  if (s.players[moved]!.contract) s.players[moved]!.contract!.teamId = to;
  playUntil(() => (s.lines[moved]?.parts?.at(-1)?.bat?.pa ?? 0) > 20);
}, 600_000);

describe('the last games and the months', () => {
  it('keep ten games at most and sum to the season by month', () => {
    const lines = Object.values(s.lines).filter((l) => l.bat && l.bat.pa > 30);
    expect(lines.length).toBeGreaterThan(50);
    for (const l of lines) {
      expect(l.last!.length).toBeLessThanOrEqual(GAMELOG.last);
      const sum = emptyBat();
      for (const m of Object.values(l.months ?? {})) if (m.bat) addInto(sum, m.bat);
      expect(sum.pa).toBe(l.bat!.pa);
      expect(sum.h).toBe(l.bat!.h);
      expect(sum.g).toBe(l.bat!.g);
    }
    // The ten games are the newest, in order.
    const l = lines[0]!;
    const dates = l.last!.map((g) => g.date);
    expect([...dates].sort()).toEqual(dates);
  });
});

describe('a season between clubs', () => {
  it('splits into each club’s line, the season line still whole', () => {
    const line = s.lines[moved]!;
    expect(line.parts!.map((x) => x.teamId)).toEqual([from, to]);
    const sum = emptyBat();
    for (const x of line.parts!) addInto(sum, x.bat!);
    expect(sum.pa).toBe(line.bat!.pa);
    expect(sum.hr).toBe(line.bat!.hr);
    expect(sum.g).toBe(line.bat!.g);
    expect(line.parts!.reduce((a, x) => a + x.days, 0)).toBe(line.days);
    // Players who stayed put have no parts.
    expect(Object.entries(s.lines).filter(([id, l]) => id !== moved && l.parts).length).toBeLessThan(10);
  });

  it('goes into his career with the season, each part with its WAR', () => {
    const p = s.players[moved]!;
    closeSeason(s);
    const rec = p.career.find((c) => c.year === s.year && !c.level)!;
    expect(rec.parts!.map((x) => x.teamId)).toEqual([from, to]);
    expect(rec.parts!.every((x) => Number.isFinite(x.war))).toBe(true);
    expect((rec as unknown as { months?: unknown }).months).toBeUndefined();
  });
});

describe('the manager and the general manager’s fixed players (2.0.64)', () => {
  it('keeps a player fixed on the lineup card up, and one kept in the futures down', { timeout: 600_000 }, () => {
    const u = loadSave('2.0.58');
    expect(u.phase).toBe('regular');
    const me = u.user!.teamId;
    u.user!.entry = 'auto';
    const r = () => u.rosters[me]!;
    // A healthy hitter below, fixed at the ninth spot against right-handers.
    const up = [...r().futures, ...r().third].find((id) => !isPitcher(u.players[id]!) && !u.injuries[id] && u.players[id]!.status === 'active' && !u.players[id]!.contract?.kind?.includes('development'))!;
    expect(up).toBeTruthy();
    const card = { R: [...Array(8).fill(null), { id: up, pos: null }], L: Array(9).fill(null), rotation: [], rest: true };
    apply(u, { kind: 'lineupCard', card });
    expect(r().active).toContain(up);
    // One of the first team kept in the futures goes down at once.
    const down = r().active.find((id) => id !== up && !isPitcher(u.players[id]!) && u.players[id]!.position !== 'C')!;
    apply(u, { kind: 'futuresOnly', id: down, on: true });
    expect(r().active).not.toContain(down);
    // A fixed player cannot be kept in the futures.
    expect(() => apply(u, { kind: 'futuresOnly', id: up, on: true })).toThrow();
    playDays(u, 12);
    if (!u.injuries[up]) expect(r().active).toContain(up);
    expect(r().active).not.toContain(down);
    // Free again: the manager may call him up.
    apply(u, { kind: 'futuresOnly', id: down, on: false });
    expect(u.user!.futuresOnly).toBeUndefined();
  });
});

describe('a number retired by the general manager (2.0.64)', () => {
  it('welcomes a great, angers the fans over a journeyman, and gives the wearer another number', () => {
    const u = loadSave('2.0.58');
    const me = u.user!.teamId;
    const ours = Object.values(u.players).filter((p) => p.teamId === me && p.status === 'active' && p.number != null && p.number <= 99);
    const [great, journeyman, wearer] = ours;
    const retire = (p: typeof great, seasons: number, war: number, number: number) => {
      // As leaveLeague retires him: off the roster, no club, his number kept.
      for (const k of ['active', 'futures', 'third'] as const) u.rosters[me]![k] = u.rosters[me]![k].filter((id) => id !== p!.id);
      p!.status = 'retired';
      p!.teamId = null;
      p!.number = number;
      p!.numberTeam = me;
      p!.career = Array.from({ length: seasons }, (_, i) => ({ year: 2000 + i, teamId: me, age: 25 + i, days: 150, bat: null, pit: null, war: war / seasons }));
    };
    retire(great, 13, 70, 77);
    retire(journeyman, 1, 0.5, wearer!.number!);
    const list = retireCandidates(u);
    const g = list.find((c) => c.id === great!.id)!;
    const j = list.find((c) => c.id === journeyman!.id)!;
    expect(g.verdict).toBe('worthy');
    expect(j.verdict).toBe('unworthy');
    expect(j.mood).toBeLessThan(-0.2);
    const club = () => u.clubs![me]!;
    const before = club().interest;
    apply(u, { kind: 'retireNumber', id: great!.id });
    expect(club().interest).toBeCloseTo(Math.min(0.8, before + 0.03), 5);
    const mid = club().interest;
    const n = wearer!.number;
    apply(u, { kind: 'retireNumber', id: journeyman!.id });
    expect(club().interest).toBeLessThan(mid - 0.2);
    expect(u.teams.find((t) => t.id === me)!.retiredNumbers!.map((x) => x.number)).toEqual(expect.arrayContaining([77, n]));
    expect(wearer!.number).not.toBe(n);
    // Not twice, and not one of another club's.
    expect(() => apply(u, { kind: 'retireNumber', id: great!.id })).toThrow();
  });
});
