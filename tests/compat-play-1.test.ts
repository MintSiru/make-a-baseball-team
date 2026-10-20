/* Saves of released versions play on through a season, a winter and the next opening day (compat/shared.ts): the
   first of four parts, so they run side by side (2.0.30). */
import { describe, it } from 'vitest';
import { part, playsOn } from './compat/shared';

describe.each(part(1))('a %s save', (version) => {
  it('plays on through the season, the winter and the next opening day', () => playsOn(version), 600_000);
});
