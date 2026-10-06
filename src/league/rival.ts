/* The twelfth club, the rival (V0.9). The player designs it (or lets the scouts suggest one) when it is founded:
   in a set winter, or when the board puts a twelfth club to the clubs (and the player may vote it down).

   It goes through the same founding as the user's club (V0.3, the NC and KT precedents in RULES.md §8): a
   tryout, two priority picks and the first pick of every round with five extra picks in its first draft, the
   first pick of every round in its second, a futures season, then a special draft of one unprotected player
   from each first-team club (each protects 20, 10억 a player) and up to three free agents without
   compensation before its first first-team season, with one more foreign player and first-team spot for two
   seasons. This time the user's club is one of the clubs that protect and lose a player. */
import { generateDraftPool, rng } from '../draftroom';
import { CITIES, cityById } from '../club/cities';
import type { ParentCompanyType } from '../club/types';
import { fromDraftProspect, placeClass } from '../model/player';
import type { Player, PlayerId, Team, TeamId } from '../model/types';
import { EXPANSION_DEFAULTS, minimumSalaryFor } from '../rules/kbo2026';
import { addAlert } from './alerts';
import { renewSalary } from './contracts';
import { clubState } from './fans';
import { milestone } from './milestones';
import { addNews } from './news';
import { developmentContract, leaveLeague, removeFromRoster, rosterLimit, sign, type OffseasonStep } from './offseason';
import { ageIn, isForeign, keepValue } from './players';
import { MANAGER_STYLES, staffOf } from './staff';
import { developmentIds, emptyRoster, firstTeamIds, registeredIds, type Decision, type GmStyle, type LeagueState, type ManagerStyle, type RivalSettings } from './state';
import { crossing } from './rivalry';
import { farewell } from './life';
import { GM_STYLES, gmValue } from './twelve';
import { OFFSEASON, RIVAL } from './tuning';

export const RIVAL_ID = 'rival';

