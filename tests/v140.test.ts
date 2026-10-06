/* 1.4.0: postseason records and the bracket, and retired players back as managers, coaches and front-office heads. */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { alumniDay, alumniFor, alumnusHired, alumnusJob, alumnusStaff, fameOf, legendFired, ownLegend, pickAlumnus } from '../src/league/alumni';
import { clubState } from '../src/league/fans';
import { createLeague } from '../src/league/history';
import { closeSeason } from '../src/league/offseason';
import { isPitcher } from '../src/league/players';
import { bracketView, champion, playPostseason, postseasonRound, postseasonStatus, startPostseason } from '../src/league/postseason';
import { postResult, postRows, postseasonBoards, postTotals } from '../src/league/poststats';
import { playRegularSeason } from '../src/league/season';
import { staffCandidates, staffSalary } from '../src/league/staff';
import type { LeagueState } from '../src/league/state';
import { ALUMNI } from '../src/league/tuning';
import { playerCard } from '../src/league/views';
import { parseSave } from '../src/save/format';

const loadSave = () => parseSave(gunzipSync(readFileSync(new URL('./fixtures/save-1.3.0.json.gz', import.meta.url))).toString('utf8')).snapshot!.state as LeagueState;
const clone = (s: LeagueState) => JSON.parse(JSON.stringify(s)) as LeagueState;

describe('postseason records and the bracket', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = createLeague('v140-post');
    playRegularSeason(s);
  }, 300_000);

  it('keeps postseason games in lines of their own, out of the season', () => {
    const a = clone(s);
    const before = JSON.stringify(a.lines);
    playPostseason(a);
    expect(JSON.stringify(a.lines)).toBe(before);
    const lines = Object.values(a.postLines ?? {});
    expect(lines.length).toBeGreaterThan(40);
    const games = a.postseason.reduce((n, x) => n + x.games.length, 0);
    const pa = lines.reduce((n, l) => n + (l.bat?.pa ?? 0), 0);
    // Two clubs a game, about 38 plate appearances each.
    expect(pa / games / 2).toBeGreaterThan(30);
    expect(pa / games / 2).toBeLessThan(50);
    const champ = champion(a)!;
    for (const [id, l] of Object.entries(a.postLines!)) if (l.teamId === champ) expect(a.players[id]!.teamId).toBe(champ);
  });

  it('files them with each player when the books close, with how far his club went', () => {
    const a = clone(s);
    playPostseason(a);
    const year = a.year;
    const champ = champion(a)!;
    const ks = a.postseason.find((x) => x.round === 'ks')!;
    const loser = ks.high === champ ? ks.low : ks.high;
    const wildcardLoser = a.postseason.find((x) => x.round === 'wildcard')!;
    const wcOut = wildcardLoser.winner === wildcardLoser.high ? wildcardLoser.low : wildcardLoser.high;
    closeSeason(a);
    expect(a.postLines).toBeUndefined();
    const filed = Object.values(a.players).filter((p) => p.post?.some((r) => r.year === year));
    expect(filed.length).toBeGreaterThan(40);
    expect(postResult(a, year, champ)).toBe('우승');
    expect(postResult(a, year, loser)).toBe('준우승');
    expect(postResult(a, year, wcOut)).toBe('와일드카드 탈락');
    const star = filed.find((p) => p.post!.at(-1)!.teamId === champ)!;
    const rows = postRows(a, star);
    expect(rows.at(-1)!.result).toBe('우승');
    expect(postTotals(rows).titles).toBe(rows.filter((r) => r.result === '우승').length);
    expect(postTotals(rows).titles).toBeGreaterThanOrEqual(1);
    // The season's totals stay as they were: his first-team line for the year has no postseason games in it.
    const season = star.career.find((c) => c.year === year && !c.level)!;
    expect(season).toBeTruthy();
    const b = postseasonBoards(a);
    expect(b.year).toBe(year);
    expect(b.latest.find((x) => x.label === '안타')!.rows.length).toBe(5);
    expect(b.ever.find((x) => x.label === '안타')!.rows[0]!.key).toBeGreaterThan(0);
  });

  it('draws the bracket: the round being played, who waits, and each game', () => {
    const a = clone(s);
    expect(bracketView(a)).toBeNull();
    startPostseason(a);
    let v = bracketView(a)!;
    expect(v.rounds.map((r) => r.round)).toEqual(['wildcard', 'semipo', 'po', 'ks']);
    expect(v.rounds.map((r) => r.state)).toEqual(['live', 'waiting', 'waiting', 'waiting']);
    expect(v.rounds[0]!.series[0]!.hw).toBe(1); // the 4th seed starts a win up
    expect(v.rounds[1]!.series[0]!.low.teamId).toBeNull();
    expect(v.rounds[1]!.series[0]!.low.label).toBe('와일드카드 승자');
    expect(v.rounds[3]!.series[0]!.high.label).toBe('1위');
    expect(postseasonStatus(a)).toContain('와일드카드 결정전 (1/4라운드)');
    postseasonRound(a);
    v = bracketView(a)!;
    const wc = v.rounds[0]!.series[0]!;
    expect(wc.state).toBe('done');
    expect(wc.games.length).toBe(a.postseason[0]!.games.length);
    expect(v.rounds[1]!.state).toBe('live');
    expect(v.rounds[1]!.series[0]!.low.teamId).toBe(wc.winner);
    expect(postseasonStatus(a)).toContain('(2/4라운드)');
    playPostseason(a);
    v = bracketView(a)!;
    expect(v.rounds.every((r) => r.state === 'done')).toBe(true);
    expect(v.champion).toBe(champion(a));
    expect(postseasonStatus(a)).toBeNull();
  });
});

