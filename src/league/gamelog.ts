/* 2.0.64 (the user's requests): a player's season in more pieces, kept beside his season line and never instead of
   it — so the records, the awards and the manager read the same totals as before.
   - His last ten first-team games (newest last), each in a few numbers, and the season by month.
   - A player who changes clubs in the season (a trade, a waiver claim, a release and a new club): his line at each
     club in turn. The season line stays whole; the parts are what the record shows under it.
   The games and months are this season's alone (a save stays small); the parts go into his career with the season. */
import type { TeamBox } from './engine/types';
import { addInto, emptyBat, emptyPit, type SeasonLine } from './state';
import type { BatTotals, PitTotals, PlayerId, TeamId } from '../model/types';

/** A game in a few numbers: 타석·타수·안타·2루타·3루타·홈런·타점·득점·볼넷·삼진·도루. */
export type BatGame = [pa: number, ab: number, h: number, d: number, t: number, hr: number, rbi: number, r: number, bb: number, k: number, sb: number];
/** 아웃·피안타·실점·자책·볼넷·삼진·피홈런·투구 수·승·패·세이브·홀드·선발. */
export type PitGame = [outs: number, h: number, r: number, er: number, bb: number, k: number, hr: number, pitches: number, w: number, l: number, sv: number, hld: number, gs: number];

export interface GameRow {
  date: string;
  opp: TeamId;
  home: boolean;
  bat?: BatGame;
  pit?: PitGame;
}

/** A club's share of a season split between clubs. */
export interface SeasonPart {
  teamId: TeamId;
  days: number;
  bat: BatTotals | null;
  pit: PitTotals | null;
}

export const GAMELOG = { last: 10 };

/** The counting numbers of a batting or pitching total, without the splits and the batted balls. */
const batCounts = (b: Partial<BatTotals>) => addInto(emptyBat(), { ...b, split: undefined, posG: undefined, bip: undefined, fld: undefined, spray: undefined });
const pitCounts = (p: Partial<PitTotals>) => addInto(emptyPit(), { ...p, split: undefined, bip: undefined });

/** The part of his season at `teamId`: begun when he first appears for a second club (the earlier club's part is
    his line so far), then the last part while he stays. Null while he has played for one club only. */
export function partFor(line: SeasonLine, teamId: TeamId): SeasonPart | null {
  const last = line.parts?.at(-1);
  if (last?.teamId === teamId) return last;
  if (!line.parts && line.teamId === teamId) return null;
  if (!line.parts) line.parts = [{ teamId: line.teamId, days: line.days, bat: line.bat ? batCounts(line.bat) : null, pit: line.pit ? pitCounts(line.pit) : null }];
  const part: SeasonPart = { teamId, days: 0, bat: null, pit: null };
  line.parts.push(part);
  return part;
}

/** Before a game's box is added to the season lines: a player appearing for a new club starts his part there. */
export function notePart(lines: Record<PlayerId, SeasonLine>, box: TeamBox) {
  for (const x of [...box.batting, ...box.pitching]) {
    const line = lines[x.id];
    if (line) partFor(line, box.teamId);
  }
}

/** After a game's box went into the season lines: the game row, the month and the club's part. */
export function logGame(lines: Record<PlayerId, SeasonLine>, box: TeamBox, date: string, opp: TeamId, home: boolean) {
  const month = date.slice(5, 7);
  const rows = new Map<PlayerId, GameRow>();
  const row = (id: PlayerId) => {
    let r = rows.get(id);
    if (!r) rows.set(id, (r = { date, opp, home }));
    return r;
  };
  for (const b of box.batting) {
    const line = lines[b.id];
    if (!line) continue;
    if (b.pa > 0) row(b.id).bat = [b.pa, b.ab, b.h, b.d, b.t, b.hr, b.rbi, b.r, b.bb, b.k, b.sb];
    // As the season line counts a game: a plate appearance, or in the game as a substitute.
    const played = b.pa > 0 || !!b.sub ? 1 : 0;
    const m = ((line.months ??= {})[month] ??= {});
    addInto((m.bat ??= emptyBat()), batCounts(b));
    m.bat.g += played;
    const part = line.parts?.at(-1);
    if (part?.teamId === box.teamId) {
      addInto((part.bat ??= emptyBat()), batCounts(b));
      part.bat.g += played;
    }
  }
  for (const p of box.pitching) {
    const line = lines[p.id];
    if (!line) continue;
    row(p.id).pit = [p.outs, p.h, p.r, p.er, p.bb, p.k, p.hr, p.pitches, p.w, p.l, p.sv, p.hld, p.gs];
    const m = ((line.months ??= {})[month] ??= {});
    addInto((m.pit ??= emptyPit()), pitCounts(p));
    m.pit.g++;
    const part = line.parts?.at(-1);
    if (part?.teamId === box.teamId) {
      addInto((part.pit ??= emptyPit()), pitCounts(p));
      part.pit.g++;
    }
  }
  for (const [id, r] of rows) {
    const line = lines[id]!;
    const games = (line.last ??= []);
    games.push(r);
    if (games.length > GAMELOG.last) games.splice(0, games.length - GAMELOG.last);
  }
}
