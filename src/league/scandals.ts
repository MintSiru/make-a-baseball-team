/* The dark side (V0.12; user's club only, like life.ts). Now and then one of our players drives drunk, gets into a
   fight, is caught doping, or is found fixing games. The KBO's penalties are the real ones (RULES.md §9, S73–S75):
   drunk driving 70 games with a suspended licence and a year's ban with a revoked one (five years the second time,
   for life the third; ten more games for hiding it), doping 72 games and then a whole season (game assumption: for
   life the third time), match fixing a life ban; a fight costs 30 games (50 for a bad one; a game assumption, the
   KBO decides case by case). The club then answers: release him, add a penalty of its own, or leave it to the KBO;
   the fans judge the answer.

   Doping gives warning (the player's request): a player who starts using shows it over the following weeks — a body
   that changes, a rumour about his trainer, numbers that jump, a supplement the trainers cannot place. Clean players
   draw a rumour or two as well. The general manager can order an internal test (a fee from the fund): it catches a
   user before the KBO's testers do and costs nothing but some goodwill, or upsets a clean player. Left alone, the
   KBO's random tests find him in the end. */
import { rng } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { addAlert } from './alerts';
import { clubState } from './fans';
import { eunneun, iga } from './josa';
import { addNews } from './news';
import { leaveLeague } from './offseason';
import { ageIn, isForeign, isPitcher } from './players';
import { orgPlayers, type Decision, type LeagueState } from './state';
import { GROWTH, SCANDAL as S } from './tuning';
import { troubleFactor } from './traits';

export type Offense = 'dui' | 'doping' | 'assault' | 'fixing';

/** A suspension: games still to sit out (his club's first-team games), or a ban until a date. */
export interface Suspension {
  reason: string;
  games?: number;
  until?: string;
  since: string;
}

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
const short = (s: LeagueState) => s.teams.find((t) => t.id === s.user?.teamId)?.short ?? '';

/** Whether he is serving a suspension on `date` (he cannot be registered or play). */
export function suspended(s: LeagueState, id: PlayerId, date?: string): boolean {
  const x = s.suspended?.[id];
  if (!x) return false;
  if ((x.games ?? 0) > 0) return true;
  return !!x.until && (!date || x.until > date);
}

/** One of his club's first-team games went by: one game fewer to sit out. */
export function serveSuspensions(s: LeagueState, teamId: string) {
  for (const [id, x] of Object.entries(s.suspended ?? {})) {
    if (s.players[id]?.teamId !== teamId || !x.games) continue;
    x.games--;
    if (x.games <= 0 && !x.until) delete s.suspended![id];
  }
}

/** Bans that ran out by `date` are lifted. */
function liftBans(s: LeagueState, date: string) {
  for (const [id, x] of Object.entries(s.suspended ?? {})) if (!x.games && x.until && x.until <= date) delete s.suspended![id];
}

// ── A day of the season ──────────────────────────────────────────────────────────────────────────

/** Who might do it: our domestic players at the club, a little likelier for some than others. */
function candidate(s: LeagueState, offense: Offense | 'rumour', r: () => number): Player | null {
  const u = s.user!;
  const pool = orgPlayers(s, u.teamId).filter((p) => p.status === 'active' && !isForeign(p) && !suspended(s, p.id) && !p.life?.suspicion);
  if (!pool.length) return null;
  const base = (p: Player) => {
    const age = ageIn(p, s.year);
    if (offense === 'doping') {
      // A contract year, a comeback from an operation or a career on the line.
      const lastYear = !(p.contract?.salaries ?? []).some((x) => x.season > s.year);
      const operated = (p.injuries ?? []).some((i) => i.surgery && Number(i.date.slice(0, 4)) >= s.year - 1);
      return (age >= 26 && age <= 34 ? 2 : 1) * (lastYear ? 1.5 : 1) * (operated ? 1.5 : 1);
    }
    if (offense === 'fixing') return isPitcher(p) && p.scouting.current < 50 ? 3 : 0.3;
    return age >= 21 ? 1 : 0.3;
  };
  // 논란성 (1.1.0): the likelier ones; a rumour finds anyone.
  const weight = offense === 'rumour' ? base : (p: Player) => base(p) * troubleFactor(p);
  const total = pool.reduce((a, p) => a + weight(p), 0);
  let x = r() * total;
  return pool.find((p) => (x -= weight(p)) < 0) ?? pool.at(-1)!;
}

/** How much trouble the club's domestic players make, against the league's usual (1). */
function clubTrouble(s: LeagueState, teamId: string): number {
  const pool = orgPlayers(s, teamId).filter((p) => p.status === 'active' && !isForeign(p));
  return pool.length ? pool.reduce((a, p) => a + troubleFactor(p), 0) / pool.length / GROWTH.controversy.mean : 1;
}

