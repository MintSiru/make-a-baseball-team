/* AI articles (V0.7): every provider adapter against a fake HTTP response, the number check, and the
   template fallback. No real API is called. */
import { describe, expect, it } from 'vitest';
import type { NewsItem } from '../src/league/news';
import { numbersCheck, rewrite } from '../src/story/writer';

const item: NewsItem = {
  id: 'g-1',
  date: '2028-05-02',
  kind: 'game',
  title: '고래, KT에 끝내기 승리',
  body: '고래가 10회말 끝내기로 KT를 5-4로 꺾었다.',
  quotes: [{ who: '김민수', role: 'player', text: '팀이 이겨서 기쁩니다.' }],
  facts: { date: '2028-05-02', club: '고래', opponent: 'KT', runsFor: 5, runsAgainst: 4, innings: 10 },
  players: [],
};

const story = (body: string) => JSON.stringify({ title: '고래, 10회말 끝내기로 KT 제압', body, quotes: [{ who: '김민수', role: 'player', text: '기쁩니다.' }] });

const fakeFetch = (status: number, json: unknown) =>
  (async () => new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;

describe('number check', () => {
  it('accepts the facts and rejects invented numbers', () => {
    expect(numbersCheck(JSON.parse(story('고래가 KT를 5-4로 이겼다. 10회말이었다.')), item)).toBe(true);
    expect(numbersCheck(JSON.parse(story('고래가 KT를 5-4로 이겼다. 17연승이다.')), item)).toBe(false);
    // Numbers from the game log's fact lines are facts too.
    expect(numbersCheck(JSON.parse(story('고래는 안타 13개를 쳤다.')), { ...item, detail: ['안타 고래 13개, KT 8개'] })).toBe(true);
  });
});

describe('providers', () => {
  it('Claude (official SDK) returns a structured article', async () => {
    const f = fakeFetch(200, {
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-5',
      content: [{ type: 'text', text: story('고래가 10회말 KT를 5-4로 꺾었다.') }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 900, output_tokens: 120 },
    });
    const out = await rewrite(item, { provider: 'anthropic', key: 'sk-test', model: 'claude-opus-5' }, f);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.text.title).toContain('끝내기');
      expect(out.usage.input).toBe(900);
    }
  });
  it('Claude: a refusal and a bad key fall back', async () => {
    const refused = fakeFetch(200, { id: 'm', type: 'message', role: 'assistant', model: 'x', content: [], stop_reason: 'refusal', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } });
    expect(await rewrite(item, { provider: 'anthropic', key: 'k', model: 'x' }, refused)).toMatchObject({ ok: false, error: 'refusal' });
    const bad = fakeFetch(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
    expect(await rewrite(item, { provider: 'anthropic', key: 'k', model: 'x' }, bad)).toMatchObject({ ok: false, error: 'auth' });
  });
  it('GPT (REST) with a JSON schema', async () => {
    const f = fakeFetch(200, { choices: [{ message: { content: story('고래가 KT를 5-4로 꺾었다.') } }], usage: { prompt_tokens: 800, completion_tokens: 100 } });
    const out = await rewrite(item, { provider: 'openai', key: 'k', model: 'm' }, f);
    expect(out.ok).toBe(true);
    expect(await rewrite(item, { provider: 'openai', key: 'k', model: 'm' }, fakeFetch(429, {}))).toMatchObject({ ok: false, error: 'rate' });
  });
  it('Gemini (REST) in JSON mode', async () => {
    const f = fakeFetch(200, { candidates: [{ content: { parts: [{ text: story('고래가 KT를 5-4로 꺾었다.') }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 700, candidatesTokenCount: 90 } });
    expect((await rewrite(item, { provider: 'gemini', key: 'k', model: 'm' }, f)).ok).toBe(true);
    const blocked = fakeFetch(200, { candidates: [{ finishReason: 'SAFETY' }] });
    expect(await rewrite(item, { provider: 'gemini', key: 'k', model: 'm' }, blocked)).toMatchObject({ ok: false, error: 'refusal' });
  });
  it('an invented number keeps the template', async () => {
    const f = fakeFetch(200, { choices: [{ message: { content: story('고래가 KT를 5-4로 꺾고 12연승을 달렸다.') } }] });
    expect(await rewrite(item, { provider: 'openai', key: 'k', model: 'm' }, f)).toMatchObject({ ok: false, error: 'invalid' });
  });
});
