import { k as __i18n_k } from '../i18n/index';
/* The one prompt every provider gets (ROADMAP "LLM 연동 설계"): a fixed system prompt with Draft Room's
   writing rules and the fictional world (cached where the provider supports it), and a user message
   with the article's public facts and the template draft. */
import type { NewsItem } from '../league/news';

export const STORY_SYSTEM = __i18n_k("story.prompt.sTORY_SYSTEM.51449bc3");

export const STORY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'body', 'quotes'],
  properties: {
    title: { type: 'string' },
    body: { type: 'string' },
    quotes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['who', 'role', 'text'],
        properties: {
          who: { type: 'string' },
          role: { type: 'string', enum: ['player', 'manager', 'fan', 'gm'] },
          text: { type: 'string' },
        },
      },
    },
  },
} as const;

const KIND: Record<NewsItem['kind'], string> = { game: __i18n_k("story.prompt.kIND.game.08cbb1ec"), milestone: __i18n_k("story.prompt.kIND.milestone.e5ddaff6"), month: __i18n_k("story.prompt.kIND.month.bd7fd75c"), season: __i18n_k("story.prompt.kIND.season.ac5e1210"), award: __i18n_k("story.prompt.kIND.award.21bdcba1"), interview: __i18n_k("story.prompt.kIND.interview.2069fa29"), move: __i18n_k("story.prompt.kIND.move.fd8d86a0"), injury: __i18n_k("story.prompt.kIND.injury.9b1c2ccc"), allstar: __i18n_k("story.prompt.kIND.allstar.477a18c7") };

/** The user message: kind, facts and the template draft (public information only). */
export function storyPrompt(item: NewsItem): string {
  return JSON.stringify(
    {
      kind: KIND[item.kind],
      date: item.date,
      facts: item.facts,
      detail: item.detail ?? [],
      draft: { title: item.title, body: item.body, quotes: item.quotes },
    },
    null,
    1,
  );
}
