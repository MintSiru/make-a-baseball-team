import { k as __i18n_k } from '../i18n/index';
/* Scenarios (1.6.0, the scenario mode the roadmap kept a hook for since V0.3): a founding with some conditions fixed,
   a goal and a deadline. The goal is judged each winter after the owner's verdict; once it is won or lost the game
   says so and goes on as a free game. Some scenarios change the money and the owner:

   1. 서울의 왕 — a fourth Seoul club against LG, 두산 and 키움: a better first-team record than all three by 2035.
   2. 재기 — a faded general manager and 한빛그룹's third-generation heir: lavish money, no patience (goals higher,
      trust lost half again as fast, firing from the second first-team season) and orders in the season; a Korean
      Series title within five first-team seasons.
   3. 섬그늘에 야구하러 가면 — 울릉군's citizen club: a tiny island market, a 3,000-seat ground, hard difficulty and
      the sack possible; still in the job after the 2035 season.
   4. 돌격대의 귀환 — 쌍방울 레이더스 back in 전주: three Korean Series titles by 2035.
   5. 판타지 드래프트 — every player in the league let go in the winter of 2027 and drafted again with that year's
      class (fantasy.ts); the three seasons after are scored.
   6. 백 투 더 패스트 — the same free founding ten years earlier, in 2016 (era.ts).
   7. 살려야 한다 — a runaway AI runs the club for its first five years (rogue.ts); then three seasons to win it all.
   8. 불경기 — our money cut by a recession the other clubs somehow escape; a title within five first-team seasons.
   9. 불인기 종목 — the country falls for another sport: every club's crowds and our support shrink; the same goal.
   10. 강철야구 — a TV show's club in 목동, its first squad retired players and players nobody drafted; the same goal.

   The clubs, the cities beyond the real candidates and the stories are game fiction. */
import { rng } from '../draftroom';
import type { TeamId } from '../model/types';
import { addAlert } from './alerts';
import { milestone } from './milestones';
import { addNews } from './news';
import { makeStaff, staffOf } from './staff';
import { standings } from './standings';
import { firstTeamIds, orgIds, orgPlayers, type Decision, type ExpansionSettings, type LeagueState } from './state';
import { FANS, PARENT } from './tuning';

const FANS_MIN = FANS.priceMin;

export type ScenarioId = 'seoul' | 'comeback' | 'ulleung' | 'raiders' | 'fantasy' | 'past' | 'rescue' | 'recession' | 'unpopular' | 'steel';

export interface ScenarioState {
  status: 'active' | 'won' | 'lost';
  /** The winter it was decided, and what was said. */
  decided?: number;
  text?: string;
  /** 판타지 드래프트: points so far, by season. */
  points?: Record<number, number>;
  /** 재기: the owner's orders this season (one of each kind a season) and the star order being watched. */
  orders?: string[];
  star?: { since: string; ids: string[]; grant: number };
  /** 살려야 한다: the winter the general manager took over, and what the AI left behind. */
  takeover?: number;
  damage?: string[];
}

