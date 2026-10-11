import { k as __i18n_k } from '../i18n/index';
/* The owner's side (V0.6, RULES.md §13, ROADMAP 난이도 설계). Each type of owner behaves differently:

   - 대기업 계열: the largest support, the highest expectations and the shortest patience; the group's
     own year moves the money (±10%).
   - 강소·중견기업: less money, but a club that wins and pays its way is rewarded for good.
   - 명명권 스폰서: no parent. A naming sponsor pays a fee for a few years; when the deal ends the club
     renews or signs another sponsor, and the club takes the sponsor's name. An investor covers little.
   - 시민구단: the city council reviews the budget every winter; a mayor elected every four years (June
     local elections: 2026, 2030, …) is friendly, neutral or hostile to the club and moves the city's
     money; large or lasting deficits bring the council down on the club (V0.7.7). Fans are loyal.
   - V0.7.7: each naming sponsor offers its own fee and goal (none, a finish, a crowd) and may walk out
     after a missed season; a conglomerate or mid-size owner now and then pays for a free agent
     (market.ts parentGift).

   Every season the owner sets goals (a finish, a crowd, a deficit it accepts) and judges them in the
   winter: next year's support and payroll budget move with the score, and so does its trust in the
   general manager. Firing is a setting and off in the sandbox. */
import { startYear } from './era';
import { rng } from '../draftroom';
import type { ParentCompanyType } from '../club/types';
import { clubState } from './fans';
import { addAlert } from './alerts';
import { eunneun, ro, wagwa } from './josa';
import { firstTeamIds, type Evaluation, type LeagueState, type Mayor, type SeasonGoals, type SponsorGoal, type SponsorOffer } from './state';
import { PARENT, DIFFICULTY } from './tuning';
import { scenarioOf } from './scenarios';

const money = (n: number) => __i18n_k("league.parent.money.db0fc332", { value: Math.round(n / 10000) });

/** Support the owner approves in its first year (만 원), before difficulty. */
export const baseSupport = (type: ParentCompanyType) => PARENT.support[type];

/** Goals for the coming season. A new club gets two lenient seasons. */
export function setGoals(s: LeagueState, year: number): SeasonGoals | null {
  const u = s.user;
  if (!u || !firstTeamIds(s, year).includes(u.teamId)) return null;
  const type = u.settings.parentType;
  const seasonsIn = year - u.firstTeamYear;
  const clubs = firstTeamIds(s, year).length;
  const owner = scenarioOf(s)?.owner;
  const rank = owner ? Math.min(clubs, owner.rankGoal(seasonsIn)) : seasonsIn < 2 ? clubs : Math.min(clubs, PARENT.rankGoal[type] + (seasonsIn < 4 ? 2 : 0));
  const c = clubState(s, u.teamId);
  const last = c.reports.at(-1);
  const team = s.teams.find((t) => t.id === u.teamId)!;
  const lastAvg = last?.homeGames ? last.fans / last.homeGames : team.stadium.capacity * 0.6;
  const fans = Math.round(Math.min(team.stadium.capacity * 0.95, lastAvg * PARENT.crowdGoal) / 100) * 100;
  const goals = { year, rank, fans, result: -(u.support ?? 0) };
  u.goals = goals;
  return goals;
}

/**
 * The winter verdict: each goal met or missed, trust moves, and next year's support and payroll budget
 * move by up to ±10%. Returns null before the club plays first-team games.
 */
