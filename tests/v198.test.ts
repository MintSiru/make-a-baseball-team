/* 1.9.8: the update notes (the change log read into the game) and the legacy postseason of 1982–1985. */
import { describe, expect, it } from 'vitest';
import { RELEASE } from '../src/core/version';
import { newer, UPDATE_NOTES } from '../src/ui/updates';

describe('update notes', () => {
  it('reads every version of the change log, newest first, the current one on top', () => {
    expect(UPDATE_NOTES.length).toBeGreaterThan(40);
    expect(UPDATE_NOTES[0]!.version).toBe(RELEASE);
    for (let i = 1; i < UPDATE_NOTES.length; i++) expect(newer(UPDATE_NOTES[i - 1]!.version, UPDATE_NOTES[i]!.version)).toBe(true);
    expect(UPDATE_NOTES.every((n) => !n.text.includes('**'))).toBe(true);
  });

  it('compares versions by number', () => {
    expect(newer('1.10.0', '1.9.8')).toBe(true);
    expect(newer('1.9.8', '1.9.8')).toBe(false);
    expect(newer('0.16.0', '1.0.0')).toBe(false);
  });
});
