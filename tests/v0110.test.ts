/* V0.11: user feedback. Fewer Tommy John operations and hardly any repeats, stars who do not retire out of the blue
   (and our players who can be talked into another season), foreign stars and foreign hitters who play every
   position, a main position with up to three others, and pop-ups for every article about our club. */
import { beforeAll, describe, expect, it } from 'vitest';
import { rng } from '../src/draftroom';
import { apply } from '../src/league/actions';
import { addAlert } from '../src/league/alerts';
import { autoDecision, EXPANSION_ID } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { injuryWeight, INJURY_TYPES } from '../src/league/injuries';
import { addNews } from '../src/league/news';
import { persuadeChance, retirementChance } from '../src/league/offseason';
import { isPitcher, makeForeign } from '../src/league/players';
import { fitPenalty, learnPositions, migrateAlt, secondaryPositions } from '../src/league/positions';
import { orgPlayers, type LeagueState } from '../src/league/state';
import { INJURY } from '../src/league/tuning';
import { resolveAnnual } from '../src/league/userclub';
import { altPositions, type Position } from '../src/model/position';
import type { Player } from '../src/model/types';
import { migrateState } from '../src/save/migrate';
import { endRegular } from './helpers';

let s: LeagueState;
let retireSeen: { id: string; chance: number }[] = [];
let talked: string | null = null;
let left: string | null = null;

const at = (p: Player, age: number, season: number) => (p.birthday = `${season - age}-01-15`);
const pending = () => s.pending as LeagueState['pending'];

beforeAll(() => {
  s = createLeague('v0110-test');
  apply(s, { kind: 'toFounding' });
  apply(s, {
    kind: 'found',
    settings: { name: '울산 고래단', short: '고래', color: '#1f6fb2', cityId: 'ulsan', parentType: 'conglomerate', parentName: '가상', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null },
  });
  while (pending()) apply(s, { kind: 'decide', input: autoDecision(s)! });
  endRegular(s);
  apply(s, { kind: 'postseason' });
  // Two of our veterans want to retire this winter: one is talked round, the other goes.
  const next = s.year + 1;
  const vets = orgPlayers(s, EXPANSION_ID)
    .filter((p) => p.status === 'active' && p.origin.kind !== 'foreign')
    .slice(0, 2);
  for (const p of vets) {
    at(p, 41, next);
    // Faded too, and the scouts' report says so (the retirement roll reads the report; with a good one a 41-year-old
    // could still want to play on).
    for (const k of Object.keys(p.hidden.current) as (keyof typeof p.hidden.current)[]) p.hidden.current[k] = 30;
    p.scouting.current = 30;
  }
  [talked, left] = [vets[0]!.id, vets[1]!.id];
  apply(s, { kind: 'nextSeason' });
  while (pending()) {
    const d = pending()!;
    if (d.kind === 'retire') {
      retireSeen = d.rows.map((r) => ({ ...r }));
      for (const r of d.rows) r.chance = r.id === talked ? 1 : r.chance;
      apply(s, { kind: 'decide', input: { kind: 'retire', ids: [talked!] } });
    } else apply(s, { kind: 'decide', input: autoDecision(s)! });
  }
}, 900_000);

describe('Tommy John', () => {
  const tj = INJURY_TYPES.pitcher.find((t) => /토미존/.test(t.part))!;
  const arm = (dates: string[]) => ({ injuries: dates.map((date) => ({ date, days: 400, part: tj.part, surgery: 'major' as const })) }) as unknown as Player;

  it('is rarer than before and seldom repeats', () => {
    expect(tj.weight).toBeLessThanOrEqual(2.5);
    const R = INJURY.repeat;
    expect(injuryWeight(arm([]), tj, '2030-05-01')).toBe(tj.weight);
    expect(injuryWeight(arm(['2029-06-01']), tj, '2030-05-01')).toBeCloseTo(tj.weight * R.soon);
    expect(injuryWeight(arm(['2026-06-01']), tj, '2030-05-01')).toBeCloseTo(tj.weight * R.later);
    expect(injuryWeight(arm(['2020-06-01', '2026-06-01']), tj, '2030-05-01')).toBeCloseTo(tj.weight * R.later * R.again);
    // Other injuries are not affected by an old operation.
    const other = INJURY_TYPES.pitcher.find((t) => !t.surgery)!;
    expect(injuryWeight(arm(['2029-06-01']), other, '2030-05-01')).toBe(other.weight);
  });

  it('a league season has a handful, not one per club', () => {
    const year = s.year - 1;
    const ops = Object.values(s.players).flatMap((p) => (p.injuries ?? []).filter((i) => /토미존/.test(i.part) && i.date.startsWith(String(year))));
    expect(ops.length).toBeLessThanOrEqual(12);
  });
});

