import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, rich as __i18n_rich, t as __i18n_t } from '../i18n/index';
/* AI article settings (V0.7): provider, the player's own API key, model, and automatic writing. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { useFocusTrap } from './modal';
import { PROVIDERS } from '../story/writer';
import type { StorySettings as Settings } from '../story/settings';
import type { ProviderId } from '../story/types';

type Props = { settings: Settings; usage: { input: number; output: number; articles: number }; pausedUntil?: number; onSave: (s: Settings) => void };

/** The dialog (a story button with no key yet); in a game the same options sit in the settings tab (V0.13). */
export function StorySettings({ onClose, ...props }: Props & { onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useFocusTrap(box, onClose);
  useEffect(() => {
    box.current?.querySelector('select')?.focus();
  }, []);
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="story-settings-title" ref={box}>
        <button type="button" class="close" onClick={onClose} aria-label={__i18n_t("ui.storySettings.storySettings.94b7dba1")}>{__i18n_t("ui.storySettings.storySettings.94b7dba1")}</button>
        <h2 id="story-settings-title">{__i18n_t("ui.storySettings.storySettings.a8a3d611")}</h2>
        <StoryOptions {...props} />
      </div>
    </div>
  );
}

/** Provider, key, model, automatic writing. Keys stay in this tab (or this browser, if asked) and never in a save. */
export function StoryOptions({ settings, usage, pausedUntil = 0, onSave }: Props) {
  const [s, setS] = useState<Settings>(settings);
  const [models, setModels] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const p = PROVIDERS[s.provider];
  const key = s.keys[s.provider] ?? '';
  const model = s.models[s.provider] ?? p.defaultModel;
  const load = async () => {
    setMsg(__i18n_k("ui.storySettings.storyOptions.load.0a351c98"));
    try {
      const list = await p.listModels(key);
      setModels(list);
      setMsg(__i18n_k("ui.storySettings.storyOptions.load.d06448e8", { length: list.length }));
    } catch (e) {
      setMsg(__i18n_k("ui.storySettings.storyOptions.load.8379d457", { value: e instanceof Error ? e.message : String(e) }));
    }
  };
  return (
    <>
      <p class="muted">{__i18n_rich("ui.storySettings.storyOptions.339a4ade", { value: <strong>{__i18n_t("ui.storySettings.storyOptions.c8debb0f")}</strong> })}</p>
      <div class="form-grid">
        <label>
          제공자
          <select value={s.provider} onChange={(e) => setS({ ...s, provider: (e.currentTarget as HTMLSelectElement).value as ProviderId })}>
            {__i18n_display(Object.values(PROVIDERS).map((x) => (
              <option key={x.id} value={x.id}>
                {__i18n_display(x.label)}
              </option>
            )))}
          </select>
        </label>
        <label>
          API 키
          <input type="password" autoComplete="off" value={key} onInput={(e) => setS({ ...s, keys: { ...s.keys, [s.provider]: (e.currentTarget as HTMLInputElement).value } })} />
        </label>
        <label>
          모델
          <input list="story-models" value={model} placeholder={__i18n_displayText(p.defaultModel || __i18n_k("ui.storySettings.storyOptions.4ae2eb63"))} onInput={(e) => setS({ ...s, models: { ...s.models, [s.provider]: (e.currentTarget as HTMLInputElement).value } })} />
          <datalist id="story-models">
            {__i18n_display(models.map((m) => (
              <option key={m} value={m} />
            )))}
          </datalist>
        </label>
        <div>
          <button type="button" disabled={!key} onClick={load}>{__i18n_t("ui.storySettings.storyOptions.d7254c44")}</button>{__i18n_display(' ')}
          <span class="muted small">{__i18n_display(msg)}</span>
        </div>
      </div>
      <label class="check">
        <input type="checkbox" checked={s.auto} onChange={(e) => setS({ ...s, auto: (e.currentTarget as HTMLInputElement).checked })} /> 큰 기사(시즌 결산·시상·월간 결산·인터뷰·우리 구단 이적)는 나올 때마다 자동으로 쓰기
      </label>
      <label class="inline-form">
        한 번 켤 때 자동으로 쓸 기사 수
        <input type="number" min={0} max={200} value={s.budget} onInput={(e) => setS({ ...s, budget: Math.max(0, Number((e.currentTarget as HTMLInputElement).value) || 0) })} />
      </label>
      <label class="check">
        <input type="checkbox" checked={s.remember} onChange={(e) => setS({ ...s, remember: (e.currentTarget as HTMLInputElement).checked })} /> 이 브라우저에 설정과 키 기억하기
      </label>
      {__i18n_display(s.remember && <p class="notice warn">{__i18n_t("ui.storySettings.storyOptions.4a678414")}</p>)}
      <p class="muted small">{__i18n_t("ui.storySettings.storyOptions.50bb5a3a", { articles: usage.articles, value: usage.input.toLocaleString('ko-KR'), value2: usage.output.toLocaleString('ko-KR') })}</p>
      {__i18n_display(pausedUntil > Date.now() && (
        <p class="muted small">{__i18n_t("ui.storySettings.storyOptions.93fa27a7", { value: new Date(pausedUntil).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) })}</p>
      ))}
      <p class="muted small">{__i18n_t("ui.storySettings.storyOptions.2b7aaa2f")}</p>
      <div class="row-actions">
        <button type="button" class="primary" onClick={() => onSave(s)}>{__i18n_t("ui.storySettings.storyOptions.1f1712ac")}</button>
        <button type="button" onClick={() => onSave({ ...s, keys: {} })}>{__i18n_t("ui.storySettings.storyOptions.c82ce3d3")}</button>
      </div>
    </>
  );
}
