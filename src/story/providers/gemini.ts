/* Google Gemini through its REST generateContent API (JSON response mode), called from the browser
   with the player's own key. The schema is enforced by our own parser. */
import { parseStory, type StoryError, type StoryModel } from '../types';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

const errorOf = (status: number): StoryError => (status === 401 || status === 403 ? 'auth' : status === 429 ? 'rate' : status === 400 ? 'invalid' : 'unknown');

export const geminiModel: StoryModel = {
  id: 'gemini',
  label: 'Google (Gemini)',
  defaultModel: '',
  async generate(req, key, model, fetchImpl = fetch) {
    let res: Response;
    try {
      res = await fetchImpl(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `${req.system}\n\nJSON 스키마:\n${JSON.stringify(req.schema)}` }] },
          contents: [{ role: 'user', parts: [{ text: req.user }] }],
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: req.maxTokens },
        }),
      });
    } catch {
      return { ok: false, error: 'network', message: '연결하지 못했습니다.' };
    }
    if (!res.ok) return { ok: false, error: errorOf(res.status), message: `API 오류 ${res.status}` };
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const cand = data.candidates?.[0];
    if (data.promptFeedback?.blockReason || cand?.finishReason === 'SAFETY') return { ok: false, error: 'refusal', message: '모델이 이 기사를 쓰지 않기로 했습니다.' };
    const story = parseStory(cand?.content?.parts?.map((p) => p.text ?? '').join('') ?? '');
    if (!story) return { ok: false, error: 'invalid', message: '모델 응답을 읽지 못했습니다.' };
    return { ok: true, text: story, usage: { input: data.usageMetadata?.promptTokenCount ?? 0, output: data.usageMetadata?.candidatesTokenCount ?? 0 } };
  },
  async listModels(key, fetchImpl = fetch) {
    const res = await fetchImpl(`${BASE}/models`, { headers: { 'x-goog-api-key': key } });
    if (!res.ok) throw new Error(`API 오류 ${res.status}`);
    const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    return (data.models ?? []).filter((m) => m.supportedGenerationMethods?.includes('generateContent') ?? true).map((m) => m.name.replace(/^models\//, ''));
  },
};
