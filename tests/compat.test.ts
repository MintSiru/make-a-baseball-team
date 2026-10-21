/* Saves made by released versions keep working (V1.0, docs/PLAN-1.0.md §4 G). The fixtures are real autosaves
   written by the 0.11.0, 0.12.0, 0.16.0, 1.0.0, 1.1.0, 1.2.0, 1.3.0, 1.4.0, 1.6.0, 1.7.0, 1.7.1, 1.8.0, 1.8.1, 1.8.2, 1.8.4, 1.9.0, 1.9.3, 1.9.5, 1.9.8, 1.9.9, 2.0.0, 2.0.1, 2.0.2, 2.0.3, 2.0.4, 2.0.5, 2.0.6, 2.0.7, 2.0.8, 2.0.11, 2.0.12, 2.0.15, 2.0.16, 2.0.17, 2.0.18 and 2.0.21, 2.0.22, 2.0.24, 2.0.25, 2.0.26, 2.0.27, 2.0.28, 2.0.29, 2.0.30 code (a naming-rights club on hard, three weeks into its first first-team
   season, a rival club due in the winter of 2028), gzip-packed. Each is loaded the way the game loads a file and played
   through the rest of the season, the winter and into the next opening day. */
import { describe, it } from 'vitest';
import { loads, VERSIONS } from './compat/shared';

// The versions are listed in compat/shared.ts; playing each on is in compat-play-1…4 (2.0.30).
describe.each(VERSIONS)('a %s save', (version) => {
  it('loads, carried forward to the current rules when they changed', () => loads(version));
});
