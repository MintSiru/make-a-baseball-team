import { k as __i18n_k } from '../i18n/index';
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
      return __i18n_k("league.interviews.firstQuestion.fcd833bb");
    case 'walkOff':
      return __i18n_k("league.interviews.firstQuestion.1b6227d7");
    case 'multiHr':
      return __i18n_k("league.interviews.firstQuestion.b8f7d3b4", { hr: o.hr });
    case 'bigK':
      return __i18n_k("league.interviews.firstQuestion.c5f0e76b", { value: o.k });
    case 'fourHits':
      return __i18n_k("league.interviews.firstQuestion.9dc3e0d9", { h: o.h });
    case 'milestone':
      return __i18n_k("league.interviews.firstQuestion.e745849d", { label: o.label });
    case 'allStarMvp':
      return __i18n_k("league.interviews.firstQuestion.f06cdfb3");
    case 'award':
      return __i18n_k("league.interviews.firstQuestion.a8cc85cb", { label: o.label });
  }
}

/** His first answer, in his personality's voice. */
const VOICE: Record<string, string[]> = {
  '차분한 노력파': [__i18n_k("league.interviews.vOICE.460d72ce"), __i18n_k("league.interviews.vOICE.8dd315e9")],
  '승부욕 강한 도전자': [__i18n_k("league.interviews.vOICE.a2aaa520"), __i18n_k("league.interviews.vOICE.ae409406")],
  '밝은 분위기 메이커': [__i18n_k("league.interviews.vOICE.b146e693"), __i18n_k("league.interviews.vOICE.8ee06f72")],
  '분석을 즐기는 연구형': [__i18n_k("league.interviews.vOICE.73b58710"), __i18n_k("league.interviews.vOICE.e9bb5fc3")],
  '책임감 강한 리더': [__i18n_k("league.interviews.vOICE.fb60b78f"), __i18n_k("league.interviews.vOICE.3c90a625")],
  '말보다 행동하는 실천형': [__i18n_k("league.interviews.vOICE.78203649"), __i18n_k("league.interviews.vOICE.2a256cbd")],
  '꾸준함을 믿는 성실형': [__i18n_k("league.interviews.vOICE.939ec82c"), __i18n_k("league.interviews.vOICE.c274b668")],
  '큰 무대를 즐기는 대담형': [__i18n_k("league.interviews.vOICE.73a481f8"), __i18n_k("league.interviews.vOICE.13b61ecf")],
};
const VOICE_DEFAULT = [__i18n_k("league.interviews.vOICE_DEFAULT.9ba6d873"), __i18n_k("league.interviews.vOICE_DEFAULT.145ee447")];

/** The second question and answer: how he did it. */
function howQA(p: Player, o: Occasion, key: string): [string, string] {
  const pitcher = isPitcher(p);
  const analytic = p.personality === '분석을 즐기는 연구형';
  if (o.kind === 'noHit') return [__i18n_k("league.interviews.howQA.4289e128"), pick([__i18n_k("league.interviews.howQA.88ecd410"), __i18n_k("league.interviews.howQA.79a11247")], key)];
  if (o.kind === 'walkOff') return [__i18n_k("league.interviews.howQA.7742dabb"), analytic ? __i18n_k("league.interviews.howQA.90441189") : pick([__i18n_k("league.interviews.howQA.870172dd"), __i18n_k("league.interviews.howQA.5a7e854d")], key)];
  if (pitcher)
    return [
      __i18n_k("league.interviews.howQA.c7078d19"),
      pick(
        analytic
          ? [__i18n_k("league.interviews.howQA.7ddf5e26"), __i18n_k("league.interviews.howQA.6b1f9c25")]
          : [__i18n_k("league.interviews.howQA.43d4e19f"), __i18n_k("league.interviews.howQA.3cdea56c")],
        key,
      ),
    ];
  return [
    __i18n_k("league.interviews.howQA.70337893"),
    pick(analytic ? [__i18n_k("league.interviews.howQA.c4f98764"), __i18n_k("league.interviews.howQA.3ec1d4b5")] : [__i18n_k("league.interviews.howQA.0fe23664"), __i18n_k("league.interviews.howQA.0a014e05"), __i18n_k("league.interviews.howQA.cbcd0e96")], key),
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
    leadership: [__i18n_k("league.interviews.answers.leadership.6752c3f0"), __i18n_k("league.interviews.answers.leadership.aa2d1116")],
    mental: [__i18n_k("league.interviews.answers.mental.267ad626"), __i18n_k("league.interviews.answers.mental.b3e99734")],
    work: [__i18n_k("league.interviews.answers.work.a3887809"), __i18n_k("league.interviews.answers.work.2d3e6e38")],
    loyalty: [__i18n_k("league.interviews.answers.loyalty.2c1ea707"), __i18n_k("league.interviews.answers.loyalty.6c5d2711")],
  };
  return [__i18n_k("league.interviews.nextQA.b746ec05"), pick(answers[top], key)];
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
    title: __i18n_k("league.interviews.heroInterview.title.c59e1031", { name: p.name, headline: headline }),
    body: `— ${firstQuestion(o)}\n${a1}\n— ${q2}\n${a2}\n— ${q3}\n${a3}`,
    quotes: [{ who: p.name, role: 'player', text: a1 }],
    facts: { player: p.name, personality: p.personality, occasion: firstQuestion(o) },
    players: [id],
    mine: true,
  };
}
