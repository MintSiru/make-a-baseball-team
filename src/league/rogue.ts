import { k as __i18n_k } from '../i18n/index';
/* 살려야 한다 (1.6.0, scenario 7): a runaway "genius GM" AI runs the club from the founding through its fifth season.
   It answers every decision by itself — mostly as the scouts would, but it drafts for now over the future and gives
   every player what he asks — and each winter it does its own damage: the best young players traded for veterans,
   big extensions for players past thirty, a manager it likes, tickets at the top price, money spent on its own
   projects. The general manager watches (one long action, no input) and takes over in the winter of the fifth season
   with what is left. */
import { rng } from '../draftroom';
import { apply, regularOver } from './actions';
import { addAlert } from './alerts';
import { renewSalary, salaryIn } from './contracts';
import { startYear } from './era';
import { autoDecision, type DecisionInput } from './expansion';
import { clubState } from './fans';
import { movePlayer } from './market';
import { addNews } from './news';
import { ageIn, currentValue, futureValue, isForeign } from './players';
import { makeStaff, staffOf } from './staff';
import { firstTeamIds, orgPlayers, type LeagueState } from './state';
import { FANS } from './tuning';

export const ROGUE = {
  /** Seasons the AI runs (from the founding): it hands over in the winter of the founding year + this − 1. */
  seasons: 5,
  trades: 2,
  extensions: 2,
  extensionYears: 3,
  extensionRaise: 1.8,
  projects: 150_000,
} as const;

export const takeoverYear = () => startYear() + ROGUE.seasons - 1;

/** The AI's answer to a decision: the scouts', except where it has ideas of its own. */
function rogueInput(s: LeagueState): DecisionInput | null {
  const d = s.pending!;
  if (d.kind === 'draftPick') {
    // It wants players who can play now: the best current grade, whatever the ceiling.
    const pool = s.offseason!.draft!.pool.map((id) => s.players[id]!);
    const best = [...pool].sort((a, b) => currentValue(b) - currentValue(a))[0];
    return { kind: 'draftPick', id: best?.id ?? null };
  }
  if (d.kind === 'salaries') return { kind: 'salaries', choices: Object.fromEntries(d.rows.map((r) => [r.id, 'ask'])) };
  return autoDecision(s);
}

/** One winter's damage; returns what it did, in a line each. */
function rogueWinter(s: LeagueState, year: number): string[] {
  const u = s.user!;
  const me = u.teamId;
  const next = year + 1;
  const r = rng(`${s.seed}|rogue|${year}`);
  const done: string[] = [];
  const ours = () => orgPlayers(s, me).filter((p) => p.status === 'active' && !isForeign(p));
  // Youth for veterans.
  const others = firstTeamIds(s, year).filter((id) => id !== me && s.rosters[id]);
  const young = ours()
    .filter((p) => ageIn(p, next) <= 24 && p.proSince <= year)
    .sort((a, b) => futureValue(b) - futureValue(a))
    .slice(0, ROGUE.trades);
  for (const p of young) {
    const club = others[Math.floor(r() * others.length)]!;
    const vet = orgPlayers(s, club)
      .filter((q) => !isForeign(q) && q.status === 'active' && ageIn(q, next) >= 31)
      .sort((a, b) => currentValue(b) - currentValue(a))[0];
    if (!vet) continue;
    movePlayer(s, p, club);
    movePlayer(s, vet, me);
    const team = s.teams.find((t) => t.id === club)!.short;
    done.push(__i18n_k("league.rogue.rogueWinter.d84a0d78", { name: p.name, ageIn: ageIn(p, next), team: team, name2: vet.name, ageIn2: ageIn(vet, next) }));
    addNews(s, { id: `rogue-trade-${year}-${p.id}`, date: `${year}-11-15`, kind: 'move', title: __i18n_k("league.rogue.rogueWinter.title.53320f19", { name: p.name, name2: vet.name }), body: __i18n_k("league.rogue.rogueWinter.body.df2bfd43", { team: team, name: p.name, ageIn: ageIn(vet, next), name2: vet.name }), quotes: [], facts: {}, players: [p.id, vet.id], mine: true });
  }
  // Big deals for players past thirty.
  const old = ours()
    .filter((p) => ageIn(p, next) >= 30)
    .sort((a, b) => currentValue(b) - currentValue(a))
    .slice(0, ROGUE.extensions);
  for (const p of old) {
    const annual = Math.round((Math.max(renewSalary(p, next), salaryIn(p, year)) * ROGUE.extensionRaise) / 1000) * 1000;
    p.contract = { teamId: me, kind: 'multiYear', signedIn: year, signingBonus: 0, salaries: Array.from({ length: ROGUE.extensionYears }, (_, i) => ({ season: next + i, amount: annual })) };
    done.push(__i18n_k("league.rogue.rogueWinter.6a8b4952", { name: p.name, ageIn: ageIn(p, next), extensionYears: ROGUE.extensionYears, value: Math.round(annual / 10_000) }));
  }
  // Its own manager, the top ticket price, no marketing, its own projects.
  const staff = staffOf(s, me);
  const pick = makeStaff(s, 'manager', `rogue-${year}`, year, -15, { club: me });
  done.push(__i18n_k("league.rogue.rogueWinter.93d8b82a", { name: staff.manager.name, name2: pick.name, rating: pick.rating }));
  staff.manager = { ...pick, id: `st-${me}-manager-rogue-${year}`, until: next + 2 };
  const club = clubState(s, me);
  club.price = FANS.priceMax;
  club.marketing = FANS.marketing.min;
  u.fund -= ROGUE.projects;
  u.ledger.push({ year, label: __i18n_k("league.rogue.rogueWinter.label.fb955a09"), amount: -ROGUE.projects });
  done.push(__i18n_k("league.rogue.rogueWinter.e9e9e6f7", { value: Math.round(ROGUE.projects / 10_000) }));
  return done;
}

