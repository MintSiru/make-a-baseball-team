/* 2.0.76 (the user's requests): a record of the league's offenses (drunk driving, doping and the rest) to look up, and
   the hall of fame and retired numbers decided by deliberation, not on retirement. */
import { describe, expect, it } from 'vitest';
import { HALL_VOTE, ballotWinter, hallVote, lastVote } from '../src/league/hallvote';
import { conductWeight, offensesOf } from '../src/league/conduct';
import { setEra } from '../src/league/era';
import { maybeRetireNumber, retireCandidates } from '../src/league/numbers';
import { leaveLeague } from '../src/league/offseason';
import { isForeign, isPitcher } from '../src/league/players';
import { migrateOffenseLog, offenseLabel, scandalDay } from '../src/league/scandals';
import type { LeagueState } from '../src/league/state';
import type { Player } from '../src/model/types';
import { loadSave } from './helpers';

const load = () => {
  const s = loadSave('2.0.75');
  setEra(s);
  return s;
};

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);

/** A hitter's first-team career: `n` seasons at `teamId` with `war` a season, the last one `last`. */
function career(p: Player, teamId: string, n: number, war: number, last: number) {
  const bat = { g: 130, pa: 550, ab: 480, r: 80, h: 140, d: 25, t: 2, hr: 20, rbi: 80, sb: 10, cs: 3, bb: 60, k: 90, hbp: 5, sf: 5, sh: 0, gdp: 10 };
  p.career = Array.from({ length: n }, (_, i) => ({ year: last - n + 1 + i, teamId, age: 25 + i, days: 180, bat: { ...bat } as never, pit: null, war }));
}

/** Domestic hitters of a club, retired with a career. */
function retirees(s: LeagueState, teamId: string, k: number) {
  const list = Object.values(s.players)
    .filter((p) => p.teamId === teamId && p.status === 'active' && !isForeign(p) && !isPitcher(p) && !p.twoWay)
    .slice(0, k);
  for (const p of list) {
    p.status = 'retired';
    p.honors = [];
    delete p.life?.offenses;
  }
  return list;
}

describe('2.0.76: the league’s record of offenses', () => {
  it('records the other clubs’ offenses too, with the KBO’s penalty and the club’s own, and no alert or decision for us', () => {
    const s = load();
    s.pending = null;
    const me = s.user!.teamId;
    const seed = s.seed;
    const before = (s.offenseLog ?? []).length;
    for (let round = 0; round < 4; round++) {
      s.seed = `${seed}|v2076|${round}`;
      for (let d = 0; d < 170; d++) {
        scandalDay(s, addDays(`${s.year}-04-01`, d));
        s.pending = null;
      }
    }
    s.seed = seed;
    const theirs = (s.offenseLog ?? []).slice(before).filter((e) => e.teamId !== me);
    expect(theirs.length).toBeGreaterThan(3);
    for (const e of theirs) {
      expect(!!e.answer || !!e.life).toBe(true);
      expect(s.players[e.id]?.life?.offenses?.[e.offense] ?? 0).toBeGreaterThan(0);
      expect(s.alerts?.some((a) => a.id === `scandal-${e.id}-${e.date}`)).toBe(false);
      expect(s.news?.some((n) => n.id === `scandal-${e.id}-${e.date}` && !n.mine)).toBe(true);
    }
    // A penalty of the club's own, on top of the KBO's.
    const served = theirs.find((e) => !e.life && s.suspended?.[e.id]?.games);
    expect(served).toBeDefined();
    expect(offensesOf(s, served!.id)[0]!.answer).toBeTruthy();
  });

  it('builds the record of a save from before from the players’ life events', () => {
    const s = load();
    const p = Object.values(s.players).find((x) => x.teamId === s.user!.teamId && x.status === 'active')!;
    (p.life ??= {}).events = [...(p.life.events ?? []), { date: `${s.year}-05-02`, text: `${offenseLabel('dui')} · 70경기 출장 정지`, tone: 'bad' }];
    delete s.offenseLog;
    migrateOffenseLog(s);
    const e = s.offenseLog!.find((x) => x.id === p.id && x.date === `${s.year}-05-02`)!;
    expect(e.offense).toBe('dui');
    expect(e.penalty).toBe('70경기 출장 정지');
    expect(e.teamId).toBe(s.user!.teamId);
  });
});

