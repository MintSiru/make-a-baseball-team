/* V0.15: a page everyone can read — club colours made readable on light and dark paper, the theme and text
   size settings, and a short explanation for every decision. */
import { describe, expect, it } from 'vitest';
import { existingTeams, FICTIONAL_LABELS } from '../src/league/clubs';
import type { Decision } from '../src/league/state';
import { contrast, DEFAULT_PREFS, parseDisplay, readableAccent } from '../src/ui/display';
import { decisionTip, decisionTips } from '../src/ui/tutorial';

const BACKGROUNDS = { light: ['#f6f3ec', '#ece7dc', '#fbf9f4', '#f1ede4'], dark: ['#16181b', '#1f2226', '#1c1f23', '#23272c', '#1f282d'] };
// Every colour a club can wear: the real clubs, the fictional set, the founding form's swatches, and extremes.
const COLORS = [
  ...existingTeams().map((t) => t.color),
  ...Object.values(FICTIONAL_LABELS).map((l) => l.color),
  '#0f6e8c', '#1b7f5a', '#6b3fa0', '#c2572b', '#2f4858', '#b3261e', '#0b5394', '#8a6d1d',
  '#000000', '#ffffff', '#ffff00', '#7f7f7f', '#16181b', '#f6f3ec',
];

describe('club colour as the accent', () => {
  for (const dark of [false, true]) {
    it(`stays readable on every ${dark ? 'dark' : 'light'} background, with readable button text`, () => {
      for (const c of COLORS) {
        const { accent, ink } = readableAccent(c, dark);
        for (const bg of dark ? BACKGROUNDS.dark : BACKGROUNDS.light) expect(contrast(accent, bg), `${c} → ${accent} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(accent, ink), `${c} → ${accent} with ${ink}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it('leaves a colour alone when it already reads well', () => {
    expect(readableAccent('#1e3a5f', false).accent).toBe('#1e3a5f');
    expect(readableAccent('#1e3a5f', false).ink).toBe('#ffffff');
  });
});

describe('display settings', () => {
  it('theme and text size default to the system and normal, and bad values fall back', () => {
    expect(DEFAULT_PREFS.theme).toBe('system');
    expect(DEFAULT_PREFS.scale).toBe('normal');
    expect(parseDisplay(JSON.stringify({ theme: 'dark', scale: 'large' }))).toMatchObject({ theme: 'dark', scale: 'large' });
    expect(parseDisplay(JSON.stringify({ theme: 'purple', scale: 3 }))).toMatchObject({ theme: 'system', scale: 'normal' });
    // A setting stored by 0.14 or earlier (no theme or size yet).
    expect(parseDisplay(JSON.stringify({ bars: 'scale', tables: true, density: 'comfortable' }))).toMatchObject({ bars: 'scale', theme: 'system', scale: 'normal' });
  });
});

describe('decision explanations', () => {
  const KINDS: Decision['kind'][] = [
    'camp', 'development', 'dispute', 'draftPick', 'faCompensation', 'faOptions', 'faProtect', 'faRound', 'foreign', 'foreignRenew', 'military', 'national', 'posting', 'released',
    'retire', 'returnee', 'rival', 'rivalProtect', 'rookieBonus', 'roster', 'salaries', 'scandal', 'secondPick', 'secondProtect', 'specialDraft', 'sponsor', 'staff', 'tryout', 'meddle', 'fantasyPick',
  ];
  it('every decision has a title and a few lines (shown as "이 결정은?" and in the help tab)', () => {
    for (const k of KINDS) {
      const tip = decisionTip(k);
      expect(tip, k).not.toBeNull();
      expect(tip!.body.length, k).toBeGreaterThan(0);
    }
    expect(decisionTips().map(([k]) => k).sort()).toEqual([...KINDS].sort());
  });
});