export const rivalTeam = (s: LeagueState) => (s.twelve ? s.teams.find((t) => t.id === s.twelve!.teamId) : undefined);
const short = (s: LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? id;
const eok = (manwon: number) => `${Math.round(manwon / 1000) / 10}억`;

// ── The founding decision ────────────────────────────────────────────────────────────────────────

// None of the fictional set's nicknames (clubs.ts), so the two never look alike (V0.16).
const NICKNAMES = ['스톰', '나이츠', '팰컨스', '썬더스', '블레이즈', '제츠', '레인저스', '스파크스', '오로라', '타이탄스'];
const COLORS = ['#0b7a75', '#7b2d8e', '#c0392b', '#1b4f9c', '#d35400', '#2e7d32', '#455a64', '#8d6e63'];
const COMPANIES = ['한빛그룹', '대륙건설', '새솔식품', '누리통신', '푸른에너지', '온누리유통'];
const GM_KEYS: GmStyle[] = ['balanced', 'develop', 'winNow', 'moneyball'];
const MANAGER_KEYS = Object.keys(MANAGER_STYLES) as ManagerStyle[];

/** Cities the twelfth club can call home: the candidates (RULES.md §12) other than the user's. */
export const rivalCities = (s: LeagueState) => CITIES.filter((c) => c.id !== s.user?.settings.cityId);

/** The scouts' suggestion: a city weighted by its market, a made-up name, owner and style. */
export function suggestRival(s: LeagueState, year: number): RivalSettings {
  const r = rng(`${s.seed}|rival-suggest|${year}`);
  const cities = rivalCities(s);
  const total = cities.reduce((a, c) => a + c.market, 0);
  let x = r() * total;
  const city = cities.find((c) => (x -= c.market) < 0) ?? cities[0]!;
  const parentType: ParentCompanyType = (['conglomerate', 'conglomerate', 'midsize', 'midsize', 'namingRights', 'citizen'] as const)[Math.floor(r() * 6)]!;
  const pickOf = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
  const mine = s.user ? s.teams.find((t) => t.id === s.user!.teamId)?.color : undefined;
  return {
    name: `${city.name} ${pickOf(NICKNAMES)}`,
    short: city.name,
    color: pickOf(COLORS.filter((c) => c !== mine)),
    cityId: city.id,
    parentType,
    parentName: parentType === 'citizen' ? `${city.name}시` : pickOf(COMPANIES),
    gm: pickOf(GM_KEYS),
    manager: pickOf(MANAGER_KEYS),
    format: 'single',
  };
}

/** The founding decision this winter, if a twelfth club comes now. */
export function rivalDecision(s: LeagueState, year: number): Decision | null {
  const u = s.user;
  const set = u?.settings.twelve;
  if (!u || !set || set.mode === 'off' || s.twelve) return null;
  // The user's club is in the first team before the twelfth club's special draft.
  if (year < u.firstTeamYear) return null;
  if (set.mode === 'year') return year >= (set.year ?? Infinity) ? { kind: 'rival', year, event: false, suggestion: suggestRival(s, year) } : null;
  const E = RIVAL.event;
  if (year < u.firstTeamYear + E.after) return null;
  if ((u.twelveNo ?? []).some((y) => year - y < E.again)) return null;
  if (rng(`${s.seed}|twelve-event|${year}`)() >= E.chance) return null;
  return { kind: 'rival', year, event: true, suggestion: suggestRival(s, year) };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function checkRival(s: LeagueState, d: Extract<Decision, { kind: 'rival' }>, settings: RivalSettings | null): string | null {
  if (!settings) return d.event ? null : '창단 연도를 정해 두었으므로 창단을 막을 수 없습니다.';
  const name = settings.name.trim(),
    sh = settings.short.trim();
  if (name.length < 2 || name.length > 12) return '구단명은 2~12자로 정하세요.';
  if (sh.length < 1 || sh.length > 4) return '약칭은 1~4자로 정하세요.';
  if (s.teams.some((t) => t.name === name || t.short === sh)) return '다른 구단과 같은 이름이나 약칭입니다.';
  if (!rivalCities(s).some((c) => c.id === settings.cityId)) return '연고지를 고르세요 (우리 구단과 같은 도시는 안 됩니다).';
  if (!HEX.test(settings.color)) return '구단 색을 고르세요.';
  if (!settings.parentName.trim() || settings.parentName.trim().length > 20) return '모기업(운영 주체) 이름을 20자 안으로 정하세요.';
  if (!(settings.gm in GM_STYLES) || !(settings.manager in MANAGER_STYLES) || !['single', 'two'].includes(settings.format)) return '운영 방식을 고르세요.';
  return null;
}

/** Applies the founding decision: the club is founded, or the board votes it down this winter. */
export function resolveRival(s: LeagueState, d: Extract<Decision, { kind: 'rival' }>, settings: RivalSettings | null) {
  const u = s.user!;
  if (!settings) {
    (u.twelveNo ??= []).push(d.year);
    addNews(s, {
      date: `${d.year}-12-10`,
      kind: 'season',
      title: 'KBO 이사회, 12구단 창단 안건 부결',
      body: `KBO 이사회가 12번째 구단 창단 신청을 표결에 부쳤으나 부결됐다. 리그는 당분간 11구단 체제로 간다.`,
      quotes: [],
      facts: { year: d.year, result: '부결' },
      players: [],
      mine: true,
    });
    return;
  }
  foundRival(s, settings, d.year);
}

/** Founds the twelfth club in the winter of `year`: futures next season, the first team the one after. */
export function foundRival(s: LeagueState, settings: RivalSettings, year: number) {
  const city = cityById(settings.cityId)!;
  const firstTeam = year + 2;
  // The city fixes up its ballpark for the first team (game assumption, at least 12,000 seats).
  const seats = Math.max(city.stadium.seats, RIVAL.minSeats);
  const team: Team = {
    id: RIVAL_ID,
    name: settings.name.trim(),
    short: settings.short.trim(),
    color: settings.color,
    region: city.name,
    kind: 'expansion',
    founded: year,
    firstTeamFrom: firstTeam,
    benefitsUntil: firstTeam + EXPANSION_DEFAULTS.benefitSeasons - 1,
    parent: { type: settings.parentType, name: settings.parentName.trim() },
    stadium: { name: city.stadium.real ? city.stadium.name : `${city.name}야구장`, size: seats < 15_000 ? 'small' : 'medium', capacity: seats, ownership: 'municipalLease' },
  };
  s.teams.push(team);
  s.rosters[RIVAL_ID] = emptyRoster();
  s.twelve = { teamId: RIVAL_ID, cityId: city.id, founded: year, firstTeam, format: settings.format, gm: settings.gm, manager: settings.manager };
  clubState(s, RIVAL_ID);
  const staff = staffOf(s, RIVAL_ID);
  staff.manager.style = settings.manager;
  const signed = rivalTryout(s, year);
  const date = `${year}-12-10`;
  const format = settings.format === 'two' ? '드림·매직 양대 리그' : '12구단 단일 리그';
  addNews(s, {
    date,
    kind: 'season',
    title: `12번째 구단 '${team.name}' 창단 승인`,
    body:
      `KBO 이사회가 ${city.name}을 연고로 하는 ${team.name}의 창단을 승인했다. ${team.parent.name}이 운영을 맡고, 홈구장은 ${team.stadium.name}(${seats.toLocaleString('ko-KR')}석)이다. ` +
      `${year + 1}년 퓨처스리그를 거쳐 ${firstTeam}년 1군에 들어오며, 그때부터 리그는 ${format}로 치러진다. 트라이아웃으로 ${signed}명과 계약했고, 올겨울 신인 드래프트에서 우선지명 2명과 매 라운드 첫 지명권을 받는다. ` +
      `구단은 '${GM_STYLES[settings.gm].label}' 운영을 내걸었고, 초대 감독은 ${staff.manager.name}(${MANAGER_STYLES[settings.manager].label})이다.`,
    quotes: [],
    facts: { club: team.name, city: city.name, firstTeam, format, gm: GM_STYLES[settings.gm].label },
    players: [],
    mine: true,
  });
  addAlert(s, {
    id: `rival-founded-${year}`,
    date,
    kind: 'season',
    title: `12구단 ${team.name} 창단`,
    lines: [
      `${city.name} 연고, ${year + 1} 퓨처스 → ${firstTeam} 1군 진입, ${format}`,
      `${year + 1}년 겨울 특별지명: 우리 구단도 보호선수 ${EXPANSION_DEFAULTS.specialDraft.protected}명을 뺀 선수 1명을 내줄 수 있습니다 (보상금 ${eok(EXPANSION_DEFAULTS.specialDraft.feePerPlayer)}).`,
    ],
  });
  milestone(s, year, `12구단 ${team.name} 창단 (${city.name}) — 우리의 라이벌`, 'rivalFounded');
}

/** The founding tryout: independent-league players, returnees from abroad and young players let go this year. */
function rivalTryout(s: LeagueState, year: number): number {
  const seed = `${s.seed}|tryout|${RIVAL_ID}|${year}`;
  const next = year + 1;
  const gm = s.twelve!.gm;
  const pool = placeClass(
    generateDraftPool(seed)
      .players.filter((p) => ['독립구단', '해외독립 복귀', '마이너 복귀', '대졸'].includes(p.pathway) && p.age >= 21)
      .map((p) => fromDraftProspect(p, year, seed))
      .map((p) => ({ ...p, id: `rt${year}-${p.origin.sourceId}` })),
    seed,
  );
  const released = Object.values(s.players).filter((p) => p.status === 'retired' && p.career.length && (p.career.at(-1)?.year ?? 0) >= year - 1 && ageIn(p, next) <= 33);
  const chosen = [...released, ...pool].sort((a, b) => gmValue(b, next, gm) - gmValue(a, next, gm)).slice(0, RIVAL.tryout);
  for (const p of chosen) {
    p.proSince = Math.max(p.proSince, next);
    sign(s, p, RIVAL_ID, {
      teamId: RIVAL_ID,
      kind: 'standard',
      signedIn: year,
      signingBonus: 0,
      salaries: [{ season: next, amount: p.career.length ? renewSalary(p, next) : minimumSalaryFor(next) }],
    });
  }
  return chosen.length;
}

// ── The special draft ────────────────────────────────────────────────────────────────────────────

/** Players a club must put on the special draft's lists: domestic, at least a year in, not this winter's free agents. */
export const specialEligible = (s: LeagueState, teamId: TeamId, next: number): Player[] =>
  registeredIds(s, teamId)
    .map((id) => s.players[id]!)
    .filter((p) => !isForeign(p) && p.proSince < next && !(p.contract?.kind === 'freeAgent' && p.contract.signedIn === next - 1));

/** The winter before the twelfth club's first first-team season: the user's club protects its 20. */
export function rivalProtectDecision(s: LeagueState, next: number): Decision | null {
  const tw = s.twelve,
    u = s.user;
  if (!tw || !u || tw.firstTeam !== next || tw.picks || !firstTeamIds(s, next - 1).includes(u.teamId)) return null;
  const P = EXPANSION_DEFAULTS.specialDraft;
  const candidates = specialEligible(s, u.teamId, next);
  if (candidates.length <= P.protected) return null;
  return { kind: 'rivalProtect', candidates: candidates.map((p) => p.id), protect: P.protected, fee: P.feePerPlayer };
}

export function checkRivalProtect(d: Extract<Decision, { kind: 'rivalProtect' }>, ids: PlayerId[]): string | null {
  if (ids.some((id) => !d.candidates.includes(id))) return '보호할 수 없는 선수입니다.';
  if (new Set(ids).size !== ids.length) return '같은 선수를 두 번 골랐습니다.';
  if (ids.length > d.protect) return `보호선수는 ${d.protect}명까지입니다.`;
  return null;
}

/** Stores the list; places left open are filled by the scouts, most valuable first. */
export function resolveRivalProtect(s: LeagueState, d: Extract<Decision, { kind: 'rivalProtect' }>, ids: PlayerId[]) {
  if (!s.offseason) return;
  const next = s.offseason.year + 1;
  const rest = autoProtect(s, d, next).filter((id) => !ids.includes(id));
  s.offseason.rivalProtect = [...ids, ...rest].slice(0, Math.max(ids.length, d.protect));
}

/** The scouts' 20: the most valuable to keep. */
export const autoProtect = (s: LeagueState, d: Extract<Decision, { kind: 'rivalProtect' }>, next: number) =>
  [...d.candidates].sort((a, b) => keepValue(s.players[b]!, next) - keepValue(s.players[a]!, next)).slice(0, d.protect);

/** The twelfth club takes one unprotected player from each first-team club and pays each club 10억. */
export function rivalSpecialDraft(s: LeagueState, next: number) {
  const tw = s.twelve;
  if (!tw || tw.firstTeam !== next || tw.picks) return;
  const P = EXPANSION_DEFAULTS.specialDraft;
  const u = s.user;
  const picks: { from: TeamId; id: PlayerId; name: string }[] = [];
  for (const teamId of firstTeamIds(s, next - 1)) {
    if (teamId === tw.teamId) continue;
    const eligible = specialEligible(s, teamId, next);
    const mine = teamId === u?.teamId;
    const kept = new Set(
      mine && s.offseason?.rivalProtect
        ? s.offseason.rivalProtect
        : [...eligible]
            .sort((a, b) => keepValue(b, next) - keepValue(a, next))
            .slice(0, P.protected)
            .map((p) => p.id),
    );
    const p = eligible.filter((x) => !kept.has(x.id)).sort((a, b) => gmValue(b, next, tw.gm) - gmValue(a, next, tw.gm))[0];
    if (!p) continue;
    removeFromRoster(s, p);
    p.teamId = tw.teamId;
    if (p.contract) p.contract.teamId = tw.teamId;
    s.rosters[tw.teamId]!.futures.push(p.id);
    picks.push({ from: teamId, id: p.id, name: p.name });
    if (mine) {
      crossing(s, p, teamId, tw.teamId, '특별지명', `${next - 1}-11-28`, false);
      farewell(s, p, teamId, '특별지명', `${next - 1}-11-28`);
    }
    if (mine && u) {
      u.fund += P.feePerPlayer;
      u.ledger.push({ year: next - 1, label: `특별지명 보상금 수령 · ${p.name} (${short(s, tw.teamId)})`, amount: P.feePerPlayer });
      (u.log ??= []).push({ year: next - 1, text: `${p.name}, 12구단 ${short(s, tw.teamId)} 특별지명으로 이적 (보상금 ${eok(P.feePerPlayer)})` });
    }
  }
  tw.picks = picks;
  const team = rivalTeam(s)!;
  const date = `${next - 1}-11-28`;
  const ours = picks.find((x) => x.from === u?.teamId);
  addNews(s, {
    date,
    kind: 'move',
    title: `${team.short}, 특별지명으로 ${picks.length}명 영입${ours ? ` · ${ours.name}도 떠나` : ''}`,
    body: `${team.name}가 기존 구단의 보호선수 ${P.protected}명 외 선수를 한 명씩 지명했다(선수당 보상금 ${eok(P.feePerPlayer)}). ${picks.map((x) => `${short(s, x.from)} ${x.name}`).join(', ')}.`,
    quotes: [],
    facts: { type: '특별지명', club: team.name, count: picks.length },
    players: picks.map((x) => x.id),
    mine: true,
  });
  if (ours)
    addAlert(s, {
      id: `rival-special-${next}`,
      date,
      kind: 'season',
      title: `특별지명 · ${ours.name} ${team.short}행`,
      lines: [
        `${team.name}가 보호선수 밖의 ${ours.name}을(를) 지명했습니다. 보상금 ${eok(P.feePerPlayer)}을 받았습니다.`,
        ...picks.filter((x) => x !== ours).map((x) => `${short(s, x.from)} ${x.name}`),
      ],
      tone: 'bad',
      players: [ours.id],
    });
}

// ── Filling the roster ───────────────────────────────────────────────────────────────────────────

/** In its founding winter and the one before its first-team debut, the twelfth club looks at the players the
    other clubs let go before anyone else (after the user's club). */
export function rivalFill(s: LeagueState, next: number) {
  const tw = s.twelve,
    o = s.offseason;
  if (!tw || !o || next > tw.firstTeam) return;
  const F = RIVAL.fill;
  const room = (next === tw.firstTeam ? F.entering : F.founding) - registeredIds(s, tw.teamId).length;
  if (room <= 0) return;
  const pick = o.released
    .map((id) => s.players[id])
    .filter((p): p is Player => !!p && !p.teamId && keepValue(p, next) >= F.minValue && ageIn(p, next) <= F.maxAge)
    .sort((a, b) => gmValue(b, next, tw.gm) - gmValue(a, next, tw.gm))
    .slice(0, room);
  for (const p of pick) sign(s, p, tw.teamId, { teamId: tw.teamId, kind: 'standard', signedIn: next - 1, signingBonus: 0, salaries: [{ season: next, amount: renewSalary(p, next) }] });
  const taken = new Set(pick.map((p) => p.id));
  o.released = o.released.filter((id) => !taken.has(id));
}

/** The twelfth club's part of an offseason step, after the user's decision for it. */
export function rivalStep(s: LeagueState, step: OffseasonStep) {
  const o = s.offseason;
  if (!s.twelve || !o) return;
  const next = o.year + 1;
  if (step === 'special') rivalSpecialDraft(s, next);
  if (step === 'released') rivalFill(s, next);
  if (step === 'check') rivalTrim(s, next);
}

/** After its foreign signings (four and the Asia quota in its first season), the twelfth club gets down to the
    registered-player limit as the user's club must: the least valuable go, the young ones as development players. */
function rivalTrim(s: LeagueState, next: number) {
  const tw = s.twelve!;
  const over = registeredIds(s, tw.teamId).length - rosterLimit(next);
  if (over <= 0) return;
  const D = OFFSEASON.development;
  let dev = developmentIds(s, tw.teamId).length;
  const cut = registeredIds(s, tw.teamId)
    .map((id) => s.players[id]!)
    .filter((p) => !isForeign(p) && p.contract?.kind !== 'freeAgent' && !(tw.picks ?? []).some((x) => x.id === p.id))
    .sort((a, b) => gmValue(a, next, tw.gm) - gmValue(b, next, tw.gm))
    .slice(0, over);
  for (const p of cut) {
    if (ageIn(p, next) <= D.convertAge && dev < D.aiTarget) {
      p.contract = developmentContract(tw.teamId, next);
      dev++;
    } else leaveLeague(s, p, 'retired');
  }
}
