import { k as __i18n_k } from '../i18n/index';
/* Interviews after a big day (1.2.0, from the 1.0 feedback). When one of our players has a game to remember — a
   no-hitter, a walk-off, two home runs, ten strikeouts, four hits — or reaches a career milestone, is named 미스터
   올스타 or wins a season award, the reporters want a word: a short question-and-answer piece in the news, now and
   then for an ordinary big game and always for the rare ones.

   The answers come from who he is: his personality sets the voice (Draft Room's eight), his traits what he talks
   about (a leader talks about the team, a big-stage player about wanting more of it, a hard worker about his
   routine, a loyal one about the fans and the club). The wording draws from a hash of the article's key, never from
   the simulation's streams.

   2.0.47 (the user's request: 인터뷰 내용의 다양성을 늘리자): several ways to ask each question; first answers about the
   day itself (a walk-off, a no-hitter, an award) as well as in his voice, a rookie's or a veteran's now and then; a
   pitcher may speak of his catcher by name; and sometimes a fourth question, about who he will call first. */
import { hashUnit } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { isJunior, type NewsItem } from './news';
import { isMarried } from './life';
import { ageIn, currentValue, isPitcher } from './players';
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

/** The question about the day (2.0.47: two ways to ask it). */
function firstQuestion(o: Occasion, key: string): string {
  switch (o.kind) {
    case 'noHit':
      return pick([__i18n_k("league.interviews.firstQuestion.fcd833bb"), __i18n_k("league.interviews.text.4512ad9d")], key);
    case 'walkOff':
      return pick([__i18n_k("league.interviews.firstQuestion.1b6227d7"), __i18n_k("league.interviews.text.fc4ea60b")], key);
    case 'multiHr':
      return pick([__i18n_k("league.interviews.firstQuestion.b8f7d3b4", { hr: o.hr }), __i18n_k("league.interviews.text.0e0ac078", { hr: o.hr })], key);
    case 'bigK':
      return pick([__i18n_k("league.interviews.firstQuestion.c5f0e76b", { value: o.k }), __i18n_k("league.interviews.text.2ddc9fb6", { k: o.k })], key);
    case 'fourHits':
      return pick([__i18n_k("league.interviews.firstQuestion.9dc3e0d9", { h: o.h }), __i18n_k("league.interviews.text.05c8f314", { h: o.h })], key);
    case 'milestone':
      return pick([__i18n_k("league.interviews.firstQuestion.e745849d", { label: o.label }), __i18n_k("league.interviews.text.dcf14440", { label: o.label })], key);
    case 'allStarMvp':
      return pick([__i18n_k("league.interviews.firstQuestion.f06cdfb3"), __i18n_k("league.interviews.text.502eadf3")], key);
    case 'award':
      return pick([__i18n_k("league.interviews.firstQuestion.a8cc85cb", { label: o.label }), __i18n_k("league.interviews.text.c24b1046", { label: o.label })], key);
  }
}

/** 2.0.47: first answers about the day itself. */
const ABOUT: Record<Occasion['kind'], string[]> = {
  noHit: [__i18n_k("league.interviews.text.45ba50e2"), __i18n_k("league.interviews.text.cf8bd6fd"), __i18n_k("league.interviews.text.e0639b22")],
  walkOff: [__i18n_k("league.interviews.text.765c2f8f"), __i18n_k("league.interviews.text.393ad435"), __i18n_k("league.interviews.text.85bfe046")],
  multiHr: [__i18n_k("league.interviews.text.3c86afea"), __i18n_k("league.interviews.text.2471cadc"), __i18n_k("league.interviews.text.0faeb522")],
  bigK: [__i18n_k("league.interviews.text.aa2d5edd"), __i18n_k("league.interviews.text.44fc32c4"), __i18n_k("league.interviews.text.d450492a")],
  fourHits: [__i18n_k("league.interviews.text.0f2e99ab"), __i18n_k("league.interviews.text.45b3f2fc"), __i18n_k("league.interviews.text.39f1dd40")],
  milestone: [__i18n_k("league.interviews.text.d2b5209d"), __i18n_k("league.interviews.text.4f0befd4"), __i18n_k("league.interviews.text.1760c2f1")],
  allStarMvp: [__i18n_k("league.interviews.text.6b76333a"), __i18n_k("league.interviews.text.b09216d3")],
  award: [__i18n_k("league.interviews.text.b8734d3f"), __i18n_k("league.interviews.text.e5994026"), __i18n_k("league.interviews.text.5e90a95b")],
};
/** 2.0.47: now and then a rookie's or a veteran's word. */
const ROOKIE = [__i18n_k("league.interviews.text.736db4ea"), __i18n_k("league.interviews.text.6b4c0bec")];
const VETERAN = [__i18n_k("league.interviews.text.55cdb667"), __i18n_k("league.interviews.text.30470d0e")];

