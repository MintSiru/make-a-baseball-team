/* Moving players during the year (V0.5, RULES.md §5–6): trades until July 31 and after the season,
   releases through seven-day waivers, unattached players anyone can sign, and replacing foreign
   players during the season (twice a year, until August 15).

   AI clubs judge every move by public grades only: a player is worth his keep value above a
   replacement level, more the longer he is under club control, less the more he is paid. */
import { ro } from './josa';
import { rng } from '../draftroom';
import type { Player, PlayerId, TeamId } from '../model/types';
import { KBO_2026, minimumSalaryFor } from '../rules/kbo2026';
import { foreignContract, renewSalary, salaryIn } from './contracts';
import { today } from './entry';
import { splitContract } from './foreign';
import { movePlayer } from './market';
import { leaveLeague, removeFromRoster, rosterLimit } from './offseason';
import { ageIn, currentValue, isForeign, isPitcher, keepValue, makeForeign } from './players';
import { currentStandings } from './season';
import { firstTeamIds, orgPlayers, registeredIds, type LeagueState } from './state';
import { TRADES } from './tuning';
import { moveNews } from './movenews';

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
const shortOf = (s: LeagueState, id: TeamId | null) => s.teams.find((t) => t.id === id)?.short ?? '-';

export function logTransaction(s: LeagueState, text: string) {
  (s.transactions ??= []).push({ date: s.phase === 'regular' ? today(s) : `${s.year}-11-01`, text });
  if (s.transactions.length > TRADES.logSize) s.transactions.splice(0, s.transactions.length - TRADES.logSize);
}

// ── Value ────────────────────────────────────────────────────────────────────────────────────────

const faSeasons = (p: Player) => (p.origin.entryCategory === 'college' ? KBO_2026.freeAgency.seasonsCollege : KBO_2026.freeAgency.seasonsHighSchool);

/** Seasons the club controls him: his contract, or until he reaches free agency. */
function control(s: LeagueState, p: Player) {
  const years = p.contract?.salaries.filter((x) => x.season >= s.year).length ?? 1;
  const toFa = p.service.lastFreeAgencyAt === undefined ? faSeasons(p) - p.service.creditedSeasons : years;
  return Math.max(1, Math.min(6, Math.max(years, toFa)));
}

/** What a club thinks a player is worth in a trade (public grades, age, control, salary). */
export function tradeValue(s: LeagueState, p: Player): number {
  const T = TRADES.value;
  const above = Math.max(0, keepValue(p, s.year) - T.replacement);
  const ctl = Math.min(1, T.controlBase + T.controlPerYear * control(s, p));
  const age = ageIn(p, s.year) >= T.oldFrom ? T.oldFactor : 1;
  const pay = (salaryIn(p, s.year) || salaryIn(p, s.year + 1)) / 10000;
  return Math.round((above ** T.power * ctl * age - pay * T.perEok) * 10) / 10;
}

// ── Trades ───────────────────────────────────────────────────────────────────────────────────────

/** Trades are open during the season until July 31 and again once the season is over. */
export function tradeWindow(s: LeagueState): string | null {
  if (s.pending) return '먼저 결정할 일을 끝내세요.';
  if (s.phase === 'regular' && today(s) > `${s.year}-${KBO_2026.trade.deadline}`) return '7월 31일 트레이드 마감이 지났습니다. 한국시리즈가 끝나면 다시 열립니다.';
  if (s.phase === 'offseason') return '오프시즌 진행 중에는 트레이드할 수 없습니다.';
  return null;
}

export interface TradeCheck {
  problem: string | null;
  /** Value the other club gets minus what it gives up (its view). */
  margin: number;
  accepted: boolean;
}

