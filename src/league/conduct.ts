/* 2.0.76 (the user's request: 「약물이나 음주운전 같은 짓 했을 때 확인하는 기록」): the league's record of its players'
   offenses (징계 기록) — every incident (scandals.ts), at our club or another, with the KBO's penalty and the club's
   answer — and what a player's record weighs when the hall of fame's committee or a club's board deliberates on him
   (hallvote.ts, numbers.ts). */
import type { Player, PlayerId, TeamId } from '../model/types';
import type { Offense } from './scandals';
import type { LeagueState } from './state';

export interface OffenseEntry {
  date: string;
  id: PlayerId;
  name: string;
  teamId: TeamId | null;
  offense: Offense;
  /** The KBO's penalty (as the news gave it). */
  penalty: string;
  /** His club's answer, when it gave one. */
  answer?: string;
  /** A ban for life (he left the league). */
  life?: true;
}

/** Kept for the record: the last this many. */
const KEEP = 600;

export function recordOffense(s: LeagueState, e: OffenseEntry) {
  const list = (s.offenseLog ??= []);
  list.push(e);
  if (list.length > KEEP) list.splice(0, list.length - KEEP);
}

/** His club's answer to his latest offense of this kind. */
export function answerOffense(s: LeagueState, id: PlayerId, offense: Offense, answer: string) {
  const e = [...(s.offenseLog ?? [])].reverse().find((x) => x.id === id && x.offense === offense);
  if (e) e.answer = answer;
}

/** His offenses, the latest first. */
export const offensesOf = (s: LeagueState, id: PlayerId) => (s.offenseLog ?? []).filter((e) => e.id === id).reverse();

/** What each offense weighs against him in a deliberation (points off a hall of fame vote's share; a club's board
    holds his number back from 25). Match fixing bars him for good. */
export const CONDUCT = {
  weight: {
    dui: 15,
    doping: 30,
    assault: 8,
    fixing: Infinity,
    affair: 5,
    abortion: 10,
    gambling: 20,
    gangs: 20,
    schoolViolence: 20,
    draftDodge: 25,
    insubordination: 3,
    fanQuarrel: 2,
    narcotics: 15,
    drunkBrawl: 8,
    drugs: 35,
    hazing: 10,
    abuse: 10,
  } as Record<Offense, number>,
  /** The most it takes off (short of a bar). */
  max: 60,
  /** A club's board: at this weight or more it does not retire his number. */
  board: 25,
};

/** The weight of his record (Infinity: barred). */
export function conductWeight(p: Player): number {
  let w = 0;
  for (const [o, n] of Object.entries(p.life?.offenses ?? {})) if (n) w += (CONDUCT.weight[o as Offense] ?? 0) * n;
  return w === Infinity ? Infinity : Math.min(CONDUCT.max, w);
}
