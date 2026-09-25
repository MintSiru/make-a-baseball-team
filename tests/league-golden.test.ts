import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SIM_VERSION } from '../src/core/version';
import { goldenHash } from './golden';

const FILE = new URL('./fixtures/league-golden.json', import.meta.url);

describe('league golden master', () => {
  it('reproduces the recorded history for this SIM_VERSION', () => {
    expect(existsSync(FILE), 'No golden recorded: npm run golden:write').toBe(true);
    const golden = JSON.parse(readFileSync(FILE, 'utf8')) as { sim: string; hash: string };
    expect(golden.sim, `SIM_VERSION is now ${SIM_VERSION}: re-record with npm run golden:write`).toBe(SIM_VERSION);
    expect(goldenHash(), 'Simulation results changed: bump SIM_VERSION in src/core/version.ts, then npm run golden:write').toBe(golden.hash);
  }, 120_000);
});