export interface ScenarioDef {
  id: ScenarioId;
  title: string;
  /** One line for the list. */
  tagline: string;
  story: string[];
  goal: string;
  /** Felt difficulty, 1–5. */
  stars: number;
  /** Settings the scenario sets, and the ones the player cannot change. */
  fixed: Partial<ExpansionSettings>;
  locked: (keyof ExpansionSettings)[];
  /** Founding money and the payroll budget (× the usual), and the owner's yearly support. */
  money?: { fund?: number; payroll?: number; support?: number };
  /** 재기: the owner's temper. */
  owner?: { startTrust: number; trustLoss: number; fireFrom: number; rankGoal: (seasonsIn: number) => number };
  /** 백 투 더 패스트: years before the usual 2026 start. */
  era?: number;
  /** A Korean Series title within this many first-team seasons (from the debut, or from the takeover). */
  titleWithin?: number;
  /** 불인기 종목: every club's crowds × this. */
  crowd?: number;
  /** No goal: a free game under the scenario's conditions. */
  free?: boolean;
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: 'seoul',
    title: __i18n_k("league.scenarios.sCENARIOS.title.b367c13b"),
    tagline: __i18n_k("league.scenarios.sCENARIOS.tagline.e82ead88"),
    story: [
      __i18n_k("league.scenarios.sCENARIOS.story.5cc62a42"),
      __i18n_k("league.scenarios.sCENARIOS.story.341dad37"),
    ],
    goal: __i18n_k("league.scenarios.sCENARIOS.goal.af5b6fb5"),
    stars: 3,
    fixed: { cityId: 'seoul', stadium: 'existing' },
    locked: ['cityId'],
  },
  {
    id: 'comeback',
    title: __i18n_k("league.scenarios.sCENARIOS.title.e25dc523"),
    tagline: __i18n_k("league.scenarios.sCENARIOS.tagline.d0de9671"),
    story: [
      __i18n_k("league.scenarios.sCENARIOS.story.fffccb74"),
      __i18n_k("league.scenarios.sCENARIOS.story.bf9c2b30"),
    ],
    goal: __i18n_k("league.scenarios.sCENARIOS.goal.e1c9c59b"),
    titleWithin: 5,
    stars: 3,
    fixed: { parentType: 'conglomerate', parentName: __i18n_k("league.scenarios.fixed.parentName.3497e002"), firing: true },
    locked: ['parentType', 'parentName', 'firing'],
    money: { fund: 1.4, payroll: 1.45, support: 1.5 },
    owner: { startTrust: 50, trustLoss: 1.5, fireFrom: 1, rankGoal: (n) => (n === 0 ? 6 : n === 1 ? 4 : 3) },
  },
  {
    id: 'ulleung',
    title: __i18n_k("league.scenarios.sCENARIOS.title.2aca598f"),
    tagline: __i18n_k("league.scenarios.sCENARIOS.tagline.1f81f174"),
    story: [
      __i18n_k("league.scenarios.sCENARIOS.story.80779924"),
      __i18n_k("league.scenarios.sCENARIOS.story.510962fe"),
    ],
    goal: __i18n_k("league.scenarios.sCENARIOS.goal.00c0669f"),
    stars: 5,
    fixed: { cityId: 'ulleung', parentType: 'citizen', difficulty: 'hard', firing: true, stadium: 'existing' },
    locked: ['cityId', 'parentType', 'difficulty', 'firing'],
    money: { fund: 0.9, payroll: 0.9, support: 0.9 },
  },
  {
    id: 'raiders',
    title: __i18n_k("league.scenarios.sCENARIOS.title.6948fbf5"),
    tagline: __i18n_k("league.scenarios.sCENARIOS.tagline.aa705eaa"),
    story: [
      __i18n_k("league.scenarios.sCENARIOS.story.8a4f5ac6"),
      __i18n_k("league.scenarios.sCENARIOS.story.f0cb2b7b"),
    ],
    goal: __i18n_k("league.scenarios.sCENARIOS.goal.d2d65080"),
    stars: 4,
    fixed: { cityId: 'jeonju', parentType: 'midsize', name: __i18n_k("league.scenarios.fixed.name.27066a3c"), short: __i18n_k("league.scenarios.fixed.short.fcc26bb5"), parentName: __i18n_k("league.scenarios.fixed.parentName.fcc26bb5") },
    locked: ['cityId', 'parentType', 'name', 'short'],
  },
  {
    id: 'fantasy',
    title: __i18n_k("league.scenarios.sCENARIOS.title.bc92c419"),
    tagline: __i18n_k("league.scenarios.sCENARIOS.tagline.e701d340"),
    story: [
      __i18n_k("league.scenarios.sCENARIOS.story.48b50c6a"),
      __i18n_k("league.scenarios.sCENARIOS.story.f20a9448"),
    ],
    goal: __i18n_k("league.scenarios.sCENARIOS.goal.e3d53c11"),
    stars: 2,
    fixed: { promotion: 'afterFutures' },
    locked: ['promotion'],
  },
  {
    id: 'past',
    title: __i18n_k("league.scenarios.sCENARIOS.title.3c3d1fab"),
    tagline: __i18n_k("league.scenarios.sCENARIOS.tagline.b0ffb3c9"),
    story: [
      __i18n_k("league.scenarios.sCENARIOS.story.4bbac36f"),
      __i18n_k("league.scenarios.sCENARIOS.story.fe67476c"),
    ],
    goal: __i18n_k("league.scenarios.sCENARIOS.goal.c0426705"),
    stars: 2,
    fixed: {},
    locked: [],
    era: -10,
    free: true,
  },
  {
    id: 'rescue',
    title: __i18n_k("league.scenarios.sCENARIOS.title.e41c04c3"),
    tagline: __i18n_k("league.scenarios.sCENARIOS.tagline.501bbe87"),
    story: [
      __i18n_k("league.scenarios.sCENARIOS.story.34a6e3b2"),
      __i18n_k("league.scenarios.sCENARIOS.story.812fc6f3"),
    ],
    goal: __i18n_k("league.scenarios.sCENARIOS.goal.deaea7c9"),
    stars: 5,
    fixed: { promotion: 'immediate', tutorial: false, autoPrep: false, firing: false },
    locked: ['promotion', 'tutorial', 'autoPrep'],
    titleWithin: 3,
  },
  {
    id: 'recession',
    title: __i18n_k("league.scenarios.sCENARIOS.title.326da8e9"),
    tagline: __i18n_k("league.scenarios.sCENARIOS.tagline.e75e7917"),
    story: [
      __i18n_k("league.scenarios.sCENARIOS.story.186801d1"),
      __i18n_k("league.scenarios.sCENARIOS.story.a75e867f"),
    ],
    goal: __i18n_k("league.scenarios.sCENARIOS.goal.e1c9c59b"),
    stars: 4,
    fixed: {},
    locked: [],
    money: { fund: 0.7, payroll: 0.75, support: 0.75 },
    titleWithin: 5,
  },
  {
    id: 'unpopular',
    title: __i18n_k("league.scenarios.sCENARIOS.title.76386a0a"),
    tagline: __i18n_k("league.scenarios.sCENARIOS.tagline.4edf9990"),
    story: [
      __i18n_k("league.scenarios.sCENARIOS.story.03d3acfd"),
      __i18n_k("league.scenarios.sCENARIOS.story.18f35727"),
    ],
    goal: __i18n_k("league.scenarios.sCENARIOS.goal.e1c9c59b"),
    stars: 4,
    fixed: {},
    locked: [],
    money: { support: 0.85 },
    crowd: 0.72,
    titleWithin: 5,
  },
  {
    id: 'steel',
    title: __i18n_k("league.scenarios.sCENARIOS.title.840e03f2"),
    tagline: __i18n_k("league.scenarios.sCENARIOS.tagline.782c74be"),
    story: [
      __i18n_k("league.scenarios.sCENARIOS.story.a0690b45"),
      __i18n_k("league.scenarios.sCENARIOS.story.c27a09fe"),
    ],
    goal: __i18n_k("league.scenarios.sCENARIOS.goal.e1c9c59b"),
    stars: 4,
    fixed: { cityId: 'seoul', parentType: 'midsize', name: __i18n_k("league.scenarios.fixed.name.bc4b5e9e"), short: __i18n_k("league.scenarios.fixed.short.5d91e5f8"), parentName: __i18n_k("league.scenarios.fixed.parentName.000339fa"), stadium: 'existing' },
    locked: ['cityId', 'parentType', 'name', 'short'],
    titleWithin: 5,
  },
];

