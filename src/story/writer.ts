/* The story writer (V0.7): one entry point for every provider. It sends only the article's public facts
   and template draft, checks that every number in the result is one the facts or draft already had,
   and otherwise keeps the template (the fallback is always there). */
import type { NewsItem } from '../league/news';
import { anthropicModel } from './providers/anthropic';
import { geminiModel } from './providers/gemini';
import { openaiModel } from './providers/openai';
import { STORY_SCHEMA, STORY_SYSTEM, storyPrompt } from './prompt';
import type { ProviderId, StoryModel, StoryOutcome, StoryText } from './types';

export const PROVIDERS: Record<ProviderId, StoryModel> = { anthropic: anthropicModel, openai: openaiModel, gemini: geminiModel };

const numbers = (text: string) => (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/,/g, '').replace(/^0+(?=\d)/, ''));

/** Every number the model wrote must already be in the facts or the draft. */
export function numbersCheck(text: StoryText, item: NewsItem): boolean {
  const known = new Set(numbers(`${JSON.stringify(item.facts)} ${item.title} ${item.body} ${item.quotes.map((q) => q.text).join(' ')}`));
  const all = numbers(`${text.title} ${text.body} ${text.quotes.map((q) => q.text).join(' ')}`);
  return all.every((n) => known.has(n));
}

export interface RewriteSettings {
  provider: ProviderId;
  key: string;
  model: string;
}

export async function rewrite(item: NewsItem, settings: RewriteSettings, fetchImpl?: typeof fetch): Promise<StoryOutcome> {
  const provider = PROVIDERS[settings.provider];
  const out = await provider.generate({ system: STORY_SYSTEM, user: storyPrompt(item), schema: STORY_SCHEMA as unknown as Record<string, unknown>, maxTokens: 4000 }, settings.key, settings.model || provider.defaultModel, fetchImpl);
  if (out.ok && !numbersCheck(out.text, item)) return { ok: false, error: 'invalid', message: '기사에 사실에 없는 숫자가 있어 원래 기사를 유지합니다.' };
  return out;
}