export function checkTrade(s: LeagueState, teamId: TeamId, give: PlayerId[], get: PlayerId[]): TradeCheck {
  const u = s.user;
  const no = (problem: string): TradeCheck => ({ problem, margin: 0, accepted: false });
  if (!u) return no('구단이 없습니다.');
  const closed = tradeWindow(s);
  if (closed) return no(closed);
  if (teamId === u.teamId || !s.rosters[teamId]) return no('상대 구단을 고르세요.');
  if (!give.length || !get.length) return no('주고받을 선수를 한 명 이상 고르세요.');
  const gives = give.map((id) => s.players[id]);
  const gets = get.map((id) => s.players[id]);
  if (gives.some((p) => !p || p.teamId !== u.teamId || p.status !== 'active')) return no('우리 선수만 보낼 수 있습니다.');
  if (gets.some((p) => !p || p.teamId !== teamId || p.status !== 'active')) return no('상대 구단 선수만 받을 수 있습니다.');
  if ([...gives, ...gets].some((p) => isForeign(p!))) return no('외국인 선수는 트레이드할 수 없습니다 (게임 규칙).');
  if ([...gives, ...gets].some((p) => p!.proSince > s.year)) return no('올해 지명한 신인은 계약 첫해가 시작되기 전에는 트레이드할 수 없습니다 (게임 규칙).');
  const devCount = (xs: typeof gives) => xs.filter((p) => p!.contract?.kind === 'development').length;
  const limit = rosterLimit(s.phase === 'regular' ? s.year : s.year + 1);
  const mine = registeredIds(s, u.teamId).length - (give.length - devCount(gives)) + (get.length - devCount(gets));
  const theirs = registeredIds(s, teamId).length - (get.length - devCount(gets)) + (give.length - devCount(gives));
  if (mine > limit) return no(`받으면 우리 소속선수가 ${limit}명을 넘습니다.`);
  if (theirs > limit) return no(`상대 구단 소속선수가 ${limit}명을 넘게 됩니다.`);
  const inValue = gives.reduce((a, p) => a + tradeValue(s, p!), 0);
  const outValue = gets.reduce((a, p) => a + tradeValue(s, p!), 0);
  const margin = Math.round((inValue - outValue * TRADES.accept.premium - TRADES.accept.fixed) * 10) / 10;
  return { problem: null, margin, accepted: margin >= 0 };
}

export function makeTrade(s: LeagueState, teamId: TeamId, give: PlayerId[], get: PlayerId[]) {
  const c = checkTrade(s, teamId, give, get);
  if (c.problem) throw new Error(c.problem);
  const u = s.user!;
  if (!c.accepted) {
    (u.log ??= []).push({ year: s.year, text: `${shortOf(s, teamId)}에 트레이드 제안 → 거절` });
    return false;
  }
  for (const id of give) movePlayer(s, s.players[id]!, teamId);
  for (const id of get) movePlayer(s, s.players[id]!, u.teamId);
  const names = (ids: PlayerId[]) => ids.map((id) => s.players[id]!.name).join('·');
  const text = `트레이드: ${shortOf(s, u.teamId)} ${names(give)} ↔ ${shortOf(s, teamId)} ${names(get)}`;
  (u.log ??= []).push({ year: s.year, text });
  logTransaction(s, text);
  moveNews(s, { type: 'trade', a: u.teamId, b: teamId, fromA: give, fromB: get });
  return true;
}

/** A few trades between AI clubs each season: depth at one spot for need at another, at even value. */
export function aiTrades(s: LeagueState, r: () => number) {
  const clubs = firstTeamIds(s).filter((id) => id !== s.user?.teamId);
  const spots = (teamId: TeamId) => {
    const ps = registeredIds(s, teamId)
      .map((id) => s.players[id]!)
      .filter((p) => !isForeign(p) && p.proSince <= s.year && p.contract?.kind !== 'development');
    return ps;
  };
  const groupOf = (p: Player) => (isPitcher(p) ? p.role : p.position ?? 'DH');
  for (let k = 0; k < TRADES.ai.perSeason; k++) {
    if (r() > TRADES.ai.chance) continue;
    const a = clubs[Math.floor(r() * clubs.length)]!;
    const b = clubs[Math.floor(r() * clubs.length)]!;
    if (a === b) continue;
    // A's third-best at some spot for B's surplus at another, within 15% of each other's value.
    const fromA = spots(a)
      .filter((p) => spots(a).filter((q) => groupOf(q) === groupOf(p) && currentValue(q) >= currentValue(p)).length >= 3)
      .sort((x, y) => tradeValue(s, y) - tradeValue(s, x))[0];
    if (!fromA) continue;
    const need = groupOf(fromA);
    const fromB = spots(b)
      .filter((p) => groupOf(p) !== need)
      .map((p) => ({ p, gap: Math.abs(tradeValue(s, p) - tradeValue(s, fromA)) }))
      .filter((x) => x.gap <= Math.max(2, tradeValue(s, fromA) * 0.15))
      .sort((x, y) => x.gap - y.gap)[0]?.p;
    if (!fromB) continue;
    movePlayer(s, fromA, b);
    movePlayer(s, fromB, a);
    logTransaction(s, `트레이드: ${shortOf(s, a)} ${fromA.name} ↔ ${shortOf(s, b)} ${fromB.name}`);
    moveNews(s, { type: 'trade', a, b, fromA: [fromA.id], fromB: [fromB.id] });
  }
}

