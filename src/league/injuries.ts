import { k as __i18n_k } from '../i18n/index';
/* Injuries (V0.7.7): what goes wrong, for how long, and what it leaves behind.

   Two kinds. A knock (타박상, 뭉침, 몸살) keeps a player out of the lineup for a few days while he stays
   registered; anything a week or longer takes him off the first team onto the injured list (RULES.md §7).
   The catalogue follows a KBO first team's season (RULES.md §7, S51: one club in 2021 — 50 time-loss
   injuries, 70% under a week, 16% three weeks or longer, trunk and back the most common) and the
   usual layoffs reported in KBO news: 옆구리 4~6주, 햄스트링 2~5주, 사구 골절 5~8주, 토미존 1년 이상.
   A major operation can change a player for good (a step slower after the knee or the Achilles, less
   life on the fastball after the labrum), makes him more fragile, and is the usual reason for a 4급
   military grade (military.ts). Surgery layoffs carry over the winter. */
import { rng, type ToolKey } from '../draftroom';
import type { InjuryRecord, Player, PlayerId } from '../model/types';
import type { TeamBox } from './engine/types';
import { addAlert } from './alerts';
import { iga, ro } from './josa';
import { addNews } from './news';
import { ageIn, isPitcher } from './players';
import { staffEdge, staffRating } from './staff';
import type { LeagueState, SeasonLine } from './state';
import { INJURY, STAFF, TRAINING } from './tuning';
import { facilityInjury, facilityRehab } from './facilities';

export interface InjuryType {
  part: string;
  weight: number;
  days: [number, number];
  surgery?: 'minor' | 'major';
  /** Lasting loss of hidden ability: [tool, most, least] grade points (negative). */
  effects?: [ToolKey, number, number][];
}

/** Injuries that take a pitcher off the first team (a week or longer). */
const PITCHER: InjuryType[] = [
  { part: __i18n_k("league.injuries.pITCHER.part.46268499"), weight: 12, days: [10, 28] },
  { part: __i18n_k("league.injuries.pITCHER.part.14559fd0"), weight: 10, days: [14, 35] },
  { part: __i18n_k("league.injuries.pITCHER.part.e2737af2"), weight: 8, days: [21, 42] },
  { part: __i18n_k("league.injuries.pITCHER.part.228bf02d"), weight: 7, days: [7, 21] },
  { part: __i18n_k("league.injuries.pITCHER.part.40a92d0b"), weight: 4, days: [7, 14] },
  { part: __i18n_k("league.injuries.pITCHER.part.ce39cc2a"), weight: 4, days: [14, 28] },
  { part: __i18n_k("league.injuries.pITCHER.part.1998b3e8"), weight: 3, days: [28, 56] },
  { part: __i18n_k("league.injuries.pITCHER.part.91de82cb"), weight: 4, days: [42, 90] },
  { part: __i18n_k("league.injuries.pITCHER.part.9d8788c2"), weight: 3, days: [42, 90] },
  { part: __i18n_k("league.injuries.pITCHER.part.882a4d74"), weight: 3, days: [7, 14] },
  { part: __i18n_k("league.injuries.pITCHER.part.57b10a76"), weight: 1, days: [42, 70] },
  { part: __i18n_k("league.injuries.pITCHER.part.2bb9bb0f"), weight: 2.5, days: [60, 100], surgery: 'minor' },
  {
    part: __i18n_k("league.injuries.pITCHER.part.4f896082"),
    weight: 2.5,
    days: [365, 480],
    surgery: 'major',
    effects: [
      ['stuff', -3, 0],
      ['command', -3, 0],
    ],
  },
  {
    part: __i18n_k("league.injuries.pITCHER.part.a6b34efe"),
    weight: 0.8,
    days: [330, 450],
    surgery: 'major',
    effects: [
      ['stuff', -7, -3],
      ['command', -4, -1],
      ['stamina', -4, 0],
    ],
  },
  { part: __i18n_k("league.injuries.pITCHER.part.61965cbe"), weight: 0.3, days: [120, 180], surgery: 'minor' },
];