export const scenarioDef = (id: string | null | undefined) => SCENARIOS.find((x) => x.id === id) ?? null;
export const scenarioOf = (s: LeagueState) => scenarioDef(s.user?.settings.scenario);
/** The owner's yearly support against the usual. */
export const supportFactor = (settings: ExpansionSettings) => scenarioDef(settings.scenario)?.money?.support ?? 1;

/** The fantasy draft's year and the seasons it scores. */
export const FANTASY = {
  year: 2027,
  seasons: [2028, 2029, 2030],
  rankPoints: 10,
  post: { wildcard: 5, semipo: 10, po: 15, runnerUp: 25, champion: 40 },
  /** The class on the board: as many as this many rounds of a rookie draft. */
  classRounds: 11,
  /** A club picks as if its pay could reach the salary cap × this (the cap counts the top 40; the rest earn little). */
  capShare: 1.1,
};
const SEOUL_RIVALS: TeamId[] = ['lg', 'doosan', 'kiwoom'];
const DEADLINE = 2035;

const won = (s: LeagueState, teamId: TeamId, year: number) => s.history.find((h) => h.year === year)?.champion === teamId;
const titles = (s: LeagueState, teamId: TeamId, upTo: number) => s.history.filter((h) => h.year <= upTo && h.champion === teamId).length;

