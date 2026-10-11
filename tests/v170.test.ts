/* 1.7.0: the 1.6 feedback — bugs (a foreign place left open, two-league playoff box scores in v130, the 2016
   tryout's ages in v160b) and the new features. */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
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
import { developPlayer, GRADE_KEYS } from '../src/league/offseason';
import { rng } from '../src/draftroom';
import { pitchFeed } from '../src/league/pitchfeed';
import { money, moneyShort } from '../src/ui/format';
import { CITIES } from '../src/club/cities';
import { extensionOptions, extensionProblem } from '../src/league/extensions';
import { captainDay, captainsProblem } from '../src/league/captains';
import { clubhouse } from '../src/league/views';
import { ageIn, makeForeign, veteranOnMarket } from '../src/league/players';
import { ADAPT, adaptabilityOf, adaptDay, adaptPenalty, failChance } from '../src/league/adapt';
import { traitReport } from '../src/league/reports';
import { FREAK, FREAK_KEYS, freakDay } from '../src/league/freak';
import { firstTeamIds } from '../src/league/state';

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

describe('grades season by season', () => {
  it('an older save starts the log from today; each winter adds the new report', () => {
    const s = loadSave();
    const p = Object.values(s.players).find((x) => x.status === 'active' && x.teamId === s.user!.teamId && !isPitcher(x))!;
    expect(p.gradeLog).toEqual([[p.scouting.season, p.scouting.current, ...GRADE_KEYS.map((k) => (p.scouting.tools as Record<string, number>)[k] ?? 0)]]);
    developPlayer(p, s.year, 0, rng('grow'));
    expect(p.gradeLog!.length).toBe(2);
    expect(p.gradeLog![1]![0]).toBe(s.year + 1);
    expect(p.gradeLog![1]![1]).toBe(p.scouting.current);
  });
});

describe('the relay a pitch at a time', () => {
  it('every plate appearance ends on the pitch the engine played, the same way each time', () => {
    const s = loadSave();
    const id = Object.keys(s.pbp ?? {})[0]!;
    const log = s.pbp![id]!;
    const frames = pitchFeed(s, id)!;
    expect(pitchFeed(s, id)).toEqual(frames);
    const pas = log.filter((e) => e.k === 'pa');
    expect(frames.filter((f) => f.kind === 'result')).toHaveLength(pas.length);
    for (const [n, e] of log.entries()) {
      if (e.k !== 'pa') continue;
      const mine = frames.filter((f) => f.play === n);
      const lastPitch = mine.filter((f) => f.kind === 'pitch').at(-1)!;
      if (e.res === 'K') expect(lastPitch.strikes).toBe(3);
      if (e.res === 'BB') expect(lastPitch.balls).toBe(4);
      for (const f of mine.filter((f) => f.kind === 'pitch')) expect(f.balls <= 4 && f.strikes <= 3).toBe(true);
      const result = mine.at(-1)!;
      expect(result.kind).toBe('result');
      expect(result.outs).toBe(e.outs);
      expect(result.bases).toEqual(e.bases);
      expect(result.score).toEqual(e.score);
    }
  });
});

describe('amounts in won, dollars or yen; more homes', () => {
  it('converts at the fixed rates, won by default', () => {
    const prefs = (currency: string) => vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ currency }) });
    expect(money(17500)).toBe('1억 7,500만');
    prefs('usd');
    expect(money(14000)).toBe('10만 달러');
    expect(money(14)).toBe('100달러');
    prefs('jpy');
    expect(money(10000)).toBe('1,075만 엔');
    expect(moneyShort(200000)).toBe('2.2억 엔');
    prefs('krw');
    expect(money(10000)).toBe('1억');
    vi.unstubAllGlobals();
  });

  it('has twenty homes to choose from', () => {
    expect(CITIES.length).toBe(20);
    expect(new Set(CITIES.map((c) => c.id)).size).toBe(20);
  });
});

