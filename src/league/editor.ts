import { k as __i18n_k } from '../i18n/index';
/* 2.0.9 (the user's request): the editor — a player's name, hometown, school and nickname, and family ties between
   players, for any player in the league; abilities are not editable. Records that keep a copy of his name (retired
   numbers, the draft log, the hall of fame, the owner's gifts, FA promises, the rival's special draft) follow the
   new name; articles already written keep the old one, as with clubs' names (V0.13). Nothing here touches the
   simulation's random streams. */
import type { Player, PlayerId } from '../model/types';
import { type FamilyKind, tiesOf } from './family';
import { eunneun } from './josa';
import { NICKNAME_MAX } from './nicknames';
import type { LeagueState } from './state';

export const EDIT = { name: { min: 1, max: 20 }, birthplace: { min: 1, max: 20 }, school: { min: 1, max: 24 }, ties: 8, fatherGap: 16, brotherGap: 25 };

export interface PlayerEdit {
  name: string;
  birthplace: string;
  school: string;
  /** Empty: the fans' nickname (or none). */
  nickname: string;
}

export const editOf = (p: Player): PlayerEdit => ({ name: p.name, birthplace: p.birthplace, school: p.education.school, nickname: p.nicknameOwn ?? '' });

const len = (v: string) => [...v].length;

/** Why this edit cannot be made (null if it can). */
export function checkPlayerEdit(s: LeagueState, id: PlayerId, e: PlayerEdit): string | null {
  if (!s.players[id]) return __i18n_k('league.editor.text.65f1bb5d');
  const fields: [keyof typeof EDIT & keyof PlayerEdit, string][] = [
    ['name', __i18n_k('league.editor.text.9aa18e50')],
    ['birthplace', __i18n_k('league.editor.text.71479e57')],
    ['school', __i18n_k('league.editor.text.add2f441')],
  ];
  for (const [k, what] of fields) {
    const n = len(e[k].trim());
    const r = EDIT[k];
    if (n < r.min || n > r.max) return __i18n_k('league.editor.text.3def3b1e', { what: eunneun(what), min: r.min, max: r.max });
  }
  if (len(e.nickname.trim()) > NICKNAME_MAX) return __i18n_k('league.editor.text.327ea555', { n: NICKNAME_MAX });
  return null;
}

/** Makes the edit (nothing if it cannot be made). */
export function editPlayer(s: LeagueState, id: PlayerId, e: PlayerEdit) {
  if (checkPlayerEdit(s, id, e)) return;
  const p = s.players[id]!;
  const name = e.name.trim(),
    birthplace = e.birthplace.trim(),
    school = e.school.trim(),
    nickname = e.nickname.trim();
  if (name !== p.name) rename(s, id, name);
  p.birthplace = birthplace;
  const old = p.education.school;
  if (school !== old) {
    // The school's name in his path and history too ("서울고 졸업 → 2차 1R"), as north.ts does.
    const swap = (text: string) => (old ? text.split(old).join(school) : text);
    p.education = { ...p.education, school, pathText: swap(p.education.pathText), history: p.education.history.map((h) => JSON.parse(swap(JSON.stringify(h)))) };
    for (const d of s.draftLog ?? []) if (d.id === id) d.from = school;
  }
  if (nickname) p.nicknameOwn = nickname;
  else delete p.nicknameOwn;
}

function rename(s: LeagueState, id: PlayerId, name: string) {
  s.players[id]!.name = name;
  const fix = (x: { name: string }) => (x.name = name);
  for (const t of s.teams) for (const r of t.retiredNumbers ?? []) if (r.playerId === id) fix(r);
  for (const d of s.draftLog ?? []) if (d.id === id) fix(d);
  for (const h of s.hallOfFame ?? []) if (h.id === id) fix(h);
  for (const g of s.user?.parentGifts ?? []) if (g.id === id) fix(g);
  for (const g of s.user?.promises ?? []) if (g.id === id) fix(g);
  for (const g of s.twelve?.picks ?? []) if (g.id === id) fix(g);
}

/** A tie as the editor offers it: what the other man is to him. */
export type Relation = 'father' | 'son' | 'brother' | 'twin';

const bornIn = (p: Player) => Number(p.birthday.slice(0, 4));

/** The tie a relation makes (`a` the father, the older brother, the first-born twin). */
function tieFor(s: LeagueState, id: PlayerId, other: PlayerId, rel: Relation): { kind: FamilyKind; a: PlayerId; b: PlayerId } {
  if (rel === 'father') return { kind: 'father', a: other, b: id };
  if (rel === 'son') return { kind: 'father', a: id, b: other };
  const older = s.players[id]!.birthday <= s.players[other]!.birthday;
  return { kind: rel, a: older ? id : other, b: older ? other : id };
}

/** Why `other` cannot be made his `rel` (null if he can). */
export function checkTie(s: LeagueState, id: PlayerId, other: PlayerId, rel: Relation): string | null {
  const p = s.players[id],
    o = s.players[other];
  if (!p || !o) return __i18n_k('league.editor.text.65f1bb5d');
  if (id === other) return __i18n_k('league.editor.text.0e56e537');
  if (tiesOf(s, id).some((t) => t.a === other || t.b === other)) return __i18n_k('league.editor.text.555f749c');
  if (tiesOf(s, id).length >= EDIT.ties || tiesOf(s, other).length >= EDIT.ties) return __i18n_k('league.editor.text.a34be3ab', { n: EDIT.ties });
  const t = tieFor(s, id, other, rel);
  const gap = Math.abs(bornIn(p) - bornIn(o));
  if (t.kind === 'father') {
    if (bornIn(s.players[t.b]!) - bornIn(s.players[t.a]!) < EDIT.fatherGap) return __i18n_k('league.editor.text.2a60bb00', { n: EDIT.fatherGap });
    if ((s.families ?? []).some((x) => x.kind === 'father' && x.b === t.b)) return __i18n_k('league.editor.text.535ceade');
  }
  if (t.kind === 'brother' && gap > EDIT.brotherGap) return __i18n_k('league.editor.text.40fb5dbb', { n: EDIT.brotherGap });
  if (t.kind === 'twin' && gap !== 0) return __i18n_k('league.editor.text.55e63be5');
  return null;
}

/** Ties `other` to him as his `rel`. */
export function addTie(s: LeagueState, id: PlayerId, other: PlayerId, rel: Relation) {
  if (checkTie(s, id, other, rel)) return;
  const year = s.offseason?.year ?? s.year;
  (s.families ??= []).push({ ...tieFor(s, id, other, rel), year });
}

/** Unties the two. */
export function removeTie(s: LeagueState, id: PlayerId, other: PlayerId) {
  if (s.families) s.families = s.families.filter((t) => !((t.a === id && t.b === other) || (t.a === other && t.b === id)));
}

/** Players whose name has `text` in it, for the editor's family search (the first `limit`). */
export function findPlayers(s: LeagueState, text: string, except: PlayerId, limit = 20): Player[] {
  const q = text.trim();
  if (!q) return [];
  return Object.values(s.players)
    .filter((p) => p.id !== except && p.name.includes(q))
    .sort((a, b) => (a.status === 'retired' ? 1 : 0) - (b.status === 'retired' ? 1 : 0) || a.name.localeCompare(b.name))
    .slice(0, limit);
}