/** First-team wins and losses since our debut, for a club. */
function record(s: LeagueState, teamId: TeamId, from: number, to: number) {
  let w = 0,
    l = 0;
  for (const h of s.history) {
    if (h.year < from || h.year > to) continue;
    const row = h.table.find((r) => r.teamId === teamId);
    if (row) {
      w += row.w;
      l += row.l;
    }
  }
  return { w, l, pct: w + l ? w / (w + l) : 0 };
}

/** A fantasy season's points: the rank (11 clubs: 110 for 1st) and how far the club went in the postseason. */
export function fantasyPoints(s: LeagueState, year: number, teamId: TeamId): number {
  const h = s.history.find((x) => x.year === year);
  if (!h) return 0;
  const clubs = h.table.length;
  const rank = h.table.find((r) => r.teamId === teamId)?.rank ?? clubs;
  const P = FANTASY.post;
  const mine = h.series.filter((x) => x.high === teamId || x.low === teamId);
  let post = 0;
  if (h.champion === teamId) post = P.champion;
  else if (mine.some((x) => x.round === 'ks')) post = P.runnerUp;
  else if (mine.some((x) => x.round === 'po')) post = P.po;
  else if (mine.some((x) => x.round === 'semipo')) post = P.semipo;
  else if (mine.length) post = P.wildcard;
  return (clubs + 1 - rank) * FANTASY.rankPoints + post;
}

export const fantasyGrade = (points: number) => (points >= 330 ? 'S' : points >= 260 ? 'A' : points >= 190 ? 'B' : points >= 120 ? 'C' : 'D');

/** How the scenario stands, for the club overview. */
export function scenarioProgress(s: LeagueState): { title: string; goal: string; lines: string[]; status: ScenarioState['status'] } | null {
  const def = scenarioOf(s);
  const u = s.user;
  if (!def || !u) return null;
  const st = u.scenario ?? { status: 'active' };
  const lines: string[] = [];
  const me = u.teamId;
  const last = s.history.at(-1)?.year ?? s.year - 1;
  switch (def.id) {
    case 'seoul': {
      const from = u.firstTeamYear;
      const us = record(s, me, from, last);
      const rows = [{ id: me, name: __i18n_k("league.scenarios.rows.name.055c18cb"), ...us }, ...SEOUL_RIVALS.map((id) => ({ id, name: s.teams.find((t) => t.id === id)?.short ?? id, ...record(s, id, from, last) }))];
      lines.push(us.w + us.l ? __i18n_k("league.scenarios.scenarioProgress.c0382dcf", { from: from, last: last, value: rows.map((r) => `${r.name} ${r.pct.toFixed(3).replace(/^0/, '')}`).join(' · ') }) : __i18n_k("league.scenarios.scenarioProgress.29c4414b", { from: from }));
      lines.push(__i18n_k("league.scenarios.scenarioProgress.4e4a4144", { value: Math.max(0, DEADLINE - Math.max(last, from - 1)) }));
      break;
    }
    case 'comeback': {
      const until = u.firstTeamYear + 4;
      lines.push(__i18n_k("league.scenarios.scenarioProgress.ede1a55d", { until: until, firstTeamYear: u.firstTeamYear, until2: until }));
      lines.push(__i18n_k("league.scenarios.scenarioProgress.8ba4e665", { value: Math.round(u.trust ?? def.owner!.startTrust) }));
      if (st.star) lines.push(__i18n_k("league.scenarios.scenarioProgress.51220a99", { value: Math.round(st.star.grant / 10_000) }));
      break;
    }
    case 'ulleung':
      lines.push(__i18n_k("league.scenarios.scenarioProgress.1bfde1f2", { value: Math.max(0, Math.min(last, DEADLINE) - 2026), value2: DEADLINE - 2026 }));
      lines.push(__i18n_k("league.scenarios.scenarioProgress.9ab68f74", { value: Math.round(u.trust ?? 60) }));
      break;
    case 'raiders':
      lines.push(__i18n_k("league.scenarios.scenarioProgress.229eb034", { titles: titles(s, me, last) }));
      break;
    case 'rescue':
      if (!st.takeover) lines.push(__i18n_k("league.scenarios.scenarioProgress.2f61c573"));
      else {
        lines.push(__i18n_k("league.scenarios.scenarioProgress.8c908d84", { value: st.takeover + 3, value2: st.takeover + 1, value3: st.takeover + 3 }));
        if (st.damage?.length) lines.push(__i18n_k("league.scenarios.scenarioProgress.3e6aff66", { value: st.damage.slice(0, 4).join(' · ') }));
      }
      break;
    case 'recession':
    case 'unpopular':
    case 'steel': {
      const until = u.firstTeamYear + def.titleWithin! - 1;
      lines.push(__i18n_k("league.scenarios.scenarioProgress.ede1a55d", { until: until, firstTeamYear: u.firstTeamYear, until2: until }));
      if (def.crowd) lines.push(__i18n_k("league.scenarios.scenarioProgress.525a10e6", { value: Math.round(def.crowd * 100) }));
      break;
    }
    case 'fantasy': {
      const pts = FANTASY.seasons.map((y) => st.points?.[y]);
      const sum = pts.reduce<number>((a, b) => a + (b ?? 0), 0);
      lines.push(s.year <= FANTASY.year && !(s.offseason && s.offseason.year > FANTASY.year) ? __i18n_k("league.scenarios.scenarioProgress.6addfcb9") : __i18n_k("league.scenarios.scenarioProgress.095d5695", { value: FANTASY.seasons.map((y, i) => `${y} ${pts[i] ?? '-'}`).join(' · '), sum: sum }));
      break;
    }
  }
  if (st.text) lines.push(st.text);
  return { title: def.title, goal: def.goal, lines, status: st.status };
}