describe('retirement', () => {
  // A 보통 grower: since 1.6.0 the extreme growth types retire years earlier or later.
  const someone = () => {
    const p = structuredClone(Object.values(s.players).find((x) => x.status === 'active' && x.origin.kind !== 'foreign' && !isPitcher(x))!);
    p.hidden.traits = { ...p.hidden.traits!, growth: 'normal' };
    return p;
  };

  it('a star in his mid-thirties keeps playing; a fading veteran goes', () => {
    const p = someone();
    at(p, 34, 2030);
    p.scouting.current = 65;
    p.career = [{ ...p.career[0]!, year: 2029, level: undefined, days: 180, war: 5 } as Player['career'][number]];
    expect(retirementChance(p, 2030)).toBeLessThan(0.01);
    p.scouting.current = 40;
    p.career[0]!.war = 0.1;
    at(p, 38, 2030);
    expect(retirementChance(p, 2030)).toBeGreaterThan(0.5);
    at(p, 31, 2030);
    expect(retirementChance(p, 2030)).toBe(0);
  });

  it('younger and better players are easier to talk round', () => {
    const p = someone();
    at(p, 34, 2030);
    p.scouting.current = 65;
    const easy = persuadeChance(p, 2030);
    at(p, 40, 2030);
    p.scouting.current = 45;
    const hard = persuadeChance(p, 2030);
    expect(easy).toBeGreaterThan(0.85);
    expect(hard).toBeLessThan(0.4);
    expect(hard).toBeGreaterThanOrEqual(0.1);
  });

  it('our players who want to retire come to the general manager, and his word can keep one', () => {
    expect(retireSeen.map((r) => r.id)).toEqual(expect.arrayContaining([talked, left]));
    expect(s.players[talked!]!.status).toBe('active');
    expect(s.players[left!]?.status ?? 'retired').toBe('retired');
    const alert = s.alerts!.find((a) => a.kind === 'retire');
    expect(alert).toBeDefined();
    expect(alert!.lines.join(' ')).toContain('한 시즌 더');
    expect(s.user!.log!.some((l) => l.text.includes('설득 성공'))).toBe(true);
  });
});

describe('foreign players', () => {
  const hitters = Array.from({ length: 400 }, (_, i) => makeForeign('v0110', `fh${i}`, 2030, { kind: 'hitter', asiaQuota: false }));
  const pitchers = Array.from({ length: 400 }, (_, i) => makeForeign('v0110', `fp${i}`, 2030, { kind: 'pitcher', asiaQuota: false }));

  it('hitters play every position but catcher, the glove fitting the spot', () => {
    const by = (pos: string) => hitters.filter((p) => p.position === pos);
    for (const pos of ['1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']) expect(by(pos).length).toBeGreaterThan(8);
    expect(by('1B').length / hitters.length).toBeLessThan(0.35);
    const def = (xs: Player[]) => xs.reduce((a, p) => a + (p.hidden.current.defense ?? 0), 0) / xs.length;
    expect(def(by('CF'))).toBeGreaterThan(def(by('1B')) + 8);
    expect(def(by('SS'))).toBeGreaterThan(def(by('LF')) + 6);
    expect(hitters.filter((p) => ['2B', '3B', 'SS'].includes(p.position!) && p.throws === '좌')).toHaveLength(0);
  });

  it('now and then a star reaches 70', () => {
    const top = [...hitters, ...pitchers].filter((p) => p.scouting.current >= 70).length;
    expect(top).toBeGreaterThan(5);
    expect(top).toBeLessThan(120);
  });
});

