import { k as __i18n_k } from '../i18n/index';
/* 2.0.28 (the user's request): a player's moves, from the draft on — the second draft, free-agent deals (and the
   ones who stayed), compensation picks, releases and waiver claims, unattached signings, trades, foreign signings,
   postings and returns, retirement. Each move is noted on the player as it happens (`noteMove`, from the transaction
   news and the few places that move a player without an article); the screen reads them back with his draft pick
   from the draft log, and for a save from before 2.0.28 the club changes his career shows (`moveHistory`). For the
   screen only: nothing in the simulation reads them. */
import type { Player, PlayerId, TeamId } from '../model/types';
import { today } from './entry';
import type { Move } from './movenews';
import type { LeagueState } from './state';

export type MoveKind =
  | 'draft'
  | 'join'
  | 'foreignSign'
  | 'special'
  | 'secondDraft'
  | 'fa'
  | 'faStay'
  | 'compensation'
  | 'trade'
  | 'release'
  | 'waiver'
  | 'pool'
  | 'signReleased'
  | 'unsigned'
  | 'foreign'
  | 'foreignOut'
  | 'temp'
  | 'posting'
  | 'abroad'
  | 'returnee'
  | 'retire'
  | 'change';

export interface MoveEntry {
  date: string;
  kind: MoveKind;
  from: TeamId | null;
  to: TeamId | null;
  /** What came with it: the other side of a trade, a deal's terms, the free agent a pick replaced. */
  note?: string;
}

export const MOVE_LABELS: Record<MoveKind, string> = {
  draft: __i18n_k("league.moves.text.7bd24a81"),
  join: __i18n_k("league.moves.text.81af228b"),
  foreignSign: __i18n_k("league.moves.text.7f403bab"),
  special: __i18n_k("league.moves.text.5293fe40"),
  secondDraft: __i18n_k("league.moves.text.7021a262"),
  fa: __i18n_k("league.moves.text.463ba92b"),
  faStay: __i18n_k("league.moves.text.f3e074c4"),
  compensation: __i18n_k("league.moves.text.ddded6e0"),
  trade: __i18n_k("league.moves.text.428749ee"),
  release: __i18n_k("league.moves.text.e16b5dd5"),
  waiver: __i18n_k("league.moves.text.f49fc0c2"),
  pool: __i18n_k("league.moves.text.588bc601"),
  signReleased: __i18n_k("league.moves.text.b2daafc4"),
  unsigned: __i18n_k("league.moves.text.10f7aeca"),
  foreign: __i18n_k("league.moves.text.7e0f0b07"),
  foreignOut: __i18n_k("league.moves.text.73e37503"),
  temp: __i18n_k("league.moves.text.ce2be3ab"),
  posting: __i18n_k("league.moves.text.c02cebf4"),
  abroad: __i18n_k("league.moves.text.40adaebf"),
  returnee: __i18n_k("league.moves.text.14a364f7"),
  retire: __i18n_k("league.moves.text.5b170d3c"),
  change: __i18n_k("league.moves.text.b16017b2"),
};

const KEEP = 40;
const dateOf = (s: LeagueState) => (s.phase === 'regular' ? today(s) : `${s.year}-11-01`);
const short = (s: LeagueState, id: TeamId | null) => (id ? (s.teams.find((t) => t.id === id)?.short ?? id) : '');

/** Notes a move on the player. */
export function noteMove(s: LeagueState, p: Player | undefined, kind: MoveKind, from: TeamId | null, to: TeamId | null, note?: string, date = dateOf(s)) {
  if (!p) return;
  const list = (p.moves ??= []);
  list.push({ date, kind, from, to, ...(note ? { note } : {}) });
  if (list.length > KEEP) list.splice(0, list.length - KEEP);
}

/** A foreign player his club did not keep (a release is noted already, the same day). */
export function noteForeignOut(s: LeagueState, p: Player, from: TeamId | null) {
  const last = p.moves?.at(-1);
  if (last && (last.kind === 'release' || last.kind === 'foreignOut') && last.date === dateOf(s)) return;
  noteMove(s, p, 'foreignOut', from, null);
}