describe('multi-year deals before free agency', () => {
  it('two to six years for a domestic player short of free agency; a yes sets the seasons from next year', () => {
    const s = loadSave();
    const u = s.user!;
    const p = Object.values(s.players).filter((x) => x.teamId === u.teamId && !extensionProblem(s, x.id)).sort((a, b) => b.scouting.current - a.scouting.current)[0]!;
    expect(p).toBeTruthy();
    const opts = extensionOptions(s, p.id);
    expect(opts.map((x) => x.years)).toEqual(expect.arrayContaining([2, 3, 4]));
    for (const o of opts) expect(o.total).toBe(o.annual * o.years);
    const foreign = Object.values(s.players).find((x) => x.teamId === u.teamId && isForeign(x))!;
    expect(extensionProblem(s, foreign.id)).not.toBeNull();
    // A loyal player on easy says yes almost always; a no would shut the door for a month.
    p.hidden.traits!.loyalty = 100;
    u.settings.difficulty = 'easy';
    let t = apply(s, { kind: 'extend', id: p.id, years: 3 });
    if (t.players[p.id]!.contract!.kind !== 'multiYear') {
      expect(extensionProblem(t, p.id)).toMatch(/거절/);
      t.user!.extensionTalks = {};
      t = apply(t, { kind: 'extend', id: p.id, years: 4 });
      if (t.players[p.id]!.contract!.kind !== 'multiYear') return;
    }
    const c = t.players[p.id]!.contract!;
    expect(c.kind).toBe('multiYear');
    expect(c.salaries.filter((x) => x.season > s.year).map((x) => x.season).slice(0, 3)).toEqual([s.year + 1, s.year + 2, s.year + 3]);
    expect(t.news!.some((n) => n.id.startsWith(`extension-${p.id}`))).toBe(true);
    expect(extensionProblem(t, p.id)).not.toBeNull();
  });
});

describe('the captaincy', () => {
  it('is named from our players, shows in the clubhouse and calls a meeting at the fifth loss in a row', () => {
    const s = loadSave();
    const u = s.user!;
    const ours = s.rosters[u.teamId]!.active.map((id) => s.players[id]!);
    const cap = [...ours].sort((a, b) => b.hidden.traits!.leadership - a.hidden.traits!.leadership)[0]!;
    const other = Object.values(s.players).find((p) => p.teamId && p.teamId !== u.teamId)!;
    expect(captainsProblem(s, other.id, [])).not.toBeNull();
    expect(captainsProblem(s, cap.id, [cap.id])).not.toBeNull();
    const t = apply(s, { kind: 'captains', captain: cap.id, vice: [ours.find((p) => p.id !== cap.id)!.id] });
    expect(t.user!.captains!.captain).toBe(cap.id);
    expect(clubhouse(t, u.teamId).notes.some((n) => n.includes(cap.name))).toBe(true);
    // Five losses in a row.
    const date = t.schedule[t.next]!.date;
    t.scores.push({ id: 'w', date, home: u.teamId, away: other.teamId!, hs: 1, as: 0, att: 0 });
    for (let i = 0; i < 5; i++) t.scores.push({ id: `x${i}`, date, home: u.teamId, away: other.teamId!, hs: 0, as: 1, att: 0 });
    captainDay(t, date, false);
    const meeting = t.news!.find((n) => n.id === `captain-meeting-${date}`)!;
    expect(meeting).toBeTruthy();
    if (cap.hidden.traits!.leadership >= 60) expect(t.players[ours.find((p) => p.id !== cap.id)!.id]!.life?.form?.delta).toBeGreaterThan(0);
  });
});

