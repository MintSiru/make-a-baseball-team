/* Whether the page is dark right now (V0.15): the player's pick in the display settings, else the system's,
   following either as it changes. The club colour is adjusted for it (display.ts readableAccent). */
import { useEffect, useState } from 'preact/hooks';
import { DISPLAY_EVENT, isDark, loadDisplay, type UiMode } from './display';

export function useDark(): boolean {
  const [dark, setDark] = useState(() => isDark(loadDisplay()));
  useEffect(() => {
    const update = () => setDark(isDark(loadDisplay()));
    const media = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
    media?.addEventListener('change', update);
    window.addEventListener(DISPLAY_EVENT, update);
    return () => {
      media?.removeEventListener('change', update);
      window.removeEventListener(DISPLAY_EVENT, update);
    };
  }, []);
  return dark;
}

/** 2.0.62: the redesigned screens or the legacy ones (display.ts), following the settings as they change. */
export function useUi(): UiMode {
  const [ui, setUi] = useState(() => loadDisplay().ui);
  useEffect(() => {
    const update = () => setUi(loadDisplay().ui);
    window.addEventListener(DISPLAY_EVENT, update);
    return () => window.removeEventListener(DISPLAY_EVENT, update);
  }, []);
  return ui;
}