/** His first answer, in his personality's voice. */
const VOICE: Record<string, string[]> = {
  '차분한 노력파': [
    __i18n_k("league.interviews.vOICE.460d72ce"),
    __i18n_k("league.interviews.vOICE.8dd315e9"),
    __i18n_k("league.interviews.text.1174acc8"),
    __i18n_k("league.interviews.text.d2b4d0f6"),
    __i18n_k("league.interviews.text.84d2c285"),
  ],
  '승부욕 강한 도전자': [
    __i18n_k("league.interviews.vOICE.a2aaa520"),
    __i18n_k("league.interviews.vOICE.ae409406"),
    __i18n_k("league.interviews.text.0267798a"),
    __i18n_k("league.interviews.text.c7166eaf"),
    __i18n_k("league.interviews.text.1b1ed608"),
  ],
  '밝은 분위기 메이커': [
    __i18n_k("league.interviews.vOICE.b146e693"),
    __i18n_k("league.interviews.vOICE.8ee06f72"),
    __i18n_k("league.interviews.text.4999dcaa"),
    __i18n_k("league.interviews.text.ecc7318a"),
    __i18n_k("league.interviews.text.63ee8d3e"),
  ],
  '분석을 즐기는 연구형': [
    __i18n_k("league.interviews.vOICE.73b58710"),
    __i18n_k("league.interviews.vOICE.e9bb5fc3"),
    __i18n_k("league.interviews.text.4dc50aa8"),
    __i18n_k("league.interviews.text.b4c2b080"),
    __i18n_k("league.interviews.text.372209d6"),
  ],
  '책임감 강한 리더': [
    __i18n_k("league.interviews.vOICE.fb60b78f"),
    __i18n_k("league.interviews.vOICE.3c90a625"),
    __i18n_k("league.interviews.text.86159b1e"),
    __i18n_k("league.interviews.text.eb25890d"),
    __i18n_k("league.interviews.text.0d8f1b23"),
  ],
  '말보다 행동하는 실천형': [
    __i18n_k("league.interviews.vOICE.78203649"),
    __i18n_k("league.interviews.vOICE.2a256cbd"),
    __i18n_k("league.interviews.text.f298fc28"),
    __i18n_k("league.interviews.text.de7b3167"),
    __i18n_k("league.interviews.text.c6fb4540"),
  ],
  '꾸준함을 믿는 성실형': [
    __i18n_k("league.interviews.vOICE.939ec82c"),
    __i18n_k("league.interviews.vOICE.c274b668"),
    __i18n_k("league.interviews.text.309b90d3"),
    __i18n_k("league.interviews.text.a8d432b0"),
    __i18n_k("league.interviews.text.4f3af2e1"),
  ],
  '큰 무대를 즐기는 대담형': [
    __i18n_k("league.interviews.vOICE.73a481f8"),
    __i18n_k("league.interviews.vOICE.13b61ecf"),
    __i18n_k("league.interviews.text.33851469"),
    __i18n_k("league.interviews.text.ba10580c"),
    __i18n_k("league.interviews.text.371780fe"),
  ],
};
const VOICE_DEFAULT = [
  __i18n_k("league.interviews.vOICE_DEFAULT.9ba6d873"),
  __i18n_k("league.interviews.vOICE_DEFAULT.145ee447"),
  __i18n_k("league.interviews.text.fe8bd65d"),
  __i18n_k("league.interviews.text.127991c1"),
  __i18n_k("league.interviews.text.5982ca0d"),
];
const YOUNG_VOICE = [
  __i18n_k("league.interviews.vOICE.fb60b78f"),
  __i18n_k("league.interviews.text.57ad7ebd"),
  __i18n_k("league.interviews.text.8190b0a1"),
  __i18n_k("league.interviews.text.e0afdc29"),
];