// ── Releases, waivers and unattached players ─────────────────────────────────────────────────────

const seasonShareLeft = (s: LeagueState) => {
  if (s.phase !== 'regular' || !s.schedule.length) return 0;
  return Math.max(0, (s.schedule.length - s.next) / s.schedule.length);
};

/** What the club still owes when it lets him go: the rest of this season's pay and any later guaranteed seasons. */
export function releaseCost(s: LeagueState, p: Player) {
  const now = Math.round(salaryIn(p, s.year) * seasonShareLeft(s));
  const later = (p.contract?.salaries ?? []).filter((x) => x.season > s.year);
  return { now, later: later.map((x) => ({ season: x.season, amount: x.amount })) };
}

export function canRelease(s: LeagueState, id: PlayerId): string | null {
  const u = s.user;
  const p = s.players[id];
  if (!u || !p || p.teamId !== u.teamId || p.status !== 'active') return '우리 선수가 아닙니다.';
  if (s.pending || s.phase === 'offseason') return '지금은 방출할 수 없습니다.';
  if (s.phase === 'regular' && s.rosters[u.teamId]!.active.includes(id) && s.rosters[u.teamId]!.active.length <= 26) return '1군 최소 인원 때문에 먼저 다른 선수를 올리세요.';
  return null;
}

/** Releases a user's player: during the season he goes on waivers for seven days; after it he is free at once. */
export function releasePlayer(s: LeagueState, id: PlayerId) {
  const problem = canRelease(s, id);
  if (problem) throw new Error(problem);
  const u = s.user!;
  const p = s.players[id]!;
  const cost = releaseCost(s, p);
  const owed = [...(cost.now ? [{ season: s.year, amount: cost.now }] : []), ...cost.later];
  for (const x of owed) (u.deadMoney ??= []).push({ season: x.season, amount: x.amount, label: `${p.name} 잔여 연봉` });
  removeFromRoster(s, p);
  p.teamId = null;
  if (s.phase === 'regular') {
    (s.waivers ??= []).push({ id, from: u.teamId, until: addDays(today(s), KBO_2026.waiver.days) });
    (u.log ??= []).push({ year: s.year, text: `${p.name} 웨이버 공시 (${addDays(today(s), KBO_2026.waiver.days)}까지)` });
    logTransaction(s, `웨이버 공시: ${shortOf(s, u.teamId)} ${p.name}`);
  } else {
    p.contract = null;
    (s.pool ??= []).push(id);
    (u.log ??= []).push({ year: s.year, text: `${p.name} 방출 (자유계약선수)` });
  }
  moveNews(s, { type: 'release', teamId: u.teamId, id, waiver: s.phase === 'regular', owed: owed.reduce((a, x) => a + x.amount, 0) });
  if (isForeign(p)) leaveForeign(s, p);
}

function leaveForeign(s: LeagueState, p: Player) {
  s.pool = (s.pool ?? []).filter((x) => x !== p.id);
  s.waivers = (s.waivers ?? []).filter((w) => w.id !== p.id);
  leaveLeague(s, p, 'overseas');
}

/** Waivers that run out today: the weakest club by record that wants him claims him (and his contract); else he is free. */
export function processWaivers(s: LeagueState, date: string) {
  const due = (s.waivers ?? []).filter((w) => w.until <= date);
  if (!due.length) return;
  s.waivers = (s.waivers ?? []).filter((w) => w.until > date);
  const order = [...currentStandings(s)].reverse().map((r) => r.teamId);
  for (const w of due) {
    const p = s.players[w.id];
    if (!p || p.status !== 'active') continue;
    const claimer = order.find((t) => {
      if (t === w.from || t === s.user?.teamId) return false;
      if (registeredIds(s, t).length >= rosterLimit(s.year)) return false;
      const weakest = Math.min(...registeredIds(s, t).map((id) => keepValue(s.players[id]!, s.year)));
      return keepValue(p, s.year) >= weakest + TRADES.waiverMargin;
    });
    if (claimer) {
      p.teamId = claimer;
      if (p.contract) p.contract.teamId = claimer;
      s.rosters[claimer]!.futures.push(p.id);
      // The claiming club takes the contract: the releasing club no longer owes it.
      if (s.user && w.from === s.user.teamId) s.user.deadMoney = (s.user.deadMoney ?? []).filter((x) => x.label !== `${p.name} 잔여 연봉`);
      logTransaction(s, `웨이버 영입: ${shortOf(s, claimer)} ${p.name} (${shortOf(s, w.from)}에서)`);
      moveNews(s, { type: 'claim', teamId: claimer, from: w.from, id: p.id }, date);
      if (w.from === s.user?.teamId) (s.user.log ??= []).push({ year: s.year, text: `${p.name} 웨이버로 ${ro(shortOf(s, claimer))} 이적` });
    } else {
      p.contract = null;
      (s.pool ??= []).push(p.id);
    }
  }
}

