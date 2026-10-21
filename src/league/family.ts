import { k as __i18n_k } from '../i18n/index';
/* 2.0.6 (the 2.0 plan's seventh stage, the user's request): players tied by family — the son of a former player now
   coaching or managing, brothers, now and then twins — and the stories they make.

   A tie is made when a club drafts a player (the draft's own stream, so no other draw moves): rarely he turns out to be
   the son of a coach or manager who played in the league (the same surname, born 22–40 years after him; his build
   takes after his father's), the younger brother of a player in the game (the same surname, one to six years apart,
   from the same town), or the twin of a player taken earlier in the same draft. Abilities stay their own (plan
   decision: the engine is not touched).

   The stories: the draft itself (a club taking a coach's son, or a brother joining his brother), brothers or a father
   and son meeting across the field (a brother batting against his brother on the mound), twins on the first team on
   the same day, a son passing his father's career home runs or wins, and the fans' grumbling when a manager keeps
   playing a struggling son. */
import { rng } from '../draftroom';
import type { Player, PlayerId, TeamId } from '../model/types';
import type { TeamBox } from './engine/types';
import { eulreul, iga, ro, wagwa } from './josa';
import { addNews } from './news';
import { isForeign, isPitcher } from './players';
import type { LeagueState } from './state';

export type FamilyKind = 'father' | 'brother' | 'twin';

/** `a` is the father (or the older brother, or the first-born twin), `b` the son (the younger brother, the other twin). */
export interface FamilyTie {
  kind: FamilyKind;
  a: PlayerId;
  b: PlayerId;
  /** The draft that made it. */
  year: number;
}

/** Chances at each pick (each needs a fitting relative to be there). */
/** 2.0.27 (the user's request): sons more often — of any former first-team regular now, not only of a coach — twins
    far rarer (a handful in the KBO's whole history), brothers a little rarer. */
export const FAMILY = { son: 0.03, brother: 0.015, twin: 0.002, fatherGap: [22, 40] as const, brotherGap: [1, 6] as const, fatherSeasons: 3 };

const DOUBLE = ['남궁', '황보', '제갈', '선우', '독고'];
export const surnameOf = (name: string) => (DOUBLE.includes(name.slice(0, 2)) ? name.slice(0, 2) : name.slice(0, 1));
const bornIn = (p: Player) => Number(p.birthday.slice(0, 4));
const short = (s: LeagueState, id: TeamId | null | undefined) => s.teams.find((t) => t.id === id)?.short ?? '';

export const tiesOf = (s: LeagueState, id: PlayerId) => (s.families ?? []).filter((t) => t.a === id || t.b === id);

/** His relatives as the player page shows them: who, and what he is to him. */
export function familyOf(s: LeagueState, id: PlayerId): { id: PlayerId; name: string; relation: string; team: string }[] {
  const out: { id: PlayerId; name: string; relation: string; team: string }[] = [];
  for (const t of tiesOf(s, id)) {
    const other = t.a === id ? t.b : t.a;
    const o = s.players[other];
    if (!o) continue;
    const first = t.a === id;
    const relation = t.kind === 'father' ? (first ? __i18n_k("league.family.text.bb28b624") : __i18n_k("league.family.text.7e3ccf68")) : t.kind === 'twin' ? __i18n_k("league.family.text.a0da0b80") : first ? __i18n_k("league.family.text.c43d04b1") : __i18n_k("league.family.text.e46ebed2");
    const staff = coachingAt(s, other);
    out.push({ id: other, name: o.name, relation, team: staff ? __i18n_k("league.family.text.26087beb", { team: short(s, staff.team), role: staff.role }) : o.status === 'retired' ? __i18n_k("league.family.text.5b170d3c") : short(s, o.teamId) });
  }
  return out;
}

/** Where a former player coaches or manages now. */
function coachingAt(s: LeagueState, id: PlayerId): { team: TeamId; role: string } | null {
  for (const t of s.teams)
    for (const m of Object.values(s.clubs?.[t.id]?.staff ?? {})) if (m?.playerId === id) return { team: t.id, role: m.role === 'manager' ? __i18n_k("league.family.text.daec431c") : __i18n_k("league.family.text.95430629") };
  return null;
}

/** Former players coaching or managing anywhere. */
function coaches(s: LeagueState): { p: Player; team: TeamId; manager: boolean }[] {
  const out: { p: Player; team: TeamId; manager: boolean }[] = [];
  for (const t of s.teams)
    for (const m of Object.values(s.clubs?.[t.id]?.staff ?? {})) {
      const p = m?.playerId ? s.players[m.playerId] : undefined;
      if (p && !isForeign(p)) out.push({ p, team: t.id, manager: m!.role === 'manager' });
    }
  return out;
}