describe('positions', () => {
  const tools = { contact: 50, power: 50, speed: 55, defense: 55, eye: 50 };

  it('most hitters list one or two other positions, few are utility men', () => {
    const counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < 2000; i++) counts[altPositions((['SS', 'CF', 'LF', '1B', '3B', '2B', 'RF'] as Position[])[i % 7]!, tools, rng(`alt-${i}`)).length]!++;
    expect(counts[4]).toBe(0);
    expect(counts[3]! / 2000).toBeLessThan(0.15);
    expect((counts[1]! + counts[2]!) / 2000).toBeGreaterThan(0.6);
    const ss = new Set(Array.from({ length: 300 }, (_, i) => altPositions('SS', tools, rng(`ss-${i}`))).flat());
    expect(ss.has('C')).toBe(false);
    expect(ss.has('2B') && ss.has('3B')).toBe(true);
    const catchers = Array.from({ length: 300 }, (_, i) => altPositions('C', tools, rng(`c-${i}`)));
    expect(catchers.filter((x) => x.length === 0).length).toBeGreaterThan(150);
  });

  it('a listed position costs half the gap, anywhere else the gap and more', () => {
    const p = { position: 'SS', alt: ['2B'], career: [] } as unknown as Player;
    expect(fitPenalty(p, 'SS', {})).toBe(0);
    expect(fitPenalty(p, '2B', {})).toBe(1);
    expect(fitPenalty(p, '3B', {})).toBe(8);
    expect(fitPenalty(p, '3B', { '3B': 30 })).toBe(1);
    expect(fitPenalty(p, 'DH', {})).toBe(0);
  });

  it('a season at a new spot adds it to his list, up to three', () => {
    const p = { position: 'LF', alt: ['RF'], career: [] } as unknown as Player;
    learnPositions(p, { '1B': 45, CF: 12, DH: 60 });
    expect(p.alt).toEqual(['RF', '1B']);
    learnPositions(p, { CF: 50, '3B': 50 });
    expect(p.alt).toHaveLength(3);
  });

  it('every hitter in the league has his list; an older save gets one', () => {
    const hitters = Object.values(s.players).filter((p) => p.status === 'active' && p.position);
    expect(hitters.every((p) => Array.isArray(p.alt) && p.alt.length <= 3 && !p.alt.includes(p.position!))).toBe(true);
    expect(hitters.filter((p) => secondaryPositions(s, p).length > 3).length / hitters.length).toBeLessThan(0.05);
    const old = { position: 'SS', career: [{ year: 2020, bat: { posG: { '3B': 40, '2B': 10 } } }] } as unknown as Player;
    migrateAlt(old, ['1B', '2B']);
    expect(old.alt).toEqual(['3B', '1B', '2B']);
  });

  it('a save from 0.8.0 carries over with the lists filled in', () => {
    const c = structuredClone(s);
    for (const p of Object.values(c.players)) delete p.alt;
    c.sim = '0.8.0';
    migrateState(c, '0.8.0');
    expect(Object.values(c.players).filter((p) => p.position).every((p) => Array.isArray(p.alt))).toBe(true);
  });

  it('a spring move keeps the old spot, and a listed one needs no season to adapt', () => {
    const c = structuredClone(s);
    c.offseason ??= { year: c.year - 1, step: 0, draft: null, released: [], done: [] };
    const p = orgPlayers(c, EXPANSION_ID).find((x) => x.position && x.position !== 'C' && (x.alt ?? []).length > 0 && x.alt!.length < 3)!;
    const from = p.position!;
    const to = p.alt![0]!;
    resolveAnnual(c, { kind: 'camp', players: [p.id] }, { kind: 'camp', plans: { [p.id]: { position: to } } });
    expect(p.position).toBe(to);
    expect(p.alt).toContain(from);
    expect(p.plan?.adaptingIn).toBeUndefined();
  });
});

describe('pop-ups for our news', () => {
  it('every article about our club becomes a minor alert; the full alert replaces it', () => {
    const c = structuredClone(s);
    const p = orgPlayers(c, EXPANSION_ID)[0]!;
    addNews(c, { id: 'test-move', date: '2027-05-01', kind: 'move', title: '고래, 트레이드', body: '첫 줄\n둘째 줄', quotes: [], facts: {}, players: [p.id], mine: true });
    addNews(c, { id: 'test-other', date: '2027-05-01', kind: 'move', title: '다른 구단 트레이드', body: '', quotes: [], facts: {}, players: [], mine: false });
    addNews(c, { id: `iv-${p.id}-2027-05-01`, date: '2027-05-01', kind: 'interview', title: '[인터뷰]', body: '', quotes: [], facts: {}, players: [p.id], mine: true });
    const ids = c.alerts!.map((a) => a.id);
    expect(ids).toContain('test-move');
    expect(ids).not.toContain('test-other');
    expect(ids).not.toContain(`iv-${p.id}-2027-05-01`);
    expect(c.alerts!.find((a) => a.id === 'test-move')).toMatchObject({ kind: 'move', minor: true, lines: ['첫 줄', '둘째 줄'] });
    addNews(c, { id: 'injury-x', date: '2027-05-02', kind: 'injury', title: '부상', body: '기사', quotes: [], facts: {}, players: [p.id], mine: true });
    addAlert(c, { id: 'injury-x', date: '2027-05-02', kind: 'injury', title: '수술', lines: ['큰 수술'], tone: 'bad' });
    const x = c.alerts!.filter((a) => a.id === 'injury-x');
    expect(x).toHaveLength(1);
    expect(x[0]!.minor).toBeUndefined();
    expect(x[0]!.title).toBe('수술');
  });

  it('a season brings our club its articles as alerts', () => {
    const kinds = new Set((s.alerts ?? []).filter((a) => a.minor).map((a) => a.kind));
    expect(kinds.has('game') || kinds.has('life') || kinds.has('injury')).toBe(true);
  });
});
