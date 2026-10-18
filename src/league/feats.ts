import { k as __i18n_k } from '../i18n/index';
/* 2.0.7 (the user's request): the great single-game feats, kept on the player's page and in the news, and the
   nicknames they bring — a perfect game, a no-hitter (노히트 노런: no hit and no run, by one pitcher or the staff
   together), an immaculate inning (three strikeouts on nine pitches), a cycle (사이클링 히트), three home runs in a
   game, and home runs in three straight at-bats or more (연타석 홈런, across games: walks and sacrifices do not break
   it). Every first-team game of the regular season counts. */
import type { PlayerId, TeamId } from '../model/types';
import type { GameOut, TeamBox } from './engine/types';
import { iga } from './josa';
import { addNews } from './news';
import type { LeagueState } from './state';

export type FeatKind = 'perfect' | 'noHitter' | 'teamNoHitter' | 'immaculate' | 'cycle' | 'hr3' | 'hrStreak';

export interface Feat {
  kind: FeatKind;
  date: string;
  /** The club he did it against. */
  vs: TeamId;
  /** Home runs in the game (hr3) or in a row (hrStreak); the inning (immaculate). */
  n?: number;
}

const short = (s: LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? '';

/** A feat's name ("3연타석 홈런"). */
export function featLabel(f: Pick<Feat, 'kind' | 'n'>): string {
  switch (f.kind) {
    case 'perfect':
      return __i18n_k("league.feats.text.ce5342e4");
    case 'noHitter':
      return __i18n_k("league.feats.text.b1faa7c8");
    case 'teamNoHitter':
      return __i18n_k("league.feats.text.7ca86115");
    case 'immaculate':
      return __i18n_k("league.feats.text.17fb66f7");
    case 'cycle':
      return __i18n_k("league.feats.text.2fd46a6d");
    case 'hr3':
      return __i18n_k("league.feats.text.25d7b0b6", { n: f.n ?? 3 });
    case 'hrStreak':
      return __i18n_k("league.feats.text.f61129e2", { n: f.n ?? 3 });
  }
}

/** A feat as one line: "퍼펙트게임 · 2031-05-03 LG전". */
export function featText(s: LeagueState, f: Feat): string {
  return __i18n_k("league.feats.text.3fec3026", { label: featLabel(f), date: f.date, vs: short(s, f.vs) });
}

function add(s: LeagueState, id: PlayerId, f: Feat, team: TeamId) {
  const p = s.players[id];
  if (!p) return;
  (p.feats ??= []).push(f);
  const label = featLabel(f);
  const mine = !!s.user && team === s.user.teamId;
  addNews(s, {
    id: `feat-${f.kind}-${id}-${f.date}`,
    date: f.date,
    kind: 'milestone',
    title: __i18n_k("league.feats.text.74271aad", { name: p.name, label }),
    body: __i18n_k("league.feats.text.fc45d9bc", { team: short(s, team), name: iga(p.name), vs: short(s, f.vs), label }),
    quotes: [],
    facts: { name: p.name, feat: label, opponent: short(s, f.vs) },
    players: [id],
    ...(mine ? { mine } : {}),
  });
}

/** After a first-team game: each side's feats. */
export function featsGame(s: LeagueState, out: GameOut, date: string) {
  const sides: [TeamBox, TeamBox][] = [
    [out.home, out.away],
    [out.away, out.home],
  ];
  for (const [own, other] of sides) {
    // On the mound: the other side without a hit or a run over nine innings or more.
    if (out.innings >= 9 && other.hits === 0 && other.runs === 0 && own.pitching.length) {
      if (own.pitching.length === 1) {
        const free = other.batting.reduce((a, b) => a + b.bb + b.hbp, 0) === 0 && own.errors === 0;
        add(s, own.pitching[0]!.id, { kind: free ? 'perfect' : 'noHitter', date, vs: other.teamId }, own.teamId);
      } else for (const x of own.pitching) add(s, x.id, { kind: 'teamNoHitter', date, vs: other.teamId }, own.teamId);
    }
    for (const imm of own.immaculate ?? []) add(s, imm.pitcher, { kind: 'immaculate', date, vs: other.teamId, n: imm.inning }, own.teamId);
    // At the plate.
    for (const b of own.batting) {
      if (b.h - b.d - b.t - b.hr >= 1 && b.d >= 1 && b.t >= 1 && b.hr >= 1) add(s, b.id, { kind: 'cycle', date, vs: other.teamId }, own.teamId);
      if (b.hr >= 3) add(s, b.id, { kind: 'hr3', date, vs: other.teamId, n: b.hr }, own.teamId);
      if (!b.hrSeq?.length) continue;
      const runs = (s.hrRuns ??= {});
      for (const x of b.hrSeq) {
        if (!x) {
          delete runs[b.id];
          continue;
        }
        const n = (runs[b.id] ?? 0) + 1;
        runs[b.id] = n;
        if (n === 3) add(s, b.id, { kind: 'hrStreak', date, vs: other.teamId, n }, own.teamId);
        else if (n > 3) {
          // The streak goes on: the same feat, a longer run.
          const f = s.players[b.id]?.feats?.findLast((x) => x.kind === 'hrStreak');
          if (f) f.n = n;
        }
      }
    }
  }
}

/** His feats, the latest first. */
export const featsOf = (s: LeagueState, id: PlayerId) => [...(s.players[id]?.feats ?? [])].reverse();
