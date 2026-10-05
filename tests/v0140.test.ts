/* V0.14: saves that do not stall the page (packed, written one at a time) and the difficulty that reaches
   negotiations, scouting, the trade desk and the owner's patience. */
import { IDBFactory } from 'fake-indexeddb';
import { beforeAll, describe, expect, it } from 'vitest';
import { apply, regularOver } from '../src/league/actions';
import { autoDecision, EXPANSION_ID } from '../src/league/expansion';
import { fitOf, type FaTalk } from '../src/league/fa';
import { createLeague } from '../src/league/history';
import { evaluate } from '../src/league/parent';
import { draftClass, isForeign } from '../src/league/players';
import { scoutView } from '../src/league/staff';
import { orgPlayers, type Difficulty, type LeagueState } from '../src/league/state';
import { checkTrade, tradeValue } from '../src/league/trade';
import { DIFFICULTY } from '../src/league/tuning';
import { toGrade, overall } from '../src/draftroom';
import { autoSaver } from '../src/save/autosave';
import { gunzipText, isGzip, packText, readSaveFile } from '../src/save/compress';
import { makeSave } from '../src/save/format';
import { indexedDbStore } from '../src/save/store';

describe('packed saves', () => {
  it('gzip round-trips a save and is much smaller', async () => {
    const text = JSON.stringify({ format: 'kbo-expansion-save', players: Array.from({ length: 3000 }, (_, i) => ({ id: `p${i}`, name: '김야구', career: [{ year: 2026, war: 1.5 }] })) });
    const gz = await packText(text);
    expect(gz).not.toBeNull();
    expect(isGzip(gz!)).toBe(true);
    expect(gz!.length).toBeLessThan(text.length / 4);
    expect(await gunzipText(gz!)).toBe(text);
  });

  it('a picked file may be plain JSON or gzip of it', async () => {
    const text = '{"format":"kbo-expansion-save","한글":"그대로"}';
    expect(await readSaveFile(new Blob([text]))).toBe(text);
    expect(await readSaveFile(new Blob([(await packText(text))! as BlobPart]))).toBe(text);
  });
});

describe('autosave', () => {
  const manual = () => {
    const due: (() => void)[] = [];
    return {
      timers: { set: ((fn: () => void) => (due.push(fn), due.length)) as unknown as typeof setTimeout, clear: (() => undefined) as typeof clearTimeout },
      fire: () => due.splice(0).forEach((f) => f()),
    };
  };

  it('a burst of changes is written once, with the newest state', async () => {
    const written: number[] = [];
    const t = manual();
    const saver = autoSaver<number>(async (n) => void written.push(n), 300, t.timers);
    for (let i = 1; i <= 5; i++) saver.schedule(i);
    expect(written).toEqual([]);
    t.fire();
    await saver.flush();
    expect(written).toEqual([5]);
  });

  it('changes during a write wait for it, and only the newest is written next', async () => {
    const written: number[] = [];
    let release!: () => void;
    const t = manual();
    const saver = autoSaver<number>(
      (n) =>
        new Promise<void>((done) => {
          written.push(n);
          release = done;
        }),
      300,
      t.timers,
    );
    saver.schedule(1);
    t.fire();
    await Promise.resolve();
    expect(written).toEqual([1]);
    saver.schedule(2);
    saver.schedule(3);
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(written).toEqual([1, 3]);
    release();
    await saver.flush();
    expect(written).toEqual([1, 3]);
  });

  it('flush writes what is waiting without the delay; a failed write does not stop the next', async () => {
    const written: number[] = [];
    const t = manual();
    const saver = autoSaver<number>(async (n) => {
      if (n === 1) throw new Error('disk full');
      written.push(n);
    }, 300, t.timers);
    saver.schedule(1);
    await saver.flush();
    saver.schedule(2);
    await saver.flush();
    expect(written).toEqual([2]);
  });
});

describe('packed autosave in IndexedDB', () => {
  it('stores the save packed and reads it back; a plain row from before still reads', async () => {
    const factory = new IDBFactory();
    const store = await indexedDbStore('v0140-db', factory);
    const save = makeSave('packed-seed', [], { at: { year: 2030, phase: 'regularSeason' }, state: { teams: [], rosters: {}, filler: 'x'.repeat(50_000) } });
    await store.put('auto', save);
    const raw = await new Promise<Record<string, unknown>>((resolve) => {
      const open = factory.open('v0140-db');
      open.onsuccess = () => {
        const req = open.result.transaction('saves').objectStore('saves').get('auto');
        req.onsuccess = () => resolve(req.result);
      };
    });
    expect(raw.gz).toBeInstanceOf(Uint8Array);
    expect(raw.text).toBeUndefined();
    expect((raw.gz as Uint8Array).length).toBeLessThan(5_000);
    expect((await store.get('auto'))?.seed).toBe('packed-seed');
    // A row written by 0.13 or earlier: the text as it is.
    await new Promise<void>((resolve) => {
      const open = factory.open('v0140-db');
      open.onsuccess = () => {
        const tx = open.result.transaction('saves', 'readwrite');
        tx.objectStore('saves').put({ slot: 'old', seed: 'old-seed', savedAt: save.savedAt, text: JSON.stringify({ ...save, seed: 'old-seed' }) });
        tx.oncomplete = () => resolve();
      };
    });
    expect((await store.get('old'))?.seed).toBe('old-seed');
    expect((await store.list()).map((x) => x.slot).sort()).toEqual(['auto', 'old']);
  });
});

