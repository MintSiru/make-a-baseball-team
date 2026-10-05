/* Display settings (V0.7.6): the colours of the 20–80 ability bars, and whether the grades in the tables are
   coloured too. A per-browser preference like the alert pop-ups: never in the save, so a shared save file
   opens in the reader's own colours. */

/** Five tiers of the 20–80 scale: under 40, 40s, 50s, 60s, 70 and up. */
export type Tier = 0 | 1 | 2 | 3 | 4;
export const TIER_LABELS = ['40 미만', '40–49', '50–59', '60–69', '70 이상'] as const;
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
}

export type Theme = 'system' | 'light' | 'dark';
export type Scale = 'small' | 'normal' | 'large';
export const THEME_LABELS: Record<Theme, string> = { system: '기기 설정 따르기', light: '밝게', dark: '어둡게' };
export const SCALE_LABELS: Record<Scale, string> = { small: '작게', normal: '보통', large: '크게' };
/** How much the page is scaled for each text size. */
export const SCALE_ZOOM: Record<Scale, number> = { small: 0.92, normal: 1, large: 1.12 };

/** null: the stylesheet's own colours (the club colour above 60, grey in the middle, pale under 40). */
export const PRESETS: Record<Exclude<BarPreset, 'custom'>, { label: string; note: string; colors: Colors | null }> = {
  club: { label: '구단 색 (기본)', note: '60 이상은 구단 색, 40 미만은 옅게', colors: null },
  scale: { label: '등급별 색', note: '빨강–주황–노랑–초록–파랑', colors: ['#c8412f', '#e0862c', '#cfab2a', '#3d9a4f', '#2f6fd6'] },
  safe: { label: '색약 친화', note: '주황–회색–파랑, 적록 구분 없이', colors: ['#b85c00', '#e39b43', '#8c8c8c', '#4f93d1', '#1f5fa6'] },
  mono: { label: '흑백', note: '진할수록 높음', colors: ['var(--rule)', 'var(--ink-2)', 'var(--ink-2)', 'var(--ink)', 'var(--ink)'] },
};

export const DEFAULT_PREFS: DisplayPrefs = { bars: 'club', custom: [...PRESETS.scale.colors!] as Colors, tables: false, density: 'compact', theme: 'system', scale: 'normal' };

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
  return { bars, custom, tables: v.tables === true, density: v.density === 'comfortable' ? 'comfortable' : 'compact', theme, scale };
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
