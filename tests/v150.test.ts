/* 1.5.0: the general manager's briefing, the scouts' reasons, and the start time apart from the guide (with the
   decisions before the debut handed to the scouts). */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { apply, regularOver } from '../src/league/actions';
import { adviceFor } from '../src/league/advice';
import { briefing } from '../src/league/briefing';
import { autoDecision, checkDecision } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { isPitcher } from '../src/league/players';
import type { ExpansionSettings, LeagueState } from '../src/league/state';
import { parseSave } from '../src/save/format';
import { nextLesson } from '../src/ui/tutorial';

const clone = (s: LeagueState) => JSON.parse(JSON.stringify(s)) as LeagueState;

describe("the general manager's briefing", () => {
  let s: LeagueState;
  beforeAll(() => {
    s = parseSave(gunzipSync(readFileSync(new URL('./fixtures/save-1.3.0.json.gz', import.meta.url))).toString('utf8')).snapshot!.state as LeagueState;
  });

  it('brings up at most three things, the most pressing first, each with a way to act on it', () => {
    const items = briefing(s);
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < items.length; i++) expect(items[i - 1]!.weight).toBeGreaterThanOrEqual(items[i]!.weight);
    for (const x of items) {
      expect(x.facts.length).toBeGreaterThan(0);
      expect(x.options.length).toBeGreaterThan(0);
    }
    // This club plays with two foreign places open: that comes up.
    expect(items.some((x) => x.id === 'foreign-open')).toBe(true);
  });

  it('a regular out for weeks comes first, with who plays his spot now', () => {
    const a = clone(s);
    const me = a.user!.teamId;
    const star = a.rosters[me]!.active.map((id) => a.players[id]!).filter((p) => !isPitcher(p)).sort((x, y) => y.scouting.current - x.scouting.current)[0]!;
    const date = a.schedule[a.next]!.date;
    a.injuries[star.id] = { until: `${a.year}-07-15`, days: 80, onList: true, part: '햄스트링' };
    const items = briefing(a);
    expect(items[0]!.id).toBe(`injury-${star.id}`);
    expect(items[0]!.facts.join(' ')).toContain('햄스트링');
    expect(items[0]!.options.some((o) => o.go.tab === 'market')).toBe(true);
    expect(date < `${a.year}-07-15`).toBe(true);
  });

  it('a payroll over the budget is flagged with where money can be found', () => {
    const a = clone(s);
    a.user!.payrollBudget = 1_000;
    const item = briefing(a).find((x) => x.id === 'payroll-over');
    expect(item).toBeTruthy();
    expect(item!.options.map((o) => o.go)).toContainEqual({ tab: 'market', view: 'release' });
  });

  it('reads only what the club can see: grades are the public ones', () => {
    const a = clone(s);
    // Hiding the truth changes nothing the briefing says.
    const before = JSON.stringify(briefing(a));
    for (const p of Object.values(a.players)) {
      p.hidden.current = Object.fromEntries(Object.keys(p.hidden.current).map((k) => [k, 20]));
      p.hidden.potential = Object.fromEntries(Object.keys(p.hidden.potential).map((k) => [k, 20]));
    }
    expect(JSON.stringify(briefing(a))).toBe(before);
  });
});

describe('straight to the first team, with the guide, the decisions before the debut handed to the scouts', () => {
  let s: LeagueState;
  const settings: ExpansionSettings = {
    name: '검증 고래',
    short: '검증',
    color: '#1f6fb2',
    cityId: 'ulsan',
    parentType: 'conglomerate',
    parentName: '검증그룹',
    stadium: 'existing',
    promotion: 'immediate',
    difficulty: 'normal',
    scenario: null,
    tutorial: true,
    autoPrep: true,
  };
  beforeAll(() => {
    s = apply(apply(createLeague('v150-prep'), { kind: 'toFounding' }), { kind: 'found', settings });
  }, 300_000);

  it('the guide speaks of a 2027 debut and never of a futures year', () => {
    const lesson = nextLesson(s, { tab: 'decision' } as never)!;
    expect(lesson.id).toBe('welcome');
    expect(lesson.body.join(' ')).toContain('2027년 1군 데뷔');
    expect(lesson.body.join(' ')).not.toContain('퓨처스리그 1년');
  });

  it('every decision to the debut has a valid recommendation with its reasons', () => {
    let a = s;
    const kinds = new Set<string>();
    const unexplained = new Set<string>();
    for (let guard = 0; guard < 400; guard++) {
      if (a.year >= a.user!.firstTeamYear && a.phase === 'regular' && !a.pending) break;
      if (a.pending) {
        const input = autoDecision(a);
        expect(input, a.pending.kind).toBeTruthy();
        expect(checkDecision(a, input!), a.pending.kind).toBeNull();
        kinds.add(a.pending.kind);
        if (!adviceFor(a)) unexplained.add(a.pending.kind);
        a = apply(a, { kind: 'decide', input: input! });
        // The futures-year lessons never come up on this road.
        const lesson = nextLesson(a, { tab: 'club' } as never);
        expect(lesson?.id === 'futures' || lesson?.id === 'futuresMid').toBe(false);
      } else if (a.phase === 'regular' && !regularOver(a)) a = apply(a, { kind: 'days', days: 30 });
      else if (a.phase === 'regular' || (a.phase === 'postseason' && a.bracket && !a.bracket.done)) a = apply(a, { kind: 'postseason' });
      else a = apply(a, { kind: 'nextSeason' });
    }
    expect(a.year).toBe(2027);
    expect(a.phase).toBe('regular');
    expect(a.rosters[a.user!.teamId]!.active.length).toBeGreaterThanOrEqual(26);
    for (const k of ['tryout', 'specialDraft', 'foreign']) expect(kinds.has(k), k).toBe(true);
    // The draft picks are the scouts' own board and the FA market has its own screen; everything else explains itself.
    expect([...unexplained].filter((k) => k !== 'draftPick' && k !== 'faRound')).toEqual([]);
  }, 600_000);
});