/** Injuries that take a position player off the first team. */
const HITTER: InjuryType[] = [
  { part: __i18n_k("league.injuries.hITTER.part.e2737af2"), weight: 12, days: [21, 42] },
  { part: __i18n_k("league.injuries.hITTER.part.228bf02d"), weight: 12, days: [7, 21] },
  { part: __i18n_k("league.injuries.hITTER.part.ce39cc2a"), weight: 12, days: [14, 35] },
  { part: __i18n_k("league.injuries.hITTER.part.b00eb0fd"), weight: 4, days: [14, 28] },
  { part: __i18n_k("league.injuries.hITTER.part.898d1897"), weight: 5, days: [10, 28] },
  { part: __i18n_k("league.injuries.hITTER.part.ed73dfc1"), weight: 4, days: [14, 28] },
  { part: __i18n_k("league.injuries.hITTER.part.1c9b60e1"), weight: 5, days: [14, 28] },
  { part: __i18n_k("league.injuries.hITTER.part.1356c6c5"), weight: 6, days: [10, 28] },
  { part: __i18n_k("league.injuries.hITTER.part.799175ac"), weight: 4, days: [14, 35] },
  { part: __i18n_k("league.injuries.hITTER.part.37984ac2"), weight: 6, days: [35, 60] },
  { part: __i18n_k("league.injuries.hITTER.part.a210761e"), weight: 6, days: [10, 28] },
  { part: __i18n_k("league.injuries.hITTER.part.c1604205"), weight: 4, days: [35, 70] },
  { part: __i18n_k("league.injuries.hITTER.part.5593309a"), weight: 5, days: [7, 21] },
  { part: __i18n_k("league.injuries.hITTER.part.14559fd0"), weight: 3, days: [14, 28] },
  { part: __i18n_k("league.injuries.hITTER.part.0a9fbc13"), weight: 2, days: [7, 14] },
  { part: __i18n_k("league.injuries.hITTER.part.48f655da"), weight: 2, days: [35, 56], surgery: 'minor' },
  { part: __i18n_k("league.injuries.hITTER.part.a7a7ad43"), weight: 1.5, days: [60, 100], surgery: 'minor' },
  {
    part: __i18n_k("league.injuries.hITTER.part.3cdd9942"),
    weight: 0.8,
    days: [240, 330],
    surgery: 'major',
    effects: [
      ['speed', -7, -3],
      ['defense', -3, -1],
    ],
  },
  {
    part: __i18n_k("league.injuries.hITTER.part.6f19c629"),
    weight: 0.8,
    days: [150, 210],
    surgery: 'major',
    effects: [
      ['defense', -2, 0],
      ['power', -2, 0],
    ],
  },
  {
    part: __i18n_k("league.injuries.hITTER.part.26b50d6e"),
    weight: 0.4,
    days: [180, 270],
    surgery: 'major',
    effects: [
      ['speed', -9, -5],
      ['defense', -4, -2],
    ],
  },
  {
    part: __i18n_k("league.injuries.hITTER.part.5a945952"),
    weight: 0.6,
    days: [90, 150],
    surgery: 'major',
    effects: [['power', -3, -1]],
  },
];

/** Knocks: out of the lineup for a few days, still registered. */
const KNOCKS = {
  pitcher: [__i18n_k("league.injuries.kNOCKS.pitcher.e95306e8"), __i18n_k("league.injuries.kNOCKS.pitcher.f085c67c"), __i18n_k("league.injuries.kNOCKS.pitcher.13fa3e99"), __i18n_k("league.injuries.kNOCKS.pitcher.b4caf185"), __i18n_k("league.injuries.kNOCKS.pitcher.61c31c42")],
  hitter: [__i18n_k("league.injuries.kNOCKS.hitter.c70d523c"), __i18n_k("league.injuries.kNOCKS.hitter.7b713d10"), __i18n_k("league.injuries.kNOCKS.hitter.5e03c265"), __i18n_k("league.injuries.kNOCKS.hitter.b4caf185"), __i18n_k("league.injuries.kNOCKS.hitter.769e348f"), __i18n_k("league.injuries.kNOCKS.hitter.d78a8c1d"), __i18n_k("league.injuries.kNOCKS.hitter.61c31c42"), __i18n_k("league.injuries.kNOCKS.hitter.c411e47d"), __i18n_k("league.injuries.kNOCKS.hitter.d942d31b")],
};