describe('2.0.76: the hall of fame by the committee’s vote', () => {
  it('votes on retired players from the winter after: a great career in, a lesser one stays, a record costs votes', () => {
    const s = load();
    const year = s.year + 1;
    const club = s.teams.find((t) => t.id !== s.user!.teamId && s.rosters[t.id])!.id;
    const [great, good, doper, fixer, weak] = retirees(s, club, 5) as [Player, Player, Player, Player, Player];
    career(great, club, 15, 4.8, year - 1); // WAR 72
    career(good, club, 15, 3.4, year - 1); // WAR 51
    career(doper, club, 15, 4.8, year - 1);
    (doper.life ??= {}).offenses = { doping: 2 };
    career(fixer, club, 15, 4.8, year - 1);
    (fixer.life ??= {}).offenses = { fixing: 1 };
    career(weak, club, 10, 1, year - 1); // WAR 10: not a candidate
    // Retiring no longer puts anyone in the hall.
    const hall = s.hallOfFame?.length ?? 0;
    expect(ballotWinter(s, great, year - 1)).toBe(0);
    expect(ballotWinter(s, great, year)).toBe(1);
    expect(ballotWinter(s, fixer, year)).toBe(0);
    expect(ballotWinter(s, weak, year)).toBe(0);
    expect(conductWeight(doper)).toBe(60);
    hallVote(s, year);
    // (The save's own retired players are on the ballot too.)
    const voted = s.hallOfFame!.slice(hall);
    expect(voted.map((h) => h.id)).toContain(great.id);
    expect(voted.map((h) => h.id)).not.toContain(doper.id);
    for (const h of voted) expect(h.vote).toBeGreaterThanOrEqual(HALL_VOTE.in);
    const v = s.hallVotes!.at(-1)!;
    expect(v.year).toBe(year);
    expect(v.rows.find((r) => r.id === good.id)!.result).toBe('stay');
    const d = v.rows.find((r) => r.id === doper.id)!;
    expect(d.result).not.toBe('in');
    expect(d.conduct).toBe(60);
    expect(v.rows.some((r) => r.id === fixer.id || r.id === weak.id)).toBe(false);
    expect(s.news?.some((n) => n.id === `hall-vote-${year}`)).toBe(true);
    // A winter later: the one voted in is off the ballot; the other is in his second winter, with a little more.
    expect(ballotWinter(s, great, year + 1)).toBe(0);
    hallVote(s, year + 1);
    const again = lastVote(s, good.id)!;
    expect(again.year).toBe(year + 1);
    expect(again.on).toBe(2);
    // Ten winters without: off the ballot for good.
    for (let y = year + 2; y <= year + HALL_VOTE.years; y++) hallVote(s, y);
    expect(s.hallOfFame!.some((h) => h.id === good.id) || s.hallDropped!.includes(good.id)).toBe(true);
    expect(ballotWinter(s, good, year + HALL_VOTE.years + 1)).toBe(0);
  });

  it('puts no one in the hall on retirement', () => {
    const s = load();
    const club = s.teams.find((t) => t.id !== s.user!.teamId && s.rosters[t.id])!.id;
    const p = Object.values(s.players).find((x) => x.teamId === club && x.status === 'active' && !isForeign(x) && !isPitcher(x) && !x.twoWay)!;
    career(p, club, 16, 5, s.year);
    const hall = s.hallOfFame?.length ?? 0;
    leaveLeague(s, p, 'retired');
    expect(s.hallOfFame?.length ?? 0).toBe(hall);
    expect(ballotWinter(s, p, s.year + 1)).toBe(1);
  });
});

describe('2.0.76: retired numbers by deliberation', () => {
  const great = (s: LeagueState, teamId: string, n: number) => {
    const p = Object.values(s.players).find((x) => x.teamId === teamId && x.status === 'active' && !isForeign(x) && !isPitcher(x) && !x.twoWay && x.number != null && x.number < 100 && x.numberTeam === teamId)!;
    p.number = n;
    career(p, teamId, 13, 5, s.year);
    delete p.life?.offenses;
    return p;
  };

  it('another club’s board retires a clean great’s number, and holds back one with a heavy record', () => {
    const s = load();
    const team = s.teams.find((t) => t.id !== s.user!.teamId && s.rosters[t.id])!;
    team.retiredNumbers = [];
    const a = great(s, team.id, 98);
    maybeRetireNumber(s, a, team.id, s.year);
    expect(team.retiredNumbers.map((x) => x.number)).toEqual([98]);
    expect(s.news?.some((n) => n.id === `retire-number-${a.id}`)).toBe(true);
    team.retiredNumbers = [];
    const b = great(s, team.id, 97);
    (b.life ??= {}).offenses = { dui: 2 };
    maybeRetireNumber(s, b, team.id, s.year);
    expect(team.retiredNumbers).toEqual([]);
  });

  it('leaves ours to the general manager, with the board’s opinion', () => {
    const s = load();
    const me = s.user!.teamId;
    const team = s.teams.find((t) => t.id === me)!;
    team.retiredNumbers = [];
    const p = great(s, me, 96);
    maybeRetireNumber(s, p, me, s.year);
    expect(team.retiredNumbers).toEqual([]);
    expect(s.alerts?.some((a) => a.id === `retire-number-${p.id}`)).toBe(true);
    leaveLeague(s, p, 'retired');
    const c = retireCandidates(s).find((x) => x.id === p.id)!;
    expect(c.board).toBe('for');
    expect(c.verdict).toBe('worthy');
    (p.life ??= {}).offenses = { doping: 1 };
    const d = retireCandidates(s).find((x) => x.id === p.id)!;
    expect(d.board).toBe('against');
    expect(d.conduct).toBe(30);
    expect(d.merit).toBeLessThan(c.merit);
  });
});