describe('foreign players adapting, and old big-league names', () => {
  it('a hidden adaptability: easier for Asia-quota players; a few rookies fail, and pay for it in games all season', () => {
    const regular = Array.from({ length: 400 }, (_, i) => makeForeign('adapt-test', `r${i}`, 2027, { kind: i % 2 ? 'pitcher' : 'hitter', asiaQuota: false }));
    const asia = Array.from({ length: 400 }, (_, i) => makeForeign('adapt-test', `a${i}`, 2027, { kind: 'pitcher', asiaQuota: true }));
    const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
    expect(mean(asia.map(adaptabilityOf))).toBeGreaterThan(mean(regular.map(adaptabilityOf)) + 5);
    // Two checks in his first season: about one rookie import in ten fails.
    const fail = mean(regular.map((p) => 1 - (1 - failChance(adaptabilityOf(p))) ** 2));
    expect(fail).toBeGreaterThan(0.04);
    expect(fail).toBeLessThan(0.16);
    expect(failChance(60)).toBe(0);

    // A low-adaptability rookie on our club, at a check date: he may lose his touch.
    const s = loadSave();
    const u = s.user!;
    const date = `${s.year}-${ADAPT.checks[0]}`;
    let failed: ReturnType<typeof makeForeign> | null = null;
    for (let i = 0; i < 3000 && !failed; i++) {
      const p = makeForeign(s.seed, `adapt-${i}`, s.year, { kind: 'hitter', asiaQuota: false });
      if (adaptabilityOf(p) > 30) continue;
      p.teamId = u.teamId;
      p.career = [];
      s.players[p.id] = p;
      s.rosters[u.teamId]!.active.push(p.id);
      adaptDay(s, date);
      if (p.adaptFail) failed = p;
      else {
        s.rosters[u.teamId]!.active.pop();
        delete s.players[p.id];
      }
    }
    expect(failed).not.toBeNull();
    expect(adaptPenalty(failed!, s.year)).toBeGreaterThanOrEqual(ADAPT.drop[0]);
    expect(adaptPenalty(failed!, s.year + 1)).toBe(0);
    expect(s.news!.some((n) => n.id === `adapt-${failed!.id}` && n.mine)).toBe(true);
    // The scouts and coaches read it like the other hidden traits.
    expect(traitReport(s, failed!)!.reads.some((r) => r.key === 'adapt')).toBe(true);
    // Not on other days, and never twice.
    const before = s.news!.length;
    adaptDay(s, `${s.year}-06-01`);
    adaptDay(s, date);
    expect(s.news!.length).toBe(before);
  });

  it('now and then an old big-league name: 34–38, a long MLB career, the top price', () => {
    const keys = Array.from({ length: 400 }, (_, i) => veteranOnMarket(`k${i}`));
    const share = keys.filter(Boolean).length / keys.length;
    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.4);
    for (let i = 0; i < 40; i++) {
      const p = makeForeign('vet-test', `v${i}`, 2027, { kind: i % 3 ? 'pitcher' : 'hitter', asiaQuota: false, veteran: true });
      expect(ageIn(p, 2027)).toBeGreaterThanOrEqual(34);
      expect(ageIn(p, 2027)).toBeLessThanOrEqual(39);
      expect(p.origin.background!.veteran).toBe(true);
      expect(p.origin.background!.text).toMatch(/^MLB \d+시즌/);
      expect(p.origin.background!.ask).toBeGreaterThanOrEqual(800_000);
    }
    // An ordinary signing is as before.
    expect(makeForeign('vet-test', 'x1', 2027, { kind: 'pitcher', asiaQuota: false })).toEqual(makeForeign('vet-test', 'x1', 2027, { kind: 'pitcher', asiaQuota: false, veteran: false }));
  });
});

describe('freak injuries', () => {
  it('rarely; off the field, on the list (a hangover only a game), in the papers and in his history', () => {
    const s = loadSave();
    const u = s.user!;
    const dates = [...new Set(s.schedule.slice(s.next).map((g) => g.date))];
    // At the real rate: a handful a season across the league.
    const quiet = structuredClone(s);
    for (const d of dates) freakDay(quiet, d);
    const seen = (quiet.news ?? []).filter((n) => n.id.startsWith('freak-')).length;
    expect(seen).toBeLessThan(dates.length * firstTeamIds(s).length * FREAK.perClubDay * 3 + 3);
    // One for every club today.
    const rate = FREAK.perClubDay;
    FREAK.perClubDay = 1;
    try {
      freakDay(s, dates[0]!);
    } finally {
      FREAK.perClubDay = rate;
    }
    const items = (s.news ?? []).filter((n) => n.id.startsWith('freak-') && n.date === dates[0]);
    expect(items).toHaveLength(firstTeamIds(s).length);
    for (const n of items) {
      const p = s.players[n.players![0]!]!;
      const inj = s.injuries[p.id]!;
      expect(inj.part).toBe(n.facts.part);
      expect(!!inj.dtd).toBe(!inj.onList);
      if (inj.onList) expect(p.injuries!.at(-1)!.date).toBe(dates[0]);
      expect(n.mine).toBe(p.teamId === u.teamId);
    }
    expect(FREAK_KEYS).toEqual(expect.arrayContaining(['car', 'stairs', 'kid', 'sink', 'hangover']));
  });
});