const tied = (s: LeagueState, id: PlayerId, kind?: FamilyKind) => (s.families ?? []).some((t) => (t.a === id || t.b === id) && (!kind || t.kind === kind));

/** At a draft pick: maybe a family tie for the man just taken, and the story of it. */
export function familyAtPick(s: LeagueState, p: Player, teamId: TeamId, draftYear: number, overall: number, earlier: PlayerId[]) {
  if (isForeign(p) || tied(s, p.id)) return;
  const r = rng(`${s.seed}|family|${draftYear}|${overall}`);
  const name = surnameOf(p.name);
  const born = bornIn(p);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  let tie: FamilyTie | null = null;
  // A coach's or manager's son, or (2.0.27) a retired player's who played a few seasons on a first team.
  if (r() < FAMILY.son) {
    const staff = coaches(s);
    const coachIds = new Set(staff.map((c) => c.p.id));
    const veterans = Object.values(s.players)
      .filter((o) => o.status === 'retired' && !s.otherSport?.[o.id] && !isForeign(o) && !coachIds.has(o.id) && o.career.filter((c) => !c.level).length >= FAMILY.fatherSeasons)
      .map((o) => ({ p: o }));
    const dads = [...staff, ...veterans].filter((c) => surnameOf(c.p.name) === name && born - bornIn(c.p) >= FAMILY.fatherGap[0] && born - bornIn(c.p) <= FAMILY.fatherGap[1] && !(s.families ?? []).some((t) => t.kind === 'father' && t.a === c.p.id));
    const same = dads.filter((c) => isPitcher(c.p) === isPitcher(p));
    const dad = pick(same.length ? same : dads);
    if (dad) {
      tie = { kind: 'father', a: dad.p.id, b: p.id, year: draftYear };
      // He takes after his father in build.
      p.height = Math.round(dad.p.height + (r() - 0.5) * 8);
      p.weight = Math.round(dad.p.weight * (p.height / dad.p.height) + (r() - 0.5) * 6);
    }
  }
  // An older brother in the game.
  if (!tie && r() < FAMILY.brother) {
    const olds = Object.values(s.players).filter(
      (o) => o.id !== p.id && o.status !== 'retired' && o.status !== 'amateur' && !isForeign(o) && surnameOf(o.name) === name && born - bornIn(o) >= FAMILY.brotherGap[0] && born - bornIn(o) <= FAMILY.brotherGap[1] && !tied(s, o.id, 'brother') && !tied(s, o.id, 'twin'),
    );
    const near = olds.filter((o) => o.education.region === p.education.region);
    const bro = pick(near.length ? near : olds);
    if (bro) {
      tie = { kind: 'brother', a: bro.id, b: p.id, year: draftYear };
      p.birthplace = bro.birthplace;
    }
  }
  // A twin taken earlier in the same draft.
  if (!tie && r() < FAMILY.twin) {
    const twins = earlier.map((id) => s.players[id]!).filter((o) => o && !isForeign(o) && surnameOf(o.name) === name && bornIn(o) === born && !tied(s, o.id));
    const twin = pick(twins);
    if (twin) {
      tie = { kind: 'twin', a: twin.id, b: p.id, year: draftYear };
      p.birthday = twin.birthday;
      p.birthplace = twin.birthplace;
      p.height = Math.round(twin.height + (r() - 0.5) * 4);
    }
  }
  if (!tie) return;
  (s.families ??= []).push(tie);
  draftStory(s, tie, teamId, draftYear);
}

