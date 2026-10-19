import { k as __i18n_k } from '../i18n/index';
/* 1.9.3: nicknames (별명), from the 1.9 feedback. After the awards each winter the fans give a player one from his
   public record (41 kinds, three to five names each): awards and titles, career and season marks, golden gloves by
   position, a career with one club, a fastball of 158 and up, the pitch he leans on, forty and still playing. A bigger feat later gives him a bigger one (by tier); otherwise a nickname stays. The general manager may
   give our players one of his own, which no record replaces. Only names and numbers anyone could see are used. */
import { hashUnit } from '../draftroom';
import type { Player, PlayerId, TeamId } from '../model/types';
import { awardLabel } from './awards';
import { landmarkOf } from './landmarks';
import { armAngle } from './tracking';

/** 2.0.0: an arm angle under this is a submariner's (tracking.ts). */
const SLOT_UNDER = 0;
import { clubIn } from './lineage';
import { addNews } from './news';
import { ageIn, isForeign, isPitcher } from './players';
import { fastballOf, repertoire, topVelocity } from './pitches';
import type { LeagueState } from './state';

export type NickCode = 'legend' | 'mvp' | 'triple' | 'mvp1' | 'hrKing' | 'oneClub' | 'saveKing' | 'hits2000' | 'hr300' | 'w150' | 'hr' | 'hr40' | 'avg' | 'rbi' | 'hits' | 'runs' | 'obp' | 'slg' | 'sb' | 'k' | 'k200' | 'ace' | 'w20' | 'pct' | 'save' | 'catcher' | 'shortstop' | 'outfield' | 'glove' | 'dh' | 'heater' | 'control' | 'ironGames' | 'iron' | 'hold' | 'foreign' | 'knuckle' | 'oldPitch' | 'sinker' | 'cutter' | 'fake' | 'big' | 'small' | 'rookie' | 'walkOn' | 'bomber' | 'workhorse' | 'phoenix' | 'evergreen' | 'crafty' | 'pitchMix' | 'submarine' | 'perfect' | 'noHitter' | 'cycle' | 'hrStreak' | 'immaculate';

/** The record a nickname comes from: given in `year`; `team` is the club a "{club}" in it names. */
export type Nickname = NonNullable<Player['nickname']> & { code: NickCode };

/** A name from the club a "{club}" names and the player's given name (1.9.5: 큰·작·짭 + the given name). */
type Names = ((club: string, given: string, place: string) => string)[];

