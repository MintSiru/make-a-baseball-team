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

const money = (n: number) => `${Math.round(n / 10000)}억`;

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
    { label: '성적', ok: rank <= g.rank, text: `${rank}위 (목표 ${g.rank}위 이내)`, w: W.rank },
    { label: '관중', ok: avg >= g.fans, text: `경기당 ${avg.toLocaleString('ko-KR')}명 (목표 ${g.fans.toLocaleString('ko-KR')}명)`, w: W.fans },
    { label: '재정', ok: result >= g.result, text: `운영 결과 ${money(result)} (허용 ${money(g.result)})`, w: W.money },
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
      note(s, year, '그룹 실적 호조로 내년 지원금이 10% 늘었습니다');
      return 1 + PARENT.groupSwing.size;
    }
    if (x < PARENT.groupSwing.chance * 2) {
      note(s, year, '그룹 실적 부진으로 내년 지원금이 10% 줄었습니다');
      return 1 - PARENT.groupSwing.size;
    }
  }
  if (type === 'midsize' && report && report.operating >= 0) {
    applyBudgetChange(s, PARENT.midsizeReward);
    note(s, year, '흑자 운영에 모기업이 지원을 늘리기로 했습니다');
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
      note(s, year, `시의회 예산 심의: 관중 ${verdict > 0 ? '호조로 증액' : '부진으로 삭감'}`);
    } else note(s, year, '시의회 예산 심의: 원안 통과');
    return factor;
  }
  return 1;
}

// ── Citizen club: the mayor and the council (V0.7.7) ─────────────────────────────────────────────────

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권'];
const GIVEN = ['영수', '민호', '정훈', '성진', '현철', '지영', '수연', '동욱', '재형', '상민', '경호', '은정', '태식', '미경', '준석'];
export const STANCE_LABEL: Record<Mayor['stance'], string> = { friendly: '우호적', neutral: '중립', hostile: '적대적' };

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
    note(s, year, '적자가 컸지만 시의회가 이번에는 넘어갔습니다');
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
  const why = big && lasting ? `큰 적자가 ${deficitYears(s, year)}년째 이어져` : big ? `올해 적자(${money(deficitOf(s, year))})가 지원 한도를 넘어` : `적자가 ${deficitYears(s, year)}년째 이어져`;
  note(s, year, `${ev.title}: ${why}`);
  addAlert(s, { id: `council-${year}`, date: `${year}-12-10`, kind: 'owner', title: ev.title, lines: [`${why} ${ev.text}`, `시장 ${u.mayor!.name} (${STANCE_LABEL[u.mayor!.stance]})`], tone: 'bad' });
  return factor;
}

function mayorAlert(s: LeagueState, year: number, now: Mayor, before: Mayor) {
  const same = now.name === before.name;
  const lines = [
    same ? `${now.name} 시장이 다시 당선됐습니다 (${now.until}년까지).` : `새 시장 ${now.name} (${now.since}~${now.until}년).`,
    `구단에 ${STANCE_LABEL[now.stance]}: ${now.stance === 'friendly' ? '지원을 아끼지 않습니다 (지원 한도 +15%)' : now.stance === 'hostile' ? '구단 지원을 줄이려 합니다 (지원 한도 −15%, 적자에 더 엄격)' : '지원은 예전 그대로입니다'}.`,
  ];
  note(s, year, `${year} 지방선거: ${lines[0]} 성향 ${STANCE_LABEL[now.stance]}`);
  addAlert(s, { id: `mayor-${year}`, date: `${year}-12-05`, kind: 'owner', title: same ? `${now.name} 시장 재선` : `새 시장 ${now.name} 취임`, lines, tone: now.stance === 'friendly' ? 'good' : now.stance === 'hostile' ? 'bad' : undefined });
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
const SPONSORS = ['한빛증권', '한누리생명', '새솔은행', '누리통신', '다온캐피탈', '한결제약', '새벽투자', '온누리게임즈', '태평양물산', '청운건설'];

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
  !g || g.kind === 'none' ? '조건 없음' : g.kind === 'fans' ? `경기당 관중 ${g.fans.toLocaleString('ko-KR')}명` : g.rank <= 5 ? `가을야구 (${g.rank}위 이내)` : `${g.rank}위 이내`;

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
    note(s, year, `${eunneun(sp.name)} 목표(${goalText(sp.goal)}) 미달을 이유로 명명권 계약을 해지했습니다`);
    addAlert(s, { id: `sponsor-out-${year}`, date: `${year}-11-15`, kind: 'owner', title: `${sp.name} 명명권 계약 해지`, lines: [`목표 ${goalText(sp.goal)}을 ${sp.missed}년 연속 채우지 못해 스폰서가 계약을 끝냈습니다.`, '이번 겨울에 새 스폰서를 구해야 합니다.'], tone: 'bad' });
  } else {
    note(s, year, `${sp.name}: 목표(${goalText(sp.goal)}) 미달, 계약은 유지 (${sp.missed}년 연속)`);
    addAlert(s, { id: `sponsor-warn-${year}`, date: `${year}-11-15`, kind: 'owner', title: `${sp.name}, 목표 미달에 불만`, lines: [`목표 ${goalText(sp.goal)}을 채우지 못했습니다 (${sp.missed}년 연속). 계약은 이어가지만, 또 못 채우면 해지할 수 있습니다.`], tone: 'bad' });
  }
}

/** Signs a naming sponsor; a new sponsor renames the club ("<sponsor> <nickname>"). */
export function signSponsor(s: LeagueState, offer: SponsorOffer, year: number) {
  const u = s.user!;
  const c = clubState(s, u.teamId);
  const team = s.teams.find((t) => t.id === u.teamId)!;
  const renamed = offer.name !== (c.sponsor?.name ?? u.settings.parentName);
  c.sponsor = { name: offer.name, annual: offer.annual, until: year + offer.years, ...(offer.goal ? { goal: offer.goal, risk: offer.risk ?? 0, from: year + 1, missed: 0 } : {}) };
  team.parent = { ...team.parent, name: `${offer.name} (명명권)` };
  if (renamed) {
    const nickname = team.name.split(' ').slice(1).join(' ') || team.name;
    const short = offer.name.slice(0, 2);
    team.name = `${short} ${nickname}`;
    team.short = short;
    note(s, year, `새 명명권 스폰서 ${offer.name}: 구단명이 ${ro(team.name)} 바뀝니다 (연 ${money(offer.annual)}, ${offer.years}년)`);
  } else note(s, year, `${wagwa(offer.name)} 명명권 재계약 (연 ${money(offer.annual)}, ${offer.years}년)`);
}
