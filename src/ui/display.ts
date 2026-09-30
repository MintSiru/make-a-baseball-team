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
}

/** null: the stylesheet's own colours (the club colour above 60, grey in the middle, pale under 40). */
export const PRESETS: Record<Exclude<BarPreset, 'custom'>, { label: string; note: string; colors: Colors | null }> = {
  club: { label: '구단 색 (기본)', note: '60 이상은 구단 색, 40 미만은 옅게', colors: null },
  scale: { label: '등급별 색', note: '빨강–주황–노랑–초록–파랑', colors: ['#c8412f', '#e0862c', '#cfab2a', '#3d9a4f', '#2f6fd6'] },
  safe: { label: '색약 친화', note: '주황–회색–파랑, 적록 구분 없이', colors: ['#b85c00', '#e39b43', '#8c8c8c', '#4f93d1', '#1f5fa6'] },
  mono: { label: '흑백', note: '진할수록 높음', colors: ['var(--rule)', 'var(--ink-2)', 'var(--ink-2)', 'var(--ink)', 'var(--ink)'] },
};

export const DEFAULT_PREFS: DisplayPrefs = { bars: 'club', custom: [...PRESETS.scale.colors!] as Colors, tables: false, density: 'compact' };

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
  return { bars, custom, tables: v.tables === true, density: v.density === 'comfortable' ? 'comfortable' : 'compact' };
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