/** Each nickname's tier (a higher one replaces a lower), its names (one drawn per player) and why. */
const CATALOG: Record<NickCode, { tier: number; names: Names; why: () => string }> = {
  legend: { tier: 5, names: [() => __i18n_k("league.nicknames.text.72075069"), () => __i18n_k("league.nicknames.text.9cda7809"), (club) => __i18n_k("league.nicknames.text.a96961b0", { club }), () => __i18n_k("league.nicknames.text.b7674e16"), () => __i18n_k("league.nicknames.text.f69335ff"), (_, __, place) => __i18n_k("league.nicknames.text.1530ae72", { place })], why: () => __i18n_k("league.nicknames.text.3980c706") },
  mvp: { tier: 5, names: [() => __i18n_k("league.nicknames.text.bf8187e7"), (club) => __i18n_k("league.nicknames.text.400f1864", { club }), () => __i18n_k("league.nicknames.text.1c4ddf42"), () => __i18n_k("league.nicknames.text.70a99f74"), () => __i18n_k("league.nicknames.text.1f2b3bdb")], why: () => __i18n_k("league.nicknames.text.896908f4") },
  triple: { tier: 5, names: [() => __i18n_k("league.nicknames.text.35e6f1f3"), () => __i18n_k("league.nicknames.text.4b47db32"), () => __i18n_k("league.nicknames.text.75a0b461"), () => __i18n_k("league.nicknames.text.3b993e89")], why: () => __i18n_k("league.nicknames.text.5b44ab89") },
  mvp1: { tier: 4, names: [(club) => __i18n_k("league.nicknames.text.443d65cd", { club }), () => __i18n_k("league.nicknames.text.9a7037c9"), () => __i18n_k("league.nicknames.text.11dccbc1"), (club) => __i18n_k("league.nicknames.text.e62661ba", { club })], why: () => __i18n_k("league.nicknames.text.105caf78") },
  hrKing: { tier: 4, names: [() => __i18n_k("league.nicknames.text.53e2ce84"), () => __i18n_k("league.nicknames.text.3b9bdba2"), () => __i18n_k("league.nicknames.text.88678a90"), () => __i18n_k("league.nicknames.text.7307ca11"), () => __i18n_k("league.nicknames.text.840295f1"), (_, __, place) => __i18n_k("league.nicknames.text.b50b9b86", { place })], why: () => __i18n_k("league.nicknames.text.72ed7454") },
  oneClub: { tier: 4, names: [(club) => __i18n_k("league.nicknames.text.77dfd824", { club }), () => __i18n_k("league.nicknames.text.32f7e058"), (club) => __i18n_k("league.nicknames.text.cd526bf0", { club }), (club) => __i18n_k("league.nicknames.text.c53811ee", { club }), (club) => __i18n_k("league.nicknames.text.906fc8e3", { club }), (_, __, place) => __i18n_k("league.nicknames.text.9d4d9724", { place })], why: () => __i18n_k("league.nicknames.text.60e9f92b") },
  saveKing: { tier: 4, names: [() => __i18n_k("league.nicknames.text.876f733f"), () => __i18n_k("league.nicknames.text.150c64db"), () => __i18n_k("league.nicknames.text.61bf0260"), () => __i18n_k("league.nicknames.text.2112ca45"), () => __i18n_k("league.nicknames.text.0da80aac"), (_, __, place) => __i18n_k("league.nicknames.text.76642167", { place })], why: () => __i18n_k("league.nicknames.text.5123d97a") },
  hits2000: { tier: 4, names: [() => __i18n_k("league.nicknames.text.9ed8a3ff"), () => __i18n_k("league.nicknames.text.3db7ccf1"), () => __i18n_k("league.nicknames.text.1cfc2a9f"), (club) => __i18n_k("league.nicknames.text.fd9990be", { club }), (_, __, place) => __i18n_k("league.nicknames.text.bd0d329b", { place })], why: () => __i18n_k("league.nicknames.text.0c999e42") },
  hr300: { tier: 4, names: [() => __i18n_k("league.nicknames.text.3b0147c6"), () => __i18n_k("league.nicknames.text.99bcd40c"), (club) => __i18n_k("league.nicknames.text.0ddcb21f", { club }), () => __i18n_k("league.nicknames.text.71cdc639"), (_, __, place) => __i18n_k("league.nicknames.text.39931843", { place })], why: () => __i18n_k("league.nicknames.text.1f6956d1") },
  w150: { tier: 4, names: [() => __i18n_k("league.nicknames.text.c6e716e8"), (club) => __i18n_k("league.nicknames.text.955eaee2", { club }), () => __i18n_k("league.nicknames.text.9c7c884f"), () => __i18n_k("league.nicknames.text.2fbd689d")], why: () => __i18n_k("league.nicknames.text.527396e8") },
  hr: { tier: 3, names: [() => __i18n_k("league.nicknames.text.89e5b73a"), () => __i18n_k("league.nicknames.text.f8bc7046"), () => __i18n_k("league.nicknames.text.bf2ae07b"), () => __i18n_k("league.nicknames.text.f94340f5"), () => __i18n_k("league.nicknames.text.cd63a1f6")], why: () => __i18n_k("league.nicknames.text.e74ea0c8") },
  hr40: { tier: 3, names: [() => __i18n_k("league.nicknames.text.cc9211e8"), () => __i18n_k("league.nicknames.text.6716992d"), () => __i18n_k("league.nicknames.text.99f9b122"), () => __i18n_k("league.nicknames.text.e42aef3c")], why: () => __i18n_k("league.nicknames.text.f0a32856") },
  avg: { tier: 3, names: [() => __i18n_k("league.nicknames.text.797b2584"), () => __i18n_k("league.nicknames.text.32087d90"), () => __i18n_k("league.nicknames.text.33874b72"), () => __i18n_k("league.nicknames.text.05ac7984"), () => __i18n_k("league.nicknames.text.e3b2c537")], why: () => __i18n_k("league.nicknames.text.2f2dc8c8") },
  rbi: { tier: 3, names: [() => __i18n_k("league.nicknames.text.3f399485"), () => __i18n_k("league.nicknames.text.2672eda9"), () => __i18n_k("league.nicknames.text.87d41670"), () => __i18n_k("league.nicknames.text.3c81368a")], why: () => __i18n_k("league.nicknames.text.46672e13") },
  hits: { tier: 3, names: [() => __i18n_k("league.nicknames.text.490bbb1f"), () => __i18n_k("league.nicknames.text.e6797497"), () => __i18n_k("league.nicknames.text.7f9f3a3f"), () => __i18n_k("league.nicknames.text.4c03dbad")], why: () => __i18n_k("league.nicknames.text.25cc6919") },
  runs: { tier: 3, names: [() => __i18n_k("league.nicknames.text.0a9dbd6e"), () => __i18n_k("league.nicknames.text.4ee0c0b3"), () => __i18n_k("league.nicknames.text.17724412"), () => __i18n_k("league.nicknames.text.7addf5ff")], why: () => __i18n_k("league.nicknames.text.5af2e330") },
  obp: { tier: 3, names: [() => __i18n_k("league.nicknames.text.b7d3ffdd"), () => __i18n_k("league.nicknames.text.9e2c0437"), () => __i18n_k("league.nicknames.text.15e0cec4"), () => __i18n_k("league.nicknames.text.a36481ab")], why: () => __i18n_k("league.nicknames.text.209ab2a2") },
  slg: { tier: 3, names: [() => __i18n_k("league.nicknames.text.695e57a2"), () => __i18n_k("league.nicknames.text.a7cd6108"), () => __i18n_k("league.nicknames.text.b8275c0c"), () => __i18n_k("league.nicknames.text.7a7b6779")], why: () => __i18n_k("league.nicknames.text.cdafbf8a") },
  sb: { tier: 3, names: [() => __i18n_k("league.nicknames.text.fa38ca53"), () => __i18n_k("league.nicknames.text.4c2e8a5e"), () => __i18n_k("league.nicknames.text.fce91d12"), () => __i18n_k("league.nicknames.text.1da58dca"), () => __i18n_k("league.nicknames.text.4a083719"), (_, __, place) => __i18n_k("league.nicknames.text.c42bd6c5", { place })], why: () => __i18n_k("league.nicknames.text.65624f66") },
  k: { tier: 3, names: [() => __i18n_k("league.nicknames.text.884ab20d"), () => __i18n_k("league.nicknames.text.2d3441f3"), () => __i18n_k("league.nicknames.text.b8df828c"), () => __i18n_k("league.nicknames.text.7d034fc9"), () => __i18n_k("league.nicknames.text.d0dd3fac")], why: () => __i18n_k("league.nicknames.text.edbdf38e") },
  k200: { tier: 3, names: [() => __i18n_k("league.nicknames.text.79d8f028"), () => __i18n_k("league.nicknames.text.f191b006"), () => __i18n_k("league.nicknames.text.c1cf5fa2")], why: () => __i18n_k("league.nicknames.text.421cabcd") },
  ace: { tier: 3, names: [(club) => __i18n_k("league.nicknames.text.4f9eb883", { club }), () => __i18n_k("league.nicknames.text.9c8069c6"), () => __i18n_k("league.nicknames.text.44045880"), () => __i18n_k("league.nicknames.text.df6310ae"), () => __i18n_k("league.nicknames.text.a32579c4"), (_, __, place) => __i18n_k("league.nicknames.text.6ee182d9", { place })], why: () => __i18n_k("league.nicknames.text.b281e484") },
  w20: { tier: 3, names: [() => __i18n_k("league.nicknames.text.12efaf1a"), () => __i18n_k("league.nicknames.text.7c8fe1d8"), () => __i18n_k("league.nicknames.text.1c4fc3cd")], why: () => __i18n_k("league.nicknames.text.a19f4599") },
  pct: { tier: 3, names: [() => __i18n_k("league.nicknames.text.668f1377"), () => __i18n_k("league.nicknames.text.c80cc3a9"), () => __i18n_k("league.nicknames.text.8d59c0e6")], why: () => __i18n_k("league.nicknames.text.c6a798b4") },
  save: { tier: 3, names: [() => __i18n_k("league.nicknames.text.4f1e3fa1"), () => __i18n_k("league.nicknames.text.29ad170a"), () => __i18n_k("league.nicknames.text.5d857bac"), () => __i18n_k("league.nicknames.text.d9b5abb6"), () => __i18n_k("league.nicknames.text.2ba04135")], why: () => __i18n_k("league.nicknames.text.daf4d623") },
  catcher: { tier: 3, names: [() => __i18n_k("league.nicknames.text.c5b6630a"), () => __i18n_k("league.nicknames.text.1fbf2c87"), () => __i18n_k("league.nicknames.text.4e315d40"), () => __i18n_k("league.nicknames.text.3b2dac19")], why: () => __i18n_k("league.nicknames.text.67f521ae") },
  shortstop: { tier: 3, names: [() => __i18n_k("league.nicknames.text.8405ef4a"), () => __i18n_k("league.nicknames.text.8284c14e"), () => __i18n_k("league.nicknames.text.8c18249e"), () => __i18n_k("league.nicknames.text.d6ba8d04")], why: () => __i18n_k("league.nicknames.text.ded7d733") },
  outfield: { tier: 3, names: [() => __i18n_k("league.nicknames.text.7c181cc9"), () => __i18n_k("league.nicknames.text.14813a3b"), () => __i18n_k("league.nicknames.text.8273df60"), () => __i18n_k("league.nicknames.text.37a1b748")], why: () => __i18n_k("league.nicknames.text.8bff19d3") },
  glove: { tier: 3, names: [() => __i18n_k("league.nicknames.text.80ef74b5"), () => __i18n_k("league.nicknames.text.a0471ab7"), () => __i18n_k("league.nicknames.text.47abeef5"), () => __i18n_k("league.nicknames.text.37e36092"), () => __i18n_k("league.nicknames.text.443431ad")], why: () => __i18n_k("league.nicknames.text.b387de31") },
  dh: { tier: 3, names: [() => __i18n_k("league.nicknames.text.66dc12c6"), () => __i18n_k("league.nicknames.text.ece4397d"), () => __i18n_k("league.nicknames.text.27269e1e")], why: () => __i18n_k("league.nicknames.text.7a5f1801") },
  heater: { tier: 2, names: [() => __i18n_k("league.nicknames.text.0f43dced"), () => __i18n_k("league.nicknames.text.cdf98f2d"), () => __i18n_k("league.nicknames.text.744811eb"), () => __i18n_k("league.nicknames.text.d6f8a48f"), () => __i18n_k("league.nicknames.text.b08f3e93")], why: () => __i18n_k("league.nicknames.text.59a3c5dd") },
  control: { tier: 2, names: [() => __i18n_k("league.nicknames.text.67c94da4"), () => __i18n_k("league.nicknames.text.c4a00276"), () => __i18n_k("league.nicknames.text.9eb02a98"), () => __i18n_k("league.nicknames.text.fcac2e86")], why: () => __i18n_k("league.nicknames.text.01d2cae3") },
  ironGames: { tier: 2, names: [() => __i18n_k("league.nicknames.text.3ec6bbe3"), () => __i18n_k("league.nicknames.text.1db38f03"), () => __i18n_k("league.nicknames.text.bd21d353"), () => __i18n_k("league.nicknames.text.2ee0e24d")], why: () => __i18n_k("league.nicknames.text.38b86773") },
  iron: { tier: 2, names: [() => __i18n_k("league.nicknames.text.e1b293f0"), () => __i18n_k("league.nicknames.text.7d20f8e3"), () => __i18n_k("league.nicknames.text.23d1b328"), () => __i18n_k("league.nicknames.text.eae3f936"), () => __i18n_k("league.nicknames.text.2054db51")], why: () => __i18n_k("league.nicknames.text.cbe85715") },
  hold: { tier: 2, names: [() => __i18n_k("league.nicknames.text.26b2de5d"), () => __i18n_k("league.nicknames.text.3902089d"), () => __i18n_k("league.nicknames.text.8aec620c"), () => __i18n_k("league.nicknames.text.6bae7a8e"), () => __i18n_k("league.nicknames.text.0d93b9ef")], why: () => __i18n_k("league.nicknames.text.5355207c") },
  foreign: { tier: 2, names: [() => __i18n_k("league.nicknames.text.e70d808e"), () => __i18n_k("league.nicknames.text.2f591371"), (club) => __i18n_k("league.nicknames.text.04acd87e", { club }), () => __i18n_k("league.nicknames.text.3d76d4a6"), () => __i18n_k("league.nicknames.text.4a07773b"), () => __i18n_k("league.nicknames.text.aa628aa3"), (club) => __i18n_k("league.nicknames.text.629d0b46", { club })], why: () => __i18n_k("league.nicknames.text.0605fc64") },
  knuckle: { tier: 2, names: [() => __i18n_k("league.nicknames.text.ffc72ae8"), () => __i18n_k("league.nicknames.text.18acdc99"), () => __i18n_k("league.nicknames.text.1ca201f3"), () => __i18n_k("league.nicknames.text.84ea2ab1")], why: () => __i18n_k("league.nicknames.text.c9fde957") },
  oldPitch: { tier: 2, names: [() => __i18n_k("league.nicknames.text.2dc02089"), () => __i18n_k("league.nicknames.text.33e8febb"), () => __i18n_k("league.nicknames.text.13d4ee4c")], why: () => __i18n_k("league.nicknames.text.ce265203") },
  sinker: { tier: 1, names: [() => __i18n_k("league.nicknames.text.73d529bc"), () => __i18n_k("league.nicknames.text.9e085d61"), () => __i18n_k("league.nicknames.text.4d4b94fc")], why: () => __i18n_k("league.nicknames.text.08e3820a") },
  cutter: { tier: 1, names: [() => __i18n_k("league.nicknames.text.9df84812"), () => __i18n_k("league.nicknames.text.db633069"), () => __i18n_k("league.nicknames.text.1d2fe275")], why: () => __i18n_k("league.nicknames.text.3682fa89") },
  // 1.9.9 (the user's request): the old-time names (RULES.md §9 별명): 연습생 신화 (장종훈), 폭격기 (선동열 「무등산 폭격기」),
  // 철완 (최동원, 장명부 427⅓이닝), 불사조 (박철순), 노송 (김용수), 너구리 (장명부), 팔색조 (조계현) — for what the
  // record shows, so the old seasons' workloads earn them most.
  walkOn: { tier: 4, names: [() => __i18n_k("league.nicknames.text.d51fb6d7"), () => __i18n_k("league.nicknames.text.a737c937"), () => __i18n_k("league.nicknames.text.8b5b63d6"), () => __i18n_k("league.nicknames.text.67af428a")], why: () => __i18n_k("league.nicknames.text.8a0c7dd7") },
  bomber: { tier: 3.5, names: [() => __i18n_k("league.nicknames.text.6f134201"), (club) => __i18n_k("league.nicknames.text.f2ce3b51", { club }), () => __i18n_k("league.nicknames.text.b7212081"), () => __i18n_k("league.nicknames.text.b5599e10"), (_, __, place) => __i18n_k("league.nicknames.text.a82856fa", { place }), (_, __, place) => __i18n_k("league.nicknames.text.a82856fa", { place })], why: () => __i18n_k("league.nicknames.text.4be9c292") },
  workhorse: { tier: 3, names: [() => __i18n_k("league.nicknames.text.c5813be8"), () => __i18n_k("league.nicknames.text.60a39364"), () => __i18n_k("league.nicknames.text.b81d8c10"), () => __i18n_k("league.nicknames.text.cf490736"), (_, __, place) => __i18n_k("league.nicknames.text.3ae10b4c", { place })], why: () => __i18n_k("league.nicknames.text.5ef88d85") },
  phoenix: { tier: 3, names: [() => __i18n_k("league.nicknames.text.3bba71fe"), () => __i18n_k("league.nicknames.text.55299f18"), () => __i18n_k("league.nicknames.text.bc5fac57"), () => __i18n_k("league.nicknames.text.2b8d244c")], why: () => __i18n_k("league.nicknames.text.13a693de") },
  evergreen: { tier: 3, names: [() => __i18n_k("league.nicknames.text.dd71a70c"), () => __i18n_k("league.nicknames.text.44182efe"), () => __i18n_k("league.nicknames.text.8d4616e8")], why: () => __i18n_k("league.nicknames.text.ed6d0791") },
  crafty: { tier: 2.5, names: [() => __i18n_k("league.nicknames.text.0b46112d"), () => __i18n_k("league.nicknames.text.cfc2df5c"), () => __i18n_k("league.nicknames.text.4dddcd7f"), () => __i18n_k("league.nicknames.text.c6b08dec")], why: () => __i18n_k("league.nicknames.text.686f7b9a") },
  pitchMix: { tier: 2, names: [() => __i18n_k("league.nicknames.text.ad0a48cc"), () => __i18n_k("league.nicknames.text.591f5d3d"), () => __i18n_k("league.nicknames.text.17bc2445")], why: () => __i18n_k("league.nicknames.text.cdf144ce") },
  // 2.0.0: an underhand pitcher who wins (이강철 「핵잠수함」): his arm slot from tracking.ts.
  submarine: { tier: 2, names: [() => __i18n_k("league.nicknames.text.c6c0729a"), () => __i18n_k("league.nicknames.text.6532d628"), () => __i18n_k("league.nicknames.text.9b6909fc")], why: () => __i18n_k("league.nicknames.text.e96154d3") },
  // 2.0.7 (the user's request): the great single-game feats (feats.ts).
  perfect: { tier: 4, names: [() => __i18n_k("league.nicknames.text.b6247b5d"), () => __i18n_k("league.nicknames.text.c81829b8"), (club) => __i18n_k("league.nicknames.text.4a0c3acc", { club }), () => __i18n_k("league.nicknames.text.0784798d")], why: () => __i18n_k("league.nicknames.text.ce5342e4") },
  noHitter: { tier: 3, names: [() => __i18n_k("league.nicknames.text.31f361fc"), () => __i18n_k("league.nicknames.text.dcd04827"), (club) => __i18n_k("league.nicknames.text.ff607674", { club }), () => __i18n_k("league.nicknames.text.868555f3")], why: () => __i18n_k("league.nicknames.text.b1faa7c8") },
  cycle: { tier: 3, names: [() => __i18n_k("league.nicknames.text.7c6af36b"), () => __i18n_k("league.nicknames.text.4a5f8e98"), () => __i18n_k("league.nicknames.text.d4c80c75"), (club) => __i18n_k("league.nicknames.text.0f93e0f0", { club })], why: () => __i18n_k("league.nicknames.text.2fd46a6d") },
  hrStreak: { tier: 3, names: [() => __i18n_k("league.nicknames.text.fbf64703"), () => __i18n_k("league.nicknames.text.f5840534"), () => __i18n_k("league.nicknames.text.3f0fb907"), (club) => __i18n_k("league.nicknames.text.448cdf3b", { club })], why: () => __i18n_k("league.nicknames.text.333419ef") },
  immaculate: { tier: 2, names: [() => __i18n_k("league.nicknames.text.49b2a938"), () => __i18n_k("league.nicknames.text.bb87dd13"), () => __i18n_k("league.nicknames.text.72b43499"), () => __i18n_k("league.nicknames.text.0e630db7")], why: () => __i18n_k("league.nicknames.text.17fb66f7") },
  // 1.9.5 (the user's request): namesakes. Two players in the league with one name are 큰 (the elder) and 작 (the younger)
  // + the given name, as fans tell them apart; one who shares a hall-of-famer's name is 짭 + the given name.
  fake: { tier: 1.6, names: [(_, given) => __i18n_k("league.nicknames.text.6a424078", { given })], why: () => __i18n_k("league.nicknames.text.f4f5781c") },
  big: { tier: 1.5, names: [(_, given) => __i18n_k("league.nicknames.text.450ed5c3", { given })], why: () => __i18n_k("league.nicknames.text.730d79f4") },
  small: { tier: 1.5, names: [(_, given) => __i18n_k("league.nicknames.text.f9ef294f", { given })], why: () => __i18n_k("league.nicknames.text.82043aa0") },
  rookie: { tier: 1, names: [() => __i18n_k("league.nicknames.text.0907682a"), () => __i18n_k("league.nicknames.text.21ff9e6f"), () => __i18n_k("league.nicknames.text.c91c8593"), () => __i18n_k("league.nicknames.text.2ede4455"), () => __i18n_k("league.nicknames.text.bf2885ef")], why: () => __i18n_k("league.nicknames.text.9ecfbb08") },
};