export const INJURY_TYPES = { pitcher: PITCHER, hitter: HITTER };

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);

/**
 * How likely this injury is for him. A major operation he has had before is much rarer the second time: a rebuilt
 * elbow ligament gives way again in about one MLB pitcher in eight over a career (RULES.md S71), and hardly ever
 * in the first two years; a third time is rarer still.
 */
export function injuryWeight(p: Player, t: InjuryType, date: string): number {
  if (t.surgery !== 'major') return t.weight;
  const before = (p.injuries ?? []).filter((x) => x.part === t.part);
  if (!before.length) return t.weight;
  const R = INJURY.repeat;
  const years = (Date.parse(date) - Date.parse(before.at(-1)!.date)) / (365 * 86400000);
  return t.weight * (years < R.within ? R.soon : R.later) * R.again ** (before.length - 1);
}

function pick(list: InjuryType[], r: () => number, weight: (t: InjuryType) => number = (t) => t.weight): InjuryType {
  let x = r() * list.reduce((a, t) => a + weight(t), 0);
  for (const t of list) if ((x -= weight(t)) < 0) return t;
  return list[list.length - 1]!;
}

/** Out of the lineup today for any reason (injured, a knock, the national team). */
export const sidelined = (s: LeagueState, id: PlayerId) => !!s.injuries[id] || !!s.away?.[id] || !!s.abroad?.[id] || !!s.suspended?.[id];
/** Off the first team: on the injured list, in rehab or with the national team (a knock does not count). */
export const offRoster = (s: LeagueState, id: PlayerId) => {
  const i = s.injuries[id];
  return (!!i && !i.dtd) || !!s.away?.[id] || !!s.abroad?.[id] || !!s.suspended?.[id];
};

/** A major operation's lasting mark on the player: hidden ability, and a little more fragile. */
function aftermath(p: Player, t: InjuryType, r: () => number) {
  for (const [tool, most, least] of t.effects ?? []) {
    const loss = Math.round(least + (most - least) * r());
    for (const tools of [p.hidden.current, p.hidden.potential]) {
      const v = tools[tool];
      if (v != null) tools[tool] = Math.max(20, v + loss);
    }
  }
  p.hidden.injuryRisk = Math.min(INJURY.maxRisk, p.hidden.injuryRisk + INJURY.riskAfterSurgery);
}

/**
 * Injuries from one side's game. Chances per appearance scale with the player's hidden risk, his age past
 * 30 and, for pitchers, a long outing; the club's head trainer lowers them and shortens layoffs (staff.ts).
 * Futures games (`level` 'futures') hurt a little less often and do not put anyone on the injured list.
 */
