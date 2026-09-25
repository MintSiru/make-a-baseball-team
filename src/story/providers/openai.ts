/* OpenAI (GPT) through its REST Chat Completions API with a strict JSON schema response format,
   called from the browser with the player's own key. */
import { bodyOf, failure, retryAfterOf } from '../errors';
import { parseStory, type StoryModel } from '../types';

const BASE = 'https://api.openai.com/v1';

export const openaiModel: StoryModel = {
  id: 'openai',
  label: 'OpenAI (GPT)',
  defaultModel: '',
  async generate(req, key, model, fetchImpl = fetch) {
    let res: Response;
    try {
      res = await fetchImpl(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          max_completion_tokens: req.maxTokens,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
          response_format: { type: 'json_schema', json_schema: { name: 'news_article', strict: true, schema: req.schema } },
        }),
      });
    } catch {
      return { ok: false, error: 'network', message: '연결하지 못했습니다.' };
    }
    if (!res.ok) {
      // A 429 is either too many requests for now or an account with no credit left (insufficient_quota).
      const body = (await bodyOf(res)) as { error?: { code?: string; type?: string; message?: string } } | undefined;
      const e = body?.error;
      const spent = res.status === 429 && (e?.code === 'insufficient_quota' || e?.type === 'insufficient_quota');
      return failure(res.status, { kind: spent ? 'quota' : undefined, retryAfter: retryAfterOf(res.headers, body), detail: e?.message });
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string | null; refusal?: string | null } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const msg = data.choices?.[0]?.message;
    if (msg?.refusal) return { ok: false, error: 'refusal', message: '모델이 이 기사를 쓰지 않기로 했습니다.' };
    const story = parseStory(msg?.content ?? '');
    if (!story) return { ok: false, error: 'invalid', message: '모델 응답을 읽지 못했습니다.' };
    return { ok: true, text: story, usage: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 } };
  },
  async listModels(key, fetchImpl = fetch) {
    const res = await fetchImpl(`${BASE}/models`, { headers: { authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`API 오류 ${res.status}`);
    const data = (await res.json()) as { data?: { id: string }[] };
    return (data.data ?? []).map((m) => m.id).sort();
  },
};