/** Unattached players' asking salary for the rest of this season (or next season after it). */
export function poolAsk(s: LeagueState, p: Player) {
  const season = s.phase === 'regular' ? s.year : s.year + 1;
  const full = Math.max(minimumSalaryFor(season), renewSalary(p, season));
  return s.phase === 'regular' ? Math.max(minimumSalaryFor(season), Math.round((full * Math.max(0.3, seasonShareLeft(s))) / 100) * 100) : full;
}

export function canSignFromPool(s: LeagueState, id: PlayerId): string | null {
  const u = s.user;
  const p = s.players[id];
  if (!u || !p || !(s.pool ?? []).includes(id)) return '자유계약선수 명단에 없습니다.';
  if (s.pending || s.phase === 'offseason') return '지금은 계약할 수 없습니다.';
  if (registeredIds(s, u.teamId).length >= rosterLimit(s.phase === 'regular' ? s.year : s.year + 1)) return '소속선수 한도가 찼습니다.';
  return null;
}

export function signFromPool(s: LeagueState, id: PlayerId) {
  const problem = canSignFromPool(s, id);
  if (problem) throw new Error(problem);
  const u = s.user!;
  const p = s.players[id]!;
  const season = s.phase === 'regular' ? s.year : s.year + 1;
  p.teamId = u.teamId;
  p.contract = { teamId: u.teamId, kind: 'standard', signedIn: s.year, signingBonus: 0, salaries: [{ season, amount: poolAsk(s, p) }] };
  s.rosters[u.teamId]!.futures.push(id);
  s.pool = (s.pool ?? []).filter((x) => x !== id);
  (u.log ??= []).push({ year: s.year, text: `자유계약선수 ${p.name} 영입` });
  logTransaction(s, `자유계약선수 영입: ${shortOf(s, u.teamId)} ${p.name}`);
  moveNews(s, { type: 'pool', teamId: u.teamId, id, salary: p.contract.salaries[0]!.amount });
}

/** At the end of the season unattached players who were not signed leave the league. */
export function clearPool(s: LeagueState) {
  for (const id of s.pool ?? []) {
    const p = s.players[id];
    if (p && !p.teamId) leaveLeague(s, p, 'retired');
  }
  s.pool = [];
  s.waivers = [];
}

// ── Foreign players during the season ───────────────────────────────────────────────────────────

export function foreignWindow(s: LeagueState, teamId: TeamId): string | null {
  if (s.phase !== 'regular') return '외국인 교체는 정규시즌 중에만 할 수 있습니다.';
  if (today(s) > `${s.year}-${KBO_2026.foreign.replacementDeadline}`) return '8월 15일 외국인 교체 마감이 지났습니다.';
  if ((s.foreignChanges?.[teamId] ?? 0) >= KBO_2026.foreign.replacementsPerSeason) return `올해 외국인 교체 ${KBO_2026.foreign.replacementsPerSeason}번을 모두 썼습니다.`;
  return null;
}

/** Candidates for a mid-season signing (the same list until the club uses a replacement). */
export function foreignMarket(s: LeagueState, teamId: TeamId): Player[] {
  const used = s.foreignChanges?.[teamId] ?? 0;
  const out: Player[] = [];
  const specs: ['pitcher' | 'hitter', boolean, number][] = [
    ['pitcher', false, 5],
    ['hitter', false, 4],
    ['pitcher', true, 2],
    ['hitter', true, 1],
  ];
  let k = 0;
  for (const [kind, asia, n] of specs)
    for (let i = 0; i < n; i++) {
      const p = makeForeign(s.seed, `fm${s.year}-${teamId}-${used}-${k++}`, s.year, { kind, asiaQuota: asia });
      p.status = 'amateur';
      out.push(p);
    }
  return out;
}