/** Each winter after the owner's verdict: is the scenario won or lost? */
export function scenarioWinter(s: LeagueState, year: number) {
  const def = scenarioOf(s);
  const u = s.user;
  if (!def || !u) return;
  const st = (u.scenario ??= { status: 'active' });
  if (def.free) return;
  if (def.id === 'fantasy' && FANTASY.seasons.includes(year) && firstTeamIds(s, year).includes(u.teamId)) (st.points ??= {})[year] = fantasyPoints(s, year, u.teamId);
  if (st.status !== 'active') return;
  const me = u.teamId;
  let verdict: { status: 'won' | 'lost'; text: string } | null = null;
  if (u.fired && def.id !== 'fantasy') verdict = { status: 'lost', text: __i18n_k("league.scenarios.scenarioWinter.text.fe0f46d5", { fired: u.fired }) };
  else
    switch (def.id) {
      case 'seoul':
        if (year >= DEADLINE) {
          const us = record(s, me, u.firstTeamYear, DEADLINE);
          const best = SEOUL_RIVALS.map((id) => ({ id, ...record(s, id, u.firstTeamYear, DEADLINE) })).sort((a, b) => b.pct - a.pct)[0]!;
          const name = s.teams.find((t) => t.id === best.id)?.short ?? best.id;
          verdict = us.pct > best.pct ? { status: 'won', text: __i18n_k("league.scenarios.scenarioWinter.text.9e42e974", { value: us.pct.toFixed(3), name: name, value2: best.pct.toFixed(3) }) } : { status: 'lost', text: __i18n_k("league.scenarios.scenarioWinter.text.491a1010", { value: us.pct.toFixed(3), name: name, value2: best.pct.toFixed(3) }) };
        }
        break;
      case 'comeback':
        if (won(s, me, year)) verdict = { status: 'won', text: __i18n_k("league.scenarios.scenarioWinter.text.1fac13e4", { year: year }) };
        else if (year >= u.firstTeamYear + 4) verdict = { status: 'lost', text: __i18n_k("league.scenarios.scenarioWinter.text.53fceaee", { value: u.firstTeamYear + 4 }) };
        break;
      case 'rescue':
        if (!st.takeover || year <= st.takeover) break;
        if (won(s, me, year)) verdict = { status: 'won', text: __i18n_k("league.scenarios.scenarioWinter.text.7ffb4a2f", { year: year, value: year - st.takeover }) };
        else if (year >= st.takeover + 3) verdict = { status: 'lost', text: __i18n_k("league.scenarios.scenarioWinter.text.324a0bd8", { value: st.takeover + 3 }) };
        break;
      case 'recession':
      case 'unpopular':
      case 'steel': {
        const until = u.firstTeamYear + def.titleWithin! - 1;
        const cheer = { recession: __i18n_k("league.scenarios.cheer.recession.5a3b4b76"), unpopular: __i18n_k("league.scenarios.cheer.unpopular.e7e09b87"), steel: __i18n_k("league.scenarios.cheer.steel.d2f57365") }[def.id];
        if (won(s, me, year)) verdict = { status: 'won', text: __i18n_k("league.scenarios.scenarioWinter.text.97a7c92d", { year: year, cheer: cheer }) };
        else if (year >= until) verdict = { status: 'lost', text: __i18n_k("league.scenarios.scenarioWinter.text.e9a76454", { until: until }) };
        break;
      }
      case 'ulleung':
        if (year >= DEADLINE) verdict = { status: 'won', text: __i18n_k("league.scenarios.scenarioWinter.text.e371b31b", { value: DEADLINE - 2026 }) };
        break;
      case 'raiders': {
        const n = titles(s, me, year);
        if (n >= 3) verdict = { status: 'won', text: __i18n_k("league.scenarios.scenarioWinter.text.9ff52641", { year: year }) };
        else if (year >= DEADLINE) verdict = { status: 'lost', text: __i18n_k("league.scenarios.scenarioWinter.text.869e5308", { n: n }) };
        break;
      }
      case 'fantasy':
        if (year >= FANTASY.seasons.at(-1)!) {
          const sum = FANTASY.seasons.reduce((a, y) => a + (st.points?.[y] ?? 0), 0);
          verdict = { status: 'won', text: __i18n_k("league.scenarios.scenarioWinter.text.7effb243", { sum: sum, fantasyGrade: fantasyGrade(sum) }) };
        }
        break;
    }
  if (!verdict) return;
  st.status = verdict.status;
  st.decided = year;
  st.text = verdict.text;
  const title = __i18n_k("league.scenarios.scenarioWinter.title.fd180df4", { title: def.title, value: def.id === 'fantasy' ? __i18n_k("league.scenarios.scenarioWinter.title.71d855ac") : verdict.status === 'won' ? __i18n_k("league.scenarios.scenarioWinter.title.23b64411") : __i18n_k("league.scenarios.scenarioWinter.title.732fe33a") });
  addAlert(s, { id: `scenario-${def.id}-${year}`, date: `${year}-11-30`, kind: 'achievement', title, lines: [verdict.text, __i18n_k("league.scenarios.scenarioWinter.lines.c8648025")], tone: verdict.status === 'won' ? 'good' : 'bad' });
  addNews(s, { id: `scenario-${def.id}-${year}`, date: `${year}-11-30`, kind: 'season', title, body: verdict.text, quotes: [], facts: { scenario: def.title, status: verdict.status }, players: [], mine: true });
  milestone(s, year, `${title}: ${verdict.text}`);
}