/** Codes in the order they are tried at the same tier. */
const ORDER = Object.keys(CATALOG) as NickCode[];

/** 2.0.22 (the user's report: a foreign ace called 「토종 에이스」): the names only a home-grown player can have,
    by their place in the list, and the foreign players' own names for the titles they win most. */
const DOMESTIC_ONLY: Partial<Record<NickCode, number[]>> = { ace: [4], legend: [4], bomber: [3], oneClub: [5] };
const FOREIGN_NAMES: Partial<Record<NickCode, Names>> = {
  ace: [() => __i18n_k("league.nicknames.text.9f101a8c"), (club) => __i18n_k("league.nicknames.text.cbf362e7", { club }), () => __i18n_k("league.nicknames.text.23e36842"), () => __i18n_k("league.nicknames.text.ab36babc"), (club) => __i18n_k("league.nicknames.text.07a1aa8a", { club })],
  hr: [() => __i18n_k("league.nicknames.text.bc298926"), (club) => __i18n_k("league.nicknames.text.101590bb", { club }), () => __i18n_k("league.nicknames.text.b4eb36c5"), () => __i18n_k("league.nicknames.text.e8315f7c")],
  hrKing: [() => __i18n_k("league.nicknames.text.e5194531"), () => __i18n_k("league.nicknames.text.32843294"), (club) => __i18n_k("league.nicknames.text.11e3dc75", { club })],
  legend: [() => __i18n_k("league.nicknames.text.9a46ab31"), (club) => __i18n_k("league.nicknames.text.9bbc5db8", { club }), () => __i18n_k("league.nicknames.text.9569fe10"), () => __i18n_k("league.nicknames.text.4e7ddb18")],
  mvp1: [() => __i18n_k("league.nicknames.text.6fc0bea4"), (club) => __i18n_k("league.nicknames.text.257f91bd", { club }), () => __i18n_k("league.nicknames.text.aa628aa3")],
  k: [() => __i18n_k("league.nicknames.text.6db682fc"), () => __i18n_k("league.nicknames.text.5333cf87")],
};

