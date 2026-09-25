/* The one prompt every provider gets (ROADMAP "LLM 연동 설계"): a fixed system prompt with Draft Room's
   writing rules and the fictional world (cached where the provider supports it), and a user message
   with the article's public facts and the template draft. */
import type { NewsItem } from '../league/news';

export const STORY_SYSTEM = `너는 가상의 한국 프로야구 리그를 다루는 스포츠 신문 기자다. 이 리그의 선수·코치·팬·기록은 모두 게임 속 가상 인물과 가상 기록이다.

규칙:
- 주어진 사실(facts)과 초안(draft)에 있는 내용만 쓴다. 숫자(점수, 기록, 날짜, 순위, 금액)는 사실에 있는 값만 그대로 쓰고 새 숫자를 만들지 않는다.
- 실존 인물의 이름을 쓰지 않는다. 사실에 나온 이름만 쓴다.
- 스포츠면 문체: "~다"로 끝나는 짧은 문장. 과장이나 완충 문장("~라고 할 수 있다", "~인 것으로 보인다")을 쓰지 않는다.
- 제목은 25자 안팎. 본문은 2~5문장.
- 인용(quotes)은 초안의 인용을 다듬거나 같은 인물의 말로만 쓴다. 선수는 선수답게, 감독은 감독답게, 팬은 짧은 반응으로. role은 player, manager, fan, gm 중 하나.
- 결과는 JSON 스키마에 맞춰 title, body, quotes만 낸다.`;

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

const KIND: Record<NewsItem['kind'], string> = { game: '경기 기사', milestone: '기록 달성 기사', month: '월간 결산', season: '시즌 결산', award: '시상 기사', interview: '인터뷰 기사', move: '이적 기사' };

/** The user message: kind, facts and the template draft (public information only). */
export function storyPrompt(item: NewsItem): string {
  return JSON.stringify(
    {
      kind: KIND[item.kind],
      date: item.date,
      facts: item.facts,
      draft: { title: item.title, body: item.body, quotes: item.quotes },
    },
    null,
    1,
  );
}
