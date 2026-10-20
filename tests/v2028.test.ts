/* 2.0.28: a high-school senior year in four events; real clubs for the prospects who played pro ball abroad. */
import { describe, expect, it } from 'vitest';
import Catalog from '../src/draftroom/catalog.js';
import { careerStages } from '../src/league/amateur';
import { createLeague } from '../src/league/history';
import { hsEvents, splitRecord } from '../src/league/hsevents';
import { MLB_CLUBS } from '../src/league/mlb';
import { proClubName, withRealClubs } from '../src/league/proclubs';

const institutions = (Catalog as unknown as { institutions: { id: string; kind: string; name: string; level?: string }[] }).institutions;

describe('real clubs abroad (2.0.28)', () => {
  it('names a big-league stop after an MLB club and a minor-league one after its farm team', () => {
    const mlb = institutions.find((x) => x.kind === 'overseas-pro' && x.level === 'MLB')!;
    const aaa = institutions.find((x) => x.kind === 'overseas-pro' && x.level === 'AAA')!;
    expect(MLB_CLUBS).toContain(proClubName('p1', { institutionId: mlb.id }));
    const farm = proClubName('p1', { institutionId: aaa.id })!;
    expect(farm.endsWith(' AAA')).toBe(true);
    expect(MLB_CLUBS).toContain(farm.slice(0, -4));
    // The same every time.
    expect(proClubName('p1', { institutionId: aaa.id })).toBe(farm);
  });

  it('leaves no invented big-league or minor-league club in a new league, and a save from before is fixed the same way', () => {
    const s = createLeague('v2028-clubs');
    const pro = new Set(institutions.filter((x) => x.kind === 'overseas-pro' && ['MLB', 'AAA', 'AA', 'A'].includes(x.level ?? '')).map((x) => x.name));
    const players = Object.values(s.players).filter((p) => p.origin.kind === 'draftClass');
    let renamed = 0;
    for (const p of players)
      for (const e of p.education.history ?? []) {
        expect(pro.has(e.name)).toBe(false);
        if (proClubName(p.id, e)) renamed++;
      }
    expect(renamed).toBeGreaterThan(0);
    // An old save's names come back as a new game's.
    const p = players.find((x) => x.education.history?.some((e) => proClubName(x.id, e)))!;
    const e = p.education.history.find((x) => proClubName(p.id, x))!;
    const now = e.name;
    e.name = institutions.find((x) => x.id === e.institutionId)!.name;
    withRealClubs(p);
    expect(e.name).toBe(now);
  });
});

describe('a high-school senior year, event by event (2.0.28)', () => {
  it('gives every school the weekend league and the open national; the qualified national and the champions to a few', () => {
    const schools = institutions.filter((x) => x.kind === 'high-school' || x.kind === 'hs-club');
    const all = schools.map((s) => hsEvents(s.id, { key: 'v2028|hs|2026' }));
    for (const ev of all) {
      expect(ev.some((x) => x.kind === 'league')).toBe(true);
      expect(ev.some((x) => x.kind === 'open')).toBe(true);
    }
    expect(all.filter((ev) => ev.some((x) => x.kind === 'qualified')).length).toBe(32);
    const champs = all.filter((ev) => ev.some((x) => x.kind === 'champions'));
    expect(champs).toHaveLength(8);
    expect(champs.filter((ev) => ev.find((x) => x.kind === 'champions')!.result === '우승')).toHaveLength(1);
  });

  it('shares his senior record out without losing a game, a hit or an out', () => {
    const s = createLeague('v2028-hs');
    const hs = Object.values(s.players).filter((p) => p.origin.kind === 'draftClass' && p.education.history?.length);
    let split = 0;
    for (const p of hs.slice(0, 300)) {
      for (const st of careerStages(p, s.seed)) {
        if (!st.events) continue;
        split++;
        const sum = (k: string) => st.events!.reduce((a, e) => a + (Number(e.record[k]) || 0), 0);
        expect(sum('games')).toBe(st.record.games);
        if (st.record.kind === 'pitcher') {
          expect(sum('outs')).toBe(st.record.outs);
          expect(sum('k')).toBe(st.record.k);
        } else {
          expect(sum('hits')).toBe(st.record.hits);
          expect(sum('hr')).toBe(st.record.hr);
          for (const e of st.events!) expect(Number(e.record.hr)).toBeLessThanOrEqual(Number(e.record.hits));
        }
      }
    }
    expect(split).toBeGreaterThan(100);
    // A plain split keeps its totals.
    const parts = splitRecord({ kind: 'hitter', games: 30, ab: 100, hits: 33, hr: 3, doubles: 6, triples: 1, bb: 10, sb: 5, rbi: 20, runs: 18 }, [9, 3, 2, 1], 'x');
    expect(parts.reduce((a, r) => a + Number(r.ab), 0)).toBe(100);
  });
});
