/* The owner's side (V0.6, RULES.md §13, ROADMAP 난이도 설계). Each type of owner behaves differently:

   - 대기업 계열: the largest support, the highest expectations and the shortest patience; the group's
     own year moves the money (±10%).
   - 강소·중견기업: less money, but a club that wins and pays its way is rewarded for good.
   - 명명권 스폰서: no parent. A naming sponsor pays a fee for a few years; when the deal ends the club
     renews or signs another sponsor, and the club takes the sponsor's name. An investor covers little.
   - 시민구단: the city council reviews the budget every winter (and a new mayor after a local election
     can change it); fans are loyal.

   Every season the owner sets goals (a finish, a crowd, a deficit it accepts) and judges them in the
   winter: next year's support and payroll budget move with the score, and so does its trust in the
   general manager. Firing is a setting and off in the sandbox. */
import { rng } from '../draftroom';
import type { ParentCompanyType } from '../club/types';
import { clubState } from './fans';
import { ro, wagwa } from './josa';
import { firstTeamIds, type Evaluation, type LeagueState, type SeasonGoals } from './state';
import { PARENT } from './tuning';

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
  const rank = seasonsIn < 2 ? clubs : Math.min(clubs, PARENT.rankGoal[type] + (seasonsIn < 4 ? 2 : 0));
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
  const trust = Math.max(0, Math.min(100, (u.trust ?? PARENT.startTrust) + score * PARENT.trustStep[type] + (champion ? 15 : 0)));
  u.trust = trust;
  const ev: Evaluation = { year, score, lines: lines.map(({ w: _w, ...l }) => l), change, trust };
  (u.evaluations ??= []).push(ev);
  applyBudgetChange(s, change);
  if (u.settings.firing && trust < PARENT.fireBelow && year - u.firstTeamYear >= 2) u.fired = year;
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
    // Local elections every four years from 2026 (June): a new mayor may cut or raise the budget.
    if ((year - 2026) % 4 === 0 && year >= 2026) {
      const swing = r() < 0.5 ? -PARENT.election : PARENT.election;
      applyBudgetChange(s, swing);
      note(s, year, `지방선거 뒤 새 시장이 구단 예산을 ${swing > 0 ? '늘렸' : '줄였'}습니다`);
    }
    const avg = report?.homeGames ? report.fans / report.homeGames : 0;
    const team = s.teams.find((t) => t.id === u.teamId)!;
    const full = avg / team.stadium.capacity;
    const verdict = full >= 0.75 ? 0.05 : full < 0.45 ? -0.05 : 0;
    if (verdict) {
      applyBudgetChange(s, verdict);
      note(s, year, `시의회 예산 심의: 관중 ${verdict > 0 ? '호조로 증액' : '부진으로 삭감'}`);
    } else note(s, year, '시의회 예산 심의: 원안 통과');
  }
  return 1;
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

const SPONSORS = ['한빛증권', '대한생명', '새솔은행', '누리통신', '다온캐피탈', '한결제약', '미래에셋투자', '온누리게임즈', '태평양물산', '청운건설'];

/** Offers when a naming deal ends: the current sponsor's renewal and one or two newcomers. */
export function sponsorOffers(s: LeagueState, year: number): { name: string; annual: number; years: number }[] {
  const u = s.user!;
  const c = clubState(s, u.teamId);
  const r = rng(`${s.seed}|sponsor|${year}`);
  const table = s.history.find((h) => h.year === year)?.table ?? [];
  const rank = table.find((x) => x.teamId === u.teamId)?.rank ?? 6;
  const worth = PARENT.naming.base * (0.7 + (c.popularity / 20_000) * 0.4 + c.interest * 0.4 + (6 - rank) * 0.02);
  const current = c.sponsor?.name ?? u.settings.parentName;
  const offers = [{ name: current, annual: Math.round((worth * (0.95 + r() * 0.1)) / 1000) * 1000, years: 5 }];
  const others = SPONSORS.filter((x) => x !== current);
  for (let i = 0; i < 2; i++) {
    const name = others.splice(Math.floor(r() * others.length), 1)[0]!;
    offers.push({ name, annual: Math.round((worth * (0.85 + r() * 0.35)) / 1000) * 1000, years: 3 + Math.floor(r() * 3) });
  }
  return offers;
}

/** Signs a naming sponsor; a new sponsor renames the club ("<sponsor> <nickname>"). */
export function signSponsor(s: LeagueState, offer: { name: string; annual: number; years: number }, year: number) {
  const u = s.user!;
  const c = clubState(s, u.teamId);
  const team = s.teams.find((t) => t.id === u.teamId)!;
  const renamed = offer.name !== (c.sponsor?.name ?? u.settings.parentName);
  c.sponsor = { name: offer.name, annual: offer.annual, until: year + offer.years };
  team.parent = { ...team.parent, name: `${offer.name} (명명권)` };
  if (renamed) {
    const nickname = team.name.split(' ').slice(1).join(' ') || team.name;
    const short = offer.name.slice(0, 2);
    team.name = `${short} ${nickname}`;
    team.short = short;
    note(s, year, `새 명명권 스폰서 ${offer.name}: 구단명이 ${ro(team.name)} 바뀝니다 (연 ${money(offer.annual)}, ${offer.years}년)`);
  } else note(s, year, `${wagwa(offer.name)} 명명권 재계약 (연 ${money(offer.annual)}, ${offer.years}년)`);
}
