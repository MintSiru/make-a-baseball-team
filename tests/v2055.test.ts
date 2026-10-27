/* 2.0.55 (the user's reports): after NC was merged and a club founded in its place, the abroad list and the hall of
   fame showed NC's players under the new club's name; and the national team's games had players long retired abroad. */
import { describe, expect, it } from 'vitest';
import { careerClubs } from '../src/league/clubnames';
import { resolveMerger } from '../src/league/merger';
import { joinMlb, mlbView } from '../src/league/mlb';
import { INTERNATIONAL } from '../src/league/international';
import { selectNationalTeam } from '../src/league/national';
import { currentValue, isPitcher } from '../src/league/players';
import { firstTeamIds, registeredIds, type LeagueState } from '../src/league/state';
import { loadSave } from './helpers';

/** The 2.0.46 save with NC merged away this winter: one of NC's players posted last winter, another its veteran. */
const merged = () => {
  const s = loadSave('2.0.46');
  const year = s.year;
  const partner = firstTeamIds(s).find((id) => id !== 'nc' && id !== s.user!.teamId)!;
  const [gone, vet] = registeredIds(s, 'nc').map((id) => s.players[id]!);
  gone!.career.push({ year: year - 1, teamId: 'nc', age: 25, days: 150, bat: { g: 120 } as never, pit: null, war: 3 });
  joinMlb(gone!, year - 1, { years: 2, total: 4_000_000 });
  vet!.career = [
    { year: year - 2, teamId: 'nc', age: 33, days: 150, bat: { g: 130 } as never, pit: null, war: 4 },
    { year: year - 1, teamId: 'nc', age: 34, days: 150, bat: { g: 130 } as never, pit: null, war: 3 },
  ];
  resolveMerger(s, { kind: 'merger', weak: 'nc', partner, needed: 0, clubs: firstTeamIds(s).length }, 'yes', year);
  vet!.teamId = 'nc';
  vet!.career.push({ year: year + 1, teamId: 'nc', age: 35, days: 150, bat: { g: 100 } as never, pit: null, war: 1 });
  return { s, gone: gone!, vet: vet!, now: s.teams.find((t) => t.id === 'nc')!.short };
};

describe('an old club’s name in the abroad list and the hall of fame (2.0.55)', () => {
  it('the club he left for abroad by its name then', () => {
    const { s, gone, now } = merged();
    const row = mlbView(s).find((x) => x.id === gone.id)!;
    expect(row.kboClub).toBe('NC');
    expect(now).not.toBe('NC');
  });

  it('a career’s clubs by their names in his seasons', () => {
    const { s, vet, now } = merged();
    expect(careerClubs(s, vet.career)).toEqual(['NC', now]);
  });
});

describe('no one retired abroad on the national team (2.0.55)', () => {
  it('a star whose career abroad has ended, or who is past the age, is not named', () => {
    const base = loadSave('2.0.46');
    const olympics = INTERNATIONAL.find((e) => e.kind === 'olympics' && e.year > base.year)!;
    const abroad = (s: LeagueState) => {
      const p = registeredIds(s, s.user!.teamId).map((id) => s.players[id]!).filter((x) => !isPitcher(x) && x.service.military !== 'exempt').sort((a, b) => currentValue(b) - currentValue(a))[0]!;
      for (const k of ['active', 'futures', 'third'] as const) s.rosters[p.teamId!]![k] = s.rosters[p.teamId!]![k].filter((x) => x !== p.id);
      p.teamId = null;
      p.status = 'overseas';
      p.scouting.current = 80;
      return p;
    };
    // Still playing abroad: named (2.0.47).
    const s0 = structuredClone(base);
    const playing = abroad(s0);
    expect(selectNationalTeam(s0, olympics).squad).toContain(playing.id);
    // His career abroad over: not.
    const s1 = structuredClone(base);
    const ended = abroad(s1);
    joinMlb(ended, s1.year - 5, { years: 2, total: 1_000_000 });
    ended.mlb!.ended = s1.year - 1;
    expect(selectNationalTeam(s1, olympics).squad).not.toContain(ended.id);
    // Past forty: not.
    const s2 = structuredClone(base);
    const old = abroad(s2);
    old.birthday = `${olympics.year - 45}-05-01`;
    expect(selectNationalTeam(s2, olympics).squad).not.toContain(old.id);
  });
});