/** The draft's story of a new tie. */
function draftStory(s: LeagueState, t: FamilyTie, teamId: TeamId, draftYear: number) {
  const a = s.players[t.a]!,
    b = s.players[t.b]!;
  const club = short(s, teamId);
  const at = coachingAt(s, a.id);
  const sameClub = t.kind === 'father' ? at?.team === teamId : a.teamId === teamId;
  const mine = !!s.user && (teamId === s.user.teamId || a.teamId === s.user.teamId || at?.team === s.user.teamId);
  let title: string, body: string;
  if (t.kind === 'father' && !at) {
    // 2.0.27: a former player who does not coach: his old club and seasons.
    const seasons = a.career.filter((c) => !c.level).length;
    title = __i18n_k("league.family.text.27659aed", { dad: a.name, son: b.name, club });
    body = __i18n_k("league.family.text.a6111524", { club: iga(club), dad: a.name, son: eulreul(b.name), seasons });
  } else if (t.kind === 'father') {
    const role = at?.role ?? __i18n_k("league.family.text.95430629");
    title = sameClub ? __i18n_k("league.family.text.e3c1ebd1", { club, dad: a.name, role, son: b.name }) : __i18n_k("league.family.text.5bcc2077", { dad: a.name, role, son: b.name, club });
    body = sameClub
      ? __i18n_k("league.family.text.07c2bc67", { club: iga(club), son: eulreul(b.name), dad: iga(a.name), role: ro(role) })
      : __i18n_k("league.family.text.cca548e9", { dad: a.name, team: short(s, at?.team), role, son: iga(b.name), club, seasons: a.career.filter((c) => !c.level).length });
  } else if (t.kind === 'brother') {
    title = sameClub ? __i18n_k("league.family.text.b44cf644", { club, old: a.name, young: b.name }) : __i18n_k("league.family.text.900ff9bf", { old: a.name, young: b.name, club });
    body = sameClub
      ? __i18n_k("league.family.text.e14cbd4c", { club: iga(club), old: a.name, young: eulreul(b.name) })
      : __i18n_k("league.family.text.70512e31", { team: short(s, a.teamId), old: a.name, young: iga(b.name), club });
  } else {
    const other = short(s, a.teamId);
    title = a.teamId === teamId ? __i18n_k("league.family.text.a31248c8", { a: a.name, b: b.name, club }) : __i18n_k("league.family.text.c2b5fe9c", { a: a.name, b: b.name, other: wagwa(other), club: ro(club) });
    body = __i18n_k("league.family.text.a8215b6e", { year: draftYear + 1, a: wagwa(a.name), b: iga(b.name) });
  }
  addNews(s, { id: `family-draft-${t.a}-${t.b}`, date: `${draftYear}-09-20`, kind: 'milestone', title, body, quotes: [], facts: { relation: t.kind, a: a.name, b: b.name, club }, players: [a.id, b.id], ...(mine ? { mine } : {}) });
}

const done = (s: LeagueState, key: string) => {
  const d = (s.familyDone ??= []);
  if (d.includes(key)) return true;
  d.push(key);
  return false;
};

/** After a game: relatives on the two sides — the first time they meet, and the first time one bats against the other. */
export function familyGame(s: LeagueState, home: TeamBox, away: TeamBox, date: string) {
  const ties = s.families;
  if (!ties?.length) return;
  const ids = (b: TeamBox) => new Set([...b.batting.map((x) => x.id), ...b.pitching.map((x) => x.id)]);
  const h = ids(home),
    a = ids(away);
  for (const t of ties) {
    if (t.kind === 'father') continue;
    const across = (h.has(t.a) && a.has(t.b)) || (a.has(t.a) && h.has(t.b));
    if (!across) continue;
    const x = s.players[t.a],
      y = s.players[t.b];
    if (!x || !y) continue;
    const mine = !!s.user && (x.teamId === s.user.teamId || y.teamId === s.user.teamId);
    const vs = { ...(home.vs ?? {}), ...(away.vs ?? {}) };
    const duel = vs[`${t.a}|${t.b}`] ? [t.a, t.b] : vs[`${t.b}|${t.a}`] ? [t.b, t.a] : null;
    if (duel && !done(s, `duel|${t.a}|${t.b}`)) {
      const [bat, pit] = duel.map((id) => s.players[id]!) as [Player, Player];
      const m = vs[`${bat.id}|${pit.id}`]!;
      addNews(s, {
        id: `family-duel-${t.a}-${t.b}`,
        date,
        kind: 'game',
        title: t.kind === 'twin' ? __i18n_k("league.family.text.65873747", { bat: bat.name, pit: pit.name }) : __i18n_k("league.family.text.4de50ce1", { bat: bat.name, pit: pit.name }),
        body: __i18n_k("league.family.text.f8df8b3c", { bat: iga(bat.name), pit: wagwa(pit.name), pa: m[0]!, h: m[2]!, hr: m[4]!, k: m[6]! }),
        quotes: [],
        facts: { batter: bat.name, pitcher: pit.name, pa: m[0]!, hits: m[2]!, hr: m[4]!, k: m[6]! },
        players: [bat.id, pit.id],
        ...(mine ? { mine } : {}),
      });
    } else if (!duel && !done(s, `meet|${t.a}|${t.b}`)) {
      addNews(s, {
        id: `family-meet-${t.a}-${t.b}`,
        date,
        kind: 'game',
        title: t.kind === 'twin' ? __i18n_k("league.family.text.9b8c6871", { a: x.name, b: y.name }) : __i18n_k("league.family.text.778cd910", { a: x.name, b: y.name }),
        body: __i18n_k("league.family.text.65cd22ad", { a: wagwa(x.name), b: iga(y.name) }),
        quotes: [],
        facts: { a: x.name, b: y.name, relation: t.kind },
        players: [x.id, y.id],
        ...(mine ? { mine } : {}),
      });
    }
  }
}

