/* Interviews after a big day (1.2.0, from the 1.0 feedback). When one of our players has a game to remember — a
   no-hitter, a walk-off, two home runs, ten strikeouts, four hits — or reaches a career milestone, is named 미스터
   올스타 or wins a season award, the reporters want a word: a short question-and-answer piece in the news, now and
   then for an ordinary big game and always for the rare ones.

   The answers come from who he is: his personality sets the voice (Draft Room's eight), his traits what he talks
   about (a leader talks about the team, a big-stage player about wanting more of it, a hard worker about his
   routine, a loyal one about the fans and the club). The wording draws from a hash of the article's key, never from
   the simulation's streams. */
import { hashUnit } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import type { NewsItem } from './news';
import { isPitcher } from './players';
import type { LeagueState } from './state';
import { traitsOf } from './traits';

export type Occasion =
  | { kind: 'noHit' }
  | { kind: 'walkOff' }
  | { kind: 'multiHr'; hr: number }
  | { kind: 'bigK'; k: number }
  | { kind: 'fourHits'; h: number }
  | { kind: 'milestone'; label: string }
  | { kind: 'allStarMvp' }
  | { kind: 'award'; label: string };

/** How often a big game gets an interview (the rare ones always). */
const CHANCE: Record<Occasion['kind'], number> = { noHit: 1, walkOff: 0.7, multiHr: 0.45, bigK: 0.45, fourHits: 0.35, milestone: 1, allStarMvp: 1, award: 1 };

const pick = <T,>(xs: readonly T[], key: string) => xs[Math.floor(hashUnit(key) * xs.length)]!;

/** The question about the day. */
function firstQuestion(o: Occasion): string {
  switch (o.kind) {
    case 'noHit':
      return '노히트 노런을 해냈다. 언제부터 의식했나?';
    case 'walkOff':
      return '끝내기 순간, 어떤 생각이 들었나?';
    case 'multiHr':
      return `한 경기 홈런 ${o.hr}개를 쳤다. 소감은?`;
    case 'bigK':
      return `삼진을 ${o.k}개나 잡았다. 오늘 공이 어땠나?`;
    case 'fourHits':
      return `${o.h}안타 경기를 했다. 감이 좋아 보인다.`;
    case 'milestone':
      return `통산 ${o.label} 기록을 세웠다. 소감은?`;
    case 'allStarMvp':
      return '미스터 올스타에 뽑혔다. 기분이 어떤가?';
    case 'award':
      return `${o.label} 수상을 축하한다. 소감은?`;
  }
}

/** His first answer, in his personality's voice. */
const VOICE: Record<string, string[]> = {
  '차분한 노력파': ['솔직히 실감이 잘 안 납니다. 준비한 대로 하려고 했을 뿐입니다.', '특별한 건 없었습니다. 평소처럼 하나씩 했습니다.'],
  '승부욕 강한 도전자': ['이런 날을 기다렸습니다. 그래도 여기서 만족하지 않겠습니다.', '지기 싫어서 끝까지 붙었습니다. 이겨서 더 좋습니다.'],
  '밝은 분위기 메이커': ['와, 진짜 너무 좋아요! 형들이 다 같이 기뻐해 줘서 더 신났습니다.', '팬분들 함성이 엄청났어요. 저도 모르게 소리 질렀습니다!'],
  '분석을 즐기는 연구형': ['전력분석팀과 준비한 게 그대로 맞아떨어졌습니다.', '상대 패턴을 계속 봤는데, 생각한 그림대로 갔습니다.'],
  '책임감 강한 리더': ['제 기록보다 팀이 이긴 게 먼저입니다. 다 같이 만든 겁니다.', '후배들이 잘 버텨 줘서 가능했습니다. 고맙다는 말 하고 싶습니다.'],
  '말보다 행동하는 실천형': ['할 말은 별로 없습니다. 내일도 똑같이 하겠습니다.', '말보다 결과로 보여 드리고 싶었습니다.'],
  '꾸준함을 믿는 성실형': ['하루하루 쌓은 게 오늘 나온 것 같습니다.', '루틴을 지킨 덕분입니다. 들뜨지 않겠습니다.'],
  '큰 무대를 즐기는 대담형': ['이런 순간이 제일 재밌습니다. 전혀 안 떨렸어요.', '큰 경기 체질인가 봅니다. 다음에도 저한테 왔으면 좋겠네요.'],
};
const VOICE_DEFAULT = ['좋은 결과가 나와서 기쁩니다.', '팀에 도움이 돼서 다행입니다.'];