export function evaluate(s: LeagueState, year: number): Evaluation | null {
  const u = s.user;
  const g = u?.goals;
  if (!u || !g || g.year !== year) return null;
  const table = s.history.find((h) => h.year === year)?.table ?? [];
  const rank = table.find((r) => r.teamId === u.teamId)?.rank ?? table.length;
  const report = clubState(s, u.teamId).reports.find((r) => r.year === year);
  const avg = report?.homeGames ? Math.round(report.fans / report.homeGames) : 0;
  const result = (report?.operating ?? 0) + Math.min(0, report?.cashFlows ?? 0);
  const type = u.settings.parentType;
  const W = PARENT.weights[type];
  const lines = [
    { label: __i18n_k("league.parent.lines.label.d3bb3576"), ok: rank <= g.rank, text: __i18n_k("league.parent.lines.text.25169757", { rank: rank, rank2: g.rank }), w: W.rank },
    { label: __i18n_k("league.parent.lines.label.f3384bbb"), ok: avg >= g.fans, text: __i18n_k("league.parent.lines.text.a51b3959", { value: avg.toLocaleString('ko-KR'), value2: g.fans.toLocaleString('ko-KR') }), w: W.fans },
    { label: __i18n_k("league.parent.lines.label.9cc23f63"), ok: result >= g.result, text: __i18n_k("league.parent.lines.text.a05c7867", { money: money(result), money2: money(g.result) }), w: W.money },
  ];
  const score = Math.round(lines.reduce((a, l) => a + (l.ok ? l.w : -l.w), 0) * 100) / 100;
  const champion = s.history.find((h) => h.year === year)?.champion === u.teamId;
  const change = Math.max(-PARENT.maxChange, Math.min(PARENT.maxChange, score * PARENT.maxChange + (champion ? 0.05 : 0)));
  const step = score * PARENT.trustStep[type];
  // A scenario's owner may be less patient (1.6.0: 재기 loses trust faster and may fire from the first season).
  const owner = scenarioOf(s)?.owner;
  const trust = Math.max(0, Math.min(100, (u.trust ?? PARENT.startTrust) + (step < 0 ? step * DIFFICULTY.trustLoss[u.settings.difficulty] * (owner?.trustLoss ?? 1) : step) + (champion ? 15 : 0)));
  u.trust = trust;
  const ev: Evaluation = { year, score, lines: lines.map(({ w: _w, ...l }) => l), change, trust };
  (u.evaluations ??= []).push(ev);
  applyBudgetChange(s, change);
  if (u.settings.firing && trust < PARENT.fireBelow && year - u.firstTeamYear >= (owner?.fireFrom ?? 2)) u.fired = year;
  return ev;
}

function applyBudgetChange(s: LeagueState, change: number) {
  const u = s.user!;
  u.budgetScale = Math.max(PARENT.scaleMin, Math.min(PARENT.scaleMax, (u.budgetScale ?? 1) * (1 + change)));
}

const note = (s: LeagueState, year: number, text: string) => (s.user!.log ??= []).push({ year, text });

/** This winter's owner events. Returns a one-off factor for next year's support (1 = none). */
export function ownerEvents(s: LeagueState, year: number): number {
  const u = s.user;
  if (!u) return 1;
  const r = rng(`${s.seed}|owner|${year}`);
  const type = u.settings.parentType;
  const report = clubState(s, u.teamId).reports.find((x) => x.year === year);
  if (type === 'conglomerate') {
    const x = r();
    if (x < PARENT.groupSwing.chance) {
      note(s, year, __i18n_k("league.parent.ownerEvents.d2719782"));
      return 1 + PARENT.groupSwing.size;
    }
    if (x < PARENT.groupSwing.chance * 2) {
      note(s, year, __i18n_k("league.parent.ownerEvents.aa9d6548"));
      return 1 - PARENT.groupSwing.size;
    }
  }
  if (type === 'midsize' && report && report.operating >= 0) {
    applyBudgetChange(s, PARENT.midsizeReward);
    note(s, year, __i18n_k("league.parent.ownerEvents.1d3751a0"));
  }
  if (type === 'citizen') {
    let factor = 1;
    // Local elections every four years (June 2030, 2034, …): the new mayor's stance moves the city's money.
    u.mayor ??= electMayor(s, startYear());
    if (year >= u.mayor.until) {
      const before = u.mayor;
      u.mayor = electMayor(s, u.mayor.until, before);
      const shift = PARENT.citizen.stance[u.mayor.stance].election;
      if (shift) applyBudgetChange(s, shift);
      mayorAlert(s, year, u.mayor, before);
    }
    factor *= PARENT.citizen.stance[u.mayor.stance].support;
    factor *= deficitEvents(s, year);
    const avg = report?.homeGames ? report.fans / report.homeGames : 0;
    const team = s.teams.find((t) => t.id === u.teamId)!;
    const full = avg / team.stadium.capacity;
    const verdict = full >= 0.75 ? 0.05 : full < 0.45 ? -0.05 : 0;
    if (verdict) {
      applyBudgetChange(s, verdict);
      note(s, year, __i18n_k("league.parent.ownerEvents.21cb7363", { value: verdict > 0 ? __i18n_k("league.parent.ownerEvents.da25c8e2") : __i18n_k("league.parent.ownerEvents.72f337c9") }));
    } else note(s, year, __i18n_k("league.parent.ownerEvents.9d57acb4"));
    return factor;
  }
  return 1;
}

