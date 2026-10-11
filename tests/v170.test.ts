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
import { checkLineupCard } from '../src/league/entry';
import { available, lineupFor } from '../src/league/manager';
import { isPitcher } from '../src/league/players';
import { parseSave } from '../src/save/format';
import { futureBefore, winterReport } from '../src/league/scouting';
import { draftView, draftWatchDay, draftYears } from '../src/league/draftlog';
import { ageIn } from '../src/league/players';

export const loadSave = (v = '1.4.0') => parseSave(gunzipSync(readFileSync(new URL(`./fixtures/save-${v}.json.gz`, import.meta.url))).toString('utf8')).snapshot!.state as LeagueState;

describe('a foreign place left open', () => {
  it('is signed into from the market, nobody let go, and counts as one of the season’s changes', () => {
    const s = loadSave();
    const u = s.user!;
    expect(s.phase).toBe('regular');
    const gone = Object.values(s.players).find((p) => p.teamId === u.teamId && isForeign(p) && !p.origin.asiaQuota)!;
    const before = openForeign(s, u.teamId).regular;
    removeFromRoster(s, gone);
    gone.teamId = null;
    gone.status = 'retired';
    s.foreignChanges = {};
    const open = openForeign(s, u.teamId);
    expect(open.regular).toBe(before + 1);
    const pick = foreignMarket(s, u.teamId).find((p) => !p.origin.asiaQuota)!;
    expect(canReplaceForeign(s, u.teamId, OPEN_SLOT, pick.id)).toBeNull();
    const asia = foreignMarket(s, u.teamId).find((p) => p.origin.asiaQuota);
    if (asia && open.asia === 0) expect(canReplaceForeign(s, u.teamId, OPEN_SLOT, asia.id)).not.toBeNull();
    const dead = (u.deadMoney ?? []).length;
    const t = apply(s, { kind: 'foreignSwap', out: OPEN_SLOT, in: pick.id });
    expect(t.players[pick.id]!.teamId).toBe(u.teamId);
    expect(t.foreignChanges![u.teamId]).toBe(1);
    expect(openForeign(t, u.teamId).regular).toBe(open.regular - 1);
    expect((t.user!.deadMoney ?? []).length).toBe(dead);
    expect(t.news?.some((n) => n.id === `mv-foreign-${t.schedule[t.next]?.date ?? ''}-${pick.id}` || n.id.endsWith(`-${pick.id}`))).toBe(true);
    // Full again: no open place to sign into.
    let full = t;
    while (openForeign(full, u.teamId).regular > 0 && (full.foreignChanges?.[u.teamId] ?? 0) < 2) {
      const next = foreignMarket(full, u.teamId).find((p) => !p.origin.asiaQuota)!;
      full = apply(full, { kind: 'foreignSwap', out: OPEN_SLOT, in: next.id });
    }
    const other = foreignMarket(full, u.teamId).find((p) => !p.origin.asiaQuota)!;
    expect(canReplaceForeign(full, u.teamId, OPEN_SLOT, other.id)).not.toBeNull();
  });
});

describe('the lineup card fixes the order or the position alone', () => {
  it('a spot without a position keeps the order, the manager picks the position; a place keeps the position only', () => {
    const s = loadSave();
    const u = s.user!;
    const ids = s.rosters[u.teamId]!.active;
    const free = lineupFor(s, ids, undefined, false, 'R');
    // The manager's ninth batter, fixed to lead off without a position.
    const ninth = free[8]!.id;
    const one = lineupFor(s, ids, undefined, false, 'R', { card: [{ id: ninth, pos: null }, ...Array(8).fill(null)] });
    expect(one[0]!.id).toBe(ninth);
    expect(new Set(one.map((b) => b.pos)).size).toBe(9);
    // A bench player fixed in the order plays (somewhere).
    const bench = ids.map((id) => s.players[id]!).find((p) => !isPitcher(p) && available(s, p.id) && !free.some((b) => b.id === p.id))!;
    const two = lineupFor(s, ids, undefined, false, 'R', { card: [null, null, null, null, null, null, null, { id: bench.id, pos: null }, null] });
    expect(two[7]!.id).toBe(bench.id);
    // A position only: he plays there, wherever the manager bats him.
    const lead = free[0]!;
    const three = lineupFor(s, ids, undefined, false, 'R', { places: [{ id: lead.id, pos: 'DH' }] });
    expect(three.find((b) => b.id === lead.id)?.pos).toBe('DH');
    expect(new Set(three.map((b) => b.pos)).size).toBe(9);
    // The card checks: one position each, nobody twice, nine players at most.
    const card = { R: [{ id: ninth, pos: null }, ...Array(8).fill(null)], L: Array(9).fill(null), places: { R: [{ id: lead.id, pos: 'DH' as const }], L: [] }, rotation: [], rest: true };
    expect(checkLineupCard(s, card)).toBeNull();
    expect(checkLineupCard(s, { ...card, places: { R: [{ id: ninth, pos: 'DH' as const }], L: [] } })).not.toBeNull();
    expect(checkLineupCard(s, { ...card, R: [{ id: bench.id, pos: 'DH' }, ...Array(8).fill(null)] })).not.toBeNull();
    // Through a game day: the saved card reaches the manager.
    u.lineup = card;
    const t = apply(s, { kind: 'lineupCard', card });
    expect(t.user!.lineup?.places?.R).toEqual([{ id: lead.id, pos: 'DH' }]);
  });
});

describe('the future grade moves once a season', () => {
  it('the winter report marks each move and tells ours in one story', () => {
    const s = loadSave();
    const u = s.user!;
    const before = futureBefore(s);
    const ours = [...before.keys()].map((id) => s.players[id]!).filter((p) => p.teamId === u.teamId);
    expect(ours.length).toBeGreaterThan(2);
    ours[0]!.scouting.futureValue += 10;
    ours[1]!.scouting.futureValue -= 5;
    winterReport(s, s.year, before);
    expect(ours[0]!.scouting.moved).toEqual({ date: `${s.year}-12-01`, from: before.get(ours[0]!.id), to: before.get(ours[0]!.id)! + 10 });
    const story = s.news!.find((n) => n.id === `scout-winter-${s.year}`)!;
    expect(story.players).toEqual(expect.arrayContaining([ours[0]!.id, ours[1]!.id]));
    expect(story.title).toContain('오름 1명');
    expect(ageIn(ours[0]!, s.year)).toBeLessThanOrEqual(27);
  });
});

describe('the draft over the years', () => {
  it('an older save reads its picks back from the players, with what became of them', () => {
    const s = loadSave();
    const years = draftYears(s);
    expect(years.length).toBeGreaterThan(3);
    const rows = draftView(s, years[1]!);
    expect(rows.length).toBeGreaterThan(30);
    expect(rows.map((r) => r.overall)).toEqual([...rows.map((r) => r.overall)].sort((a, b) => a - b));
    expect(rows.every((r) => r.club && r.now)).toBe(true);
  });

  it('the papers write about the class three times a season', () => {
    const s = loadSave();
    s.phase = 'regular';
    draftWatchDay(s, `${s.year}-08-15`);
    const ids = (s.news ?? []).filter((n) => n.id.startsWith(`draft-watch-${s.year}-`)).map((n) => n.id);
    expect(ids.sort()).toEqual([`draft-watch-${s.year}-race`, `draft-watch-${s.year}-spotlight`, `draft-watch-${s.year}-top10`].sort());
    const before = s.news!.length;
    draftWatchDay(s, `${s.year}-08-16`);
    expect(s.news!.length).toBe(before);
  });
});
