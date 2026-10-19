import { k as __i18n_k } from '../i18n/index';
/* 2.0.23 (the user's request: "울릉 시나리오 중 통일 한국 시나리오 추가"): another scenario's conditions added to a game
   already under way — a sandbox game or a scenario's. Only the conditions, never the other scenario's goal: the game's
   own goal (if any) stays the one judged.

   - 불경기 (recession): our owner's support and payroll budget cut as the scenario's are, from next winter's budget.
   - 불인기 종목 (unpopular): every club's crowds shrink as the scenario's do, at once; our owner's support from next
     winter.
   - 부상병동 (ward): our club alone gets hurt as the scenario's does (ward.ts), at once.
   - 통일 한국 (unified): the north's five clubs are founded in the coming winter (at its development step, as the
     twelfth club is) and play from the season after next; the league becomes sixteen clubs in two leagues of eight.
     Not with a twelfth club, a legacy or already two leagues, and our club protects its 20 before their special
     draft (each takes one unprotected player from every club, ours too).

   A condition cannot be taken back once added. */
import { addAlert } from './alerts';
import { milestone } from './milestones';
import { addNews } from './news';
import { scenarioDef, type ScenarioId } from './scenarios';
import type { LeagueState } from './state';

export type ConditionId = 'recession' | 'unpopular' | 'ward' | 'unified';
export const CONDITIONS: ConditionId[] = ['recession', 'unpopular', 'ward', 'unified'];

export interface Condition {
  id: ConditionId;
  /** The season (or the winter after it) it was added. */
  from: number;
}

/** The scenario a condition comes from (its money and crowds). */
const SOURCE: Record<ConditionId, ScenarioId> = { recession: 'recession', unpopular: 'unpopular', ward: 'ward', unified: 'unified' };

/** The game's own scenario or an added condition. */
export const hasCondition = (s: Pick<LeagueState, 'user' | 'conditions'>, id: ConditionId) =>
  s.user?.settings.scenario === id || (id === 'unified' && s.user?.settings.scenario === 'unifiedFree') || !!s.conditions?.some((c) => c.id === id);

const added = (s: Pick<LeagueState, 'user' | 'conditions'>) => (s.conditions ?? []).filter((c) => s.user?.settings.scenario !== c.id);

/** Every club's crowds × this, from the added conditions (the game's own scenario is read where it always was). */
export const conditionCrowd = (s: Pick<LeagueState, 'user' | 'conditions'>) => added(s).reduce((k, c) => k * (scenarioDef(SOURCE[c.id])?.crowd ?? 1), 1);

/** Our owner's support or payroll budget × this, from the added conditions. */
export const conditionMoney = (s: Pick<LeagueState, 'user' | 'conditions'>, kind: 'support' | 'payroll') =>
  added(s).reduce((k, c) => k * (scenarioDef(SOURCE[c.id])?.money?.[kind] ?? 1), 1);

/** Why a condition cannot be added now (null if it can). */
export function checkCondition(s: LeagueState, id: ConditionId): string | null {
  const u = s.user;
  if (!u) return __i18n_k("league.conditions.text.2fa9615a");
  if (!CONDITIONS.includes(id)) return __i18n_k("league.conditions.text.8a17c470");
  if (hasCondition(s, id)) return __i18n_k("league.conditions.text.733025ce");
  if (id === 'unified') {
    if (s.unified) return __i18n_k("league.conditions.text.2befe98b");
    if (s.legacy) return __i18n_k("league.conditions.text.0a76c05b");
    if (s.twelve) return __i18n_k("league.conditions.text.5b7fa9cd");
    if (s.leagueSides) return __i18n_k("league.conditions.text.e80a6259");
    if (s.offseason && s.offseason.done.includes('develop')) return __i18n_k("league.conditions.text.fba5a77f");
  }
  return null;
}

/** Adds a condition (news and the club's history). */
export function addCondition(s: LeagueState, id: ConditionId) {
  if (checkCondition(s, id)) return;
  const year = s.offseason?.year ?? s.year;
  (s.conditions ??= []).push({ id, from: year });
  const u = s.user!;
  // No twelfth club after the north's six.
  if (id === 'unified') u.settings = { ...u.settings, twelve: { mode: 'off' } };
  const def = scenarioDef(SOURCE[id])!;
  const title = __i18n_k("league.conditions.text.43a37a10", { title: def.title });
  const lines = [conditionText(id, year)];
  const date = s.phase === 'regular' ? (s.schedule[s.next]?.date ?? `${s.year}-10-01`) : `${year}-11-01`;
  addNews(s, { id: `condition-${id}-${year}`, date, kind: 'season', title, body: lines.join(' '), quotes: [], facts: { condition: def.title, year }, players: [], mine: true });
  addAlert(s, { id: `condition-${id}-${year}`, date, kind: 'season', title, lines });
  milestone(s, year, title, `condition-${id}`);
}

/** What the condition does from now. */
export function conditionText(id: ConditionId, year: number): string {
  switch (id) {
    case 'recession':
      return __i18n_k("league.conditions.text.2e127e72");
    case 'unpopular':
      return __i18n_k("league.conditions.text.2c0801a0");
    case 'ward':
      return __i18n_k("league.conditions.text.fb016e56");
    case 'unified':
      return __i18n_k("league.conditions.text.a987f399", { year, first: year + 2 });
  }
}
