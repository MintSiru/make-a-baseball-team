import { k as __i18n_k } from '../i18n/index';
/* 2.0.43 (the user's request: 12구단 창단 시 구단 옮겨서 플레이): when the twelfth club is founded, the general manager may
   leave the club he built and take over the new one.

   The new club is founded as the twelfth club always is (rival.ts: the tryout already held, a futures season, the
   first team the season after), but its founding is now ours to run the way our first club's was: the priority picks
   in the draft, the special draft before its first first-team season (we protect nothing — our old club is the
   AI's now, it protects its own 20), the free agents without compensation, the foreign players from the first
   team on. It comes with its own owner's money: the founding fund, entry fee and development fund as for our first
   club (expansion.ts budgetFor). The old club, its players and its fund stay where they are and the AI runs it.

   What goes with the general manager: the game's settings, the achievements and the timeline (the old club's story
   stays on it), the news and log, the tutorial. Everything that belonged to the old club (its books, its owner's
   trust and goals, its works, its lineup card and plans) stays behind. A scenario with a goal is the old club's to
   finish, so moving is only for a free founding or a free scenario. */
import type { TeamId } from '../model/types';
import { addAlert } from './alerts';
import { budgetFor } from './expansion';
import { eulreul, eunneun } from './josa';
import { milestone } from './milestones';
import { addNews } from './news';
import { baseSupport, electMayor } from './parent';
import { scenarioDef, supportFactor } from './scenarios';
import type { ExpansionSettings, LeagueState, RivalSettings, UserClub } from './state';
import { DIFFICULTY, PARENT } from './tuning';

/** Why the general manager cannot move to the new club now, or null. */
export function moveBlocked(s: LeagueState): string | null {
  const u = s.user;
  if (!u) return __i18n_k("league.clubmove.text.e8451a28");
  const def = scenarioDef(u.settings.scenario);
  if (def && !def.free) return __i18n_k("league.clubmove.text.0a7464e8");
  if (u.fired) return __i18n_k("league.clubmove.text.53416536");
  return null;
}

/** The general manager takes over `teamId` (the twelfth club just founded in the winter of `year`). */
export function moveToClub(s: LeagueState, teamId: TeamId, year: number, club: RivalSettings, firstTeam: number) {
  const old = s.user;
  if (!old) return;
  const from = s.teams.find((t) => t.id === old.teamId);
  const to = s.teams.find((t) => t.id === teamId);
  if (!from || !to) return;
  const settings: ExpansionSettings = {
    ...old.settings,
    name: to.name,
    short: to.short,
    color: to.color,
    cityId: club.cityId,
    parentType: club.parentType,
    parentName: club.parentName.trim(),
    stadium: 'existing',
    promotion: 'afterFutures',
  };
  // It is founded: the twelve-club setting has done its work.
  delete settings.twelve;
  const b = budgetFor(settings);
  const k = DIFFICULTY.money[settings.difficulty];
  const next: UserClub = {
    teamId,
    settings,
    fund: b.fund,
    payrollBudget: b.payrollBudget,
    firstTeamYear: firstTeam,
    ledger: [],
    support: Math.round(baseSupport(settings.parentType) * k * supportFactor(settings)),
    trust: scenarioDef(settings.scenario)?.owner?.startTrust ?? PARENT.startTrust,
    budgetScale: 1,
    // The general manager's own: his story, his achievements, the guide, the settings he chose.
    ...(old.scenario ? { scenario: old.scenario } : {}),
    // The old club's milestones keep their text but no longer stand for the new club's firsts.
    timeline: (old.timeline ?? []).map(({ year: y, text }) => ({ year: y, text })),
    ...(old.achievements ? { achievements: old.achievements } : {}),
    ...(old.log ? { log: old.log } : {}),
    ...(old.tutorialSeen ? { tutorialSeen: old.tutorialSeen } : {}),
    ...(old.tutorialOff ? { tutorialOff: old.tutorialOff } : {}),
    ...(old.entry ? { entry: old.entry } : {}),
    former: [...(old.former ?? []), { teamId: old.teamId, name: from.name, from: from.founded ?? year, to: year }],
  };
  const spend = (label: string, amount: number) => {
    next.fund -= amount;
    next.ledger.push({ year, label, amount: -amount, capital: true });
  };
  spend(__i18n_k("league.clubmove.text.b77f9a73"), b.entryFee);
  spend(__i18n_k("league.clubmove.text.db42ddad"), b.developmentFund);
  next.ledger.push({ year, label: __i18n_k("league.clubmove.text.262f8f56", { value: b.deposit / 10000 }), amount: 0 });
  if (settings.parentType === 'citizen') next.mayor = electMayor(s, year);
  s.user = next;
  const date = `${year}-12-10`;
  const title = __i18n_k("league.clubmove.text.6f0111bb", { from: eulreul(from.name), to: to.name });
  const lines = [
    __i18n_k("league.clubmove.text.aaaa729d", { from: eunneun(from.short) }),
    __i18n_k("league.clubmove.text.fda4d79f", { to: eunneun(to.short), next: year + 1, firstTeam }),
  ];
  addNews(s, { id: `club-move-${year}`, date, kind: 'season', title, body: lines.join(' '), quotes: [], facts: { from: from.name, to: to.name }, players: [], mine: true });
  addAlert(s, { id: `club-move-${year}`, date, kind: 'owner', title, lines });
  milestone(s, year, title, `moved-${teamId}`);
}

/** The club the general manager ran before, the latest (null when he never moved). */
export const formerClub = (s: LeagueState): TeamId | null => s.user?.former?.at(-1)?.teamId ?? null;