/** The settings with what the scenario locks (its other settings are only where the form starts). */
export const withScenario = (settings: ExpansionSettings, id: ScenarioId | null): ExpansionSettings => {
  const def = scenarioDef(id);
  if (!def) return { ...settings, scenario: null };
  const locked = Object.fromEntries(def.locked.filter((k) => k in def.fixed).map((k) => [k, def.fixed[k]]));
  return { ...settings, ...locked, scenario: def.id };
};

// ── 재기: the owner's orders ─────────────────────────────────────────────────────────────────────
/* The heir calls in the season (each kind at most once a season, one at a time): sack the manager when the club is
   losing, bring in a star by the trade deadline (with the group's money), or cut ticket prices when the stands are
   empty. The general manager obeys or refuses; refusing costs trust, which the winter verdict starts from. */

export type MeddleOrder = 'manager' | 'star' | 'ticket';
export const MEDDLE = {
  /** A day's chance once the order's conditions hold, from this date. */
  chance: { manager: 0.05, star: 0.035, ticket: 0.025 },
  from: { manager: '05-10', star: '05-15', ticket: '05-01' },
  until: { manager: '09-15', star: '07-10', ticket: '08-31' },
  /** Trust lost on refusing, and gained by obeying. */
  refuse: { manager: 10, star: 7, ticket: 4 },
  obey: 2,
  /** The star order: the group's money (만 원), the grade it means, and the verdict at the deadline. */
  starGrant: 300_000,
  starGrade: 60,
  starMet: 5,
  starMissed: 12,
  ticketCut: 0.8,
} as const;