export function rollInjuries(s: LeagueState, box: TeamBox, date: string, r: () => number, line: (id: PlayerId, teamId: string) => SeasonLine, level: 'first' | 'futures' = 'first') {
  const pitches = new Map(box.pitching.map((x) => [x.id, x.pitches]));
  const ids = [...box.batting.map((b) => b.id), ...box.pitching.map((p) => p.id)];
  for (const id of ids) {
    const p = s.players[id]!;
    const u = r();
    if (s.injuries[id] || !p.teamId) continue;
    const pitcher = isPitcher(p);
    const starter = pitcher && p.role === 'SP' && (pitches.get(id) ?? 0) >= 50;
    const base = !pitcher ? INJURY.perGame.hitter : starter ? INJURY.perGame.starter : INJURY.perGame.reliever;
    const workload = pitcher ? Math.max(1, (pitches.get(id) ?? 0) / (starter ? 95 : 25)) : 1;
    const age = Math.max(0, ageIn(p, s.year) - INJURY.ageFrom);
    const medical = staffEdge(staffRating(s, p.teamId, 'medical'));
    // The user's grass and gym, and a conditioning programme abroad this season (V0.10; 1 for everyone else).
    const care = (1 - facilityInjury(s, p.teamId)) * (p.life?.conditioned === s.year ? TRAINING.conditioned : 1);
    const scale = (p.hidden.injuryRisk / INJURY.riskScale) * (1 + age * INJURY.perYearOver) * (1 - STAFF.injury * medical) * (level === 'futures' ? INJURY.futures : 1) * care;
    const serious = base * workload * scale;
    const knock = (pitcher ? INJURY.knock.pitcher : INJURY.knock.hitter) * scale;
    if (u >= serious + knock) continue;
    const r2 = rng(`${s.seed}|injury-part|${id}|${date}`);
    if (u >= serious) {
      // A knock: a few days out of the lineup (first team only; the futures squad just plays someone else).
      if (level !== 'first') continue;
      const list = KNOCKS[pitcher ? 'pitcher' : 'hitter'];
      const days = INJURY.knock.days[0] + Math.floor(r2() * (INJURY.knock.days[1] - INJURY.knock.days[0] + 1));
      s.injuries[id] = { until: addDays(date, days + 1), days, onList: false, dtd: true, part: list[Math.floor(r2() * list.length)]! };
      continue;
    }
    const t = pick(INJURY_TYPES[pitcher ? 'pitcher' : 'hitter'], r2, (x) => injuryWeight(p, x, date));
    const spread = (r2() + r2()) / 2;
    const quicker = STAFF.injuryDays * medical * (t.surgery === 'major' ? 0.5 : 1) + facilityRehab(s, p.teamId);
    const days = Math.max(7, Math.round((t.days[0] + (t.days[1] - t.days[0]) * spread) * (1 - quicker)));
    s.injuries[id] = { until: addDays(date, days), days, onList: level === 'first', part: t.part, ...(t.surgery ? { surgery: t.surgery } : {}) };
    const rec: InjuryRecord = { date, days, part: t.part, ...(level === 'futures' ? { futures: true } : {}), ...(t.surgery ? { surgery: t.surgery } : {}) };
    (p.injuries ??= []).push(rec);
    if (t.surgery === 'major') {
      aftermath(p, t, r2);
      careerThreat(s, p, t, date, r2);
    }
    line(id, p.teamId).lost += days;
    if (p.teamId === s.user?.teamId && days >= INJURY.newsFrom) injuryNews(s, p, t, days, date, level);
  }
}

/**
 * 1.6.0: a major operation can end a career — likelier the older he is and after an earlier one. He finishes the
 * season on the list and retires in the winter (the club cannot talk him round).
 */
function careerThreat(s: LeagueState, p: Player, t: InjuryType, date: string, r: () => number) {
  const C = INJURY.careerEnding;
  const age = ageIn(p, s.year);
  const chance = Math.min(C.max, C.base + Math.max(0, age - C.from) * C.perYear + (majorSurgeries(p).length >= 2 ? C.repeat : 0));
  if (r() >= chance) return;
  (p.life ??= {}).careerOver = date;
  const team = s.teams.find((x) => x.id === p.teamId);
  const ours = p.teamId === s.user?.teamId;
  addNews(s, {
    id: `career-over-${p.id}-${date}`,
    date,
    kind: 'injury',
    title: __i18n_k("league.injuries.careerThreat.title.9b30e9bc", { value: team?.short ?? '', name: p.name, part: ro(t.part) }),
    body: __i18n_k("league.injuries.careerThreat.body.7ec81958", { age: age, name: iga(p.name), part: t.part }),
    quotes: [],
    facts: { 선수: p.name, 부상: t.part, 나이: age },
    players: [p.id],
    mine: ours,
  });
  if (ours) addAlert(s, { id: `career-over-${p.id}-${date}`, date, kind: 'retire', title: __i18n_k("league.injuries.careerThreat.title.2b49c586", { name: p.name, part: t.part }), lines: [__i18n_k("league.injuries.careerThreat.lines.0b341f4d")], tone: 'bad', players: [p.id] });
}