/** A name for him from the list: a foreign player's own if there is one, never a home-grown one's. */
function pick(p: Player, code: NickCode): { i: number; foreign?: boolean } {
  const own = isForeign(p) ? FOREIGN_NAMES[code] : undefined;
  const names = own ?? CATALOG[code].names;
  const allowed = names.map((_, i) => i).filter((i) => own || !isForeign(p) || !(DOMESTIC_ONLY[code] ?? []).includes(i));
  const i = allowed[Math.floor(hashUnit(`nick|${p.id}|${code}`) * allowed.length)] ?? 0;
  return own ? { i, foreign: true } : { i };
}

export const NICKNAME_MAX = 12;
/** First-team days a namesake needs in the season for the fans to tell him apart (1.9.5). */
export const NAMESAKE_DAYS = 100;
/** A fastball this fast (km/h, his top), thrown on a first team that season. */
const HEATER = 158;
/** 1.9.9: a pitcher this slow at his top (km/h) who wins anyway: 너구리. */
const CRAFTY = 138;

const clubShort = (s: Pick<LeagueState, 'teams'>, team: TeamId | undefined) => s.teams.find((t) => t.id === team)?.short ?? '';
/** 1.9.9: the landmark of the club's home city as of the nickname's year (무등산 for 광주: 「무등산 폭격기」). */
const placeOf = (s: Pick<LeagueState, 'teams'>, team: TeamId | undefined, year: number) => {
  const t = s.teams.find((x) => x.id === team);
  return t ? landmarkOf(clubIn(t.id, year)?.city ?? t.region) : '';
};