// ── Citizen club: the mayor and the council (V0.7.7) ─────────────────────────────────────────────────

const SURNAMES = [__i18n_k("league.parent.sURNAMES.4fdd784c"), __i18n_k("league.parent.sURNAMES.6c0cd2af"), __i18n_k("league.parent.sURNAMES.779c9c57"), __i18n_k("league.parent.sURNAMES.c596d452"), __i18n_k("league.parent.sURNAMES.402574f6"), __i18n_k("league.parent.sURNAMES.89ee0696"), __i18n_k("league.parent.sURNAMES.7977ad75"), __i18n_k("league.parent.sURNAMES.56bf74eb"), __i18n_k("league.parent.sURNAMES.b2414937"), __i18n_k("league.parent.sURNAMES.3127bf62"), __i18n_k("league.parent.sURNAMES.eddea29a"), __i18n_k("league.parent.sURNAMES.4a3ea882"), __i18n_k("league.parent.sURNAMES.19701515"), __i18n_k("league.parent.sURNAMES.e306bbaa"), __i18n_k("league.parent.sURNAMES.7c8118ea")];
const GIVEN = [__i18n_k("league.parent.gIVEN.00a5915f"), __i18n_k("league.parent.gIVEN.4e1c633a"), __i18n_k("league.parent.gIVEN.9fff797d"), __i18n_k("league.parent.gIVEN.11984fee"), __i18n_k("league.parent.gIVEN.b36c7ae5"), __i18n_k("league.parent.gIVEN.e61bd158"), __i18n_k("league.parent.gIVEN.c5c01295"), __i18n_k("league.parent.gIVEN.30b7c600"), __i18n_k("league.parent.gIVEN.39e917a5"), __i18n_k("league.parent.gIVEN.6ed912d9"), __i18n_k("league.parent.gIVEN.6620a3f0"), __i18n_k("league.parent.gIVEN.6b586415"), __i18n_k("league.parent.gIVEN.f3d4653a"), __i18n_k("league.parent.gIVEN.7b641f22"), __i18n_k("league.parent.gIVEN.4422339e")];
export const STANCE_LABEL: Record<Mayor['stance'], string> = { friendly: __i18n_k("league.parent.sTANCE_LABEL.friendly.fa192807"), neutral: __i18n_k("league.parent.sTANCE_LABEL.neutral.6640f095"), hostile: __i18n_k("league.parent.sTANCE_LABEL.hostile.ecb08d24") };

/**
 * The mayor elected in June of `year`. The first one (2026) founded the club and is usually friendly; later
 * the incumbent may win again, and a club that loses the city's money makes a hostile winner likelier.
 */
export function electMayor(s: LeagueState, year: number, before?: Mayor): Mayor {
  const r = rng(`${s.seed}|mayor|${year}`);
  const C = PARENT.citizen;
  if (before && r() < C.reelect) return { ...before, since: before.since, until: year + 4 };
  const name = `${SURNAMES[Math.floor(r() * SURNAMES.length)]}${GIVEN[Math.floor(r() * GIVEN.length)]}`;
  const w = { ...(before ? C.odds : C.foundingOdds) };
  if (before && deficitYears(s, year - 1) >= 2) w.hostile += C.deficitHostile;
  const total = w.friendly + w.neutral + w.hostile;
  const x = r() * total;
  const stance: Mayor['stance'] = x < w.friendly ? 'friendly' : x < w.friendly + w.neutral ? 'neutral' : 'hostile';
  return { name, stance, since: year, until: year + 4 };
}

