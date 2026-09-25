/* The game world. In V0.1 it holds only the first draft class; clubs and rosters arrive in V0.2. */
import { DRAFT_ROOM_DRAFT_YEAR, generateDraftPool } from '../draftroom';
import { fromDraftProspect } from '../model/player';
import type { GameDate, Player } from '../model/types';

export interface World {
  seed: string;
  date: GameDate;
  /** Prospects of the 2027 rookie draft (held September 2026), best public rank first. */
  draftClass: Player[];
}

/** The 2026 class uses the world seed itself, so a seed gives the same class as in Draft Room. */
export function createWorld(seed: string): World {
  const pool = generateDraftPool(seed);
  return {
    seed,
    date: { year: 2026, phase: 'founding' },
    draftClass: pool.players.map((p) => fromDraftProspect(p, DRAFT_ROOM_DRAFT_YEAR, seed)),
  };
}