describe('difficulty', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = createLeague('v0140-test');
    apply(s, { kind: 'toFounding' });
    apply(s, {
      kind: 'found',
      settings: { name: '청주 독수리', short: '청독', color: '#1f6fb2', cityId: 'cheongju', parentType: 'midsize', parentName: '가상', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null },
    });
    const opening = () => s.year === 2027 && s.phase === 'regular';
    for (let guard = 0; guard < 400 && !opening(); guard++) {
      if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
      else if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
      else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
      else if (s.phase === 'postseason') apply(s, { kind: 'nextSeason' });
    }
    while (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
  }, 900_000);

  const at = <T>(level: Difficulty, f: (x: LeagueState) => T): T => {
    const x = structuredClone(s);
    x.user!.settings.difficulty = level;
    return f(x);
  };

  it('normal changes nothing; easy and hard pull opposite ways', () => {
    for (const k of Object.keys(DIFFICULTY) as (keyof typeof DIFFICULTY)[]) {
      const d = DIFFICULTY[k];
      expect([0, 1]).toContain(d.normal);
      expect(Math.sign(d.easy - d.normal)).toBe(-Math.sign(d.hard - d.normal));
    }
  });

  it('the AI trade desk is easier to please on easy and harder on hard', () => {
    const ours = orgPlayers(s, EXPANSION_ID).filter((p) => p.status === 'active' && !isForeign(p) && p.proSince < s.year).sort((a, b) => tradeValue(s, b) - tradeValue(s, a));
    const other = s.teams.find((t) => t.id !== EXPANSION_ID && s.rosters[t.id])!.id;
    const theirs = orgPlayers(s, other).filter((p) => p.status === 'active' && !isForeign(p) && p.proSince < s.year).sort((a, b) => tradeValue(s, b) - tradeValue(s, a));
    const margin = (level: Difficulty) => at(level, (x) => checkTrade(x, other, [ours[0]!.id], [theirs[0]!.id]));
    const easy = margin('easy'),
      normal = margin('normal'),
      hard = margin('hard');
    expect(normal.problem).toBeNull();
    expect(easy.margin).toBeGreaterThan(normal.margin);
    expect(normal.margin).toBeGreaterThan(hard.margin);
  });

  it('a free agent likes our offer a little more on easy, a little less on hard', () => {
    const p = orgPlayers(s, s.teams.find((t) => t.id !== EXPANSION_ID && s.rosters[t.id])!.id).find((q) => !isForeign(q))!;
    const talk = { id: p.id, from: p.teamId!, demands: [], loyalty: 0 } as unknown as FaTalk;
    const offer = { years: 2, bonus: 10_000, salaries: [10_000, 10_000], options: 0 } as never;
    const k = (level: Difficulty) => at(level, (x) => fitOf(x, talk, EXPANSION_ID, offer, x.year + 1).k);
    expect(k('easy') - k('normal')).toBeCloseTo(DIFFICULTY.faFit.easy);
    expect(k('hard') - k('normal')).toBeCloseTo(DIFFICULTY.faFit.hard);
  });

  it('our scouts read the future more sharply on easy than on hard', () => {
    // The draft board is where the scouts' read matters (V0.6): this autumn's class.
    const young = draftClass(s.seed, 2027);
    const error = (level: Difficulty) =>
      at(level, (x) => young.reduce((a, p) => a + Math.abs((scoutView(x, p) ?? 0) - toGrade(overall(p.hidden.potential, p.role))), 0) / young.length);
    expect(error('easy')).toBeLessThan(error('normal'));
    expect(error('normal')).toBeLessThan(error('hard'));
  });

  it('the owner loses trust more slowly on easy and faster on hard', () => {
    const trustAfter = (level: Difficulty) =>
      at(level, (x) => {
        // A season that misses every goal (our club did not play the 2026 first-team season).
        x.user!.goals = { year: 2026, rank: 1, fans: 1_000_000, result: 1e12 };
        x.user!.trust = 60;
        return evaluate(x, 2026)!.trust;
      });
    const easy = trustAfter('easy'),
      normal = trustAfter('normal'),
      hard = trustAfter('hard');
    expect(normal).toBeLessThan(60);
    expect(easy).toBeGreaterThan(normal);
    expect(hard).toBeLessThan(normal);
  });

  it('can be changed mid-game, even while a decision waits, and the timeline says so', () => {
    const x = structuredClone(s);
    x.pending = { kind: 'national' } as unknown as LeagueState['pending'];
    apply(x, { kind: 'difficulty', level: 'hard' });
    expect(x.user!.settings.difficulty).toBe('hard');
    expect(x.user!.timeline?.at(-1)?.text).toBe('난이도 변경: 보통 → 어려움');
    const lines = x.user!.timeline!.length;
    apply(x, { kind: 'difficulty', level: 'hard' });
    expect(x.user!.timeline!.length).toBe(lines);
  });
});