/** The city's money the club needed after its own income (만 원; 0 in a year that paid its way). */
function deficitOf(s: LeagueState, year: number): number {
  const u = s.user!;
  const r = clubState(s, u.teamId).reports.find((x) => x.year === year);
  return r ? Math.max(0, -(r.operating + Math.min(0, r.cashFlows ?? 0))) : 0;
}

/** Winters in a row, up to `year`, in which the deficit took more than the council's comfortable share. */
function deficitYears(s: LeagueState, year: number): number {
  const u = s.user!;
  let n = 0;
  for (let y = year; y >= u.firstTeamYear && deficitOf(s, y) > (u.support ?? 0) * PARENT.citizen.lastingShare; y--) n++;
  return n;
}

/**
 * A large deficit (more than the approved support) or a lasting one (three winters over half of it) brings
 * the council down on the club, more surely under a hostile mayor. Returns a factor for next year's money.
 */
function deficitEvents(s: LeagueState, year: number): number {
  const u = s.user!;
  const C = PARENT.citizen;
  const big = deficitOf(s, year) > (u.support ?? 0);
  const lasting = deficitYears(s, year) >= C.lastingYears;
  if (!big && !lasting) return 1;
  const r = rng(`${s.seed}|council|${year}`);
  if (r() >= C.stance[u.mayor!.stance].eventChance) {
    note(s, year, __i18n_k("league.parent.deficitEvents.451e1db0"));
    return 1;
  }
  const hard = big && lasting ? 1.5 : 1;
  const c = clubState(s, u.teamId);
  const ev = C.events[Math.floor(r() * C.events.length)]!;
  let factor = 1;
  if (ev.budget) applyBudgetChange(s, -ev.budget * hard);
  if (ev.support) factor = 1 - ev.support * hard;
  if (ev.trust) u.trust = Math.max(0, (u.trust ?? PARENT.startTrust) - ev.trust * hard * DIFFICULTY.trustLoss[u.settings.difficulty]);
  if (ev.fans) c.popularity = Math.round(c.popularity * (1 - ev.fans * hard));
  const why = big && lasting ? __i18n_k("league.parent.deficitEvents.why.9a33feec", { deficitYears: deficitYears(s, year) }) : big ? __i18n_k("league.parent.deficitEvents.why.bd57c972", { money: money(deficitOf(s, year)) }) : __i18n_k("league.parent.deficitEvents.why.fbbcfb61", { deficitYears: deficitYears(s, year) });
  note(s, year, `${ev.title}: ${why}`);
  addAlert(s, { id: `council-${year}`, date: `${year}-12-10`, kind: 'owner', title: ev.title, lines: [`${why} ${ev.text}`, __i18n_k("league.parent.deficitEvents.lines.7f4b4563", { name: u.mayor!.name, value: STANCE_LABEL[u.mayor!.stance] })], tone: 'bad' });
  return factor;
}

function mayorAlert(s: LeagueState, year: number, now: Mayor, before: Mayor) {
  const same = now.name === before.name;
  const lines = [
    same ? __i18n_k("league.parent.mayorAlert.lines.820d1e36", { name: now.name, until: now.until }) : __i18n_k("league.parent.mayorAlert.lines.71bc10c9", { name: now.name, since: now.since, until: now.until }),
    __i18n_k("league.parent.mayorAlert.lines.6968b3d4", { value: STANCE_LABEL[now.stance], value2: now.stance === 'friendly' ? __i18n_k("league.parent.mayorAlert.lines.4b0dfc3c") : now.stance === 'hostile' ? __i18n_k("league.parent.mayorAlert.lines.bd82b307") : __i18n_k("league.parent.mayorAlert.lines.7817c49b") }),
  ];
  note(s, year, __i18n_k("league.parent.mayorAlert.f85ae871", { year: year, value: lines[0], value2: STANCE_LABEL[now.stance] }));
  addAlert(s, { id: `mayor-${year}`, date: `${year}-12-05`, kind: 'owner', title: same ? __i18n_k("league.parent.mayorAlert.title.2006085f", { name: now.name }) : __i18n_k("league.parent.mayorAlert.title.d2f505a7", { name: now.name }), lines, tone: now.stance === 'friendly' ? 'good' : now.stance === 'hostile' ? 'bad' : undefined });
}

