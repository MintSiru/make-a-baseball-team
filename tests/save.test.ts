import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { SIM_VERSION } from '../src/core/version';
import { makeSave, parseSave, SaveError, serializeSave } from '../src/save/format';
import { indexedDbStore, memoryStore, type SaveStore } from '../src/save/store';

const problemOf = (text: string) => {
  try {
    parseSave(text);
    return null;
  } catch (e) {
    return e instanceof SaveError ? e.problem : 'other';
  }
};

describe('save format', () => {
  it('round-trips', () => {
    const save = makeSave('seed-1', [{ at: { year: 2026, phase: 'founding' }, kind: 'noop', data: null }]);
    expect(parseSave(serializeSave(save))).toEqual(save);
    expect(save.sim).toBe(SIM_VERSION);
  });

  it('refuses other files, newer formats, other simulation versions and damage', () => {
    const good = makeSave('seed-1');
    expect(problemOf('not json')).toBe('notSave');
    expect(problemOf(JSON.stringify({ format: 'draft-room-save' }))).toBe('notSave');
    expect(problemOf(JSON.stringify({ ...good, version: 99 }))).toBe('newerFormat');
    expect(problemOf(JSON.stringify({ ...good, sim: '0.0' }))).toBe('otherSim');
    expect(problemOf(JSON.stringify({ ...good, seed: '' }))).toBe('damaged');
    expect(problemOf(JSON.stringify({ ...good, inputs: [{ kind: 'x' }] }))).toBe('damaged');
  });
});

async function exercise(store: SaveStore) {
  expect(await store.get('auto')).toBeNull();
  const older = makeSave('a', [], null, new Date('2026-01-01T00:00:00Z'));
  const newer = makeSave('b', [], null, new Date('2026-02-01T00:00:00Z'));
  await store.put('auto', older);
  await store.put('slot-1', newer);
  expect(await store.get('auto')).toEqual(older);
  expect((await store.list()).map((s) => s.slot)).toEqual(['slot-1', 'auto']);
  await store.put('auto', newer);
  expect((await store.get('auto'))?.seed).toBe('b');
  await store.remove('auto');
  expect(await store.get('auto')).toBeNull();
}

describe('save stores', () => {
  it('memory store', () => exercise(memoryStore()));
  it('IndexedDB store', async () => exercise(await indexedDbStore('test-db', new IDBFactory())));
});