/** The day's chances (game days only). Returns true when the club must answer before the game goes on. */
export function scandalDay(s: LeagueState, date: string): boolean {
  const u = s.user;
  if (!u) return false;
  liftBans(s, date);
  const r = rng(`${s.seed}|scandal|${date}`);
  // A club of troublemakers has more trouble (1.1.0).
  const k = clubTrouble(s, u.teamId);
  // Concealed drunk driving comes out.
  for (const p of orgPlayers(s, u.teamId)) {
    const hidden = p.life?.hiding;
    if (hidden && hidden.found <= date) {
      delete p.life!.hiding;
      if (incident(s, p, 'dui', date, r, true)) return true;
    }
  }
  dopingDay(s, date, r, k);
  if (s.pending) return true;
  for (const offense of ['dui', 'assault', 'fixing'] as Offense[]) {
    if (r() >= (S.rates[offense] / S.gameDays) * k) continue;
    const p = candidate(s, offense, r);
    if (!p) continue;
    if (offense === 'dui' && r() < S.dui.hidden) {
      (p.life ??= {}).hiding = { date, found: addDays(date, S.dui.foundAfter[0] + Math.floor(r() * (S.dui.foundAfter[1] - S.dui.foundAfter[0]))) };
      continue;
    }
    if (incident(s, p, offense, date, r)) return true;
  }
  return !!s.pending;
}

// ── Doping and its warning signs ─────────────────────────────────────────────────────────────────

const SIGNS: Record<'body' | 'trainer' | 'numbers' | 'supplement', (p: Player) => [string, string]> = {
  body: (p: Player) => [`${p.name}, 몰라보게 달라진 몸`, `${iga(p.name)} 몇 주 사이 체중이 7kg 가까이 늘었다. 본인은 "웨이트 트레이닝 덕분"이라고 했다.`],
  trainer: (p: Player) => [`${p.name}의 개인 트레이너 둘러싼 소문`, `${iga(p.name)} 비시즌부터 함께한 해외 개인 트레이너를 두고 업계에서 좋지 않은 소문이 돈다. 구단은 "확인된 바 없다"는 입장이다.`],
  numbers: (p: Player) =>
    isPitcher(p)
      ? [`${p.name}, 갑자기 빨라진 공`, `${p.name}의 직구 구속이 한 달 사이 4km/h 가까이 올랐다. 전력분석팀도 이유를 정확히 짚지 못한다.`]
      : [`${p.name}, 갑자기 늘어난 비거리`, `${p.name}의 타구 속도와 비거리가 최근 눈에 띄게 늘었다. 전력분석팀도 이유를 정확히 짚지 못한다.`],
  supplement: (p: Player) => [`트레이닝 파트 보고: ${p.name}의 보충제`, `구단 트레이닝 파트가 ${p.name}의 보충제 가운데 성분을 확인할 수 없는 제품이 있다고 보고했다.`],
};
/** Signs of a real user, in order; a clean player under a rumour shows the first two at most. */
const REAL_SIGNS: (keyof typeof SIGNS)[] = ['body', 'trainer', 'numbers', 'supplement'];

function dopingDay(s: LeagueState, date: string, r: () => number, k: number) {
  const u = s.user!;
  // Someone starts, or a rumour starts about someone clean.
  for (const real of [true, false]) {
    if (r() >= ((real ? S.rates.doping : S.doping.rumours) / S.gameDays) * (real ? k : 1)) continue;
    const p = candidate(s, real ? 'doping' : 'rumour', r);
    if (!p) continue;
    const life = (p.life ??= {});
    life.suspicion = { since: date, signs: 0, real, next: addDays(date, S.doping.firstSign[0] + Math.floor(r() * (S.doping.firstSign[1] - S.doping.firstSign[0]))) };
    if (real) {
      // It works, for now.
      const tool = isPitcher(p) ? 'stuff' : 'power';
      p.hidden.current[tool] = (p.hidden.current[tool] ?? 40) + S.doping.boost;
      life.suspicion.boost = { tool, delta: S.doping.boost };
    }
  }
  for (const p of orgPlayers(s, u.teamId)) {
    const x = p.life?.suspicion;
    if (!x) continue;
    // The next sign.
    const most = x.real ? REAL_SIGNS.length : S.doping.rumourSigns;
    if (x.signs < most && x.next <= date) {
      const sign = REAL_SIGNS[x.signs]!;
      const [title, body] = SIGNS[sign](p);
      addNews(s, { id: `sign-${p.id}-${date}`, date, kind: 'interview', title, body, quotes: [], facts: { 선수: p.name }, players: [p.id], mine: true });
      x.signs++;
      x.next = addDays(date, S.doping.between[0] + Math.floor(r() * (S.doping.between[1] - S.doping.between[0])));
    }
    // A rumour about a clean player dies down.
    if (!x.real && date >= addDays(x.since, S.doping.rumourDays)) delete p.life!.suspicion;
    // The KBO's testers come by.
    else if (x.real && date >= addDays(x.since, S.doping.graceDays) && r() < S.doping.test) {
      stopDoping(p);
      incident(s, p, 'doping', date, r);
    }
  }
}

