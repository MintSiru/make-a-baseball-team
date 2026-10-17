/* 1.9.5: the 1982 legacy start (legacy1982.ts, historic.ts), the tiebreaker (tiebreak.ts) and the namesakes'
   nicknames (큰·작·짭). */
import { describe, expect, it } from 'vitest';
import type { Player } from '../src/model/types';
import { apply, regularOver } from '../src/league/actions';
import { autoDecision } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { LEGACY_ERA, LEGACY_START, ruleNoticeLines } from '../src/league/legacy1982';
import { givenName, NAMESAKE_DAYS, nicknameOf, nicknameWinter } from '../src/league/nicknames';
import { withScenario } from '../src/league/scenarios';
import { firstTeamIds, type ExpansionSettings, type LeagueState } from '../src/league/state';
import { addTiebreaker } from '../src/league/tiebreak';
import { rulesOfYear } from '../src/rules/history';
import { setEra } from '../src/league/era';

const settings = (): ExpansionSettings =>
  withScenario({ name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'afterFutures', difficulty: 'normal', scenario: null }, 'legacy');

let league: LeagueState | null = null;
const seasons: { year: number; clubs: number; games: number; champion?: string; ksGames: number }[] = [];
/** A legacy game founded in 1982 and played on to 1992's opening day (shared by the tests below). */
function legacy(): LeagueState {
  if (league) return league;
  const s = createLeague('v195', undefined, LEGACY_ERA);
  apply(s, { kind: 'toFounding' });
  apply(s, { kind: 'found', settings: settings() });
  for (let g = 0; g < 30000 && !(s.year === 1992 && s.phase === 'regular'); g++) {
    if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
    else if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
    else if (s.phase === 'regular') {
      const clubs = firstTeamIds(s).length;
      const games = s.schedule.filter((g) => !g.id.includes('-tb-')).length;
      apply(s, { kind: 'postseason' });
      const ks = s.postseason.find((x) => x.round === 'ks');
      seasons.push({ year: s.year, clubs, games, champion: ks?.winner, ksGames: ks?.games.length ?? 0 });
    } else apply(s, { kind: 'nextSeason' });
  }
  setEra(0);
  return (league = s);
}

describe('the 1982 legacy start', () => {
  it('six clubs of 1982 under their names then, the rules of 1982, money in today’s terms', () => {
    const s = createLeague('v195-start', undefined, LEGACY_ERA);
    expect(s.historical).toBe(true);
    expect(s.year).toBe(LEGACY_START);
    expect(s.teams.map((t) => t.name).sort()).toEqual(['MBC 청룡', 'OB 베어스', '롯데 자이언츠', '삼미 슈퍼스타즈', '삼성 라이온즈', '해태 타이거즈'].sort());
    // 80 games a club: 6 × 80 / 2.
    expect(s.schedule.length).toBe(240);
    expect(Object.values(s.players).filter((p) => p.status === 'active' && p.teamId && p.origin.kind === 'foreign')).toEqual([]);
    setEra(0);
  }, 120_000);

  it('the league grows in history’s years, ours from 1983; the games of each year', () => {
    legacy();
    const by = (y: number) => seasons.find((x) => x.year === y)!;
    expect(by(1982).clubs).toBe(6);
    expect(by(1983).clubs).toBe(7);
    expect(by(1986).clubs).toBe(8);
    expect(by(1991).clubs).toBe(9);
    for (const x of seasons) expect(x.games).toBe((x.clubs * rulesOfYear(x.year).gamesPerClub) / 2);
    // Every season has a champion; a club that won both halves of 1982–1985 needed no Korean Series.
    for (const x of seasons) expect(x.champion).toBeTruthy();
  }, 900_000);

  it('the names and owners change as they did; the clubs history founds are the AI’s', () => {
    const s = legacy();
    const name = (id: string) => s.teams.find((t) => t.id === id)?.name;
    expect(name('lg')).toBe('LG 트윈스');
    expect(name('kiwoom')).toBe('태평양 돌핀스');
    expect(name('hanwha')).toBe('빙그레 이글스');
    expect(name('ssg')).toBe('쌍방울 레이더스');
    expect(s.legacy!.clubs.map((c) => c.teamId)).toEqual(['hanwha', 'ssg']);
    // No free agency before 1999: nobody has signed as one.
    expect(Object.values(s.players).some((p) => p.contract?.kind === 'freeAgent')).toBe(false);
  }, 900_000);

  it('the winter notices name what changed', () => {
    expect(ruleNoticeLines(rulesOfYear(1988), rulesOfYear(1989)).join(' ')).toContain('전·후기');
    expect(ruleNoticeLines(rulesOfYear(1997), rulesOfYear(1998)).join(' ')).toContain('외국인');
    expect(ruleNoticeLines(rulesOfYear(2003), rulesOfYear(2004))).toEqual([]);
  });
});

