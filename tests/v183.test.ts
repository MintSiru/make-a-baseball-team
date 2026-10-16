/* 1.8.3: the 1.8 feedback — a special-draft pick can be taken back (ui), and a trade that takes players from a club
   already over the 68-man limit is no longer refused for that club's roster. */
import { describe, expect, it } from 'vitest';
import { checkTrade } from '../src/league/trade';
import { rosterLimit } from '../src/league/offseason';
import { registeredIds } from '../src/league/state';
import { isForeign } from '../src/league/players';
import { loadSave } from './helpers';

describe('trades with a club over the roster limit', () => {
  it('taking more players from a club over 68 is fine; giving it more is not', () => {
    const s = loadSave('1.8.1');
    const me = s.user!.teamId;
    const [them, donor] = ['kia', 'lg'];
    // Put the other club over the limit: move players from a third club into its futures squad.
    const limit = rosterLimit(s.year);
    const extra = registeredIds(s, donor).filter((id) => !isForeign(s.players[id]!)).slice(0, limit + 2 - registeredIds(s, them).length);
    for (const id of extra) {
      const r = s.rosters[donor]!;
      for (const k of ['active', 'futures', 'third'] as const) r[k] = r[k].filter((x) => x !== id);
      s.rosters[them]!.futures.push(id);
      s.players[id]!.teamId = them;
    }
    expect(registeredIds(s, them).length).toBe(limit + 2);
    const tradable = (team: string) => registeredIds(s, team).map((id) => s.players[id]!).filter((p) => !isForeign(p) && p.status === 'active' && p.proSince < s.year && !p.origin.pickVia);
    const ours = tradable(me)[0]!.id;
    const theirs = tradable(them).slice(0, 2).map((p) => p.id);
    const roster = /상대 구단 소속선수/;
    // Two for one: the other club goes from 70 to 69, fewer than before.
    expect(checkTrade(s, them, [ours], theirs).problem ?? '').not.toMatch(roster);
    // One for two the other way: the other club would go to 71.
    const ours2 = tradable(me).slice(0, 2).map((p) => p.id);
    expect(checkTrade(s, them, ours2, [theirs[0]!]).problem ?? '').toMatch(roster);
  });
});
