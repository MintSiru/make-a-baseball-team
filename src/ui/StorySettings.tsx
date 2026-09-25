/* AI article settings (V0.7): provider, the player's own API key, model, and automatic writing. */
import { useState } from 'preact/hooks';
import { PROVIDERS } from '../story/writer';
import type { StorySettings as Settings } from '../story/settings';
import type { ProviderId } from '../story/types';

export function StorySettings({ settings, usage, onSave, onClose }: { settings: Settings; usage: { input: number; output: number; articles: number }; onSave: (s: Settings) => void; onClose: () => void }) {
  const [s, setS] = useState<Settings>(settings);
  const [models, setModels] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const p = PROVIDERS[s.provider];
  const key = s.keys[s.provider] ?? '';
  const model = s.models[s.provider] ?? p.defaultModel;
  const load = async () => {
    setMsg('모델 목록을 불러오는 중…');
    try {
      const list = await p.listModels(key);
      setModels(list);
      setMsg(`${list.length}개 모델`);
    } catch (e) {
      setMsg(`불러오지 못했습니다: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="story-settings-title">
        <button type="button" class="close" onClick={onClose} aria-label="닫기">
          닫기
        </button>
        <h2 id="story-settings-title">AI 기사 설정</h2>
        <p class="muted">
          선택 기능입니다. 본인 API 키로 Claude·GPT·Gemini 가운데 하나가 기사와 인터뷰를 다시 씁니다. 게임에는 공개 정보(경기 결과·기록·이름)만 보내고, 숫자가 사실과 다르면 원래 기사를 씁니다. 결과는
          진행 파일에 저장되지만 <strong>API 키는 저장되지 않습니다</strong>. 요금은 각 회사 요금제대로 본인 계정에 청구됩니다.
        </p>
        <div class="form-grid">
          <label>
            제공자
            <select value={s.provider} onChange={(e) => setS({ ...s, provider: (e.currentTarget as HTMLSelectElement).value as ProviderId })}>
              {Object.values(PROVIDERS).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            API 키
            <input type="password" autoComplete="off" value={key} onInput={(e) => setS({ ...s, keys: { ...s.keys, [s.provider]: (e.currentTarget as HTMLInputElement).value } })} />
          </label>
          <label>
            모델
            <input list="story-models" value={model} placeholder={p.defaultModel || '모델 이름'} onInput={(e) => setS({ ...s, models: { ...s.models, [s.provider]: (e.currentTarget as HTMLInputElement).value } })} />
            <datalist id="story-models">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          <div>
            <button type="button" disabled={!key} onClick={load}>
              모델 목록 불러오기
            </button>{' '}
            <span class="muted small">{msg}</span>
          </div>
        </div>
        <label class="check">
          <input type="checkbox" checked={s.auto} onChange={(e) => setS({ ...s, auto: (e.currentTarget as HTMLInputElement).checked })} /> 큰 기사(시즌 결산·시상·월간 결산·인터뷰)는 나올 때마다 자동으로 쓰기
        </label>
        <label class="inline-form">
          한 번 켤 때 자동으로 쓸 기사 수
          <input type="number" min={0} max={200} value={s.budget} onInput={(e) => setS({ ...s, budget: Math.max(0, Number((e.currentTarget as HTMLInputElement).value) || 0) })} />
        </label>
        <label class="check">
          <input type="checkbox" checked={s.remember} onChange={(e) => setS({ ...s, remember: (e.currentTarget as HTMLInputElement).checked })} /> 이 브라우저에 설정과 키 기억하기
        </label>
        {s.remember && <p class="notice warn">키가 이 브라우저 저장소에 남습니다. 같은 주소의 다른 페이지나 이 컴퓨터를 쓰는 사람이 읽을 수 있으니, 공용 컴퓨터에서는 켜지 마세요.</p>}
        <p class="muted small">
          이번 세션 사용량: 기사 {usage.articles}개 · 입력 {usage.input.toLocaleString('ko-KR')} 토큰 · 출력 {usage.output.toLocaleString('ko-KR')} 토큰
        </p>
        <div class="row-actions">
          <button type="button" class="primary" onClick={() => onSave(s)}>
            저장
          </button>
          <button type="button" onClick={() => onSave({ ...s, keys: {} })}>
            키 지우기
          </button>
        </div>
      </div>
    </div>
  );
}
