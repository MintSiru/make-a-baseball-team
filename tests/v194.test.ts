/* 1.9.4: the KBO's rules year by year (rules/history.ts) and the clubs' lineage (lineage.ts), for the 1982 legacy
   start — and today's game unchanged in every year for every other league. */
import { afterEach, describe, expect, it } from 'vitest';
import { setEra } from '../src/league/era';
import { existingTeams } from '../src/league/clubs';
import { clubIn, firstTeamClubsIn, foundedIn, LINEAGE } from '../src/league/lineage';
import { MODERN_FROM, ruleChanges, rulesFor, rulesOfYear, stepAt } from '../src/rules/history';
import { KBO_2026 } from '../src/rules/kbo2026';

afterEach(() => setEra(0));

describe('the year-by-year rules', () => {
  it('a step holds until the next', () => {
    const steps = [[1982, 'a'], [1990, 'b']] as const;
    expect(stepAt(steps, 1970)).toBe('a');
    expect(stepAt(steps, 1989)).toBe('a');
    expect(stepAt(steps, 1990)).toBe('b');
    expect(stepAt(steps, 2030)).toBe('b');
  });

  it('the history before 2015 (RULES.md §14)', () => {
    const y = (year: number) => rulesOfYear(year);
    expect(y(1982)).toMatchObject({ gamesPerClub: 80, halves: true, postseason: 'halves', extraInnings: 15, ties: 'excluded', territorialPicks: Infinity, futuresLeague: false });
    expect(y(1982).foreign.hold).toBe(0);
    expect(y(1982).kyopo.allowed).toBe(false);
    expect(y(1983).kyopo).toEqual({ allowed: true, maxPlay: 2, maxEntry: null });
    expect(y(1985).gamesPerClub).toBe(110);
    expect(y(1986)).toMatchObject({ gamesPerClub: 108, postseason: 'halvesTickets', territorialPicks: 10 });
    expect(y(1987).ties).toBe('half');
    expect(y(1989)).toMatchObject({ gamesPerClub: 120, halves: false, postseason: 'four' });
    expect(y(1990)).toMatchObject({ futuresLeague: true, territorialPicks: 2 });
    expect(y(1991)).toMatchObject({ gamesPerClub: 126, territorialPicks: 1 });
    expect(y(1993).postseason).toBe('fourWithin3');
    expect(y(1995).kyopo).toEqual({ allowed: true, maxPlay: null, maxEntry: 2 });
    expect(y(1997).overseasDraftInterest).toBe(false);
    expect(y(1998).foreign).toEqual({ hold: 2, play: 2, asia: 0, signing: 'tryout', capUsd: 120_000 });
    expect(y(1998)).toMatchObject({ posting: true, overseasDraftInterest: true, freeAgencySeasons: null });
    expect(y(1999)).toMatchObject({ gamesPerClub: 132, twoLeagues: true, postseason: 'twoLeagues', freeAgencySeasons: 10 });
    expect(y(2000).foreign.signing).toBe('free');
    expect(y(2001)).toMatchObject({ gamesPerClub: 133, twoLeagues: false, postseason: 'four', freeAgencySeasons: 9 });
    expect(y(2001).foreign).toMatchObject({ hold: 3, play: 2 });
    expect(y(2005).gamesPerClub).toBe(126);
    expect(y(2008)).toMatchObject({ extraInnings: null, series: { wildCard: null, semi: 5, playoff: 7, final: 7 } });
    expect(y(2010).territorialPicks).toBe(0);
    expect(y(2014)).toMatchObject({ gamesPerClub: 128, territorialPicks: 1 });
    expect([2010, 2011, 2012, 2013, 2014].map((x) => y(x).secondDraft)).toEqual([false, true, false, true, false]);
  });

  it('from 2015, and in every year for a league that does not play history, today’s game', () => {
    for (let year = 1982; year <= 2035; year++)
      for (const history of [true, false]) {
        if (history && year < MODERN_FROM) continue;
        const r = rulesOfYear(year, history);
        expect(r.firstTeam.registered).toBe(year >= 2026 ? KBO_2026.league.firstTeam.registered : 28);
        expect(r.rosterLimit).toBe(year >= 2026 ? KBO_2026.league.rosterLimit : 65);
        expect(r.foreign.asia).toBe(year >= 2026 ? KBO_2026.foreign.asiaQuota : 0);
        expect(r.futuresSimulated).toBe(year >= 2026);
        expect(r.secondDraft).toBe(year >= 2023 && (year - 2023) % 2 === 0);
      }
    expect(rulesOfYear(2015).postseason).toBe('five');
    expect(rulesOfYear(2015).gamesPerClub).toBe(144);
  });

  it('rulesFor reads the league’s calendar: history only for a league that plays it, the era shift for the rest', () => {
    expect(rulesFor(1990).rosterLimit).toBe(65);
    setEra({ era: 0, historical: true });
    expect(rulesFor(1990).rosterLimit).toBe(55);
    expect(rulesFor(2026).rosterLimit).toBe(KBO_2026.league.rosterLimit);
    // A game from 2016 plays 2026's rules in 2016.
    setEra(-10);
    expect(rulesFor(2016).foreign.asia).toBe(KBO_2026.foreign.asiaQuota);
  });

  it('every year has every rule, and the winter’s notice names what changed', () => {
    for (let year = 1982; year <= 2030; year++) for (const v of Object.values(rulesOfYear(year))) expect(v).not.toBeUndefined();
    const changes = ruleChanges(rulesOfYear(1997), rulesOfYear(1998));
    expect(changes).toEqual(expect.arrayContaining(['foreign', 'posting', 'overseasDraftInterest', 'ties']));
    expect(changes).not.toContain('year');
    expect(ruleChanges(rulesOfYear(2003), rulesOfYear(2004))).toEqual([]);
  });
});

