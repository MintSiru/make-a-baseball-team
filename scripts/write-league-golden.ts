/* Records the league golden hash (tests/fixtures/league-golden.json) for the current SIM_VERSION.
   Refuses when results changed but SIM_VERSION did not: old saves would replay into a different history. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { SIM_VERSION } from '../src/core/version';
import { goldenHash } from '../tests/golden';

const FILE = new URL('../tests/fixtures/league-golden.json', import.meta.url);
const hash = goldenHash();
const old = existsSync(FILE) ? (JSON.parse(readFileSync(FILE, 'utf8')) as { sim: string; hash: string }) : null;
if (old && old.sim === SIM_VERSION && old.hash !== hash) {
  console.error(`Simulation results changed but SIM_VERSION is still '${SIM_VERSION}'. Bump it in src/core/version.ts first.`);
  process.exit(1);
}
writeFileSync(FILE, JSON.stringify({ sim: SIM_VERSION, hash }, null, 2) + '\n');
console.log(`league golden recorded for SIM_VERSION ${SIM_VERSION}`);
