import { k as __i18n_k } from '../i18n/index';
/* Display settings (V0.7.6): the colours of the 20–80 ability bars, and whether the grades in the tables are
   coloured too. A per-browser preference like the alert pop-ups: never in the save, so a shared save file
   opens in the reader's own colours. */

/** Five tiers of the 20–80 scale: under 40, 40s, 50s, 60s, 70 and up. */
export type Tier = 0 | 1 | 2 | 3 | 4;
export const TIER_LABELS = [__i18n_k("ui.display.tIER_LABELS.0d9ea195"), '40–49', '50–59', '60–69', __i18n_k("ui.display.tIER_LABELS.722c51be")] as const;
export const gradeTier = (g: number): Tier => (g >= 70 ? 4 : g >= 60 ? 3 : g >= 50 ? 2 : g >= 40 ? 1 : 0);

export type BarPreset = 'club' | 'scale' | 'safe' | 'mono' | 'custom';
type Colors = [string, string, string, string, string];

export interface DisplayPrefs {
  bars: BarPreset;
  /** The colours of the custom preset, lowest tier first. */
  custom: Colors;
  /** Colour the overall grades in the player tables as well (the lineup's tool grades always are). */
  tables: boolean;
  /** Table rows (V0.7.7): compact fits more on the screen at once. */
  density: 'compact' | 'comfortable';
  /** Light or dark (V0.15): the system's choice unless the player picks one. */
  theme: Theme;
  /** Text size (V0.15). */
  scale: Scale;
  /** 1.6.0: our games open as a relay from the first pitch, the score hidden until the end (or until asked). */
  hideScores: boolean;
}

export type Theme = 'system' | 'light' | 'dark';
export type Scale = 'small' | 'normal' | 'large';
export const THEME_LABELS: Record<Theme, string> = { system: __i18n_k("ui.display.tHEME_LABELS.system.6c3e1f09"), light: __i18n_k("ui.display.tHEME_LABELS.light.1dc155ce"), dark: __i18n_k("ui.display.tHEME_LABELS.dark.8beb3ca0") };
export const SCALE_LABELS: Record<Scale, string> = { small: __i18n_k("ui.display.sCALE_LABELS.small.2247a832"), normal: '보통', large: __i18n_k("ui.display.sCALE_LABELS.large.69d7538d") };
/** How much the page is scaled for each text size. */
export const SCALE_ZOOM: Record<Scale, number> = { small: 0.92, normal: 1, large: 1.12 };

/** null: the stylesheet's own colours (the club colour above 60, grey in the middle, pale under 40). */
export const PRESETS: Record<Exclude<BarPreset, 'custom'>, { label: string; note: string; colors: Colors | null }> = {
  club: { label: __i18n_k("ui.display.club.label.6200c0aa"), note: __i18n_k("ui.display.club.note.6dcee184"), colors: null },
  scale: { label: __i18n_k("ui.display.scale.label.c797f3c4"), note: __i18n_k("ui.display.scale.note.2ca80346"), colors: ['#c8412f', '#e0862c', '#cfab2a', '#3d9a4f', '#2f6fd6'] },
  safe: { label: __i18n_k("ui.display.safe.label.f9206346"), note: __i18n_k("ui.display.safe.note.262c389d"), colors: ['#b85c00', '#e39b43', '#8c8c8c', '#4f93d1', '#1f5fa6'] },
  mono: { label: __i18n_k("ui.display.mono.label.d1e6f293"), note: __i18n_k("ui.display.mono.note.c6e34ea1"), colors: ['var(--rule)', 'var(--ink-2)', 'var(--ink-2)', 'var(--ink)', 'var(--ink)'] },
};

export const DEFAULT_PREFS: DisplayPrefs = { bars: 'club', custom: [...PRESETS.scale.colors!] as Colors, tables: false, density: 'compact', theme: 'system', scale: 'normal', hideScores: false };

const HEX = /^#[0-9a-f]{6}$/i;

/** Read stored preferences, keeping only what is valid. */
export function parseDisplay(raw: string | null): DisplayPrefs {
  let v: Partial<DisplayPrefs> = {};
  try {
    v = raw ? (JSON.parse(raw) as Partial<DisplayPrefs>) : {};
  } catch {
    // A damaged value: the defaults.
  }
  const bars = typeof v.bars === 'string' && (v.bars === 'custom' || Object.hasOwn(PRESETS, v.bars)) ? v.bars : DEFAULT_PREFS.bars;
  const custom = DEFAULT_PREFS.custom.map((d, i) => (Array.isArray(v.custom) && typeof v.custom[i] === 'string' && HEX.test(v.custom[i]) ? v.custom[i] : d)) as Colors;
  const theme: Theme = v.theme === 'light' || v.theme === 'dark' ? v.theme : 'system';
  const scale: Scale = v.scale === 'small' || v.scale === 'large' ? v.scale : 'normal';
  return { bars, custom, tables: v.tables === true, density: v.density === 'comfortable' ? 'comfortable' : 'compact', theme, scale, hideScores: v.hideScores === true };
}

