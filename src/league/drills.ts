import { k as __i18n_k } from '../i18n/index';
/* 2.0.66 (the user's request: 훈련 세분화): a player's training in more detail — a programme and how hard he trains.

   - The programme (훈련 프로그램) is what he works on: the whole game (균형), one ability as before (구위, 제구, 컨택…),
     or one of the coaches' combined programmes — 하체·웨이트 (구위와 체력), 투구 폼 교정 (제구와 구위), 변화구 다듬기
     (변화구와 제구); 웨이트 트레이닝 (파워와 컨택), 스윙 교정 (컨택과 선구안), 주루·수비 (스피드와 수비). An ability
     the programme works on grows faster in the winter (all of it for one ability, its share for a combined one), the
     others a little slower — the focus of before, in parts.
   - The intensity (훈련 강도): 가볍게, 보통, 강하게. Harder training grows him more and hurts him more often (the
     injury chance in games and in training), lighter the other way; the monthly reports see it too (farmreport.ts).

   The user's players only (an AI club's have no plan: 균형, 보통). Game assumptions throughout. */
import { DRAFT_GROWTH, TOOL_LABELS, type ToolKey } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { isPitcher } from './players';
import type { LeagueState } from './state';

export type Intensity = 'light' | 'normal' | 'hard';

export interface Program {
  who: 'pitcher' | 'hitter' | 'all';
  /** The abilities it works on and their shares (none: the whole game). */
  weights: Partial<Record<ToolKey, number>>;
}

/** The programmes; a single ability's key is the focus of before 2.0.66. */
export const PROGRAMS: Record<string, Program> = {
  balanced: { who: 'all', weights: {} },
  stuff: { who: 'pitcher', weights: { stuff: 1 } },
  command: { who: 'pitcher', weights: { command: 1 } },
  breaking: { who: 'pitcher', weights: { breaking: 1 } },
  stamina: { who: 'pitcher', weights: { stamina: 1 } },
  lowerBody: { who: 'pitcher', weights: { stuff: 0.6, stamina: 0.4 } },
  mechanics: { who: 'pitcher', weights: { command: 0.6, stuff: 0.4 } },
  pitchMix: { who: 'pitcher', weights: { breaking: 0.6, command: 0.4 } },
  contact: { who: 'hitter', weights: { contact: 1 } },
  power: { who: 'hitter', weights: { power: 1 } },
  eye: { who: 'hitter', weights: { eye: 1 } },
  speed: { who: 'hitter', weights: { speed: 1 } },
  defense: { who: 'hitter', weights: { defense: 1 } },
  weights: { who: 'hitter', weights: { power: 0.6, contact: 0.4 } },
  swing: { who: 'hitter', weights: { contact: 0.6, eye: 0.4 } },
  running: { who: 'hitter', weights: { speed: 0.5, defense: 0.5 } },
};

export const INTENSITY: Record<Intensity, { growth: number; injury: number; score: number }> = {
  light: { growth: 0.9, injury: 0.85, score: -8 },
  normal: { growth: 1, injury: 1, score: 0 },
  hard: { growth: 1.1, injury: 1.2, score: 8 },
};
export const INTENSITIES: Intensity[] = ['light', 'normal', 'hard'];

/** The programmes open to a pitcher or a hitter (균형 first). */
export function programsFor(pitcher: boolean): string[] {
  return Object.entries(PROGRAMS)
    .filter(([, x]) => x.who === 'all' || (x.who === 'pitcher') === pitcher)
    .map(([k]) => k);
}

/** How much faster (or slower) `key` grows under the programme `focus`: a single ability as before 2.0.66, a combined
    programme by its shares, an unknown key as 균형. */
export function programFactor(focus: string | undefined, key: string): number {
  const w = PROGRAMS[focus ?? 'balanced']?.weights;
  if (!w || !Object.keys(w).length) return 1;
  const F = DRAFT_GROWTH.focus;
  const share = w[key as ToolKey] ?? 0;
  return F.others + (F.chosen - F.others) * share;
}

export const intensityOf = (p: Pick<Player, 'plan'>): Intensity => p.plan?.intensity ?? 'normal';
export const programOf = (p: Pick<Player, 'plan'>): string => p.plan?.focus ?? 'balanced';
/** The abilities his programme works on, the main one first. */
export const programTools = (focus: string): ToolKey[] =>
  Object.entries(PROGRAMS[focus]?.weights ?? {})
    .sort(([, a], [, b]) => b - a)
    .map(([k]) => k as ToolKey);

/** The programme's name. */
export function programLabel(key: string): string {
  switch (key) {
    case 'balanced':
      return __i18n_k("league.drills.text.45c89bab");
    case 'lowerBody':
      return __i18n_k("league.drills.text.dbdc584d");
    case 'mechanics':
      return __i18n_k("league.drills.text.33e737de");
    case 'pitchMix':
      return __i18n_k("league.drills.text.a7fe8e43");
    case 'weights':
      return __i18n_k("league.drills.text.50dc118c");
    case 'swing':
      return __i18n_k("league.drills.text.4060c232");
    case 'running':
      return __i18n_k("league.drills.text.02031094");
    default:
      return (TOOL_LABELS as Record<string, string>)[key] ?? key;
  }
}

/** The intensity's name. */
export const intensityLabel = (x: Intensity) => (x === 'light' ? __i18n_k("league.drills.text.692d09fc") : x === 'hard' ? __i18n_k("league.drills.text.60b8c916") : __i18n_k("league.drills.text.2179da2c"));

/** Why his programme or intensity cannot be set so, or null: ours, a programme for his side, a known intensity. */
export function checkTrainingPlan(s: LeagueState, id: PlayerId, focus?: string, intensity?: Intensity): string | null {
  const u = s.user;
  const p = s.players[id];
  if (!u || !p || p.teamId !== u.teamId) return __i18n_k("league.drills.text.174a326e");
  if (focus !== undefined && !programsFor(isPitcher(p)).includes(focus)) return __i18n_k("league.drills.text.daf9b17d");
  if (intensity !== undefined && !INTENSITIES.includes(intensity)) return __i18n_k("league.drills.text.04ba7011");
  return null;
}

/** Sets his programme and/or intensity (from now: the reports and the injury chance at once, the growth in the
    winter). */
export function setTrainingPlan(s: LeagueState, id: PlayerId, focus?: string, intensity?: Intensity) {
  const problem = checkTrainingPlan(s, id, focus, intensity);
  if (problem) throw new Error(problem);
  const p = s.players[id]!;
  const plan = { ...p.plan, focus: focus ?? p.plan?.focus ?? 'balanced' };
  if (intensity === 'normal') delete plan.intensity;
  else if (intensity) plan.intensity = intensity;
  p.plan = plan;
}
