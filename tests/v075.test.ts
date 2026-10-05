/* V0.7.5: tutorial mode — the futures start with a guide from the founding to the first-team debut. */
import { beforeAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { autoDecision } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import type { LeagueState } from '../src/league/state';
import { nextLesson, tutorialPaused } from '../src/ui/tutorial';

let s: LeagueState;
const read = () => {
  const l = nextLesson(s, { tab: 'standings' });
  if (l) apply(s, { kind: 'tutorial', seen: l.id });
  return l?.id ?? null;
};

beforeAll(() => {
  s = createLeague('v075-test');
  apply(s, { kind: 'toFounding' });
  apply(s, {
    kind: 'found',
    settings: { name: '울산 고래단', short: '고래', color: '#1f6fb2', cityId: 'ulsan', parentType: 'conglomerate', parentName: '가상', stadium: 'existing', promotion: 'afterFutures', difficulty: 'normal', scenario: null, tutorial: true },
  });
}, 240_000);

describe('tutorial mode', () => {
  it('walks through the founding: welcome, decisions, grades, then the tryout tip', () => {
    expect(s.pending?.kind).toBe('tryout');
    expect([read(), read(), read(), read()]).toEqual(['welcome', 'decisions', 'grades', 'decision-tryout']);
    expect(read()).toBeNull(); // nothing else until the next moment
    // A screen opened for the first time has its own lesson.
    expect(nextLesson(s, { tab: 'market' })?.id).toBe('tab-market');
  });

  it('tells about the rest of the founding year once the tryout is done', () => {
    apply(s, { kind: 'decide', input: autoDecision(s)! });
    expect(s.pending).toBeFalsy();
    expect(read()).toBe('foundingSeason');
  });

  it('can be turned off and back on, and saves its progress with the club', () => {
    apply(s, { kind: 'tutorial', off: true });
    expect(nextLesson(s, { tab: 'club' })).toBeNull();
    expect(tutorialPaused(s)).toBe(true);
    apply(s, { kind: 'tutorial', on: true });
    expect(nextLesson(s, { tab: 'club' })?.id).toBe('tab-club');
    expect(s.user!.tutorialSeen).toContain('welcome');
  });

  it('explains the parts of the club screen as they are opened (V0.16)', () => {
    apply(s, { kind: 'tutorial', seen: 'tab-club' });
    for (const view of ['squad', 'lineup', 'training', 'office']) expect(nextLesson(s, { tab: 'club', view })?.id).toBe(`club-${view}`);
    expect(nextLesson(s, { tab: 'club', view: 'overview' })).toBeNull();
  });

  it('stays out of a game without tutorial mode', () => {
    const plain = structuredClone(s);
    delete plain.user!.settings.tutorial;
    expect(nextLesson(plain, { tab: 'club' })).toBeNull();
  });
});
