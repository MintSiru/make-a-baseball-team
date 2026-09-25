/* The player's story settings. The API key lives in this tab's memory by default; "remember in this
   browser" keeps it in localStorage (any page on this origin could read it — the screen says so).
   Nothing here ever goes into the league state or a save file. */
import type { ProviderId } from './types';

export interface StorySettings {
  provider: ProviderId;
  keys: Partial<Record<ProviderId, string>>;
  models: Partial<Record<ProviderId, string>>;
  remember: boolean;
  /** Rewrite big articles (season, awards, monthly reviews, interviews) as they appear. */
  auto: boolean;
  /** Most articles to write automatically in one session. */
  budget: number;
}

const STORE = 'kbo-expansion-story-settings';

export const defaultSettings = (): StorySettings => ({ provider: 'anthropic', keys: {}, models: {}, remember: false, auto: false, budget: 20 });

export function loadSettings(): StorySettings {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) return { ...defaultSettings(), ...(JSON.parse(raw) as Partial<StorySettings>), remember: true };
  } catch {
    // Storage blocked: settings stay in memory.
  }
  return defaultSettings();
}

export function saveSettings(s: StorySettings) {
  try {
    if (s.remember) localStorage.setItem(STORE, JSON.stringify(s));
    else localStorage.removeItem(STORE);
  } catch {
    // Storage blocked: settings stay in memory.
  }
}

export const hasKey = (s: StorySettings) => !!s.keys[s.provider]?.trim();