/** Plays the AI's five years, from the founding to the takeover winter. */
export function runRogue(s: LeagueState): LeagueState {
  const u = s.user;
  if (!u || u.settings.scenario !== 'rescue' || u.scenario?.takeover) return s;
  const end = takeoverYear();
  const damage: string[] = [];
  let winter = -1;
  for (let guard = 0; guard < 40_000; guard++) {
    if (s.phase === 'offseason' && s.offseason?.year === end) break;
    if (s.phase === 'offseason' && s.offseason && s.offseason.year !== winter) {
      winter = s.offseason.year;
      damage.push(...rogueWinter(s, winter));
    }
    if (s.pending) {
      const input = rogueInput(s);
      if (!input) break;
      s = apply(s, { kind: 'decide', input });
    } else if (s.phase === 'regular' && !regularOver(s)) s = apply(s, { kind: 'days', days: 30 });
    else if (s.phase === 'regular' || (s.phase === 'postseason' && s.bracket && !s.bracket.done)) s = apply(s, { kind: 'postseason' });
    else s = apply(s, { kind: 'nextSeason' });
  }
  // The general manager takes over: the old news is old, the owner starts afresh with him.
  for (const a of s.alerts ?? []) a.seen = true;
  const st = (u.scenario ??= { status: 'active' });
  st.takeover = end;
  st.damage = damage.slice(-8);
  u.trust = 60;
  delete u.fired;
  const team = s.teams.find((t) => t.id === u.teamId)!;
  const ranks = s.history.filter((h) => h.year >= startYear()).map((h) => __i18n_k("league.rogue.runRogue.ranks.69ecb200", { year: h.year, value: h.table.find((x) => x.teamId === u.teamId)?.rank ?? '-' }));
  addAlert(s, {
    id: `rogue-${end}`,
    date: `${end}-11-01`,
    kind: 'achievement',
    title: __i18n_k("league.rogue.runRogue.title.388ae560"),
    lines: [__i18n_k("league.rogue.runRogue.lines.88bf1a29", { name: team.name, value: ranks.join(' · ') || __i18n_k("league.rogue.runRogue.lines.2de28099") }), ...damage.slice(-4), __i18n_k("league.rogue.runRogue.lines.7ad55645", { value: end + 1, value2: end + 3 })],
    tone: 'bad',
  });
  addNews(s, { id: `rogue-${end}`, date: `${end}-11-01`, kind: 'move', title: __i18n_k("league.rogue.runRogue.title.66d30457", { short: team.short }), body: __i18n_k("league.rogue.runRogue.body.35e218ac", { name: team.name }), quotes: [], facts: {}, players: [], mine: true });
  return s;
}

