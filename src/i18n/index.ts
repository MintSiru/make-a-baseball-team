import type { ComponentChildren } from 'preact';
import { koSource } from './ko-types';

export type Locale = 'ko' | 'en' | 'ja';
export const LOCALES: Locale[] = ['ko', 'en', 'ja'];
export type MessageKey = keyof typeof koSource;
export type Values = Record<string, unknown>;
export const LOCALE_STORAGE_KEY = 'kbo.display.locale';
let locale: Locale = 'ko';
export const getLocale = () => locale;

/** Canonical Korean text. Simulation/save code must use this, never the active display locale. */
export function k<K extends MessageKey>(key: K, values?: Values): string {
  const source = koSource[key];
  if (!values) return source;
  return source.replace(/\{([A-Za-z_]\w*)\}/g, (token, name: string) => Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : token) as (typeof koSource)[K];
}

/** What the display locales plug in (src/i18n/runtime.ts, UI only: the worker and the saves never load it). */
export interface Translator {
  /** A message in the display locale, or null when the locale has no text for the key (the Korean is shown). */
  message(key: MessageKey, values?: Values): string | null;
  /** The raw pattern of a key in the display locale, for rich(). */
  pattern(key: MessageKey): string | null;
  /** Canonical Korean (stored news, names, labels made with k()) in the display locale; unknown text unchanged. */
  text(value: string): string;
}
let translator: Translator | null = null;
const listeners = new Set<(l: Locale) => void>();

/** Switches the display language (the runtime registers the translator first). Saves are not touched. */
export function setLocale(next: Locale, using?: Translator | null) {
  if (using !== undefined) translator = using;
  if (next === locale) return;
  locale = next;
  for (const f of listeners) f(next);
}
export function onLocale(f: (l: Locale) => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** UI text in the display locale. A key the locale lacks falls back to the Korean. */
export function t(key: MessageKey, values?: Values): string {
  if (locale === 'ko' || !translator) return k(key, values);
  return translator.message(key, values) ?? k(key, values);
}
/** Render-only boundary: identifiers and stored values are never changed; only what is shown is translated. */
export function displayText<T>(value: T): T {
  if (locale === 'ko' || !translator || typeof value !== 'string') return value;
  return translator.text(value) as T;
}
export function display<T>(value: T): T {
  if (Array.isArray(value)) return value.map(display) as T;
  return typeof value === 'string' ? displayText(value) : value;
}
/** One sentence key can reorder inline components without changing their props, handlers or identity. */
export function rich(key: MessageKey, values: Record<string, ComponentChildren>): ComponentChildren {
  const pattern = (locale !== 'ko' && translator?.pattern(key)) || koSource[key];
  const out: ComponentChildren[] = [];
  let at = 0;
  const re = /\{([A-Za-z_]\w*)\}/g;
  for (const match of pattern.matchAll(re)) {
    out.push(pattern.slice(at, match.index));
    const v = values[match[1]!];
    out.push(v === undefined ? match[0] : typeof v === 'string' ? displayText(v) : v);
    at = match.index! + match[0].length;
  }
  out.push(pattern.slice(at));
  return out;
}