/** What the fans call him (the general manager's own nickname first), or null. */
/** The given name: the name without its surname (two letters for a name of four or more). */
export const givenName = (name: string) => (name.length >= 4 ? name.slice(2) : name.slice(1));

export function nicknameOf(s: Pick<LeagueState, 'teams'>, p: Pick<Player, 'nickname' | 'nicknameOwn' | 'name'>): string | null {
  if (p.nicknameOwn) return p.nicknameOwn;
  const n = p.nickname;
  if (!n) return null;
  const names = (n.foreign ? FOREIGN_NAMES[n.code as NickCode] : undefined) ?? CATALOG[n.code as NickCode]?.names;
  if (!names) return null;
  return names[n.i % names.length]!(clubShort(s, n.team), givenName(p.name), placeOf(s, n.team, n.year));
}

/** Why he has it ("홈런 1위 2회 이상"), or null for the general manager's own. */
export const nicknameWhy = (p: Pick<Player, 'nickname' | 'nicknameOwn'>): string | null => (!p.nicknameOwn && p.nickname ? (CATALOG[p.nickname.code as NickCode]?.why() ?? null) : null);

interface Counts {
  mvp: number;
  rookie: number;
  /** Golden gloves by the position label they were given at. */
  gg: Record<string, number>;
  titles: Record<string, number>;
  triple: boolean;
}