describe('the tiebreaker', () => {
  const fake = (scores: [string, string, number, number][]): LeagueState =>
    ({
      year: 2030,
      teams: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: id.toUpperCase(), firstTeamFrom: 2020 })),
      scores: scores.map(([home, away, hs, as], i) => ({ id: `2030-${i}`, date: '2030-09-30', home, away, hs, as, att: 0 })),
      schedule: [{ id: '2030-x', date: '2030-09-30', home: 'a', away: 'b' }],
      news: [],
    }) as unknown as LeagueState;

  it('a tie for first is played off the next day at the head-to-head leader’s park', () => {
    // a and b 3–1 each, one win each against the other; the rest lose.
    const s = fake([['a', 'b', 3, 1], ['b', 'a', 2, 1], ['a', 'c', 5, 0], ['b', 'c', 4, 0], ['a', 'd', 2, 1], ['b', 'd', 3, 0]]);
    expect(addTiebreaker(s)).toBe(true);
    const tb = s.schedule.at(-1)!;
    expect(tb.id).toBe('2030-tb-1-1');
    expect(tb.date).toBe('2030-10-01');
    expect([tb.home, tb.away].sort()).toEqual(['a', 'b']);
    // Once played and decided, no more.
    s.scores.push({ id: tb.id, date: tb.date, home: tb.home, away: tb.away, hs: 4, as: 2, att: 0 });
    expect(addTiebreaker(s)).toBe(false);
  });

  it('no tiebreaker when the top is not level', () => {
    const s = fake([['a', 'b', 3, 1], ['a', 'c', 5, 0], ['b', 'c', 4, 0]]);
    expect(addTiebreaker(s)).toBe(false);
  });
});

describe('namesakes', () => {
  it('큰·작 by age, 짭 for a hall-of-famer’s name, the given name only', () => {
    expect(givenName('이병규')).toBe('병규');
    expect(givenName('남궁민수')).toBe('민수');
    const base = createLeague('v195-names');
    const year = base.history.at(-1)!.year;
    // Fans tell apart the namesakes they see: most of the season on a first team.
    const ps = Object.values(base.players).filter((p) => p.status === 'active' && p.teamId && p.origin.kind !== 'foreign' && !p.nickname && p.career.some((r) => r.year === year && !r.level && r.days >= NAMESAKE_DAYS)).slice(0, 3);
    const [old, young, other] = ps as [Player, Player, Player];
    old.name = '이병규';
    old.birthday = '1990-01-01';
    young.name = '이병규';
    young.birthday = '1999-01-01';
    other.name = '장효조';
    base.hallOfFame = [{ id: 'gone', name: '장효조', year: 2020, war: 60, seasons: 15, teams: [], line: '' }];
    nicknameWinter(base, year, false);
    expect(nicknameOf(base, old)).toBe('큰병규');
    expect(nicknameOf(base, young)).toBe('작병규');
    expect(nicknameOf(base, other)).toBe('짭효조');
  }, 240_000);
});