const ROLE: Record<string, string> = { SP: __i18n_k("league.injuries.rOLE.sP.cd036b1a"), RP: __i18n_k("league.injuries.rOLE.rP.ac3cc00a"), C: __i18n_k("league.injuries.rOLE.c.5f31470d"), '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: __i18n_k("league.injuries.rOLE.sS.3e24c7f1"), LF: __i18n_k("league.injuries.rOLE.lF.73836db2"), CF: __i18n_k("league.injuries.rOLE.cF.56780b2a"), RF: __i18n_k("league.injuries.rOLE.rF.a28a0ef8") };
const weeks = (days: number) => (days >= 60 ? __i18n_k("league.injuries.weeks.5d62daea", { value: Math.round(days / 30) }) : __i18n_k("league.injuries.weeks.0fe6e2b8", { value: Math.max(3, Math.round(days / 7)) }));

/** Our player is out three weeks or longer: an article, and a pop-up for an operation that costs a season. */
function injuryNews(s: LeagueState, p: Player, t: InjuryType, days: number, date: string, level: 'first' | 'futures') {
  const team = s.teams.find((x) => x.id === p.teamId)!;
  const who = `${ROLE[isPitcher(p) ? p.role : (p.position ?? '')] ?? ''} ${p.name}`.trim();
  const back = addDays(date, days);
  const when = back.slice(0, 4) === date.slice(0, 4) ? __i18n_k("league.injuries.injuryNews.when.9e0b4844", { number: Number(back.slice(5, 7)) }) : __i18n_k("league.injuries.injuryNews.when.e32a273e", { value: back.slice(0, 4), number: Number(back.slice(5, 7)) });
  const surgery = t.surgery === 'major' ? __i18n_k("league.injuries.injuryNews.surgery.4bbc928f") : t.surgery ? __i18n_k("league.injuries.injuryNews.surgery.78c1501e") : '';
  addNews(s, {
    id: `injury-${p.id}-${date}`,
    date,
    kind: 'injury',
    title: __i18n_k("league.injuries.injuryNews.title.c991627b", { short: team.short, name: p.name, value: surgery ? `${t.part}…${surgery.trim()}` : __i18n_k("league.injuries.injuryNews.title.3e93d178", { part: ro(t.part) }) }),
    body: __i18n_k("league.injuries.injuryNews.body.35f45b23", { name: team.name, who: iga(who), value: level === 'futures' ? __i18n_k("league.injuries.injuryNews.body.2a84aeb4") : '', part: t.part, weeks: weeks(days), when: when, value2: t.surgery === 'major' ? __i18n_k("league.injuries.injuryNews.body.131a4941") : '' }),
    quotes: [],
    facts: { 선수: p.name, 구단: team.name, 부상: t.part, '예상 기간': __i18n_k("league.injuries.injuryNews.facts.e1aa3431", { days: days }), '복귀 예정': back, ...(t.surgery ? { 수술: t.surgery === 'major' ? __i18n_k("league.injuries.facts.message.471cda0c") : __i18n_k("league.injuries.facts.message.98a2b68d") } : {}) },
    players: [p.id],
    mine: true,
  });
  if (t.surgery === 'major')
    addAlert(s, {
      id: `injury-${p.id}-${date}`,
      date,
      kind: 'injury',
      title: `${p.name} ${t.part}`,
      lines: [__i18n_k("league.injuries.injuryNews.lines.35d87295", { who: who, weeks: weeks(days), back: back }), ...(p.service.military === 'pending' ? [__i18n_k("league.injuries.injuryNews.lines.56d0d4ab")] : [])],
      tone: 'bad',
      players: [p.id],
    });
}

/** Long layoffs run over the winter: who is still out on opening day stays out (in rehab, off the list). */
export function carryOverInjuries(s: LeagueState, opening: string | undefined) {
  const kept: LeagueState['injuries'] = {};
  if (opening)
    for (const [id, inj] of Object.entries(s.injuries)) {
      const p = s.players[id];
      if (!inj.dtd && inj.until > opening && p?.teamId && p.status === 'active') kept[id] = { ...inj, onList: false };
    }
  s.injuries = kept;
}

/** Major operations in a player's history (the usual ground for a 4급 or 5급 military grade). */
export const majorSurgeries = (p: Player) => (p.injuries ?? []).filter((x) => x.surgery === 'major');