/** Each player's awards so far, from the seasons' award lists. */
function counts(s: LeagueState): Map<PlayerId, Counts> {
  const out = new Map<PlayerId, Counts>();
  const get = (id: PlayerId) => {
    let c = out.get(id);
    if (!c) out.set(id, (c = { mvp: 0, rookie: 0, gg: {}, titles: {}, triple: false }));
    return c;
  };
  const trios = [['avg', 'hr', 'rbi'], ['w', 'era', 'k']].map((t) => t.map(awardLabel));
  for (const h of s.history) {
    const a = h.awards;
    if (!a) continue;
    if (a.mvp) get(a.mvp).mvp++;
    if (a.rookie) get(a.rookie).rookie++;
    for (const g of a.goldenGloves) {
      const c = get(g.id);
      c.gg[g.pos] = (c.gg[g.pos] ?? 0) + 1;
    }
    const holder: Record<string, PlayerId> = {};
    for (const t of a.titles) {
      holder[t.label] = t.id;
      const c = get(t.id);
      c.titles[t.label] = (c.titles[t.label] ?? 0) + 1;
    }
    for (const trio of trios) {
      const id = holder[trio[0]!];
      if (id && trio.every((l) => holder[l] === id)) get(id).triple = true;
    }
  }
  return out;
}