/** The five tier colours to set, or null for the stylesheet's own. */
export function tierColors(p: DisplayPrefs): Colors | null {
  return p.bars === 'custom' ? p.custom : PRESETS[p.bars].colors;
}

// ── Storage and applying ─────────────────────────────────────────────────────────────────────────

const KEY = 'kbo-expansion-display';
export const DISPLAY_EVENT = KEY;
let memory: DisplayPrefs | null = null;

export function loadDisplay(): DisplayPrefs {
  if (memory) return memory;
  try {
    return parseDisplay(localStorage.getItem(KEY));
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Set the tier colours as CSS variables on the page (the bars, the lineup's grades and, if chosen, the tables). */
export function applyDisplay(p: DisplayPrefs, root: HTMLElement = document.documentElement) {
  const colors = tierColors(p);
  for (let i = 0; i < 5; i++) {
    if (colors) root.style.setProperty(`--grade-${i}`, colors[i]!);
    else root.style.removeProperty(`--grade-${i}`);
  }
  if (colors) root.dataset.gradeColors = p.bars;
  else delete root.dataset.gradeColors;
  if (p.tables) root.dataset.gradeTables = 'on';
  else delete root.dataset.gradeTables;
  root.dataset.density = p.density;
  if (p.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = p.theme;
  if (p.scale === 'normal') delete root.dataset.scale;
  else root.dataset.scale = p.scale;
}

/** Whether the page shows dark now: the player's pick, else the system's. */
export const isDark = (p: DisplayPrefs) => p.theme === 'dark' || (p.theme === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);

// ── Club colour as the accent (V0.15) ───────────────────────────────────────────────────────────
// The club colour is the page's accent: links, the current tab, primary buttons. A navy club on the dark
// page, or a pale one on paper, could not be read, so the accent is darkened or lightened until it stands
// out from the paper (4.5:1, the WCAG text contrast), and button text takes whichever of white or ink reads
// better on it.

/** Every background the accent is read on: paper, paper-2, cards, zebra rows, the tutorial card. */
const BACKGROUNDS = { light: ['#f6f3ec', '#ece7dc', '#fbf9f4', '#f1ede4'], dark: ['#16181b', '#1f2226', '#1c1f23', '#23272c', '#1f282d'] };
const INK = { light: '#ffffff', dark: '#0d1116' };

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const hexOf = (c: number[]) => `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`;
function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** The accent and its button text for a club colour on the light or dark page. */
export function readableAccent(color: string, dark: boolean): { accent: string; ink: string } {
  if (!HEX.test(color)) return { accent: color, ink: dark ? INK.dark : INK.light };
  const backgrounds = dark ? BACKGROUNDS.dark : BACKGROUNDS.light;
  // 4.7, not 4.5: some cards are tinted with the accent itself and come out a shade lighter.
  const readable = (c: string) => backgrounds.every((bg) => contrast(c, bg) >= 4.7);
  const toward = dark ? [255, 255, 255] : [0, 0, 0];
  const from = rgb(color);
  let accent = color.toLowerCase();
  for (let t = 0.04; !readable(accent) && t <= 1; t += 0.04) accent = hexOf(from.map((v, i) => v + (toward[i]! - v) * t));
  const ink = contrast(accent, INK.light) >= contrast(accent, INK.dark) ? INK.light : INK.dark;
  return { accent, ink };
}

/** The style that puts a club colour on a part of the page as its accent. */
export function accentStyle(color: string, dark: boolean): Record<string, string> {
  const { accent, ink } = readableAccent(color, dark);
  return { '--accent': accent, '--accent-ink': ink };
}

export function saveDisplay(p: DisplayPrefs) {
  memory = p;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage blocked: the choice lasts for this tab.
  }
  applyDisplay(p);
  window.dispatchEvent(new Event(DISPLAY_EVENT));
}

// ── Games watched (1.6.0) ────────────────────────────────────────────────────────────────────────

const WATCHED = 'kbo-expansion-watched';
let watchedMemory: string[] | null = null;

/** Our games whose relay the player has seen to the end (or opened with the score), newest last. */
export function watchedGames(): Set<string> {
  if (watchedMemory) return new Set(watchedMemory);
  try {
    const v = JSON.parse(localStorage.getItem(WATCHED) ?? '[]') as unknown;
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function markWatched(id: string) {
  const list = [...watchedGames()].filter((x) => x !== id);
  list.push(id);
  watchedMemory = list.slice(-80);
  try {
    localStorage.setItem(WATCHED, JSON.stringify(watchedMemory));
  } catch {
    // Storage blocked: remembered for this tab.
  }
}

/** Whether to keep this game's score out of sight: the setting is on, it is our game with a relay, not yet seen. */
export const spoilerHidden = (id: string, ours: boolean, relay: boolean) => ours && relay && loadDisplay().hideScores && !watchedGames().has(id);