function stopDoping(p: Player) {
  const x = p.life?.suspicion;
  if (x?.boost) p.hidden.current[x.boost.tool] = (p.hidden.current[x.boost.tool] ?? 40) - x.boost.delta;
  delete p.life!.suspicion;
}

/** Why the club cannot test him now, or null. */
export function checkInspect(s: LeagueState, id: PlayerId): string | null {
  const u = s.user;
  const p = s.players[id];
  if (!u || !p || p.teamId !== u.teamId) return '우리 선수만 검사할 수 있습니다.';
  if (u.fund < S.doping.inspectCost) return '구단 자금이 부족합니다.';
  if (p.life?.inspected === s.year) return '올해 이미 검사했습니다.';
  return null;
}

/** The club's own test: it stops a user quietly, or hurts a clean player's feelings. */
export function inspect(s: LeagueState, id: PlayerId) {
  if (checkInspect(s, id)) return;
  const u = s.user!;
  const p = s.players[id]!;
  const date = s.phase === 'regular' ? (s.schedule[s.next]?.date ?? `${s.year}-10-01`) : `${s.year}-12-15`;
  u.fund -= S.doping.inspectCost;
  u.ledger.push({ year: s.year, label: `${p.name} 구단 자체 도핑 검사`, amount: -S.doping.inspectCost });
  const life = (p.life ??= {});
  life.inspected = s.year;
  const caught = !!life.suspicion?.real;
  if (caught) stopDoping(p);
  else delete life.suspicion;
  life.fans = Math.max(-30, (life.fans ?? 0) - (caught ? S.doping.caughtGrudge : S.doping.cleanGrudge));
  (life.events ??= []).push({ date, text: caught ? '구단 자체 검사에서 금지약물 의심 성분, 면담 뒤 중단' : '구단 자체 검사, 이상 없음', tone: caught ? 'bad' : undefined });
  (u.log ??= []).push({ year: s.year, text: `${p.name} 구단 자체 도핑 검사: ${caught ? '의심 성분 확인, 선수 면담 뒤 복용 중단' : '이상 없음'}` });
  addAlert(s, {
    id: `inspect-${p.id}-${s.year}`,
    date,
    kind: 'scandal',
    title: caught ? `${p.name}, 구단 자체 검사에서 의심 성분` : `${p.name}, 구단 자체 검사 이상 없음`,
    lines: caught
      ? ['트레이닝 파트가 확인을 마쳤고, 선수가 복용을 멈추기로 했습니다. KBO 검사에 걸리기 전에 막았습니다.', '선수는 구단의 판단을 받아들였지만 마음이 편치는 않습니다.']
      : ['아무것도 나오지 않았습니다. 의심을 받은 선수가 서운해합니다.'],
    tone: caught ? 'good' : undefined,
    players: [p.id],
  });
}

// ── The incident, the penalty, the club's answer ─────────────────────────────────────────────────

const LABEL: Record<Offense, string> = { dui: '음주운전', doping: '금지약물 복용', assault: '폭행', fixing: '승부조작' };

/** The KBO's penalty for this offense and his record. */
function penalty(p: Player, offense: Offense, r: () => number, hid: boolean): { text: string; games?: number; years?: number; life?: boolean } {
  const n = (p.life?.offenses?.[offense] ?? 0) + 1;
  switch (offense) {
    case 'dui': {
      if (n >= 3) return { text: '음주운전 3회, 영구 실격', life: true };
      if (n === 2) return { text: '음주운전 2회, 5년 실격', years: 5 };
      const revoked = r() < S.dui.revoked;
      const extra = hid ? S.dui.hidingGames : 0;
      return revoked ? { text: `면허 취소, 1년 실격${hid ? ' (신고하지 않아 10경기 추가)' : ''}`, years: 1, games: extra || undefined } : { text: `면허 정지, ${S.dui.games + extra}경기 출장정지${hid ? ' (신고하지 않아 10경기 추가)' : ''}`, games: S.dui.games + extra };
    }
    case 'doping':
      if (n >= 3) return { text: '금지약물 3회 적발, 영구 실격', life: true };
      return n === 2 ? { text: '금지약물 2회 적발, 144경기 출장정지', games: 144 } : { text: '금지약물 1회 적발, 72경기 출장정지', games: 72 };
    case 'assault': {
      const bad = r() < S.assault.bad;
      return { text: `폭행, ${bad ? S.assault.badGames : S.assault.games}경기 출장정지`, games: bad ? S.assault.badGames : S.assault.games };
    }
    case 'fixing':
      return { text: '승부조작, 영구 실격', life: true };
  }
}