/** 1.9.9: in the league without a club's pick (a tryout, a development signing): 연습생. */
const walkOn = (p: Player) => {
  const o = p.origin;
  return o.kind === 'draftClass' && !o.overallPick && !o.territorial && !o.preLeague && !o.kyopo;
};

/** 1.9.9: a first-team season of WAR 3 or more after an injury of over 180 days. */
function comeback(p: Player, rows: ReturnType<typeof first>): boolean {
  const hurt = (p.injuries ?? []).filter((x) => x.days > 180).map((x) => Number(x.date.slice(0, 4)));
  return !!hurt.length && rows.some((r) => r.war >= 3 && r.year > Math.min(...hurt));
}

const first = (p: Player) => p.career.filter((c) => !c.level && ((c.bat?.pa ?? 0) > 0 || (c.pit?.outs ?? 0) > 0));

/** The nicknames his record earns, best first. */
function earned(p: Player, c: Counts | undefined, year: number, games: number, kin: Partial<Record<'big' | 'small' | 'fake', boolean>> = {}): NickCode[] {
  const t = (code: string) => c?.titles[awardLabel(code)] ?? 0;
  const gg = (code: string) => c?.gg[awardLabel(code)] ?? 0;
  const rows = first(p);
  const here = rows.filter((r) => r.teamId === p.teamId);
  const now = rows.filter((r) => r.year === year);
  const sum = (f: (r: (typeof rows)[number]) => number, xs = rows) => xs.reduce((a, r) => a + f(r), 0);
  const war = sum((r) => r.war);
  const field = Object.entries(c?.gg ?? {}).reduce((a, [pos, n]) => a + (pos === awardLabel('ggPitcher') || pos === awardLabel('ggDh') ? 0 : n), 0);
  const pitcher = isPitcher(p);
  const best = pitcher ? repertoire(p)[0]?.type : undefined;
  const fb = pitcher ? fastballOf(p) : null;
  const nowWar = sum((r) => r.war, now);
  const nowOuts = sum((r) => r.pit?.outs ?? 0, now);
  const has: Record<NickCode, boolean> = {
    legend: war >= 60,
    mvp: (c?.mvp ?? 0) >= 2,
    triple: !!c?.triple,
    mvp1: (c?.mvp ?? 0) >= 1,
    hrKing: t('hr') >= 2,
    oneClub: !isForeign(p) && here.length >= 12 && here.length === rows.length,
    saveKing: t('sv') >= 2 || sum((r) => r.pit?.sv ?? 0) >= 200,
    hits2000: sum((r) => r.bat?.h ?? 0) >= 2000,
    hr300: sum((r) => r.bat?.hr ?? 0) >= 300,
    w150: sum((r) => r.pit?.w ?? 0) >= 150,
    hr: t('hr') >= 1,
    hr40: rows.some((r) => (r.bat?.hr ?? 0) >= 40),
    avg: t('avg') >= 1,
    rbi: t('rbi') >= 1,
    hits: t('h') >= 1,
    runs: t('r') >= 1,
    obp: t('obp') >= 1,
    slg: t('slg') >= 1,
    sb: t('sb') >= 1,
    k: t('k') >= 1,
    k200: rows.some((r) => (r.pit?.k ?? 0) >= 200),
    ace: t('w') + t('era') >= 1,
    w20: rows.some((r) => (r.pit?.w ?? 0) >= 20),
    pct: t('pct') >= 1,
    save: t('sv') >= 1,
    catcher: gg('ggC') >= 2,
    shortstop: gg('ggSs') >= 2,
    outfield: gg('ggOf') >= 3,
    glove: field >= 3,
    dh: gg('ggDh') >= 2,
    heater: pitcher && (topVelocity(p) ?? 0) >= HEATER && now.length > 0,
    control: rows.some((r) => !!r.pit && r.pit.outs >= 450 && (r.pit.bb * 27) / r.pit.outs < 1.5),
    ironGames: games > 0 && now.some((r) => (r.bat?.g ?? 0) >= games),
    iron: ageIn(p, year) >= 40 && now.length > 0,
    hold: t('hld') >= 1,
    foreign: isForeign(p) && here.length >= 4 && sum((r) => r.war, here) >= 10,
    knuckle: best === 'KN',
    oldPitch: best === 'SCR' || best === 'PLM' || best === 'SH',
    sinker: fb === '2SFB' && nowWar >= 3 && nowOuts >= 300,
    cutter: fb === 'CUT' && nowWar >= 3 && nowOuts >= 150,
    walkOn: walkOn(p) && (war >= 30 || (c?.mvp ?? 0) >= 1),
    bomber: pitcher && t('k') >= 2 && t('era') >= 1,
    workhorse: rows.some((r) => (r.pit?.outs ?? 0) >= 750 || (r.pit?.cg ?? 0) >= 20),
    phoenix: comeback(p, rows),
    evergreen: rows.length >= 18 && now.length > 0,
    crafty: pitcher && (topVelocity(p) ?? 0) > 0 && topVelocity(p)! <= CRAFTY && (t('era') >= 1 || rows.some((r) => (r.pit?.w ?? 0) >= 15)),
    pitchMix: pitcher && repertoire(p).length >= 6 && nowWar >= 3 && nowOuts >= 300,
    submarine: pitcher && (armAngle(p) ?? 90) < SLOT_UNDER && nowWar >= 2,
    perfect: !!p.feats?.some((f) => f.kind === 'perfect'),
    noHitter: !!p.feats?.some((f) => f.kind === 'noHitter'),
    cycle: !!p.feats?.some((f) => f.kind === 'cycle'),
    hrStreak: !!p.feats?.some((f) => f.kind === 'hrStreak' && (f.n ?? 0) >= 3),
    immaculate: !!p.feats?.some((f) => f.kind === 'immaculate'),
    fake: !!kin.fake,
    big: !!kin.big,
    small: !!kin.small,
    rookie: (c?.rookie ?? 0) >= 1,
  };
  return ORDER.filter((x) => has[x]).sort((a, b) => CATALOG[b].tier - CATALOG[a].tier || ORDER.indexOf(a) - ORDER.indexOf(b));
}

