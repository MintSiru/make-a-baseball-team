import type { ComponentChildren } from 'preact';
import { IntlMessageFormat } from 'intl-messageformat';
import { koSource } from './ko-types';

export type Locale = 'ko' | 'en' | 'ja';
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
const formats = new Map<string, IntlMessageFormat>();
export function t(key: MessageKey, values?: Values): string {
  // The Korean extraction stage intentionally retains the exact original text, punctuation and spaces.
  if (locale === 'ko') return k(key, values);
  const source = koSource[key];
  if (!values) return source;
  const cacheKey = `${locale}:${key}`;
  let fmt = formats.get(cacheKey);
  if (!fmt) { fmt = new IntlMessageFormat(source, locale, undefined, { ignoreTag: true }); formats.set(cacheKey, fmt); }
  return String(fmt.format(values as Record<string, string | number>));
}
/** Render-only boundary: identifiers and stored values are never changed. */
export function displayText<T>(value: T): T {
  return value;
}
export function display<T>(value: T): T {
  if (Array.isArray(value)) return value.map(display) as T;
  return typeof value === 'string' ? displayText(value) : value;
}
/** One sentence key can reorder inline components without changing their props, handlers or identity. */
export function rich(key: MessageKey, values: Record<string, ComponentChildren>): ComponentChildren {
  const pattern = koSource[key];
  const out: ComponentChildren[] = [];
  let at = 0;
  const re = /\{([A-Za-z_]\w*)\}/g;
  for (const match of pattern.matchAll(re)) {
    out.push(pattern.slice(at, match.index));
    out.push(values[match[1]!] ?? match[0]);
    at = match.index! + match[0].length;
  }
  out.push(pattern.slice(at));
  return out;
}