/** The second question and answer: how he did it. */
function howQA(p: Player, o: Occasion, key: string): [string, string] {
  const pitcher = isPitcher(p);
  const analytic = p.personality === '분석을 즐기는 연구형';
  if (o.kind === 'noHit') return ['몇 회쯤부터 기록을 알았나?', pick(['7회쯤 전광판을 봤는데 그때부터는 일부러 안 봤습니다.', '동료들이 아무 말도 안 해서 알았습니다. 그게 오히려 부담이었어요.'], key)];
  if (o.kind === 'walkOff') return ['어떤 공을 노렸나?', analytic ? '그 상황에서 상대가 바깥쪽 변화구를 던질 거라고 봤습니다.' : pick(['노린 건 없습니다. 맞으면 끝난다는 생각만 했습니다.', '직구 하나만 보고 들어갔습니다.'], key)];
  if (pitcher)
    return [
      '오늘 가장 좋았던 공은?',
      pick(
        analytic
          ? ['슬라이더 각이 좋아서 카운트 싸움이 편했습니다.', '데이터상 상대가 높은 직구에 약해서 그쪽을 많이 썼습니다.']
          : ['직구에 힘이 있었습니다. 포수 사인대로 믿고 던졌습니다.', '변화구 제구가 잘 됐습니다. 그래서 직구도 살았습니다.'],
        key,
      ),
    ];
  return [
    '타석에서 무엇을 노렸나?',
    pick(analytic ? ['상대 투수 초구 패턴을 봤습니다. 거기 맞춰 준비했습니다.', '영상으로 본 대로 높은 쪽을 기다렸습니다.'] : ['실투 하나만 기다렸습니다.', '공 보고 공 치기. 단순하게 생각했습니다.', '타이밍만 늦지 않게 신경 썼습니다.'], key),
  ];
}

/** The last question: what next — by what matters most to him. */
function nextQA(p: Player, key: string): [string, string] {
  const t = traitsOf(p);
  const top = (
    [
      ['leadership', t.leadership],
      ['mental', t.mental],
      ['work', t.work],
      ['loyalty', t.loyalty],
    ] as const
  )
    .slice()
    .sort((a, b) => b[1] - a[1])[0]![0];
  const answers: Record<typeof top, string[]> = {
    leadership: ['개인 목표보다 팀이 가을야구에 가는 게 먼저입니다. 후배들 잘 이끌겠습니다.', '팀 분위기가 좋습니다. 이 분위기 끝까지 이어 가겠습니다.'],
    mental: ['더 큰 무대에서 뛰고 싶습니다. 가을에 이런 경기 꼭 하겠습니다.', '중요한 경기일수록 저한테 맡겨 주시면 좋겠습니다.'],
    work: ['오늘은 오늘이고, 내일 또 훈련장에 일찍 나오겠습니다.', '아직 부족한 게 많습니다. 시즌 끝까지 다치지 않고 꾸준히 하겠습니다.'],
    loyalty: ['이 유니폼 입고 오래 뛰고 싶습니다. 팬분들께 늘 감사합니다.', '우리 팬들 앞에서 우승하는 게 꿈입니다. 꼭 이루겠습니다.'],
  };
  return ['앞으로의 목표는?', pick(answers[top], key)];
}

/** The interview, when the day calls for one (the caller adds it to the news). */
export function heroInterview(s: LeagueState, id: PlayerId, date: string, o: Occasion, key: string): NewsItem | null {
  const p = s.players[id];
  if (!p || !s.user || p.teamId !== s.user.teamId) return null;
  if (hashUnit(`iv-chance-${key}`) >= CHANCE[o.kind]) return null;
  const a1 = pick(VOICE[p.personality] ?? VOICE_DEFAULT, `${key}-1`);
  const [q2, a2] = howQA(p, o, `${key}-2`);
  const [q3, a3] = nextQA(p, `${key}-3`);
  const headline = a1.split(/[.!]/)[0]!.trim();
  return {
    id: `hiv-${key}`,
    date,
    kind: 'interview',
    title: `[인터뷰] ${p.name} "${headline}"`,
    body: `— ${firstQuestion(o)}\n${a1}\n— ${q2}\n${a2}\n— ${q3}\n${a3}`,
    quotes: [{ who: p.name, role: 'player', text: a1 }],
    facts: { player: p.name, personality: p.personality, occasion: firstQuestion(o) },
    players: [id],
    mine: true,
  };
}