const dayOf = (date: string) => date.slice(5);

/** Today's call from the owner, if any. Returns true when the general manager must answer first. */
export function meddleDay(s: LeagueState, date: string): boolean {
  const u = s.user;
  if (!u || u.settings.scenario !== 'comeback' || s.pending || !firstTeamIds(s, s.year).includes(u.teamId)) return false;
  const st = (u.scenario ??= { status: 'active' });
  starDeadline(s, date);
  if (st.status !== 'active') return false;
  const year = s.year;
  const done = new Set((st.orders ?? []).filter((o) => o.startsWith(`${year}:`)).map((o) => o.slice(5)));
  const rows = standings(firstTeamIds(s, year), s.scores);
  const me = rows.find((r) => r.teamId === u.teamId);
  if (!me) return false;
  const games = me.w + me.l + me.t;
  const r = rng(`${s.seed}|meddle|${date}`);
  const club = s.clubs?.[u.teamId];
  const team = s.teams.find((t) => t.id === u.teamId)!;
  const fill = (() => {
    const home = s.scores.filter((g) => g.home === u.teamId);
    return home.length ? home.reduce((a, g) => a + (g.att ?? 0), 0) / home.length / team.stadium.capacity : 1;
  })();
  const open = (k: MeddleOrder) => !done.has(k) && dayOf(date) >= MEDDLE.from[k] && dayOf(date) <= MEDDLE.until[k] && r() < MEDDLE.chance[k];
  let order: MeddleOrder | null = null;
  if (games >= 30 && me.rank > rows.length - 4 && me.w < me.l && open('manager')) order = 'manager';
  else if (games >= 25 && open('star')) order = 'star';
  else if (games >= 15 && fill < 0.7 && (club?.price ?? 1) > FANS_MIN + 0.05 && open('ticket')) order = 'ticket';
  if (!order) return false;
  (st.orders ??= []).push(`${year}:${order}`);
  const manager = order === 'manager' ? staffOf(s, u.teamId).manager : null;
  const pick = order === 'manager' ? makeStaff(s, 'manager', `meddle-${year}`, year, Math.round((r() - 0.5) * 16), { club: u.teamId }) : undefined;
  const lines =
    order === 'manager'
      ? [__i18n_k("league.scenarios.meddleDay.lines.e6d537a4", { w: me.w, l: me.l, rank: me.rank }), __i18n_k("league.scenarios.meddleDay.lines.1ffbf86b", { name: manager!.name, rating: manager!.rating, name2: pick!.name, rating2: pick!.rating })]
      : order === 'star'
        ? [__i18n_k("league.scenarios.meddleDay.lines.e5eb66df"), __i18n_k("league.scenarios.meddleDay.lines.1f8fb0a9", { value: Math.round(MEDDLE.starGrant / 10_000), starGrade: MEDDLE.starGrade })]
        : [__i18n_k("league.scenarios.meddleDay.lines.d4f06e84", { value: Math.round(fill * 100) }), __i18n_k("league.scenarios.meddleDay.lines.83abe920", { value: Math.round((1 - MEDDLE.ticketCut) * 100) })];
  s.pending = { kind: 'meddle', order, date, lines, refuse: MEDDLE.refuse[order], ...(pick ? { manager: pick } : {}) };
  addAlert(s, { id: `meddle-${date}`, date, kind: 'owner', title: __i18n_k("league.scenarios.meddleDay.title.71e3a72c"), lines, tone: 'bad' });
  return true;
}