/** His club's catcher, as a pitcher speaks of him: an older one is 선배 (2.0.47). */
function catcherOf(s: LeagueState, p: Player): string | null {
  if (!p.teamId) return null;
  const c = (s.rosters[p.teamId]?.active ?? [])
    .map((id) => s.players[id]!)
    .filter((q) => q && q.id !== p.id && q.position === 'C')
    .sort((a, b) => currentValue(b) - currentValue(a))[0];
  if (!c) return null;
  return ageIn(c, s.year) > ageIn(p, s.year) ? __i18n_k("league.interviews.text.a565f5a3", { name: c.name }) : c.name;
}

/** The second question and answer: how he did it. */
function howQA(s: LeagueState, p: Player, o: Occasion, key: string): [string, string] {
  const pitcher = isPitcher(p);
  const analytic = p.personality === '분석을 즐기는 연구형';
  if (o.kind === 'noHit')
    return hashUnit(`${key}-q`) < 0.5
      ? [__i18n_k("league.interviews.howQA.4289e128"), pick([__i18n_k("league.interviews.howQA.88ecd410"), __i18n_k("league.interviews.howQA.79a11247")], key)]
      : [__i18n_k("league.interviews.text.41ae2d49"), pick([__i18n_k("league.interviews.text.807574fa"), __i18n_k("league.interviews.text.5b86e21a"), __i18n_k("league.interviews.text.527595d1")], key)];
  if (o.kind === 'walkOff')
    return [
      __i18n_k("league.interviews.howQA.7742dabb"),
      analytic ? __i18n_k("league.interviews.howQA.90441189") : pick([__i18n_k("league.interviews.howQA.870172dd"), __i18n_k("league.interviews.howQA.5a7e854d"), __i18n_k("league.interviews.text.defef90c"), __i18n_k("league.interviews.text.a4f78810")], key),
    ];
  if (pitcher) {
    // 2.0.47: now and then he speaks of his catcher.
    const catcher = catcherOf(s, p);
    if (catcher && hashUnit(`${key}-c`) < 0.4)
      return [__i18n_k("league.interviews.text.a12a8291"), pick([__i18n_k("league.interviews.text.0a361f0f", { catcher }), __i18n_k("league.interviews.text.81a47332", { catcher })], key)];
    return [
      __i18n_k("league.interviews.howQA.c7078d19"),
      pick(
        analytic
          ? [__i18n_k("league.interviews.howQA.7ddf5e26"), __i18n_k("league.interviews.howQA.6b1f9c25"), __i18n_k("league.interviews.text.d9cab8e7")]
          : [__i18n_k("league.interviews.howQA.43d4e19f"), __i18n_k("league.interviews.howQA.3cdea56c"), __i18n_k("league.interviews.text.abab2d3f"), __i18n_k("league.interviews.text.733d7b78")],
        key,
      ),
    ];
  }
  return [
    pick([__i18n_k("league.interviews.howQA.70337893"), __i18n_k("league.interviews.text.ceb7b297")], `${key}-q`),
    pick(
      analytic
        ? [__i18n_k("league.interviews.howQA.c4f98764"), __i18n_k("league.interviews.howQA.3ec1d4b5"), __i18n_k("league.interviews.text.e83422f5")]
        : [__i18n_k("league.interviews.howQA.0fe23664"), __i18n_k("league.interviews.howQA.0a014e05"), __i18n_k("league.interviews.howQA.cbcd0e96"), __i18n_k("league.interviews.text.1a85e23e"), __i18n_k("league.interviews.text.8e1fd3cd")],
      key,
    ),
  ];
}

