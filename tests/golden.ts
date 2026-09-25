/* The league golden master: a fixed seed built to 2026 opening day, hashed. Shared by the test and
   scripts/write-league-golden.ts. */
import { createHash } from 'node:crypto';
import { createLeague } from '../src/league/history';
import type { LeagueState } from '../src/league/state';

export const GOLDEN_SEED = 'golden-league';
export const hashLeague = (s: LeagueState) => createHash('sha256').update(JSON.stringify(s)).digest('hex');
export const goldenHash = () => hashLeague(createLeague(GOLDEN_SEED));
