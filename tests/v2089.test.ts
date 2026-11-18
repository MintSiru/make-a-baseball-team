/* 2.0.89 (the user's requests): release several players at once (check boxes on the market screen), and release a
   foreign player of ours (onto the market of KBO-experienced foreigners). A stand-in for an injured foreign player is
   not released this way. */
import { describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { foreignPoolPlayers } from '../src/league/foreignpool';
import { isForeign } from '../src/league/players';
import { orgPlayers } from '../src/league/state';
import { canRelease } from '../src/league/trade';
import { loadSave } from './helpers';

describe('2.0.89: release several at once, foreign players too', () => {
  it('lets go the domestic and foreign players picked; the foreign one joins the foreign market', () => {
    const s = loadSave('2.0.87');
    s.pending = null;
    const me = s.user!.teamId;
    const active = new Set(s.rosters[me]!.active);
    // Two domestic players off the first team, and a foreign one.
    const domestic = orgPlayers(s, me)
      .filter((p) => !isForeign(p) && !active.has(p.id) && !canRelease(s, p.id))
      .slice(0, 2);
    const foreign = orgPlayers(s, me).find((p) => isForeign(p) && !p.contract?.temp && !canRelease(s, p.id))!;
    expect(domestic).toHaveLength(2);
    expect(foreign).toBeDefined();
    const ids = [...domestic.map((p) => p.id), foreign.id];
    const t = apply(s, { kind: 'releaseMany', ids });
    for (const id of ids) expect(t.players[id]!.teamId).not.toBe(me);
    // In the season the domestic ones go on waivers; the foreign one to the market of KBO-experienced foreigners.
    for (const p of domestic) expect((t.waivers ?? []).some((w) => w.id === p.id)).toBe(true);
    expect(foreignPoolPlayers(t).some((p) => p.id === foreign.id) || t.players[foreign.id]!.status !== 'active').toBe(true);
    expect((t.waivers ?? []).some((w) => w.id === foreign.id)).toBe(false);
  });

  it('a stand-in for an injured foreign player cannot be released here', () => {
    const s = loadSave('2.0.87');
    s.pending = null;
    const me = s.user!.teamId;
    const p = orgPlayers(s, me).find((x) => isForeign(x) && !x.contract?.temp)!;
    p.contract = { ...p.contract!, temp: true } as never;
    expect(canRelease(s, p.id)).toContain('대체');
  });
});
