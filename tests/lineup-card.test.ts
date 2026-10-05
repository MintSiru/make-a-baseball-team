/* V0.8: the general manager's lineup card. Fixed spots and positions, the manager filling the rest, the
   rotation order, what happens when a fixed player cannot play, and the checks. */
import { beforeAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { checkLineupCard } from '../src/league/entry';
import { autoDecision, EXPANSION_ID } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { lineupFor, managerLean, matchInputs, rotationFor } from '../src/league/manager';
import { isPitcher } from '../src/league/players';
import type { LeagueState, LineupCard } from '../src/league/state';
import { lineupView } from '../src/league/views';
import { endRegular } from './helpers';

let s: LeagueState;
const pending = () => s.pending as LeagueState['pending'];

beforeAll(() => {
  s = createLeague('card-test');
  apply(s, { kind: 'toFounding' });
  apply(s, {
    kind: 'found',
    settings: { name: '울산 고래단', short: '고래', color: '#1f6fb2', cityId: 'ulsan', parentType: 'conglomerate', parentName: '가상', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null },
  });
  while (pending()) apply(s, { kind: 'decide', input: autoDecision(s)! });
  endRegular(s);
  apply(s, { kind: 'postseason' });
  apply(s, { kind: 'nextSeason' });
  while (pending()) apply(s, { kind: 'decide', input: autoDecision(s)! });
}, 480_000);

const active = () => s.rosters[EXPANSION_ID]!.active.map((id) => s.players[id]!);
const hitters = () => active().filter((p) => !isPitcher(p));
const empty = (): LineupCard => ({ R: Array(9).fill(null), L: Array(9).fill(null), rotation: [], rest: true });
const usual = (card?: LineupCard) => {
  const { prefer, style } = managerLean(s, EXPANSION_ID);
  return lineupFor(s, s.rosters[EXPANSION_ID]!.active, prefer, false, 'R', { style, ...(card ? { card: card.R, cardRest: card.rest } : {}) });
};

describe('the lineup card', () => {
  it('puts fixed players where the general manager says and lets the manager fill the rest', () => {
    const before = usual();
    // The worst hitter on the first team leads off as the designated hitter; the best bats ninth at first base.
    const worst = hitters().sort((a, b) => a.scouting.current - b.scouting.current)[0]!;
    const best = before[0]!.id === worst.id ? before[1]! : before.find((b) => b.id !== worst.id)!;
    const card = empty();
    card.R[0] = { id: worst.id, pos: 'DH' };
    card.R[8] = { id: best.id, pos: '1B' };
    const after = usual(card);
    expect(after).toHaveLength(9);
    expect(after[0]).toMatchObject({ id: worst.id, pos: 'DH' });
    expect(after[8]).toMatchObject({ id: best.id, pos: '1B' });
    expect(new Set(after.map((b) => b.pos)).size).toBe(9);
    expect(new Set(after.map((b) => b.id)).size).toBe(9);
  });

  it('a fixed player who cannot play today is replaced by the manager', () => {
    const card = empty();
    const p = hitters()[0]!;
    card.R[2] = { id: p.id, pos: 'CF' };
    const x = structuredClone(s);
    x.injuries[p.id] = { until: `${x.year}-12-31`, onList: true, part: '햄스트링', days: 30 } as LeagueState['injuries'][string];
    const { prefer, style } = managerLean(x, EXPANSION_ID);
    const lineup = lineupFor(x, x.rosters[EXPANSION_ID]!.active, prefer, false, 'R', { style, card: card.R });
    expect(lineup.map((b) => b.id)).not.toContain(p.id);
    expect(lineup).toHaveLength(9);
  });

  it('sets the rotation order, the manager filling it to five', () => {
    const arms = active().filter(isPitcher);
    const reliever = arms.find((p) => p.role === 'RP')!;
    const { prefer } = managerLean(s, EXPANSION_ID);
    const rotation = rotationFor(s, s.rosters[EXPANSION_ID]!.active, prefer, [reliever.id]);
    expect(rotation[0]!.id).toBe(reliever.id);
    expect(rotation).toHaveLength(5);
  });

  it('is what the club plays in its games, and what the lineup screen shows', () => {
    const card = empty();
    const [a, b] = hitters();
    card.R[0] = { id: a!.id, pos: 'DH' };
    card.L[0] = { id: a!.id, pos: 'DH' };
    card.R[1] = { id: b!.id, pos: 'LF' };
    card.L[1] = { id: b!.id, pos: 'LF' };
    apply(s, { kind: 'lineupCard', card });
    expect(s.user!.lineup?.R[0]).toEqual({ id: a!.id, pos: 'DH' });
    const game = s.schedule.slice(s.next).find((g) => g.home === EXPANSION_ID || g.away === EXPANSION_ID)!;
    const other = game.home === EXPANSION_ID ? game.away : game.home;
    const inputs = matchInputs(s, game.date, { teamId: EXPANSION_ID }, { teamId: other });
    const mine = inputs.home!.teamId === EXPANSION_ID ? inputs.home! : inputs.away!;
    const ids = mine.lineup.map((x) => x.id);
    // The card holds unless a fixed player has his day off today (the manager's rest, kept by default).
    if (ids.includes(a!.id)) expect(mine.lineup[0]).toMatchObject({ id: a!.id, pos: 'DH' });
    const view = lineupView(s, EXPANSION_ID, 'R')!;
    expect(view.lineup[0]).toMatchObject({ id: a!.id, fixed: true });
    // Back to the manager.
    apply(s, { kind: 'lineupCard', card: null });
    expect(s.user!.lineup).toBeUndefined();
  });

  it('refuses another club’s player, a pitcher, the same player or position twice, and six starters', () => {
    const other = Object.values(s.players).find((p) => p.teamId && p.teamId !== EXPANSION_ID && !isPitcher(p))!;
    const pitcher = active().find((p) => isPitcher(p) && !p.twoWay)!;
    const [a, b] = hitters();
    const with0 = (slot: LineupCard['R'][number], slot1: LineupCard['R'][number] = null) => {
      const c = empty();
      c.R[0] = slot;
      c.R[1] = slot1;
      return c;
    };
    expect(checkLineupCard(s, with0({ id: other.id, pos: 'LF' }))).toMatch(/우리 선수/);
    expect(checkLineupCard(s, with0({ id: pitcher.id, pos: 'DH' }))).toMatch(/투수/);
    expect(checkLineupCard(s, with0({ id: a!.id, pos: 'LF' }, { id: a!.id, pos: 'RF' }))).toMatch(/두 번/);
    expect(checkLineupCard(s, with0({ id: a!.id, pos: 'LF' }, { id: b!.id, pos: 'LF' }))).toMatch(/두 명/);
    const six = active().filter(isPitcher).slice(0, 6).map((p) => p.id);
    expect(checkLineupCard(s, { ...empty(), rotation: six })).toMatch(/5명/);
    expect(checkLineupCard(s, with0({ id: a!.id, pos: 'C' }, { id: b!.id, pos: 'SS' }))).toBeNull();
  });
});
