/* Display settings (V0.7.6): the colours of the ability bars by 20–80 tier, a preview, whether the grades in
   the tables are coloured too, and the event pop-ups. Changes show at once and stay in this browser. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { PopupSettings } from './Alerts';
import { DEFAULT_PREFS, gradeTier, loadDisplay, PRESETS, saveDisplay, TIER_LABELS, type BarPreset, type DisplayPrefs } from './display';
import { GradeBar } from './grades';

const SAMPLE = [35, 45, 55, 65, 75];
const ORDER: BarPreset[] = ['club', 'scale', 'safe', 'mono', 'custom'];
/** The stylesheet's own colours, for the swatch of the club preset. */
const CLUB_STRIP = ['var(--rule)', 'var(--ink-2)', 'var(--ink-2)', 'var(--accent)', 'var(--accent)'];

export function DisplaySettings({ onClose }: { onClose: () => void }) {
  const [p, setP] = useState<DisplayPrefs>(loadDisplay);
  const first = useRef<HTMLInputElement>(null);
  const set = (next: DisplayPrefs) => {
    setP(next);
    saveDisplay(next);
  };
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="display-settings-title">
        <button type="button" class="close" onClick={onClose} aria-label="닫기">
          닫기
        </button>
        <h2 id="display-settings-title">화면 설정</h2>
        <p class="muted">이 브라우저에만 저장되고 진행 파일에는 들어가지 않습니다.</p>

        <h3>능력치 바 색</h3>
        <div class="preset-list" role="radiogroup" aria-label="능력치 바 색">
          {ORDER.map((k, i) => {
            const preset = k === 'custom' ? null : PRESETS[k];
            const strip = k === 'custom' ? p.custom : (preset!.colors ?? CLUB_STRIP);
            return (
              <label key={k} class="check">
                <input ref={i === 0 ? first : undefined} type="radio" name="bar-preset" checked={p.bars === k} onChange={() => set({ ...p, bars: k })} />
                {preset ? preset.label : '직접 지정'}
                <span class="muted small"> · {preset ? preset.note : '등급마다 색을 고릅니다'}</span>
                {strip && (
                  <span class="strip" aria-hidden="true">
                    {strip.map((c, t) => (
                      <span key={t} style={{ background: c }} />
                    ))}
                  </span>
                )}
              </label>
            );
          })}
        </div>
        {p.bars === 'custom' && (
          <div class="swatches" role="group" aria-label="등급별 색">
            {TIER_LABELS.map((label, t) => (
              <label key={label}>
                <input
                  type="color"
                  value={p.custom[t]}
                  aria-label={`${label} 색`}
                  onInput={(e) => {
                    const custom = [...p.custom] as DisplayPrefs['custom'];
                    custom[t] = (e.currentTarget as HTMLInputElement).value;
                    set({ ...p, custom });
                  }}
                />
                {label}
              </label>
            ))}
            <button type="button" class="link small" onClick={() => set({ ...p, custom: DEFAULT_PREFS.custom })}>
              기본 색으로
            </button>
          </div>
        )}

        <h4>미리보기</h4>
        <div class="gradebars">
          {SAMPLE.map((g) => (
            <GradeBar key={g} label={`${g}`} now={g} future={g < 60 ? g + 10 : undefined} />
          ))}
        </div>
        <table class="record-table preview-grades" aria-label="표 미리보기">
          <tbody>
            <tr>
              {SAMPLE.map((g) => (
                <td key={g} class={`num grade-cell t${gradeTier(g)} ${g >= 60 ? 'plus' : g < 40 ? 'minus' : ''}`}>
                  {g}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <p class="muted small">라인업 화면의 능력치 칸은 바와 같은 색을 씁니다 (구단 색일 때는 글자색).</p>

        <label class="check">
          <input type="checkbox" checked={p.tables} onChange={(e) => set({ ...p, tables: (e.currentTarget as HTMLInputElement).checked })} /> 선수 표의 현재·미래 능력치에도 색 입히기
        </label>

        <h3>표</h3>
        <div class="segmented" role="group" aria-label="표 간격">
          <button type="button" aria-pressed={p.density === 'compact'} onClick={() => set({ ...p, density: 'compact' })}>
            촘촘하게 (한 화면에 더 많이)
          </button>
          <button type="button" aria-pressed={p.density === 'comfortable'} onClick={() => set({ ...p, density: 'comfortable' })}>
            넉넉하게
          </button>
        </div>

        <h3>알림</h3>
        <PopupSettings />

        <div class="row-actions">
          <button type="button" onClick={() => set(DEFAULT_PREFS)}>
            모두 기본값으로
          </button>
          <button type="button" class="primary" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
