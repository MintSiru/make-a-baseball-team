/* 1.7.0: the 1.6 feedback — bugs (a foreign place left open, two-league playoff box scores in v130, the 2016
   tryout's ages in v160b) and the new features. */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { isForeign } from '../src/league/players';
import { removeFromRoster } from '../src/league/offseason';
import type { LeagueState } from '../src/league/state';
import { canReplaceForeign, foreignMarket, OPEN_SLOT, openForeign } from '../src/league/trade';
import { parseSave } from '../src/save/format';

export const loadSave = (v = '1.4.0') => parseSave(gunzipSync(readFileSync(new URL(`./fixtures/save-${v}.json.gz`, import.meta.url))).toString('utf8')).snapshot!.state as LeagueState;

describe('a foreign place left open', () => {
  it('is signed into from the market, nobody let go, and counts as one of the season’s changes', () => {
    const s = loadSave();
    const u = s.user!;
    expect(s.phase).toBe('regular');
    const gone = Object.values(s.players).find((p) => p.teamId === u.teamId && isForeign(p) && !p.origin.asiaQuota)!;
    removeFromRoster(s, gone.id);
    gone.teamId = null;
    gone.status = 'retired';
    s.foreignChanges = {};
    const open = openForeign(s, u.teamId);
    expect(open.regular).toBe(1);
    const pick = foreignMarket(s, u.teamId).find((p) => !p.origin.asiaQuota)!;
    expect(canReplaceForeign(s, u.teamId, OPEN_SLOT, pick.id)).toBeNull();
    const asia = foreignMarket(s, u.teamId).find((p) => p.origin.asiaQuota);
    if (asia && open.asia === 0) expect(canReplaceForeign(s, u.teamId, OPEN_SLOT, asia.id)).not.toBeNull();
    const dead = (u.deadMoney ?? []).length;
    const t = apply(s, { kind: 'foreignSwap', out: OPEN_SLOT, in: pick.id });
    expect(t.players[pick.id]!.teamId).toBe(u.teamId);
    expect(t.foreignChanges![u.teamId]).toBe(1);
    expect(openForeign(t, u.teamId).regular).toBe(0);
    expect((t.user!.deadMoney ?? []).length).toBe(dead);
    expect(t.news?.some((n) => n.id === `mv-foreign-${t.schedule[t.next]?.date ?? ''}-${pick.id}` || n.id.endsWith(`-${pick.id}`))).toBe(true);
    // Full again: no open place to sign into.
    const other = foreignMarket(t, u.teamId).find((p) => !p.origin.asiaQuota && p.id !== pick.id)!;
    expect(canReplaceForeign(t, u.teamId, OPEN_SLOT, other.id)).not.toBeNull();
  });
});