/** Next year's support and payroll budget from the base, difficulty, the owner's scale and this winter's events. */
export function nextBudget(base: { support: number; payroll: number }, scale: number, event: number) {
  return { support: Math.round((base.support * scale * event) / 1000) * 1000, payroll: Math.round((base.payroll * scale) / 1000) * 1000 };
}

/** A naming club's sponsor deal ends this winter. */
export const sponsorDue = (s: LeagueState, year: number) => {
  const u = s.user;
  return !!u && u.settings.parentType === 'namingRights' && (clubState(s, u.teamId).sponsor?.until ?? Infinity) <= year;
};

// ── Naming sponsor ────────────────────────────────────────────────────────────────────────────────

// Fictional names only (V0.16: two real companies had slipped in).
const SPONSORS = [__i18n_k("league.parent.sPONSORS.17c6aa0f"), __i18n_k("league.parent.sPONSORS.4aa353d5"), __i18n_k("league.parent.sPONSORS.32fb5255"), __i18n_k("league.parent.sPONSORS.f7be3f40"), __i18n_k("league.parent.sPONSORS.fa4eeb4a"), __i18n_k("league.parent.sPONSORS.0b1d9816"), __i18n_k("league.parent.sPONSORS.15684b29"), __i18n_k("league.parent.sPONSORS.e4157b76"), __i18n_k("league.parent.sPONSORS.7f46e42d"), __i18n_k("league.parent.sPONSORS.ff0e7cae")];

/** Offers when a naming deal ends: the current sponsor's renewal and two newcomers, each with its own fee,
    goal and patience (V0.7.7): the more a sponsor pays, the more it wants and the sooner it walks out. */
export function sponsorOffers(s: LeagueState, year: number): SponsorOffer[] {
  const u = s.user!;
  const c = clubState(s, u.teamId);
  const r = rng(`${s.seed}|sponsor|${year}`);
  const table = s.history.find((h) => h.year === year)?.table ?? [];
  const rank = table.find((x) => x.teamId === u.teamId)?.rank ?? 6;
  const worth = PARENT.naming.base * (0.7 + (c.popularity / 20_000) * 0.4 + c.interest * 0.4 + (6 - rank) * 0.02);
  const current = c.sponsor?.name ?? u.settings.parentName;
  const last = c.reports.find((x) => x.year === year);
  const avg = last?.homeGames ? last.fans / last.homeGames : s.teams.find((t) => t.id === u.teamId)!.stadium.capacity * 0.6;
  const clubs = firstTeamIds(s, year + 1).length;
  const offer = (name: string, years: number, profile: (typeof PARENT.naming.profiles)[number], k: number): SponsorOffer => {
    const goal: SponsorGoal =
      profile.goal === 'none'
        ? { kind: 'none' }
        : profile.goal === 'fans'
          ? { kind: 'fans', fans: Math.round((avg * (1 + profile.stretch)) / 100) * 100 }
          : { kind: 'rank', rank: profile.goal === 'postseason' ? 5 : Math.min(clubs - 1, Math.max(5, rank - 1)) };
    const annual = Math.round((worth * (profile.pay[0] + (profile.pay[1] - profile.pay[0]) * k)) / 1000) * 1000;
    return { name, annual, years, goal, risk: profile.risk };
  };
  const P = PARENT.naming.profiles;
  // The current sponsor renews on the terms it knows: a crowd goal, or none after a good run.
  const offers = [offer(current, 5, c.sponsor?.missed ? P[1]! : P[0]!, 0.5 + r() * 0.5)];
  const others = SPONSORS.filter((x) => x !== current);
  const profiles = [...P.slice(1)];
  for (let i = 0; i < 2; i++) {
    const name = others.splice(Math.floor(r() * others.length), 1)[0]!;
    const profile = profiles.splice(Math.floor(r() * profiles.length), 1)[0]!;
    offers.push(offer(name, 3 + Math.floor(r() * 3), profile, r()));
  }
  return offers;
}

export const goalText = (g: SponsorGoal | undefined) =>
  !g || g.kind === 'none' ? __i18n_k("league.parent.goalText.9820aee8") : g.kind === 'fans' ? __i18n_k("league.parent.goalText.2a3bf0a7", { value: g.fans.toLocaleString('ko-KR') }) : g.rank <= 5 ? __i18n_k("league.parent.goalText.3c946d8a", { rank: g.rank }) : __i18n_k("league.parent.goalText.b916d5ce", { rank: g.rank });