describe('retired players back as staff', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = loadSave();
  });

  it('fame follows the career: a long, decorated one far above a season or two', () => {
    const retired = Object.values(s.players).filter((p) => p.status === 'retired' && p.career.some((c) => !c.level));
    const fames = retired.map((p) => ({ p, f: fameOf(s, p) })).sort((a, b) => b.f - a.f);
    expect(fames[0]!.f).toBeGreaterThanOrEqual(60);
    const short = fames.filter(({ p }) => p.career.filter((c) => !c.level).length <= 2 && !(p.honors ?? []).length);
    expect(short.length).toBeGreaterThan(20);
    expect(short.reduce((a, x) => a + x.f, 0) / short.length).toBeLessThan(15);
  });

  it('draws legends many times as often as fringe players, and only those who fit the post', () => {
    const pool = alumniFor(s, 'hitting', s.year);
    expect(pool.length).toBeGreaterThan(50);
    expect(pool.every((a) => !isPitcher(a.p))).toBe(true);
    expect(alumniFor(s, 'pitching', s.year).every((a) => isPitcher(a.p))).toBe(true);
    expect(alumniFor(s, 'medical', s.year)).toHaveLength(0);
    const picks = new Map<string, number>();
    let none = 0;
    for (let i = 0; i < 1500; i++) {
      const a = pickAlumnus(s, 'hitting', `probe-${i}`, s.year, null);
      if (!a) none++;
      else picks.set(a.p.id, (picks.get(a.p.id) ?? 0) + 1);
    }
    // Strangers are still hired often, and never more than the cap lets former players take.
    expect(none / 1500).toBeGreaterThan(1 - ALUMNI.maxShare - 0.05);
    const rate = (lo: number, hi: number) => {
      const group = pool.filter((a) => a.fame >= lo && a.fame < hi);
      return group.reduce((n, a) => n + (picks.get(a.p.id) ?? 0), 0) / Math.max(1, group.length);
    };
    expect(rate(40, 101)).toBeGreaterThan(rate(0, 10) * 10);
  });

  it('a former player coaches by his work ethic and mind, and asks more for his name', () => {
    const legend = alumniFor(s, 'manager', s.year).sort((a, b) => b.fame - a.fame)[0]!;
    const p = legend.p;
    const saved = { ...p.hidden.traits! };
    const avg = (lead: number) => {
      p.hidden.traits = { ...saved, leadership: lead, mental: lead, work: lead };
      let sum = 0;
      for (let i = 0; i < 60; i++) sum += alumnusStaff(s, legend, 'manager', `rate-${i}`, s.year, 0, staffSalary).rating;
      return sum / 60;
    };
    expect(avg(85) - avg(20)).toBeGreaterThan(15);
    p.hidden.traits = saved;
    const m = alumnusStaff(s, legend, 'manager', 'pay', s.year, 0, staffSalary);
    expect(m.playerId).toBe(p.id);
    expect(m.name).toBe(p.name);
    expect(m.style).toBeTruthy();
    expect(m.salary).toBeGreaterThan(staffSalary('manager', m.rating));
  });

  it("puts a club's own legend among its candidates, once across the posts", () => {
    const a = clone(s);
    // An established club with a legend free to hire.
    const club = a.teams.map((t) => t.id).find((id) => ownLegend(a, 'manager', id, a.year))!;
    expect(club).toBeTruthy();
    const legend = ownLegend(a, 'manager', club, a.year)!;
    a.user!.teamId = club;
    const taken = new Set<string>();
    const managers = staffCandidates(a, 'manager', a.year, taken);
    expect(managers.some((c) => c.playerId === legend.p.id)).toBe(true);
    expect(managers.length).toBeGreaterThan(3);
    const farm = staffCandidates(a, 'farm', a.year, taken);
    expect(farm.some((c) => c.playerId === legend.p.id)).toBe(false);
  });

  it('bringing a legend home lifts the fans; letting him go stings', () => {
    const a = clone(s);
    const u = a.user!;
    const legend = alumniFor(a, 'manager', a.year).sort((x, y) => y.fame - x.fame)[0]!;
    const m = { ...alumnusStaff(a, legend, 'manager', 'home', a.year, 0, staffSalary), club: u.teamId, fame: 90 };
    const c = clubState(a, u.teamId);
    const before = c.interest;
    alumnusHired(a, u.teamId, m, `${a.year}-11-20`);
    expect(c.interest).toBeCloseTo(before + ALUMNI.homecoming, 5);
    expect(a.news!.at(-1)!.title).toContain('친정');
    expect(a.alerts!.some((x) => x.id.startsWith('alumni-hire-'))).toBe(true);
    legendFired(a, u.teamId, m, `${a.year}-11-21`);
    expect(c.interest).toBeLessThan(before + ALUMNI.homecoming);
    expect(a.news!.at(-1)!.title).toContain('결별');
    // Hired by us, he shows on his player page as working for us.
    clubState(a, u.teamId).staff!.manager = m;
    expect(alumnusJob(a, legend.p.id)).toContain('감독');
    expect(playerCard(a, legend.p.id)!.status).toContain('현재');
  });

  it("our former-player manager's days: an old teammate, his old club, a lesson, a player passing his mark", () => {
    const a = clone(s);
    const u = a.user!;
    const me = u.teamId;
    const active = a.rosters[me]!.active.map((id) => a.players[id]!);
    // A retired hitter who played alongside one of ours.
    const pool = alumniFor(a, 'manager', a.year).filter((x) => !isPitcher(x.p));
    const pair = pool
      .map((x) => ({ x, mate: active.find((p) => p.career.some((c) => !c.level && x.p.career.some((d) => !d.level && d.year === c.year && d.teamId === c.teamId))) }))
      .find((y) => y.mate);
    expect(pair).toBeTruthy();
    const next = a.schedule.slice(a.next).find((g) => g.home === me || g.away === me)!;
    const opp = next.home === me ? next.away : next.home;
    const boss = { ...alumnusStaff(a, pair!.x, 'manager', 'test', a.year, 0, staffSalary), club: opp };
    clubState(a, me).staff!.manager = boss;
    // One of our hitters goes past his home runs.
    const mark = pair!.x.p.career.filter((c) => !c.level).reduce((n, c) => n + (c.bat?.hr ?? 0), 0);
    const slugger = active.find((p) => !isPitcher(p) && p.id !== pair!.mate!.id && p.career.some((c) => !c.level && c.bat && c.bat.g > 0))!;
    slugger.career.find((c) => !c.level && c.bat && c.bat.g > 0)!.bat!.hr += Math.max(mark, 50) + 1;
    const own = pair!.x.p.career.find((c) => !c.level && c.bat && c.bat.g > 0)!;
    own.bat!.hr += Math.max(0, 50 - mark);
    alumniDay(a, next.date);
    const ids = (a.news ?? []).map((n) => n.id);
    expect(ids.some((id) => id.startsWith('alumni-reunion-'))).toBe(true);
    expect(ids.some((id) => id.startsWith('alumni-oldclub-'))).toBe(true);
    expect(ids.some((id) => id.startsWith(`alumni-mark-${slugger.id}`))).toBe(true);
    expect(pair!.mate!.life?.form?.why).toContain('옛 동료');
    // Once is enough: the same day again tells nothing new.
    const count = a.news!.length;
    alumniDay(a, next.date);
    expect(a.news!.length).toBe(count);
    // A season of days brings a few lessons, never more than the cap.
    apply(a, { kind: 'days', days: 60 });
    const lessons = (a.news ?? []).filter((n) => n.id.startsWith('alumni-lesson-') || n.id.startsWith('alumni-protest-'));
    expect(lessons.length).toBeLessThanOrEqual(ALUMNI.perSeason);
  }, 120_000);
});