/** The prorated asking price now (US dollars): new signings are capped at the full-season cap times the share left. */
export function foreignPriceNow(s: LeagueState, p: Player) {
  const share = Math.max(0.2, seasonShareLeft(s));
  return Math.round((p.origin.background!.ask * share) / 10_000) * 10_000;
}

export function canReplaceForeign(s: LeagueState, teamId: TeamId, out: PlayerId, inId: string): string | null {
  const closed = foreignWindow(s, teamId);
  if (closed) return closed;
  const old = s.players[out];
  if (!old || old.teamId !== teamId || !isForeign(old)) return '내보낼 외국인 선수를 고르세요.';
  const cand = foreignMarket(s, teamId).find((p) => p.id === inId);
  if (!cand) return '후보 명단에 없는 선수입니다.';
  if (!!cand.origin.asiaQuota !== !!old.origin.asiaQuota) return '아시아쿼터는 아시아쿼터끼리, 외국인은 외국인끼리 바꿀 수 있습니다.';
  return null;
}

/** Replaces a foreign player: the old one leaves (his guaranteed pay is still owed), the new one signs for the rest of the year. */
export function replaceForeign(s: LeagueState, teamId: TeamId, out: PlayerId, inId: string, r: () => number = rng(`${s.seed}|foreign-swap|${s.year}|${teamId}|${inId}`)) {
  const problem = canReplaceForeign(s, teamId, out, inId);
  if (problem) throw new Error(problem);
  const old = s.players[out]!;
  const p = foreignMarket(s, teamId).find((x) => x.id === inId)!;
  if (s.user?.teamId === teamId) {
    const owed = Math.round(salaryIn(old, s.year) * seasonShareLeft(s));
    if (owed) (s.user.deadMoney ??= []).push({ season: s.year, amount: owed, label: `${old.name} 잔여 연봉` });
  }
  const wasActive = s.rosters[teamId]!.active.includes(out);
  leaveForeign(s, old);
  p.status = 'active';
  p.teamId = teamId;
  p.contract = foreignContract(teamId, s.year, splitContract(foreignPriceNow(s, p), r), !!p.origin.asiaQuota);
  s.players[p.id] = p;
  s.rosters[teamId]![wasActive ? 'active' : 'futures'].push(p.id);
  (s.foreignChanges ??= {})[teamId] = (s.foreignChanges[teamId] ?? 0) + 1;
  const text = `외국인 교체: ${shortOf(s, teamId)} ${old.name} → ${p.name} (${p.origin.background!.text})`;
  logTransaction(s, text);
  moveNews(s, { type: 'foreign', teamId, out: old, in: p.id, price: foreignPriceNow(s, p) });
  if (s.user?.teamId === teamId) (s.user.log ??= []).push({ year: s.year, text });
}

/** AI clubs replace a foreign player who is failing or out for long, once around July. */
export function aiForeignChanges(s: LeagueState, date: string, r: () => number) {
  for (const teamId of firstTeamIds(s)) {
    if (teamId === s.user?.teamId || foreignWindow(s, teamId)) continue;
    const bad = orgPlayers(s, teamId)
      .filter(isForeign)
      .find((p) => {
        const line = s.lines[p.id];
        const inj = s.injuries[p.id];
        if (inj && inj.until > addDays(date, 42)) return true;
        if (isPitcher(p)) return !!line?.pit && line.pit.outs >= 120 && (27 * line.pit.er) / line.pit.outs > TRADES.foreign.badEra;
        const b = line?.bat;
        if (!b || b.pa < 180) return false;
        const ops = (b.h + b.bb + b.hbp) / Math.max(1, b.ab + b.bb + b.hbp + b.sf) + (b.h + b.d + 2 * b.t + 3 * b.hr) / Math.max(1, b.ab);
        return ops < TRADES.foreign.badOps;
      });
    if (!bad || r() > TRADES.foreign.chance) continue;
    const pick = foreignMarket(s, teamId)
      .filter((p) => !!p.origin.asiaQuota === !!bad.origin.asiaQuota && isPitcher(p) === isPitcher(bad))
      .sort((a, b) => b.scouting.current - a.scouting.current)[0];
    if (pick) replaceForeign(s, teamId, bad.id, pick.id, r);
  }
}

