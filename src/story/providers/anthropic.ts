/* Claude through the official Anthropic TypeScript SDK, called from the browser with the player's own
   key (dangerouslyAllowBrowser: the key stays in this tab). Structured output via output_config.format,
   the fixed system prompt cached. The SDK does not retry here: the story writer retries every provider
   the same way (story/writer). */
import Anthropic from '@anthropic-ai/sdk';
import { failure, retryAfterOf } from '../errors';
import { parseStory, type StoryModel } from '../types';

const client = (apiKey: string, fetchImpl?: typeof fetch) => new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 0, ...(fetchImpl ? { fetch: fetchImpl } : {}) });

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
      if (e instanceof Anthropic.APIConnectionError) return { ok: false, error: 'network', message: '연결하지 못했습니다.' };
      if (e instanceof Anthropic.APIError && e.status) {
        // 529 overloaded_error is a busy server; a billing error or a spent credit balance will not pass by waiting.
        const spent = e.type === 'billing_error' || e.status === 402 || /credit balance/i.test(e.message);
        const detail = (e.error as { error?: { message?: string } } | undefined)?.error?.message;
        return failure(e.status, { kind: spent ? 'quota' : undefined, retryAfter: retryAfterOf(e.headers), detail });
      }
      return { ok: false, error: 'unknown', message: String(e) };
    }
  },
  async listModels(key, fetchImpl) {
    const ids: string[] = [];
    for await (const m of client(key, fetchImpl).models.list()) ids.push(m.id);
    return ids;
  },
};
