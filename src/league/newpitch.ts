import { k as __i18n_k } from '../i18n/index';
/* 2.0.8 (the user's request): learning a new pitch over the winter. The general manager picks pitchers of ours and a
   pitch for each (up to three a winter); when the winter's development comes round each one takes, or does not, by
   his age, his 변화구 and the pitching coach. A pitch that takes joins his mix at a small share and starts well under his
   other pitches, gaining a few points a winter for three winters (then it goes its own way with the rest, 2.0.6).
   Other clubs' young pitchers now and then pick one up too. Each attempt has its own random stream, so nothing else
   moves with it. */
import { rng } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { eulreul, iga } from './josa';
import { addNews } from './news';
import { FAMILY, fastballOf, PITCH_LABELS, repertoire, type PitchType } from './pitches';
import { ageIn, isForeign, isPitcher } from './players';
import type { LeagueState } from './state';

export const LEARN = {
  perWinter: 3,
  maxPitches: 6,
  base: 0.55,
  perBreaking: 0.01,
  /** Taken off a winter for each year past 28. */
  perAge: 0.05,
  perCoach: 0.006,
  min: 0.08,
  max: 0.9,
  startOffset: -12,
  gain: 3,
  top: -3,
  gainWinters: 3,
  ai: 0.012,
};

const ALL = Object.keys(PITCH_LABELS) as PitchType[];

/** Pitches he could learn: not his already, nor of a family he throws (his fastball's included). */
export function learnable(p: Player): PitchType[] {
  if (!isPitcher(p) || p.hidden.current.breaking == null) return [];
  const rep = repertoire(p);
  if (rep.length >= LEARN.maxPitches) return [];
  const fb = fastballOf(p);
  const families = new Set([...rep.map((x) => FAMILY[x.type]), FAMILY[fb as PitchType]].filter(Boolean));
  return ALL.filter((t) => t !== fb && !rep.some((x) => x.type === t) && !(FAMILY[t] && families.has(FAMILY[t])));
}

/** The chance it takes this winter. */
export function learnChance(s: LeagueState, p: Player, year: number): number {
  const age = ageIn(p, year);
  const breaking = p.scouting.tools.breaking ?? 40;
  const coach = (p.teamId && s.clubs?.[p.teamId]?.staff?.pitching?.rating) || 50;
  const x = LEARN.base + (breaking - 50) * LEARN.perBreaking - Math.max(0, age - 28) * LEARN.perAge + (coach - 50) * LEARN.perCoach;
  return Math.round(Math.max(LEARN.min, Math.min(LEARN.max, x)) * 100) / 100;
}

/** Why the user's club cannot plan this (null if it can). */
export function checkLearn(s: LeagueState, id: PlayerId, type: PitchType | null): string | null {
  const u = s.user;
  const p = s.players[id];
  if (!u || !p || p.teamId !== u.teamId) return __i18n_k("league.newpitch.text.98e9fc45");
  if (!isPitcher(p)) return __i18n_k("league.newpitch.text.ebb0ad19");
  if (type === null) return null;
  if (!learnable(p).includes(type)) return __i18n_k("league.newpitch.text.d3e8adb3");
  const plans = u.pitchPlans ?? {};
  if (!(id in plans) && Object.keys(plans).length >= LEARN.perWinter) return __i18n_k("league.newpitch.text.2320937e", { n: LEARN.perWinter });
  return null;
}

/** Plans (or with null cancels) a pitch for the coming winter. */
export function planLearn(s: LeagueState, id: PlayerId, type: PitchType | null) {
  if (checkLearn(s, id, type)) return;
  const plans = (s.user!.pitchPlans ??= {});
  if (type) plans[id] = type;
  else delete plans[id];
}

function learn(p: Player, type: PitchType, year: number) {
  (p.learned ??= []).push({ type, year, offset: LEARN.startOffset });
}

/** The winter's development: learned pitches gain, the user's plans are tried, and other clubs' arms now and then. */
export function learnWinter(s: LeagueState, year: number) {
  for (const p of Object.values(s.players))
    for (const x of p.learned ?? []) if (year - x.year >= 1 && year - x.year <= LEARN.gainWinters) x.offset = Math.min(LEARN.top, x.offset + LEARN.gain);
  const u = s.user;
  for (const [id, type] of Object.entries(u?.pitchPlans ?? {})) {
    const p = s.players[id];
    if (!p || p.teamId !== u!.teamId || !learnable(p).includes(type)) continue;
    const chance = learnChance(s, p, year);
    const took = rng(`${s.seed}|learn|${year}|${id}`)() < chance;
    if (took) learn(p, type, year);
    const pitch = PITCH_LABELS[type];
    addNews(s, {
      id: `learn-${year}-${id}`,
      date: `${year}-12-10`,
      kind: 'milestone',
      title: took ? __i18n_k("league.newpitch.text.2d69c235", { name: p.name, pitch }) : __i18n_k("league.newpitch.text.ec2996e2", { name: p.name, pitch }),
      body: took ? __i18n_k("league.newpitch.text.531305b4", { name: p.name, pitch: iga(pitch) }) : __i18n_k("league.newpitch.text.868119ab", { name: iga(p.name), pitch: eulreul(pitch) }),
      quotes: [],
      facts: { name: p.name, pitch, chance: Math.round(chance * 100) },
      players: [id],
      mine: true,
    });
  }
  if (u) delete u.pitchPlans;
  // Other clubs' young arms now and then.
  for (const p of Object.values(s.players)) {
    if (p.status !== 'active' || !isPitcher(p) || (u && p.teamId === u.teamId) || isForeign(p) || ageIn(p, year) > 31) continue;
    const r = rng(`${s.seed}|learn-ai|${year}|${p.id}`);
    if (r() >= LEARN.ai || repertoire(p).length >= 4) continue;
    const can = learnable(p);
    if (can.length && r() < learnChance(s, p, year)) learn(p, can[Math.floor(r() * can.length)]!, year);
  }
}

/** A learned pitch's note on his page ("2031 겨울에 익힘"), or null. */
export function learnedNote(p: Player, type: string): string | null {
  const x = p.learned?.find((y) => y.type === type);
  return x ? __i18n_k("league.newpitch.text.de2f38a6", { year: x.year }) : null;
}