/** The winter after `year`'s awards: players in the league who earned a (bigger) nickname get it. Idempotent; our
    players' new ones make the news. */
export function nicknameWinter(s: LeagueState, year: number, news = true) {
  const all = counts(s);
  // Every game of the season: the most a club played.
  const table = s.history.find((h) => h.year === year)?.table ?? [];
  const games = Math.max(0, ...table.map((r) => r.w + r.l + r.t));
  // 1.9.5: namesakes among the league's domestic players, and the names of the hall of fame. Fans tell apart the ones
  // they see: players who spent most of the season on a first team (NAMESAKE_DAYS registered days).
  const active = Object.values(s.players).filter((p) => p.status === 'active' && p.teamId);
  const seen = (p: Player) => p.career.some((r) => r.year === year && !r.level && r.days >= NAMESAKE_DAYS);
  const byName = new Map<string, Player[]>();
  for (const p of active) if (!isForeign(p) && seen(p)) byName.set(p.name, [...(byName.get(p.name) ?? []), p]);
  const kin = new Map<PlayerId, Partial<Record<'big' | 'small' | 'fake', boolean>>>();
  for (const same of byName.values()) {
    if (same.length < 2) continue;
    const old = [...same].sort((a, b) => a.birthday.localeCompare(b.birthday) || a.id.localeCompare(b.id));
    kin.set(old[0]!.id, { big: true });
    kin.set(old.at(-1)!.id, { small: true });
  }
  const hall = new Map((s.hallOfFame ?? []).map((h) => [h.name, h.id]));
  for (const p of active) if (!isForeign(p) && seen(p) && hall.has(p.name) && hall.get(p.name) !== p.id) kin.set(p.id, { ...kin.get(p.id), fake: true });
  // 2.0.22: a foreign player given a home-grown player's name before (「토종 에이스」) keeps the title under another.
  for (const p of active) {
    const n = p.nickname;
    if (!n || !isForeign(p) || n.foreign || !CATALOG[n.code as NickCode]) continue;
    const code = n.code as NickCode;
    if ((DOMESTIC_ONLY[code] ?? []).includes(n.i % CATALOG[code].names.length)) p.nickname = { ...n, ...pick(p, code) };
  }
  for (const p of active) {
    const best = earned(p, all.get(p.id), year, games, kin.get(p.id))[0];
    if (!best || (p.nickname && (CATALOG[p.nickname.code as NickCode]?.tier ?? 0) >= CATALOG[best].tier)) continue;
    p.nickname = { code: best, ...pick(p, best), year, team: p.teamId ?? undefined };
    const u = s.user;
    if (!news || !u || p.teamId !== u.teamId || p.nicknameOwn) continue;
    const nick = nicknameOf(s, p)!;
    addNews(s, {
      id: `nick-${year}-${p.id}`,
      date: `${year}-11-02`,
      kind: 'milestone',
      title: __i18n_k("league.nicknames.text.2b9f9d66", { name: p.name, nick }),
      body: __i18n_k("league.nicknames.text.abba8145", { club: clubShort(s, p.teamId), name: p.name, nick, why: CATALOG[best].why() }),
      quotes: [],
      facts: { nickname: nick },
      players: [p.id],
      mine: true,
    });
  }
}

/** Why `text` cannot be our player's nickname, or null (an empty text clears his own). */
export function checkNickname(s: LeagueState, id: PlayerId, text: string): string | null {
  const p = s.players[id];
  if (!p || !s.user || p.teamId !== s.user.teamId) return __i18n_k("league.nicknames.text.3d832159");
  if ([...text.trim()].length > NICKNAME_MAX) return __i18n_k("league.nicknames.text.327ea555", { n: NICKNAME_MAX });
  return null;
}

/** The general manager names one of our players (an empty text gives the fans' nickname back). */
export function setNickname(s: LeagueState, id: PlayerId, text: string) {
  if (checkNickname(s, id, text)) return;
  const p = s.players[id]!;
  const t = text.trim();
  if (t) p.nicknameOwn = t;
  else delete p.nicknameOwn;
}
