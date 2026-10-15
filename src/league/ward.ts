/* Scenario 11, 부상병동 (1.8.0, from the 1.7 feedback): a new fitness trainer puts the players on a high-intensity
   programme the club cannot talk him out of. Our club alone gets hurt twice as often (game injuries, knocks and
   freak accidents alike), stays out longer, and plays tired: a point off every player's main tools in every
   game, and starters pulled a few pitches sooner. Kept apart from scenarios.ts so the injury and
   lineup code can ask without importing the scenario machinery. */
import type { TeamId } from '../model/types';
import type { LeagueState } from './state';

export const WARD = {
  /** Our injury chances × this (serious injuries and knocks; freak accidents too). */
  injury: 2,
  /** Our layoffs × this. */
  rehab: 1.4,
  /** Tired legs: points off the main tools in every game. */
  fatigue: 1,
  /** Tired arms: a starter's pitch limit lowered by this. */
  pitchLimit: 6,
} as const;

/** This club is the one under the trainer's programme. */
export const inWard = (s: LeagueState, teamId: TeamId | null | undefined) => !!teamId && s.user?.settings.scenario === 'ward' && s.user.teamId === teamId;
