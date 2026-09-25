/* The one prompt every provider gets (ROADMAP "LLM 연동 설계"): a fixed system prompt with Draft Room's
   writing rules and the fictional world (cached where the provider supports it), and a user message
   with the article's public facts and the template draft. */
import type { NewsItem } from '../league/news';

export const STORY_SYSTEM = `너는 가상의 한국 프로야구 리그를 다루는 스포츠 신문 기자다. 이 리그의 선수·코치·팬·기록은 모두 게임 속 가상 인물과 가상 기록이다.

규칙:
- 주어진 사실(facts), 상세 기록(detail), 초안(draft)에 있는 내용만 쓴다. 숫자(점수, 기록, 날짜, 순위, 금액, 관중)는 거기 있는 값을 그대로 쓰고 새 숫자를 만들거나 계산해서 쓰지 않는다 (점수 차, 합계, 연승 수도 detail에 없으면 쓰지 않는다).
- 실존 인물의 이름을 쓰지 않는다. 사실에 나온 이름만 쓴다.
- 스포츠면 문체: "~다"로 끝나는 짧은 문장. 과장이나 완충 문장("~라고 할 수 있다", "~인 것으로 보인다")을 쓰지 않는다.
- 제목은 30자 안팎.
- 분량과 구성 (문단은 빈 줄로 나눈다):
  - 경기 기사: 5~8문단. 첫 문단은 결과와 승부를 가른 장면. 이어서 detail의 득점 장면을 이닝 순서대로 따라가며 아웃 카운트·주자 상황과 함께 경기 흐름을 쓴다. 선발 투수 대결과 불펜, 수훈 선수의 기록, 두 팀의 시즌 성적과 이 경기의 의미로 마무리한다.
  - 월간·시즌 결산: 5~8문단. 성적과 순위, 흐름을 바꾼 경기들, 타자·투수 기록, 수상·관중, 다음 과제.
  - 인터뷰: 질문은 "— "로 시작하는 줄, 답은 다음 줄. 질문과 답 5~7쌍. 선수의 성격이 말투에 드러나게 하고, 기록은 detail에서만 인용한다.
  - 기록 달성·시상 기사: 3~5문단.
  - 이적 기사(트레이드·방출·웨이버·외국인 교체·포스팅·FA·2차 드래프트): 4~6문단. 첫 문단은 누가 어디로 가는지와 조건. 이어서 선수마다 detail의 나이·포지션·올 시즌과 지난 시즌·통산 기록·연봉을 쓰고, 구단의 현재 성적과 이 이동으로 달라지는 자리를 기록으로 드러나는 만큼만 쓴 뒤 반응으로 마무리한다. 누가 이득인지 단정하지 않는다.
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
      detail: item.detail ?? [],
      draft: { title: item.title, body: item.body, quotes: item.quotes },
    },
    null,
    1,
  );
}