/** Each day: twins on the first team together (once), and a manager playing his struggling son (once a season). */
export function familyDay(s: LeagueState, date: string) {
  const ties = s.families;
  if (!ties?.length) return;
  const active = new Set(Object.values(s.rosters).flatMap((r) => r.active));
  for (const t of ties) {
    const a = s.players[t.a],
      b = s.players[t.b];
    if (!a || !b) continue;
    if (t.kind === 'twin' && active.has(a.id) && active.has(b.id) && !done(s, `twins|${t.a}|${t.b}`)) {
      const together = a.teamId === b.teamId;
      addNews(s, {
        id: `family-twins-${t.a}-${t.b}`,
        date,
        kind: 'milestone',
        title: together ? __i18n_k("league.family.text.9c5e0415", { a: a.name, b: b.name }) : __i18n_k("league.family.text.db2e68fc", { a: a.name, b: b.name }),
        body: together ? __i18n_k("league.family.text.9a4697ea", { team: short(s, a.teamId), a: wagwa(a.name), b: iga(b.name) }) : __i18n_k("league.family.text.d1f31694", { ta: short(s, a.teamId), a: a.name, tb: short(s, b.teamId), b: b.name }),
        quotes: [],
        facts: { a: a.name, b: b.name },
        players: [a.id, b.id],
        ...(s.user && (a.teamId === s.user.teamId || b.teamId === s.user.teamId) ? { mine: true } : {}),
      });
    }
    if (t.kind === 'father') {
      const at = coachingAt(s, a.id);
      if (!at || at.team !== b.teamId) continue;
      const m = s.clubs?.[at.team]?.staff?.manager;
      if (m?.playerId !== a.id) continue;
      const line = s.lines[b.id];
      const bat = line?.bat,
        pit = line?.pit;
      const ops = bat && bat.ab ? (bat.h + bat.bb + bat.hbp) / Math.max(1, bat.ab + bat.bb + bat.hbp + bat.sf) + (bat.h + bat.d + 2 * bat.t + 3 * bat.hr) / bat.ab : 1;
      const era = pit && pit.outs ? (27 * pit.er) / pit.outs : 0;
      const struggling = (bat && bat.pa >= 120 && ops < 0.62) || (pit && pit.outs >= 120 && era > 6);
      if (!struggling || done(s, `nepotism|${b.id}|${s.year}`)) continue;
      const club = short(s, at.team);
      addNews(s, {
        id: `family-nepotism-${b.id}-${s.year}`,
        date,
        kind: 'milestone',
        title: __i18n_k("league.family.text.40ca41f5", { club, son: b.name }),
        body: __i18n_k("league.family.text.418c9d26", { dad: a.name, son: eulreul(b.name) }),
        quotes: [{ who: __i18n_k("league.family.text.b8a5572a", { club }), role: 'fan', text: __i18n_k("league.family.text.c09b83ed") }],
        facts: { manager: a.name, son: b.name, club },
        players: [b.id],
        ...(s.user?.teamId === at.team ? { mine: true } : {}),
      });
    }
  }
}

/** When a season closes: a son passing his father's career home runs or wins. */
export function familySeason(s: LeagueState) {
  for (const t of s.families ?? []) {
    if (t.kind !== 'father') continue;
    const a = s.players[t.a],
      b = s.players[t.b];
    if (!a || !b) continue;
    const sum = (p: Player, k: 'hr' | 'w') => p.career.filter((c) => !c.level).reduce((n, c) => n + (k === 'hr' ? (c.bat?.hr ?? 0) : (c.pit?.w ?? 0)), 0);
    for (const k of ['hr', 'w'] as const) {
      const dad = sum(a, k),
        son = sum(b, k);
      if (dad < 10 || son <= dad || done(s, `pass|${k}|${b.id}`)) continue;
      const what = k === 'hr' ? __i18n_k("league.family.text.c29dacda") : __i18n_k("league.family.text.93b6ddde");
      addNews(s, {
        id: `family-pass-${k}-${b.id}`,
        date: `${s.year}-10-31`,
        kind: 'milestone',
        title: __i18n_k("league.family.text.76df2d2c", { son: b.name, dad: a.name, what: eulreul(what) }),
        body: __i18n_k("league.family.text.15d6df49", { son: b.name, what, n: son, dad: a.name, m: dad }),
        quotes: [],
        facts: { son: b.name, father: a.name, what, son_total: son, father_total: dad },
        players: [b.id, a.id],
        ...(s.user && b.teamId === s.user.teamId ? { mine: true } : {}),
      });
    }
  }
}

/** Ties to men no longer in the game's records (an undrafted twin) are dropped. */
export function pruneFamilies(s: LeagueState) {
  if (s.families) s.families = s.families.filter((t) => s.players[t.a] && s.players[t.b]);
}