/** The moves a transaction article is about (movenews.ts calls it first, with or without the user's club). */
export function noteNewsMove(s: LeagueState, m: Move, date: string) {
  const p = (id: PlayerId) => s.players[id];
  const names = (ids: PlayerId[]) => ids.map((id) => p(id)?.name ?? '').filter(Boolean).join('·');
  switch (m.type) {
    case 'trade': {
      const back = (ids: PlayerId[], picks: number[] | undefined, cash: number) =>
        [names(ids), picks?.length ? __i18n_k("league.moves.text.dacef53e", { rounds: picks.map((r) => `${r}R`).join('·') }) : '', cash > 0 ? __i18n_k("league.moves.text.6102409b") : ''].filter(Boolean).join(' + ');
      for (const id of m.fromA) noteMove(s, p(id), 'trade', m.a, m.b, __i18n_k("league.moves.text.3f2a4ab2", { what: back(m.fromB, m.picksB, -(m.cash ?? 0)) }), date);
      for (const id of m.fromB) noteMove(s, p(id), 'trade', m.b, m.a, __i18n_k("league.moves.text.3f2a4ab2", { what: back(m.fromA, m.picksA, m.cash ?? 0) }), date);
      break;
    }
    case 'release':
      noteMove(s, p(m.id), 'release', m.teamId, null, m.waiver ? __i18n_k("league.moves.text.29e07476") : undefined, date);
      break;
    case 'claim':
      noteMove(s, p(m.id), 'waiver', m.from, m.teamId, undefined, date);
      break;
    case 'pool':
      noteMove(s, p(m.id), 'pool', null, m.teamId, undefined, date);
      break;
    case 'foreign':
      noteMove(s, p(m.in), 'foreign', null, m.teamId, m.out ? __i18n_k("league.moves.text.ad27e2a4", { name: m.out.name }) : undefined, date);
      break;
    case 'posting':
      if (m.deal) noteMove(s, p(m.id), 'posting', m.teamId, null, m.npb ? __i18n_k("league.moves.text.d2a1e644") : __i18n_k("league.moves.text.d4983f92"), date);
      break;
    case 'fa': {
      const terms = __i18n_k("league.moves.text.044a2535", { years: m.years });
      noteMove(s, p(m.id), m.from === m.to ? 'faStay' : 'fa', m.from, m.to, `${m.grade} · ${terms}`, date);
      break;
    }
    case 'secondDraft':
      noteMove(s, p(m.id), 'secondDraft', m.from, m.teamId, `${m.round}R`, date);
      break;
    case 'returnee':
      noteMove(s, p(m.id), 'returnee', null, m.teamId, m.own ? __i18n_k("league.moves.text.1e560f41") : undefined, date);
      break;
  }
}

export interface MoveRow {
  /** "2027-11-01", or a year alone for a move read off his career. */
  date: string;
  kind: MoveKind;
  label: string;
  from: string;
  to: string;
  note: string;
}

/** His moves, first to last: how he came in (his draft pick, or his first club), then each one noted, and for a
    save from before 2.0.28 the club changes his career shows. */
export function moveHistory(s: LeagueState, p: Pick<Player, 'id' | 'career' | 'origin' | 'moves'>): MoveRow[] {
  const rows: MoveRow[] = [];
  const row = (date: string, kind: MoveKind, from: TeamId | null, to: TeamId | null, note = '') => rows.push({ date, kind, label: MOVE_LABELS[kind], from: short(s, from), to: short(s, to), note });
  const pick = s.draftLog?.find((x) => x.id === p.id);
  const career = [...p.career].sort((a, b) => a.year - b.year);
  const first = career[0];
  if (pick) row(`${pick.year}-09-15`, 'draft', null, pick.teamId, pick.territorial ? __i18n_k("league.moves.text.f1f3e66a") : __i18n_k("league.moves.text.55390f32", { label: pick.label, overall: pick.overall }));
  else if (first && !p.moves?.some((m) => m.date.slice(0, 4) < String(first.year))) row(String(first.year), p.origin.kind === 'foreign' ? 'foreignSign' : 'join', null, first.teamId);
  // Club changes before the moves were noted (a save from before 2.0.28): each new club in his career.
  const noted = p.moves ?? [];
  const since = noted.length ? Number(noted[0]!.date.slice(0, 4)) : Infinity;
  for (let i = 1; i < career.length; i++) {
    const a = career[i - 1]!,
      b = career[i]!;
    if (a.teamId === b.teamId || b.year > since) continue;
    if (noted.some((m) => m.to === b.teamId && Number(m.date.slice(0, 4)) >= a.year && Number(m.date.slice(0, 4)) <= b.year)) continue;
    row(String(b.year), 'change', a.teamId, b.teamId);
  }
  for (const m of noted) row(m.date, m.kind, m.from, m.to, m.note ?? '');
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}
