import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, t as __i18n_t } from '../i18n/index';
/* Display settings (V0.7.6): the colours of the ability bars by 20–80 tier, a preview, whether the grades in
   the tables are coloured too, and the event pop-ups. Changes show at once and stay in this browser. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { useFocusTrap } from './modal';
import { PopupSettings } from './Alerts';
import { DEFAULT_PREFS, gradeTier, loadDisplay, PRESETS, saveDisplay, SCALE_LABELS, THEME_LABELS, TIER_LABELS, type BarPreset, type DisplayPrefs, type Scale, type Theme } from './display';
import { GradeBar } from './grades';
import { LanguagePicker } from './LanguagePicker';
import { LANGUAGE_LABEL } from '../i18n/runtime';

const SAMPLE = [35, 45, 55, 65, 75];
const ORDER: BarPreset[] = ['club', 'scale', 'safe', 'mono', 'custom'];
/** The stylesheet's own colours, for the swatch of the club preset. */
const CLUB_STRIP = ['var(--rule)', 'var(--ink-2)', 'var(--ink-2)', 'var(--accent)', 'var(--accent)'];

/** The dialog (before a game starts); in a game the same options sit in the settings tab (V0.13). */
export function DisplaySettings({ onClose }: { onClose: () => void }) {
  const first = useRef<HTMLDivElement>(null);
  useFocusTrap(first, onClose);
  useEffect(() => {
    first.current?.querySelector('input')?.focus();
  }, []);
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="display-settings-title" ref={first}>
        <button type="button" class="close" onClick={onClose} aria-label={__i18n_t("ui.displaySettings.displaySettings.94b7dba1")}>{__i18n_t("ui.displaySettings.displaySettings.94b7dba1")}</button>
        <h2 id="display-settings-title">{__i18n_t("ui.displaySettings.displaySettings.b1c35543")}</h2>
        <DisplayOptions />
        <div class="row-actions">
          <button type="button" class="primary" onClick={onClose}>{__i18n_t("ui.displaySettings.displaySettings.468266d6")}</button>
        </div>
      </div>
    </div>
  );
}

