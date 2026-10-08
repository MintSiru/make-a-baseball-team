/* The display language (en/ja localization): a browser preference like the theme, never part of a save. Each
   language is listed by its own name so a player can find theirs whatever the page is showing. */
import { useEffect, useState } from 'preact/hooks';
import { getLocale, LOCALES, onLocale, type Locale } from '../i18n/index';
import { applyLocale, LANGUAGE_LABEL, LOCALE_NAMES } from '../i18n/runtime';

export function LanguagePicker() {
  const [lc, setLc] = useState<Locale>(getLocale());
  useEffect(() => onLocale(setLc), []);
  return (
    <label class="language-picker">
      <span class="sr-only">{LANGUAGE_LABEL}</span>
      <select aria-label={LANGUAGE_LABEL} value={lc} onChange={(e) => applyLocale((e.currentTarget as HTMLSelectElement).value as Locale)}>
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
