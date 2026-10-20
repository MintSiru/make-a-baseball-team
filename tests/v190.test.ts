/* 1.9.0: the postseason entry — thirty players handed in before each series, only those registered by July 31
   (foreign players by August 15), the user's club choosing its own, the first teams given back afterwards. */
import { describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { autoDecision, checkDecision } from '../src/league/expansion';
import { isForeign } from '../src/league/players';
import { applyEntry, checkEntry, chooseEntry, ENTRY, entryCandidates, entryProblem, openEntries } from '../src/league/postentry';
import { playPostseason, postseasonDay, startPostseason } from '../src/league/postseason';
import { registeredIds, type LeagueState } from '../src/league/state';
import { endRegular, loadSave } from './helpers';

/** A league at the end of the 2027 regular season, with one player of another club moved after the deadline. */
function seasonOver() {
  const s = loadSave('1.8.2');
  endRegular(s);
  return s;
}

/** Moves `id` to `to`'s futures squad (a waiver claim after the deadline, say). */
function moveLate(s: LeagueState, id: string, to: string) {
  const p = s.players[id]!;
  const from = s.rosters[p.teamId!]!;
  for (const k of ['active', 'futures', 'third'] as const) from[k] = from[k].filter((x) => x !== id);
  p.teamId = to;
  if (p.contract) p.contract.teamId = to;
  s.rosters[to]!.futures.push(id);
}

describe('who may play in the postseason', () => {
  it('the registered players are noted once the deadlines pass: domestic on July 31, foreign on August 15', () => {
    const s = seasonOver();
    const e = s.postEntry!;
    expect(e.year).toBe(s.year);
    for (const t of s.teams.filter((x) => s.rosters[x.id])) {
      // Our club may have let a player or two go during the season (2.0.28: a scandal the scouts answer with a release).
      expect(e.domestic![t.id]!.length).toBeGreaterThan(t.id === s.user?.teamId ? 37 : 40);
      expect(e.domestic![t.id]!.every((id) => !isForeign(s.players[id]!))).toBe(true);
      expect(e.foreign![t.id]!.every((id) => isForeign(s.players[id]!))).toBe(true);
    }
  }, 240_000);

  it('a player who joined after the deadline is out of every entry; the AI entries are thirty eligible players', () => {
    const s = seasonOver();
    startPostseason(s);
    const series = s.bracket!.live;
    const playing = [...new Set(series.flatMap((x) => [x.high, x.low]))];
    for (const id of playing) {
      expect(s.rosters[id]!.active.length).toBeLessThanOrEqual(ENTRY.registered);
      expect(s.rosters[id]!.active.length).toBeGreaterThanOrEqual(26);
      expect(s.rosters[id]!.active.every((p) => !entryProblem(s, id, p))).toBe(true);
    }
    // The best player of a club out of the postseason, moved to one in it now: not eligible.
    const out = s.teams.find((t) => s.rosters[t.id] && !playing.includes(t.id) && t.id !== s.user?.teamId)!.id;
    const star = registeredIds(s, out).sort((a, b) => s.players[b]!.scouting.current - s.players[a]!.scouting.current)[0]!;
    const to = playing.find((id) => id !== s.user?.teamId)!;
    moveLate(s, star, to);
    expect(entryProblem(s, to, star)).toBe('late');
    expect(entryCandidates(s, to)).not.toContain(star);
    expect(chooseEntry(s, to)).not.toContain(star);
  }, 240_000);

  it('the whole postseason: only eligible players play, and every club gets its first team back', () => {
    const s = seasonOver();
    const before = Object.fromEntries(Object.entries(s.rosters).map(([id, r]) => [id, [...r.active]]));
    playPostseason(s);
    expect(s.bracket!.done).toBe(true);
    for (const id of Object.keys(s.postLines ?? {})) {
      const p = s.players[id]!;
      expect(entryProblem(s, p.teamId!, id)).not.toBe('late');
    }
    for (const [id, r] of Object.entries(s.rosters)) expect([...r.active].sort()).toEqual([...before[id]!].filter((p) => s.players[p]!.teamId === id).sort());
    expect(s.postEntry!.before).toBeUndefined();
  }, 240_000);

  it('a save without the lists (from before 1.9.0) lets every registered player in', () => {
    const s = seasonOver();
    delete s.postEntry;
    const id = s.user!.teamId;
    expect(entryCandidates(s, id).length).toBe(registeredIds(s, id).filter((p) => !entryProblem(s, id, p)).length);
    expect(registeredIds(s, id).some((p) => entryProblem(s, id, p) === 'late')).toBe(false);
  }, 240_000);
});

describe('our entry', () => {
  it('before our series the general manager hands in the entry; the suggestion checks out and becomes the first team', () => {
    const s = seasonOver();
    s.phase = 'postseason';
    const me = s.user!.teamId;
    const opp = s.teams.find((t) => s.rosters[t.id] && t.id !== me)!.id;
    openEntries(s, [{ round: 'semipo', high: me, low: opp }], true);
    const d = s.pending!;
    expect(d.kind).toBe('postEntry');
    if (d.kind !== 'postEntry') return;
    expect(d.suggested.length).toBe(ENTRY.registered);
    expect(d.suggested.every((id) => d.candidates.includes(id))).toBe(true);
    // The opponent's entry is in already.
    expect(s.postEntry!.round![opp]).toBe('semipo');
    const input = autoDecision(s)!;
    expect(checkDecision(s, input)).toBeNull();
    apply(s, { kind: 'decide', input });
    expect(s.pending).toBeNull();
    expect([...s.rosters[me]!.active].sort()).toEqual([...d.suggested].sort());
    expect(s.postEntry!.round![me]).toBe('semipo');
  }, 240_000);

  it('the rules: no more than thirty, no fewer than twenty-six, enough pitchers and hitters, no late player', () => {
    const s = seasonOver();
    const me = s.user!.teamId;
    const ok = entryCandidates(s, me);
    const best = chooseEntry(s, me);
    expect(checkEntry(s, me, best)).toBeNull();
    expect(checkEntry(s, me, [...best, ...ok.filter((id) => !best.includes(id))].slice(0, 31))).not.toBeNull();
    expect(checkEntry(s, me, best.slice(0, 20))).not.toBeNull();
    const hitters = ok.filter((id) => s.players[id]!.role !== 'SP' && s.players[id]!.role !== 'RP');
    expect(checkEntry(s, me, hitters.slice(0, 28))).not.toBeNull();
    const out = s.teams.find((t) => s.rosters[t.id] && t.id !== me)!.id;
    const late = registeredIds(s, out)[0]!;
    moveLate(s, late, me);
    expect(checkEntry(s, me, [...best.slice(0, 29), late])).not.toBeNull();
  }, 240_000);

  it('nothing is played while our entry waits; played through, the suggestion stands', () => {
    const s = seasonOver();
    startPostseason(s);
    const b = s.bracket!;
    const me = s.user!.teamId;
    const opp = b.live[0]!.high === me ? b.live[0]!.low : b.live[0]!.high;
    // Our entry still to hand in for a series.
    s.pending = { kind: 'postEntry', round: b.live[0]!.round, opp, candidates: entryCandidates(s, me), late: [], size: ENTRY.registered, suggested: chooseEntry(s, me) };
    const games = b.live.map((x) => x.games.length);
    expect(postseasonDay(s)).toBe(true);
    expect(b.live.map((x) => x.games.length)).toEqual(games);
    playPostseason(s);
    expect(s.pending).toBeNull();
    expect(s.bracket!.done).toBe(true);
  }, 240_000);

  it('applyEntry keeps the regular-season first team once, to give back', () => {
    const s = seasonOver();
    const me = s.user!.teamId;
    const first = [...s.rosters[me]!.active];
    applyEntry(s, me, chooseEntry(s, me), 'semipo');
    applyEntry(s, me, chooseEntry(s, me).slice(0, 28), 'po');
    expect(s.postEntry!.before![me]).toEqual(first);
    expect(s.rosters[me]!.active.length).toBe(28);
  }, 240_000);

  it('a club that stopped before its postseason games stops for its entry too (migration)', () => {
    const s = loadSave('1.8.2');
    const stops = s.user!.settings.stops;
    if (stops) expect(stops.includes('bigGame') ? stops.includes('postEntry') : true).toBe(true);
  });
});