/** Bar colours, table colours and spacing, pop-ups. Changes show at once and stay in this browser. */
export function DisplayOptions() {
  const [p, setP] = useState<DisplayPrefs>(loadDisplay);
  const set = (next: DisplayPrefs) => {
    setP(next);
    saveDisplay(next);
  };
  return (
    <>
      <p class="muted">{__i18n_t("ui.displaySettings.displayOptions.ea265ed0")}</p>

      <h3>{LANGUAGE_LABEL}</h3>
      <LanguagePicker />

      <h3>{__i18n_t("ui.displaySettings.displayOptions.1a13e026")}</h3>
      <div class="segmented" role="group" aria-label={__i18n_t("ui.displaySettings.displayOptions.1a13e026")}>
        {__i18n_display((Object.keys(THEME_LABELS) as Theme[]).map((k) => (
          <button key={k} type="button" aria-pressed={p.theme === k} onClick={() => set({ ...p, theme: k })}>
            {__i18n_display(THEME_LABELS[k])}
          </button>
        )))}
      </div>
      <p class="muted small">{__i18n_t("ui.displaySettings.displayOptions.a302d3dd")}</p>

      <h3>{__i18n_t("ui.displaySettings.displayOptions.32b62470")}</h3>
      <div class="segmented" role="group" aria-label={__i18n_t("ui.displaySettings.displayOptions.32b62470")}>
        {__i18n_display((Object.keys(SCALE_LABELS) as Scale[]).map((k) => (
          <button key={k} type="button" aria-pressed={p.scale === k} onClick={() => set({ ...p, scale: k })}>
            {__i18n_display(SCALE_LABELS[k])}
          </button>
        )))}
      </div>

      <h3>{__i18n_t("ui.displaySettings.displayOptions.764bfea3")}</h3>
      <div class="preset-list" role="radiogroup" aria-label={__i18n_t("ui.displaySettings.displayOptions.764bfea3")}>
        {__i18n_display(ORDER.map((k) => {
          const preset = k === 'custom' ? null : PRESETS[k];
          const strip = k === 'custom' ? p.custom : (preset!.colors ?? CLUB_STRIP);
          return (
            <label key={k} class="check">
              <input type="radio" name="bar-preset" checked={p.bars === k} onChange={() => set({ ...p, bars: k })} />
              {__i18n_display(preset ? preset.label : __i18n_k("ui.displaySettings.displayOptions.9b941bf8"))}
              <span class="muted small"> · {__i18n_display(preset ? preset.note : __i18n_k("ui.displaySettings.displayOptions.f6b8f283"))}</span>
              {__i18n_display(strip && (
                <span class="strip" aria-hidden="true">
                  {__i18n_display(strip.map((c, t) => (
                    <span key={t} style={{ background: c }} />
                  )))}
                </span>
              ))}
            </label>
          );
        }))}
      </div>
      {__i18n_display(p.bars === 'custom' && (
        <div class="swatches" role="group" aria-label={__i18n_t("ui.displaySettings.displayOptions.c797f3c4")}>
          {__i18n_display(TIER_LABELS.map((label, t) => (
            <label key={label}>
              <input
                type="color"
                value={p.custom[t]}
                aria-label={__i18n_displayText(__i18n_k("ui.displaySettings.displayOptions.508a6d32", { label: label }))}
                onInput={(e) => {
                  const custom = [...p.custom] as DisplayPrefs['custom'];
                  custom[t] = (e.currentTarget as HTMLInputElement).value;
                  set({ ...p, custom });
                }}
              />
              {__i18n_display(label)}
            </label>
          )))}
          <button type="button" class="link small" onClick={() => set({ ...p, custom: DEFAULT_PREFS.custom })}>{__i18n_t("ui.displaySettings.displayOptions.5887b7d5")}</button>
        </div>
      ))}

      <h4>{__i18n_t("ui.displaySettings.displayOptions.2f1c9d7b")}</h4>
      <div class="gradebars">
        {__i18n_display(SAMPLE.map((g) => (
          <GradeBar key={g} label={__i18n_displayText(`${g}`)} now={g} future={g < 60 ? g + 10 : undefined} />
        )))}
      </div>
      <table class="record-table preview-grades" aria-label={__i18n_t("ui.displaySettings.displayOptions.e4d01c6f")}>
        <tbody>
          <tr>
            {__i18n_display(SAMPLE.map((g) => (
              <td key={g} class={`num grade-cell t${gradeTier(g)} ${g >= 60 ? 'plus' : g < 40 ? 'minus' : ''}`}>
                {__i18n_display(g)}
              </td>
            )))}
          </tr>
        </tbody>
      </table>
      <p class="muted small">{__i18n_t("ui.displaySettings.displayOptions.2818931a")}</p>

      <label class="check">
        <input type="checkbox" checked={p.tables} onChange={(e) => set({ ...p, tables: (e.currentTarget as HTMLInputElement).checked })} /> 선수 표의 현재·미래 능력치에도 색 입히기
      </label>

      <h3>{__i18n_t("ui.displaySettings.displayOptions.c31907e6")}</h3>
      <div class="segmented" role="group" aria-label={__i18n_t("ui.displaySettings.displayOptions.ab6cb1ec")}>
        <button type="button" aria-pressed={p.density === 'compact'} onClick={() => set({ ...p, density: 'compact' })}>{__i18n_t("ui.displaySettings.displayOptions.103ea773")}</button>
        <button type="button" aria-pressed={p.density === 'comfortable'} onClick={() => set({ ...p, density: 'comfortable' })}>{__i18n_t("ui.displaySettings.displayOptions.5f00e131")}</button>
      </div>

      <h3>{__i18n_t("ui.displaySettings.displayOptions.e0cee61a")}</h3>
      <label class="check">
        <input type="checkbox" checked={p.hideScores} onChange={(e) => set({ ...p, hideScores: (e.currentTarget as HTMLInputElement).checked })} /> 우리 경기 결과 가리기 — 경기 탭에서 점수를 숨기고, 열면 문자중계가 1회부터 흘러갑니다
      </label>
      <p class="muted small">{__i18n_t("ui.displaySettings.displayOptions.97c4de27")}</p>

      <h3>{__i18n_t("ui.displaySettings.displayOptions.e29d147e")}</h3>
      <PopupSettings />

      <div class="row-actions">
        <button type="button" onClick={() => set(DEFAULT_PREFS)}>{__i18n_t("ui.displaySettings.displayOptions.95f05922")}</button>
      </div>
    </>
  );
}
