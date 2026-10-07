/* 1.4.1: progress protection — a save's league checked before it is shown, and the autosave's rotating backups. */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import type { LeagueState } from '../src/league/state';
import { stateProblem } from '../src/save/check';
import { makeSave, parseSave, SaveError, serializeSave } from '../src/save/format';
import { AUTO_SLOT, BACKUP_SLOTS, backupsOf, DAMAGED_SLOT, memoryStore, restoreBackup, rotateBackups, setAsideDamaged, UNDO_SLOT } from '../src/save/store';

let state: LeagueState;
const clone = () => JSON.parse(JSON.stringify(state)) as LeagueState;
const saveOf = (s: LeagueState, savedAt = new Date().toISOString()) => ({ ...makeSave(s.seed, [], { at: { year: s.year, phase: 'regularSeason' }, state: s }), savedAt });

beforeAll(() => {
  state = parseSave(gunzipSync(readFileSync(new URL('./fixtures/save-1.3.0.json.gz', import.meta.url))).toString('utf8')).snapshot!.state as LeagueState;
});

describe("a save's league is checked before it is shown", () => {
  it('passes a whole league', () => {
    expect(stateProblem(state)).toBeNull();
  });

  it('names what is missing or broken', () => {
    expect(stateProblem({ teams: [{ id: 'kia' }], rosters: {} })).toBe('시드가 없습니다.');
    const a = clone();
    delete (a as Partial<LeagueState>).players;
    expect(stateProblem(a)).toBe('선수 명단이 없습니다.');
    const b = clone();
    b.rosters[b.user!.teamId]!.active.push('nobody');
    expect(stateProblem(b)).toContain('없는 선수');
    const c = clone();
    c.user!.teamId = 'nowhere';
    expect(stateProblem(c)).toBe('우리 구단이 리그에 없습니다.');
    const d = clone();
    (d as { schedule: unknown }).schedule = null;
    expect(stateProblem(d)).toContain('schedule');
  });

  it('refuses a well-formed file with a broken league inside', () => {
    const broken = clone();
    delete (broken as Partial<LeagueState>).rosters;
    expect(() => parseSave(serializeSave(saveOf(broken)))).toThrow(SaveError);
    expect(() => parseSave(serializeSave(saveOf(broken)))).toThrow('구단별 선수단이 없습니다');
    expect(parseSave(serializeSave(saveOf(clone()))).snapshot!.state).toBeTruthy();
  });
});

describe("the autosave's backups", () => {
  it('rotate behind the autosave, newest first, three kept', async () => {
    const st = memoryStore();
    for (let i = 0; i < 5; i++) {
      await rotateBackups(st);
      const s = clone();
      s.year = 2027 + i;
      await st.put(AUTO_SLOT, { ...saveOf(s, `2026-10-0${i + 1}T10:00:00.000Z`), snapshot: { at: { year: 2027 + i, phase: 'regularSeason' }, state: s } });
    }
    const list = await backupsOf(st);
    expect(list.map((b) => b.slot)).toEqual(BACKUP_SLOTS);
    // The autosave holds the fifth game day; behind it the fourth, third and second.
    expect(list.map((b) => b.at)).toEqual(['2030 정규시즌', '2029 정규시즌', '2028 정규시즌']);
    expect(list[0]!.club).toBeTruthy();
    expect(list.every((b) => b.problem === null)).toBe(true);
  });

  it('restore keeps the autosave it replaces, and undoing swaps them back', async () => {
    const st = memoryStore();
    const old = clone();
    old.year = 2027;
    const now = clone();
    now.year = 2031;
    await st.put(BACKUP_SLOTS[0]!, saveOf(old));
    await st.put(AUTO_SLOT, saveOf(now));
    await restoreBackup(st, BACKUP_SLOTS[0]!);
    expect((await st.get(AUTO_SLOT))!.snapshot!.state).toMatchObject({ year: 2027 });
    expect((await st.get(UNDO_SLOT))!.snapshot!.state).toMatchObject({ year: 2031 });
    await restoreBackup(st, UNDO_SLOT);
    expect((await st.get(AUTO_SLOT))!.snapshot!.state).toMatchObject({ year: 2031 });
    expect((await st.get(UNDO_SLOT))!.snapshot!.state).toMatchObject({ year: 2027 });
  });

  it('a damaged autosave is set aside, so the next save never copies it over a good backup', async () => {
    const st = memoryStore();
    await st.put(BACKUP_SLOTS[0]!, saveOf(clone()));
    await st.put(AUTO_SLOT, saveOf(clone()));
    await setAsideDamaged(st);
    expect(await st.get(AUTO_SLOT)).toBeNull();
    expect(await st.get(DAMAGED_SLOT)).toBeTruthy();
    await rotateBackups(st);
    expect((await backupsOf(st)).map((b) => b.slot)).toContain(BACKUP_SLOTS[0]);
    expect(await st.get(BACKUP_SLOTS[0]!)).toBeTruthy();
  });
});
