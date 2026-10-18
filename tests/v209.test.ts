/* 2.0.9: the editor — players' names, hometowns, schools, nicknames and family ties; every club's name. */
import { beforeAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { labelOf, labelProblems, renameClubs } from '../src/league/clubs';
import { addTie, checkPlayerEdit, checkTie, editOf, editPlayer, findPlayers, removeTie } from '../src/league/editor';
import { familyOf, tiesOf } from '../src/league/family';
import { createLeague } from '../src/league/history';
import { nicknameOf } from '../src/league/nicknames';
import type { LeagueState } from '../src/league/state';
import type { Player } from '../src/model/types';

describe('the editor', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = createLeague('v209-editor');
  }, 300_000);
  const born = (p: Player) => Number(p.birthday.slice(0, 4));

  it('renames a player everywhere his name is kept, and swaps his school in his path', () => {
    const d = s.draftLog!.find((x) => s.players[x.id]?.education.pathText.includes(s.players[x.id]!.education.school))!;
    const p = s.players[d.id]!;
    (s.hallOfFame ??= []).push({ id: p.id, name: p.name, year: 2030, war: 60, seasons: 15, teams: [], line: '' });
    const old = p.education.school;
    editPlayer(s, p.id, { ...editOf(p), name: '  홍길동 ', birthplace: '한양', school: '활빈고', nickname: '의적' });
    expect(p.name).toBe('홍길동');
    expect(p.birthplace).toBe('한양');
    expect(p.education.school).toBe('활빈고');
    expect(p.education.pathText).toContain('활빈고');
    expect(p.education.pathText).not.toContain(old);
    expect(s.draftLog!.filter((x) => x.id === p.id).every((x) => x.name === '홍길동' && x.from === '활빈고')).toBe(true);
    expect(s.hallOfFame!.find((h) => h.id === p.id)!.name).toBe('홍길동');
    expect(nicknameOf(s, p)).toBe('의적');
    editPlayer(s, p.id, { ...editOf(p), nickname: '' });
    expect(p.nicknameOwn).toBeUndefined();
  });

  it('refuses an empty name and a nickname too long', () => {
    const p = Object.values(s.players)[0]!;
    expect(checkPlayerEdit(s, p.id, { ...editOf(p), name: '  ' })).not.toBeNull();
    expect(checkPlayerEdit(s, p.id, { ...editOf(p), nickname: '가'.repeat(13) })).not.toBeNull();
    expect(checkPlayerEdit(s, p.id, editOf(p))).toBeNull();
    const before = p.name;
    editPlayer(s, p.id, { ...editOf(p), name: '' });
    expect(p.name).toBe(before);
  });

  it('ties brothers, twins and a father by their ages, and unties them', () => {
    const all = Object.values(s.players).filter((p) => !tiesOf(s, p.id).length);
    const a = all[0]!;
    const brother = all.find((p) => p !== a && Math.abs(born(p) - born(a)) <= 5)!;
    addTie(s, a.id, brother.id, 'brother');
    expect(familyOf(s, a.id).map((f) => f.id)).toContain(brother.id);
    expect(checkTie(s, a.id, brother.id, 'twin')).not.toBeNull(); // already family
    const notTwin = all.find((p) => p !== a && p !== brother && born(p) !== born(a))!;
    expect(checkTie(s, a.id, notTwin.id, 'twin')).not.toBeNull();
    const twin = all.find((p) => p !== a && p !== brother && born(p) === born(a));
    if (twin) {
      expect(checkTie(s, a.id, twin.id, 'twin')).toBeNull();
      addTie(s, a.id, twin.id, 'twin');
      expect(tiesOf(s, a.id).some((t) => t.kind === 'twin')).toBe(true);
    }
    // A father: sixteen years or more older, and only one.
    const young = all.filter((p) => p !== a).sort((x, y) => born(y) - born(x))[0]!;
    const old = all.filter((p) => p !== young).sort((x, y) => born(x) - born(y));
    const dad = old.find((p) => born(young) - born(p) >= 16);
    const near = old.find((p) => born(young) - born(p) < 16 && p !== young)!;
    expect(checkTie(s, young.id, near.id, 'father')).not.toBeNull();
    if (dad) {
      addTie(s, young.id, dad.id, 'father');
      const t = tiesOf(s, young.id).find((x) => x.kind === 'father')!;
      expect([t.a, t.b]).toEqual([dad.id, young.id]);
      const other = old.find((p) => p !== dad && born(young) - born(p) >= 16);
      if (other) expect(checkTie(s, young.id, other.id, 'father')).not.toBeNull();
    }
    removeTie(s, brother.id, a.id);
    expect(familyOf(s, a.id).map((f) => f.id)).not.toContain(brother.id);
  });

  it('goes through the actions, and finds players by name', () => {
    const [x, y] = Object.values(s.players).filter((p) => !tiesOf(s, p.id).length && p.status === 'active');
    const twinOk = born(x!) === born(y!);
    const n = apply(s, { kind: 'familyTie', id: x!.id, other: y!.id, rel: twinOk ? 'twin' : 'brother' });
    const ok = !checkTie(s, x!.id, y!.id, 'brother') || twinOk;
    if (ok) expect(tiesOf(n, x!.id).some((t) => t.a === y!.id || t.b === y!.id)).toBe(true);
    const m = apply(n, { kind: 'editPlayer', id: x!.id, edit: { ...editOf(n.players[x!.id]!), name: '임꺽정' } });
    expect(m.players[x!.id]!.name).toBe('임꺽정');
    expect(findPlayers(m, '꺽정', 'nobody').map((p) => p.id)).toContain(x!.id);
    expect(findPlayers(m, '  ', 'nobody')).toEqual([]);
  });

  it('renames any club, a new one included', () => {
    const teams = s.teams.map((t) => ({ ...t }));
    const fresh = { ...teams[0]!, kind: 'expansion' as const };
    teams[0] = fresh;
    const label = { ...labelOf(fresh), name: '한양 의적단', short: '의적' };
    expect(labelProblems(teams, { [fresh.id]: label })).toEqual([]);
    renameClubs(teams, { [fresh.id]: label });
    expect(teams[0]!.name).toBe('한양 의적단');
    expect(teams[0]!.short).toBe('의적');
    expect(labelProblems(teams, { [teams[1]!.id]: { ...labelOf(teams[1]!), short: '의적' } }).length).toBeGreaterThan(0);
  });
});
