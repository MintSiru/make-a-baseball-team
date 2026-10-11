import { k as __i18n_k } from '../i18n/index';
/* Tutorial mode (V0.7.5): the "start in the futures league" game, with a guide from the founding
   (July 2026) through the futures year (2027) to the first-team debut. Each lesson shows once, when its
   moment comes (a decision, the season's stage, a screen opened for the first time); the player reads
   it and moves on, or turns the guide off. Progress is saved with the club. */
import { shiftYears } from '../league/era';
import { regularOver } from '../league/actions';
import type { Decision, LeagueState } from '../league/state';

export interface Lesson {
  id: string;
  title: string;
  body: string[];
}

interface Ctx {
  /** The screen (tab) open now. */
  tab: string;
  /** Which part of "우리 구단" is open (V0.16), when that tab is. */
  view?: string;
}

type Rule = Omit<Lesson, 'body'> & { when: (s: LeagueState, ctx: Ctx) => boolean; body: string[] | ((s: LeagueState) => string[]) };
/** 1.5.0: the guide is a choice of its own, so a club going straight to the first team can have it too — without the
    futures-year lessons. */
const futuresYear = (s: LeagueState) => s.user!.settings.promotion !== 'immediate';

/** One short tip for each decision, the first time it comes up. */
const DECISION_TIPS: Partial<Record<Decision['kind'], { title: string; body: string[] }>> = {
  tryout: {
    title: __i18n_k("ui.tutorial.tryout.title.432ea5f0"),
    body: [
      __i18n_k("ui.tutorial.tryout.body.3812d370"),
      __i18n_k("ui.tutorial.tryout.body.f910127c"),
    ],
  },
  draftPick: {
    title: __i18n_k("ui.tutorial.draftPick.title.7bd24a81"),
    body: [
      __i18n_k("ui.tutorial.draftPick.body.620316eb"),
      __i18n_k("ui.tutorial.draftPick.body.9136feb6"),
    ],
  },
  rookieBonus: {
    title: __i18n_k("ui.tutorial.rookieBonus.title.cb4f65a6"),
    body: [
      __i18n_k("ui.tutorial.rookieBonus.body.aff8b2fd"),
      __i18n_k("ui.tutorial.rookieBonus.body.40167b04"),
    ],
  },
  development: {
    title: __i18n_k("ui.tutorial.development.title.e8d66117"),
    body: [__i18n_k("ui.tutorial.development.body.78914642")],
  },
  released: {
    title: __i18n_k("ui.tutorial.released.title.9eb3f222"),
    body: [__i18n_k("ui.tutorial.released.body.fb3eb2eb")],
  },
  camp: {
    title: __i18n_k("ui.tutorial.camp.title.cdea7675"),
    body: [__i18n_k("ui.tutorial.camp.body.9e820c16")],
  },
  staff: {
    title: __i18n_k("ui.tutorial.staff.title.b72feac0"),
    body: [__i18n_k("ui.tutorial.staff.body.8c297a4d")],
  },
  retire: {
    title: __i18n_k("ui.tutorial.retire.title.14c6bfe6"),
    body: [__i18n_k("ui.tutorial.retire.body.baeaf8d9")],
  },
  military: {
    title: __i18n_k("ui.tutorial.military.title.82af035c"),
    body: [
      __i18n_k("ui.tutorial.military.body.f572adb2"),
      __i18n_k("ui.tutorial.military.body.405952bc"),
    ],
  },
  faRound: {
    title: __i18n_k("ui.tutorial.faRound.title.eefed8f1"),
    body: [
      __i18n_k("ui.tutorial.faRound.body.65ceb0c7"),
      __i18n_k("ui.tutorial.faRound.body.70402b88"),
      __i18n_k("ui.tutorial.faRound.body.c1c2249b"),
      __i18n_k("ui.tutorial.faRound.body.1e6a0ab5"),
      __i18n_k("ui.tutorial.faRound.body.ff8c807f"),
    ],
  },
  faOptions: {
    title: __i18n_k("ui.tutorial.faOptions.title.1eacf031"),
    body: [__i18n_k("ui.tutorial.faOptions.body.2eb94f16")],
  },
  salaries: {
    title: __i18n_k("ui.tutorial.salaries.title.d8bea6b5"),
    body: [__i18n_k("ui.tutorial.salaries.body.26237420")],
  },
  specialDraft: {
    title: __i18n_k("ui.tutorial.specialDraft.title.c6ab1579"),
    body: [__i18n_k("ui.tutorial.specialDraft.body.e4ea5b9f")],
  },
  foreign: {
    title: __i18n_k("ui.tutorial.foreign.title.7f403bab"),
    body: [
      __i18n_k("ui.tutorial.foreign.body.4c6cf336"),
      __i18n_k("ui.tutorial.foreign.body.8870e439"),
    ],
  },
  foreignRenew: {
    title: __i18n_k("ui.tutorial.foreignRenew.title.4cc49db3"),
    body: [__i18n_k("ui.tutorial.foreignRenew.body.3d1cbb71")],
  },
  roster: {
    title: __i18n_k("ui.tutorial.roster.title.ea826f46"),
    body: [__i18n_k("ui.tutorial.roster.body.2e3a17ff")],
  },
  sponsor: { title: __i18n_k("ui.tutorial.sponsor.title.2d7807db"), body: [__i18n_k("ui.tutorial.sponsor.body.b04fc5d2")] },
  secondProtect: { title: __i18n_k("ui.tutorial.secondProtect.title.45c66ae7"), body: [__i18n_k("ui.tutorial.secondProtect.body.fc3a194a")] },
  secondPick: { title: __i18n_k("ui.tutorial.secondPick.title.7021a262"), body: [__i18n_k("ui.tutorial.secondPick.body.d7f009e3")] },
  posting: { title: __i18n_k("ui.tutorial.posting.title.6734925e"), body: [__i18n_k("ui.tutorial.posting.body.ab273c92")] },
  // V0.15: the decisions that come after the first-team debut (or rarely) get a tip too; every decision screen
  // also shows its tip folded away ("이 결정은?"), tutorial or not.
  faProtect: {
    title: __i18n_k("ui.tutorial.faProtect.title.b7ecac89"),
    body: [
      __i18n_k("ui.tutorial.faProtect.body.0ef88154"),
      __i18n_k("ui.tutorial.faProtect.body.86384fe9"),
    ],
  },
  faCompensation: {
    title: __i18n_k("ui.tutorial.faCompensation.title.f7acf235"),
    body: [
      __i18n_k("ui.tutorial.faCompensation.body.85860482"),
      __i18n_k("ui.tutorial.faCompensation.body.d70c57f6"),
    ],
  },
  returnee: {
    title: __i18n_k("ui.tutorial.returnee.title.05ae3968"),
    body: [__i18n_k("ui.tutorial.returnee.body.0463be38")],
  },
  rival: {
    title: __i18n_k("ui.tutorial.rival.title.6273d853"),
    body: [__i18n_k("ui.tutorial.rival.body.8377dc4c"), __i18n_k("ui.tutorial.rival.body.29781c9e")],
  },
  rivalProtect: {
    title: __i18n_k("ui.tutorial.rivalProtect.title.cc6bbfa7"),
    body: [__i18n_k("ui.tutorial.rivalProtect.body.bb130ce6")],
  },
  national: {
    title: __i18n_k("ui.tutorial.national.title.e3a9398c"),
    body: [
      __i18n_k("ui.tutorial.national.body.3a5d376e"),
      __i18n_k("ui.tutorial.national.body.61dc19e6"),
    ],
  },
  scandal: {
    title: __i18n_k("ui.tutorial.scandal.title.1b55d86b"),
    body: [
      __i18n_k("ui.tutorial.scandal.body.03cf62d4"),
      __i18n_k("ui.tutorial.scandal.body.e38a2045"),
    ],
  },
  dispute: {
    title: __i18n_k("ui.tutorial.dispute.title.8cc0c1f5"),
    body: [__i18n_k("ui.tutorial.dispute.body.1fe88b4c")],
  },
  meddle: {
    title: __i18n_k("ui.tutorial.meddle.title.8a1f72de"),
    body: [
      __i18n_k("ui.tutorial.meddle.body.ae6a2c06"),
      __i18n_k("ui.tutorial.meddle.body.7b610b7e"),
    ],
  },
  fantasyPick: {
    title: __i18n_k("ui.tutorial.fantasyPick.title.bc92c419"),
    body: [
      __i18n_k("ui.tutorial.fantasyPick.body.5f3b8000"),
      __i18n_k("ui.tutorial.fantasyPick.body.9c4a09d8"),
    ],
  },
};

