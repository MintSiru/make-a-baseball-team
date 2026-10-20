import { k as __i18n_k } from '../i18n/index';
/* 2.0.28 (the user's request): a prospect who played pro ball in America or Japan before the draft played for a club
   of the game's own lists, not an invented one — the majors' clubs (mlb.ts), a minor leaguer on one of their farm
   teams ("<club> AAA"), and an NPB 2군 on an NPB club's. The other leagues abroad (CPBL, LMB, ABL) and the
   independent leagues keep Draft Room's names. Which club is drawn from his id: the same every time, and a save from
   before 2.0.28 gets the same names on loading (save/migrate.ts). */
import Catalog from '../draftroom/catalog.js';
import { hashUnit, type HistoryEntry } from '../draftroom';
import type { Player } from '../model/types';
import { MLB_CLUBS, NPB_CLUBS } from './mlb';

interface Institution {
  id: string;
  kind: string;
  name: string;
  level?: string;
  country?: string;
}
const BY_ID = (Catalog as unknown as { byId: Record<string, Institution> }).byId;
const NPB_FARM = BY_ID.pro09?.level;

/** The club he played for at this stage, if it is one the game names after a real one. */
export function proClubName(playerId: string, e: Pick<HistoryEntry, 'institutionId'>): string | null {
  const inst = BY_ID[e.institutionId];
  if (inst?.kind !== 'overseas-pro') return null;
  const pick = (list: string[]) => list[Math.floor(hashUnit(`pro-club|${playerId}|${e.institutionId}`) * list.length)]!;
  if (inst.level === 'MLB') return pick(MLB_CLUBS);
  if (inst.level === 'A' || inst.level === 'AA' || inst.level === 'AAA') return `${pick(MLB_CLUBS)} ${inst.level}`;
  if (inst.level === NPB_FARM) return __i18n_k("league.proclubs.text.33ba061b", { club: pick(NPB_CLUBS) });
  return null;
}

/** Puts the real clubs into his history, his school (where he last played) and his path. */
export function withRealClubs(p: Pick<Player, 'id' | 'education'>): void {
  for (const e of p.education.history ?? []) {
    const name = proClubName(p.id, e);
    if (!name || e.name === name) continue;
    const old = e.name;
    e.name = name;
    if (p.education.school === old) p.education.school = name;
    p.education.pathText = p.education.pathText.split(old).join(name);
  }
}