/** 2.0.47: now and then a fourth question — who he will call first. */
function callQA(s: LeagueState, p: Player, key: string): [string, string] {
  const family = isMarried(s, p)
    ? [__i18n_k("league.interviews.text.7b60e9e2"), __i18n_k("league.interviews.text.90c9ea6e")]
    : [__i18n_k("league.interviews.text.c10e28de"), __i18n_k("league.interviews.text.45d9e2dc")];
  return [__i18n_k("league.interviews.text.5c5341e6"), pick(family, key)];
}

/** The last question: what next — by what matters most to him. */
function nextQA(p: Player, key: string, year: number): [string, string] {
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
    // 2.0.47: a young player does not speak of leading his juniors.
    leadership: isJunior(p, year)
      ? [__i18n_k("league.interviews.text.e6ba4169"), __i18n_k("league.interviews.answers.leadership.aa2d1116"), __i18n_k("league.interviews.text.e60674bd")]
      : [__i18n_k("league.interviews.answers.leadership.6752c3f0"), __i18n_k("league.interviews.answers.leadership.aa2d1116"), __i18n_k("league.interviews.text.0479ab07"), __i18n_k("league.interviews.text.20f98051")],
    mental: [__i18n_k("league.interviews.answers.mental.267ad626"), __i18n_k("league.interviews.answers.mental.b3e99734"), __i18n_k("league.interviews.text.8b402dc5"), __i18n_k("league.interviews.text.60db8a55")],
    work: [__i18n_k("league.interviews.answers.work.a3887809"), __i18n_k("league.interviews.answers.work.2d3e6e38"), __i18n_k("league.interviews.text.c6ee8e6f"), __i18n_k("league.interviews.text.e7d97b62")],
    loyalty: [__i18n_k("league.interviews.answers.loyalty.2c1ea707"), __i18n_k("league.interviews.answers.loyalty.6c5d2711"), __i18n_k("league.interviews.text.f8e60a55"), __i18n_k("league.interviews.text.8d5d061e")],
  };
  return [pick([__i18n_k("league.interviews.nextQA.b746ec05"), __i18n_k("league.interviews.text.3dea3be1")], `${key}-q`), pick(answers[top], key)];
}

/** The interview, when the day calls for one (the caller adds it to the news). */
export function heroInterview(s: LeagueState, id: PlayerId, date: string, o: Occasion, key: string): NewsItem | null {
  const p = s.players[id];
  if (!p || !s.user || p.teamId !== s.user.teamId) return null;
  if (hashUnit(`iv-chance-${key}`) >= CHANCE[o.kind]) return null;
  // 2.0.47 (user report): a young leader thanks his seniors, not his juniors. 2.0.47: half the time he talks about the
  // day itself; now and then a rookie's or a veteran's word.
  const age = ageIn(p, s.year);
  const voice = p.personality === '책임감 강한 리더' && isJunior(p, s.year) ? YOUNG_VOICE : (VOICE[p.personality] ?? VOICE_DEFAULT);
  const said = hashUnit(`${key}-about`);
  const a1 = pick(said < 0.15 && age <= 22 ? ROOKIE : said < 0.15 && age >= 34 ? VETERAN : said < 0.55 ? ABOUT[o.kind] : voice, `${key}-1`);
  const q1 = firstQuestion(o, `${key}-q1`);
  const [q2, a2] = howQA(s, p, o, `${key}-2`);
  const [q3, a3] = nextQA(p, `${key}-3`, s.year);
  const extra = hashUnit(`${key}-4`) < 0.35 ? callQA(s, p, `${key}-4a`) : null;
  const headline = a1.split(/[.!?]/)[0]!.trim();
  return {
    id: `hiv-${key}`,
    date,
    kind: 'interview',
    title: __i18n_k("league.interviews.heroInterview.title.c59e1031", { name: p.name, headline: headline }),
    body: `— ${q1}\n${a1}\n— ${q2}\n${a2}\n— ${q3}\n${a3}${extra ? `\n— ${extra[0]}\n${extra[1]}` : ''}`,
    quotes: [{ who: p.name, role: 'player', text: a1 }],
    facts: { player: p.name, personality: p.personality, occasion: q1 },
    players: [id],
    mine: true,
  };
}
