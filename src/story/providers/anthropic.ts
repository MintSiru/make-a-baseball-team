/* Claude through the official Anthropic TypeScript SDK, called from the browser with the player's own
   key (dangerouslyAllowBrowser: the key stays in this tab). Structured output via output_config.format,
   the fixed system prompt cached. */
import Anthropic from '@anthropic-ai/sdk';
import { parseStory, type StoryModel } from '../types';

const client = (apiKey: string, fetchImpl?: typeof fetch) => new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, ...(fetchImpl ? { fetch: fetchImpl } : {}) });

export const anthropicModel: StoryModel = {
  id: 'anthropic',
  label: 'Anthropic (Claude)',
  defaultModel: 'claude-opus-5',
  async generate(req, key, model, fetchImpl) {
    try {
      const response = await client(key, fetchImpl).messages.create({
        model,
        max_tokens: req.maxTokens,
        system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: req.user }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema: req.schema } },
      });
      if (response.stop_reason === 'refusal') return { ok: false, error: 'refusal', message: '모델이 이 기사를 쓰지 않기로 했습니다.' };
      const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
      const story = parseStory(text);
      if (!story) return { ok: false, error: 'invalid', message: '모델 응답을 읽지 못했습니다.' };
      return { ok: true, text: story, usage: { input: response.usage.input_tokens, output: response.usage.output_tokens } };
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return { ok: false, error: 'auth', message: 'API 키를 확인하세요.' };
      if (e instanceof Anthropic.RateLimitError) return { ok: false, error: 'rate', message: '요청 한도에 걸렸습니다. 잠시 뒤 다시 시도하세요.' };
      if (e instanceof Anthropic.APIConnectionError) return { ok: false, error: 'network', message: '연결하지 못했습니다.' };
      if (e instanceof Anthropic.APIError) return { ok: false, error: 'unknown', message: `API 오류 ${e.status ?? ''}` };
      return { ok: false, error: 'unknown', message: String(e) };
    }
  },
  async listModels(key, fetchImpl) {
    const ids: string[] = [];
    for await (const m of client(key, fetchImpl).models.list()) ids.push(m.id);
    return ids;
  },
};