describe('the clubs’ lineage', () => {
  it('names by season', () => {
    expect(clubIn('lg', 1989)?.name).toBe('MBC 청룡');
    expect(clubIn('lg', 1990)?.name).toBe('LG 트윈스');
    expect(clubIn('doosan', 1982)?.city).toBe('대전');
    expect(clubIn('doosan', 1999)?.name).toBe('두산 베어스');
    expect(clubIn('kia', 2000)?.name).toBe('해태 타이거즈');
    expect(['1982', '1985', '1988', '1996', '2008', '2010', '2019'].map((y) => clubIn('kiwoom', Number(y))?.short)).toEqual(['삼미', '청보', '태평양', '현대', '우리', '넥센', '키움']);
    expect(clubIn('kiwoom', 2000)?.city).toBe('수원');
    expect(clubIn('hanwha', 1984)).toBeNull();
    expect(clubIn('hanwha', 1993)?.name).toBe('빙그레 이글스');
    expect(clubIn('ssg', 1999)?.name).toBe('쌍방울 레이더스');
    expect(clubIn('ssg', 2000)?.name).toBe('SK 와이번스');
  });

  it('the league grows six → seven → eight → nine → ten, as the KBO did', () => {
    expect(firstTeamClubsIn(1982).length).toBe(6);
    expect(firstTeamClubsIn(1985).length).toBe(6);
    expect(firstTeamClubsIn(1986).length).toBe(7);
    expect(firstTeamClubsIn(1990).length).toBe(7);
    expect(firstTeamClubsIn(1991).length).toBe(8);
    expect(firstTeamClubsIn(2013).length).toBe(9);
    expect(firstTeamClubsIn(2015).length).toBe(10);
    expect(foundedIn(1990)).toEqual(['ssg']);
    expect(foundedIn(2011)).toEqual(['nc']);
  });

  it('every club of today has a lineage, in order, ending in today’s owner and city', () => {
    const today = existingTeams();
    expect(LINEAGE.map((l) => l.id).sort()).toEqual(today.map((t) => t.id).sort());
    for (const l of LINEAGE) {
      const years = l.eras.map((e) => e.from);
      expect([...years].sort((a, b) => a - b)).toEqual(years);
      expect(years[0]).toBe(l.founded);
      expect(l.firstTeam).toBeGreaterThanOrEqual(l.founded);
      const t = today.find((x) => x.id === l.id)!;
      expect(t.region).toBe(l.eras.at(-1)!.region);
    }
  });
});