/** It happened (or came out): the penalty, the news, the fans; a decision for the club unless he is gone for good. */
function incident(s: LeagueState, p: Player, offense: Offense, date: string, r: () => number, hid = false): boolean {
  const u = s.user!;
  const pen = penalty(p, offense, r, hid);
  const life = (p.life ??= {});
  (life.offenses ??= {})[offense] = (life.offenses[offense] ?? 0) + 1;
  life.fans = Math.max(-30, (life.fans ?? 0) - S.fans[offense]);
  (life.events ??= []).push({ date, text: `${LABEL[offense]} · ${pen.text}`, tone: 'bad' });
  clubState(s, u.teamId).interest -= S.clubMood[offense];
  addNews(s, {
    id: `scandal-${p.id}-${date}`,
    date,
    kind: 'move',
    title: `${short(s)} ${p.name}, ${LABEL[offense]}… ${pen.text}`,
    body: `${short(s)} ${iga(p.name)} ${LABEL[offense]}${offense === 'dui' && hid ? ' 사실을 숨겼다가 뒤늦게 드러났다' : '으로 물의를 빚었다'}. KBO 상벌위원회는 ${pen.text} 처분을 내렸다.${pen.life ? ' 앞으로 KBO 리그에 어떤 형태로도 돌아올 수 없다.' : ''}`,
    quotes: [{ who: '팬', role: 'fan', text: offense === 'fixing' ? '야구를 모욕했다' : '실망이다' }],
    facts: { 선수: p.name, 사유: LABEL[offense], 징계: pen.text },
    players: [p.id],
    mine: true,
  });
  addAlert(s, {
    id: `scandal-${p.id}-${date}`,
    date,
    kind: 'scandal',
    title: `${p.name} ${LABEL[offense]} · ${pen.text}`,
    lines: [`KBO 상벌위원회 결정: ${pen.text}.`, pen.life ? '선수는 리그를 떠납니다.' : '구단의 대응을 정해야 합니다.', '팬들의 실망이 큽니다.'],
    tone: 'bad',
    players: [p.id],
  });
  if (pen.life) {
    leaveLeague(s, p, 'retired');
    delete s.suspended?.[p.id];
    return false;
  }
  (s.suspended ??= {})[p.id] = { reason: `${LABEL[offense]} 징계`, since: date, ...(pen.games ? { games: pen.games } : {}), ...(pen.years ? { until: addDays(date, 365 * pen.years) } : {}) };
  s.pending = { kind: 'scandal', id: p.id, offense, penalty: pen.text };
  return true;
}

/** The club's answer. */
export function resolveScandal(s: LeagueState, d: Extract<Decision, { kind: 'scandal' }>, chosen: 'release' | 'extra' | 'none', release: (id: PlayerId) => boolean) {
  const u = s.user!;
  const p = s.players[d.id]!;
  // A release the roster cannot take now (the first team's minimum) becomes a penalty of our own.
  const answer = chosen === 'release' && !release(d.id) ? 'extra' : chosen;
  const club = clubState(s, u.teamId);
  club.interest += S.answer[answer];
  const text = answer === 'release' ? '방출' : answer === 'extra' ? `구단 자체 징계 (${S.extraGames}경기 추가 출장정지, 벌금)` : 'KBO 징계만 따름';
  if (answer === 'extra') {
    const x = s.suspended?.[d.id];
    if (x) x.games = (x.games ?? 0) + S.extraGames;
  }
  (u.log ??= []).push({ year: s.year, text: `${p.name} ${LABEL[d.offense as Offense]}: 구단 대응 — ${text}` });
  addNews(s, {
    id: `answer-${p.id}-${s.year}-${d.offense}`,
    date: s.phase === 'regular' ? (s.schedule[s.next]?.date ?? `${s.year}-10-01`) : `${s.year}-12-01`,
    kind: 'move',
    title: `${short(s)}, ${p.name}에 대해 ${answer === 'release' ? '방출 결정' : answer === 'extra' ? '자체 징계' : '추가 조치 없어'}`,
    body: answer === 'none' ? `${eunneun(short(s))} KBO 징계 외에 따로 조치하지 않기로 했다. 팬들 사이에서 비판이 나온다.` : `${iga(short(s))} ${p.name}에게 ${text} 조치를 내렸다.`,
    quotes: [],
    facts: { 선수: p.name, 대응: text },
    players: [p.id],
    mine: true,
  });
}

/** The scouts' answer: release him for a life-changing offense, a penalty of our own otherwise. */
export const autoScandal = (d: Extract<Decision, { kind: 'scandal' }>): 'release' | 'extra' => (d.offense === 'doping' || d.offense === 'assault' ? 'extra' : 'release');
