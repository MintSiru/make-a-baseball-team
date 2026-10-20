/* 2.0.29 (the user's question: can the tests run faster?): a league from createLeague takes some 36 seconds to build
   (its history played season by season) and a test run builds over a hundred. With LEAGUE_CACHE=1 a built league is
   kept on disk (node_modules/.cache/kbo-leagues), keyed by its arguments and by every source file's content, and read
   back in a fraction of a second the next time — for running a test file again while working on it. Any change under
   src/ makes new keys, so a stale league is never read (2.0.30: but the screens' code in src/ui, which no league is
   built from). Off by default (and on CI), where every league is built. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const DIR = join(ROOT, 'node_modules', '.cache', 'kbo-leagues');

let srcHash: string | null = null;
function hashSources(): string {
  if (srcHash) return srcHash;
  const h = createHash('sha1');
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      if (path === join(ROOT, 'src', 'ui')) continue;
      if (statSync(path).isDirectory()) walk(path);
      else {
        h.update(path.slice(ROOT.length));
        h.update(readFileSync(path));
      }
    }
  };
  walk(join(ROOT, 'src'));
  return (srcHash = h.digest('hex').slice(0, 16));
}

// doMock (not hoisted), so the switch decides; the test files import after this runs.
if (process.env.LEAGUE_CACHE === '1') {
  vi.doMock('../../src/league/history', async (importOriginal) => {
    const real = await importOriginal<typeof import('../../src/league/history')>();
    const { setEra } = await import('../../src/league/era');
    const createLeague: typeof real.createLeague = (seed, onYear, shift, historical) => {
      // A progress callback wants the seasons as they are played: build it.
      if (onYear) return real.createLeague(seed, onYear, shift, historical);
      const key = createHash('sha1').update(JSON.stringify([hashSources(), seed, shift ?? 0, !!historical])).digest('hex');
      const file = join(DIR, `${key}.json`);
      if (existsSync(file)) {
        const s = JSON.parse(readFileSync(file, 'utf8'));
        // The calendar createLeague leaves behind, as the game sets it for a loaded league.
        setEra(s);
        return s;
      }
      const s = real.createLeague(seed, onYear, shift, historical);
      mkdirSync(DIR, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify(s));
      renameSync(tmp, file);
      return s;
    };
    return { ...real, createLeague };
  });
}