function goalMet(s: LeagueState, g: SponsorGoal, year: number): boolean {
  const u = s.user!;
  if (g.kind === 'none') return true;
  if (g.kind === 'rank') return (s.history.find((h) => h.year === year)?.table.find((x) => x.teamId === u.teamId)?.rank ?? 99) <= g.rank;
  const r = clubState(s, u.teamId).reports.find((x) => x.year === year);
  return !!r?.homeGames && r.fans / r.homeGames >= g.fans;
}

/**
 * The sponsor looks at the season against its goal. A miss may end the deal at once (the more it pays, the
 * likelier; twice in a row, likelier still): the club then signs a new sponsor this winter.
 */
export function sponsorReview(s: LeagueState, year: number) {
  const u = s.user;
  if (!u || u.settings.parentType !== 'namingRights') return;
  const c = clubState(s, u.teamId);
  const sp = c.sponsor;
  if (!sp?.goal || sp.goal.kind === 'none' || year < (sp.from ?? Infinity) || year >= sp.until) return;
  if (goalMet(s, sp.goal, year)) {
    sp.missed = 0;
    return;
  }
  sp.missed = (sp.missed ?? 0) + 1;
  const r = rng(`${s.seed}|sponsor-review|${year}`);
  const chance = (sp.risk ?? 0) * (sp.missed >= 2 ? PARENT.naming.missedTwice : 1);
  if (r() < chance) {
    sp.until = year;
    note(s, year, __i18n_k("league.parent.sponsorReview.22cf4e6f", { name: eunneun(sp.name), goalText: goalText(sp.goal) }));
    addAlert(s, { id: `sponsor-out-${year}`, date: `${year}-11-15`, kind: 'owner', title: __i18n_k("league.parent.sponsorReview.title.9b1321ba", { name: sp.name }), lines: [__i18n_k("league.parent.sponsorReview.lines.51296435", { goalText: goalText(sp.goal), missed: sp.missed }), __i18n_k("league.parent.sponsorReview.lines.dde81898")], tone: 'bad' });
  } else {
    note(s, year, __i18n_k("league.parent.sponsorReview.d7ce5cf5", { name: sp.name, goalText: goalText(sp.goal), missed: sp.missed }));
    addAlert(s, { id: `sponsor-warn-${year}`, date: `${year}-11-15`, kind: 'owner', title: __i18n_k("league.parent.sponsorReview.title.4b5ff793", { name: sp.name }), lines: [__i18n_k("league.parent.sponsorReview.lines.e3f9700d", { goalText: goalText(sp.goal), missed: sp.missed })], tone: 'bad' });
  }
}

/** Signs a naming sponsor; a new sponsor renames the club ("<sponsor> <nickname>"). */
export function signSponsor(s: LeagueState, offer: SponsorOffer, year: number) {
  const u = s.user!;
  const c = clubState(s, u.teamId);
  const team = s.teams.find((t) => t.id === u.teamId)!;
  const renamed = offer.name !== (c.sponsor?.name ?? u.settings.parentName);
  c.sponsor = { name: offer.name, annual: offer.annual, until: year + offer.years, ...(offer.goal ? { goal: offer.goal, risk: offer.risk ?? 0, from: year + 1, missed: 0 } : {}) };
  team.parent = { ...team.parent, name: __i18n_k("league.parent.signSponsor.name.18b08fe8", { name: offer.name }) };
  if (renamed) {
    const nickname = team.name.split(' ').slice(1).join(' ') || team.name;
    const short = offer.name.slice(0, 2);
    team.name = `${short} ${nickname}`;
    team.short = short;
    note(s, year, __i18n_k("league.parent.signSponsor.352a0ed9", { name: offer.name, name2: ro(team.name), money: money(offer.annual), years: offer.years }));
  } else note(s, year, __i18n_k("league.parent.signSponsor.89bb0b43", { name: wagwa(offer.name), money: money(offer.annual), years: offer.years }));
}