/** The short explanation of a decision (V0.15): the tutorial's tip, also folded into every decision screen. */
export const decisionTip = (kind: Decision['kind']) => {
  const t = DECISION_TIPS[kind];
  return t ? { title: t.title, body: t.body.map(shiftYears) } : null;
};

/** Every decision's tip, for the help page. */
export const decisionTips = () => Object.entries(DECISION_TIPS) as [Decision['kind'], { title: string; body: string[] }][];

const inTutorial = (s: LeagueState) => {
  const u = s.user;
  return !!u?.settings.tutorial && !u.tutorialOff;
};

const RULES: Rule[] = [
  {
    id: 'welcome',
    when: (s) => s.pending?.kind === 'tryout',
    title: __i18n_k("ui.tutorial.rULES.title.32e987fc"),
    body: (s) =>
      futuresYear(s)
        ? [
            __i18n_k("ui.tutorial.rULES.body.817b1b71"),
            __i18n_k("ui.tutorial.rULES.body.a35ff0a0"),
            __i18n_k("ui.tutorial.rULES.body.86f965b1"),
          ]
        : [
            __i18n_k("ui.tutorial.rULES.body.37eaf11d"),
            __i18n_k("ui.tutorial.rULES.body.093a906e"),
            __i18n_k("ui.tutorial.rULES.body.1b285217"),
          ],
  },
  {
    id: 'decisions',
    when: (s) => !!s.pending,
    title: __i18n_k("ui.tutorial.rULES.title.2d179fd7"),
    body: [
      __i18n_k("ui.tutorial.rULES.body.7a282ed6"),
      __i18n_k("ui.tutorial.rULES.body.e9e72cc2"),
      __i18n_k("ui.tutorial.rULES.body.2378ed1d"),
    ],
  },
  {
    id: 'grades',
    when: (s) => !!s.pending,
    title: __i18n_k("ui.tutorial.rULES.title.5c01066c"),
    body: [
      __i18n_k("ui.tutorial.rULES.body.411ab544"),
      __i18n_k("ui.tutorial.rULES.body.19fbd641"),
    ],
  },
  {
    id: 'winter',
    when: (s) => !!s.pending && s.phase === 'offseason',
    title: __i18n_k("ui.tutorial.rULES.title.1d568cfb"),
    body: [
      __i18n_k("ui.tutorial.rULES.body.a6fd79dd"),
      __i18n_k("ui.tutorial.rULES.body.3980fe5e"),
      __i18n_k("ui.tutorial.rULES.body.c591b45d"),
    ],
  },
  {
    id: 'lastWinter',
    when: (s) => !!s.pending && s.offseason?.year === s.user!.firstTeamYear - 1,
    title: __i18n_k("ui.tutorial.rULES.title.507003ed"),
    body: [
      __i18n_k("ui.tutorial.rULES.body.b2d4e9e6"),
      __i18n_k("ui.tutorial.rULES.body.b30ec6b2"),
    ],
  },
  ...(Object.entries(DECISION_TIPS) as [Decision['kind'], { title: string; body: string[] }][]).map(([kind, tip]) => ({
    id: `decision-${kind}`,
    when: (s: LeagueState) => s.pending?.kind === kind,
    ...tip,
  })),
  {
    id: 'foundingSeason',
    when: (s) => !s.pending && s.phase === 'regular' && s.year < s.user!.firstTeamYear - (futuresYear(s) ? 1 : 0) && !regularOver(s),
    title: __i18n_k("ui.tutorial.rULES.title.62cd7780"),
    body: [
      __i18n_k("ui.tutorial.rULES.body.05b1ef2d"),
      __i18n_k("ui.tutorial.rULES.body.ff8c23b6"),
      __i18n_k("ui.tutorial.rULES.body.f6d652f4"),
    ],
  },
  {
    id: 'seasonEnd',
    when: (s) => !s.pending && ((s.phase === 'regular' && regularOver(s)) || s.phase === 'postseason'),
    title: __i18n_k("ui.tutorial.rULES.title.3561ad54"),
    body: [
      __i18n_k("ui.tutorial.rULES.body.64b64455"),
      __i18n_k("ui.tutorial.rULES.body.39773700"),
    ],
  },
  {
    id: 'futures',
    when: (s) => futuresYear(s) && !s.pending && s.phase === 'regular' && s.year === s.user!.firstTeamYear - 1,
    title: __i18n_k("ui.tutorial.rULES.title.770dc838"),
    body: [
      __i18n_k("ui.tutorial.rULES.body.4298c442"),
      __i18n_k("ui.tutorial.rULES.body.6c438e3b"),
      __i18n_k("ui.tutorial.rULES.body.91fefcd5"),
    ],
  },
  {
    id: 'futuresMid',
    when: (s) => futuresYear(s) && !s.pending && s.phase === 'regular' && s.year === s.user!.firstTeamYear - 1 && (s.schedule[s.next]?.date ?? '9999') >= `${s.year}-06-01`,
    title: __i18n_k("ui.tutorial.rULES.title.ea80a500"),
    body: [
      __i18n_k("ui.tutorial.rULES.body.d47243dc"),
      __i18n_k("ui.tutorial.rULES.body.67a92d65"),
      __i18n_k("ui.tutorial.rULES.body.04ff269b"),
    ],
  },
  {
    id: 'tab-club',
    when: (_s, c) => c.tab === 'club',
    title: __i18n_k("ui.tutorial.rULES.title.8cc09c32"),
    body: [
      __i18n_k("ui.tutorial.rULES.body.22540441"),
      __i18n_k("ui.tutorial.rULES.body.16a15ffc"),
    ],
  },
  {
    id: 'tab-market',
    when: (_s, c) => c.tab === 'market',
    title: __i18n_k("ui.tutorial.rULES.title.e11828a8"),
    body: [
      __i18n_k("ui.tutorial.rULES.body.b2daa3dd"),
      __i18n_k("ui.tutorial.rULES.body.a36d7871"),
    ],
  },
  {
    id: 'club-squad',
    when: (_s, c) => c.tab === 'club' && c.view === 'squad',
    title: __i18n_k("ui.tutorial.rULES.title.5b9daec2"),
    body: [
      __i18n_k("ui.tutorial.rULES.body.606c4551"),
      __i18n_k("ui.tutorial.rULES.body.343041b0"),
    ],
  },
  {
    id: 'club-lineup',
    when: (_s, c) => c.tab === 'club' && c.view === 'lineup',
    title: __i18n_k("ui.tutorial.rULES.title.4c31ef82"),
    body: [
      __i18n_k("ui.tutorial.rULES.body.efb78ac4"),
      __i18n_k("ui.tutorial.rULES.body.b006f096"),
    ],
  },
  {
    id: 'club-training',
    when: (_s, c) => c.tab === 'club' && c.view === 'training',
    title: __i18n_k("ui.tutorial.rULES.title.b4927759"),
    body: [
      __i18n_k("ui.tutorial.rULES.body.b5ea13c8"),
      __i18n_k("ui.tutorial.rULES.body.10bd5acb"),
    ],
  },
  {
    id: 'club-office',
    when: (_s, c) => c.tab === 'club' && c.view === 'office',
    title: __i18n_k("ui.tutorial.rULES.title.6bc69497"),
    body: [
      __i18n_k("ui.tutorial.rULES.body.f1eec6ea"),
      __i18n_k("ui.tutorial.rULES.body.8da0e2d1"),
      __i18n_k("ui.tutorial.rULES.body.3876829b"),
    ],
  },
  {
    id: 'tab-settings',
    when: (_s, c) => c.tab === 'settings',
    title: __i18n_k("ui.tutorial.rULES.title.c14a567e"),
    body: [
      __i18n_k("ui.tutorial.rULES.body.60b38b94"),
      __i18n_k("ui.tutorial.rULES.body.ab168865"),
    ],
  },
  {
    id: 'tab-help',
    when: (_s, c) => c.tab === 'help',
    title: __i18n_k("ui.tutorial.rULES.title.e2654ac5"),
    body: [__i18n_k("ui.tutorial.rULES.body.8b8abdc0")],
  },
  {
    id: 'tab-draft',
    when: (_s, c) => c.tab === 'draft',
    title: __i18n_k("ui.tutorial.rULES.title.0db7daf2"),
    body: [__i18n_k("ui.tutorial.rULES.body.1a48958f")],
  },
  {
    id: 'graduate',
    when: (s) => !s.pending && s.phase === 'regular' && s.year >= s.user!.firstTeamYear,
    title: __i18n_k("ui.tutorial.rULES.title.f9f46028"),
    body: [
      __i18n_k("ui.tutorial.rULES.body.cfca7d2c"),
      __i18n_k("ui.tutorial.rULES.body.5f806a2b"),
    ],
  },
];

/** The lesson to show now, if any: the first unread one whose moment has come. */
export function nextLesson(s: LeagueState, ctx: Ctx): (Lesson & { index: number }) | null {
  if (!inTutorial(s)) return null;
  const seen = s.user!.tutorialSeen ?? [];
  if (seen.includes('graduate')) return null;
  const rule = RULES.find((r) => !seen.includes(r.id) && r.when(s, ctx));
  // 1.6.0: written for 2026; a game started earlier reads its own years.
  return rule ? { id: rule.id, title: shiftYears(rule.title), body: (typeof rule.body === 'function' ? rule.body(s) : rule.body).map(shiftYears), index: seen.length + 1 } : null;
}

/** Whether the guide can be turned back on: tutorial mode, turned off, and the first-team debut still ahead. */
export const tutorialPaused = (s: LeagueState) => {
  const u = s.user;
  return !!u?.settings.tutorial && !!u.tutorialOff && !(u.tutorialSeen ?? []).includes('graduate') && s.year <= u.firstTeamYear;
};