/** Obey or refuse. */
export function resolveMeddle(s: LeagueState, d: Extract<Decision, { kind: 'meddle' }>, answer: 'obey' | 'refuse') {
  const u = s.user!;
  const st = (u.scenario ??= { status: 'active' });
  const year = Number(d.date.slice(0, 4));
  const log = (text: string) => (u.log ??= []).push({ year, text });
  if (answer === 'refuse') {
    u.trust = Math.max(0, (u.trust ?? PARENT.startTrust) - d.refuse);
    log(__i18n_k("league.scenarios.resolveMeddle.387ae0e0", { value: ORDER_LABEL[d.order], refuse: d.refuse }));
    return;
  }
  u.trust = Math.min(100, (u.trust ?? PARENT.startTrust) + MEDDLE.obey);
  if (d.order === 'manager' && d.manager) {
    const staff = staffOf(s, u.teamId);
    const old = staff.manager;
    staff.manager = { ...d.manager, id: `st-${u.teamId}-manager-${d.date}`, until: year + 2 };
    log(__i18n_k("league.scenarios.resolveMeddle.41c847cb", { name: old.name, name2: d.manager.name }));
    addNews(s, { id: `meddle-manager-${d.date}`, date: d.date, kind: 'move', title: __i18n_k("league.scenarios.resolveMeddle.title.d0d2fecf", { name: old.name, name2: d.manager.name }), body: __i18n_k("league.scenarios.resolveMeddle.body.87f111d4", { name: old.name, name2: d.manager.name }), quotes: [], facts: {}, players: [], mine: true });
  } else if (d.order === 'star') {
    u.fund += MEDDLE.starGrant;
    u.ledger.push({ year, label: __i18n_k("league.scenarios.resolveMeddle.label.396380c2"), amount: MEDDLE.starGrant });
    st.star = { since: d.date, ids: orgIds(s, u.teamId), grant: MEDDLE.starGrant };
    log(__i18n_k("league.scenarios.resolveMeddle.ecb07d3c", { value: Math.round(MEDDLE.starGrant / 10_000) }));
  } else if (d.order === 'ticket') {
    const c = s.clubs![u.teamId]!;
    c.price = Math.max(FANS_MIN, Math.round(c.price * MEDDLE.ticketCut * 100) / 100);
    log(__i18n_k("league.scenarios.resolveMeddle.5ab56d00", { value: c.price.toFixed(2) }));
  }
}

/** The star order at the trade deadline: did a big name come? */
function starDeadline(s: LeagueState, date: string) {
  const u = s.user!;
  const st = u.scenario;
  if (!st?.star || date <= `${s.year}-07-31`) return;
  const before = new Set(st.star.ids);
  const star = orgPlayers(s, u.teamId).find((p) => !before.has(p.id) && p.scouting.current >= MEDDLE.starGrade);
  const year = Number(st.star.since.slice(0, 4));
  delete st.star;
  const delta = star ? MEDDLE.starMet : -MEDDLE.starMissed;
  u.trust = Math.max(0, Math.min(100, (u.trust ?? PARENT.startTrust) + delta));
  const text = star ? __i18n_k("league.scenarios.starDeadline.text.4a7e358b", { name: star.name, starMet: MEDDLE.starMet }) : __i18n_k("league.scenarios.starDeadline.text.eaeef773", { starMissed: MEDDLE.starMissed });
  (u.log ??= []).push({ year, text });
  addAlert(s, { id: `meddle-star-${year}`, date, kind: 'owner', title: star ? __i18n_k("league.scenarios.starDeadline.title.1b056be4") : __i18n_k("league.scenarios.starDeadline.title.c37ca8a1"), lines: [text], tone: star ? 'good' : 'bad' });
}

export const ORDER_LABEL: Record<MeddleOrder, string> = { manager: __i18n_k("league.scenarios.oRDER_LABEL.manager.c4459b68"), star: __i18n_k("league.scenarios.oRDER_LABEL.star.9572e6b2"), ticket: __i18n_k("league.scenarios.oRDER_LABEL.ticket.ca441426") };
/** The scouts' word on an order: obey, unless the owner's own manager is clearly worse. */
export const autoMeddle = (s: LeagueState, d: Extract<Decision, { kind: 'meddle' }>): 'obey' | 'refuse' => (d.order === 'manager' && d.manager && d.manager.rating < staffOf(s, s.user!.teamId).manager.rating - 10 && (s.user!.trust ?? 60) > 40 ? 'refuse' : 'obey');
