import { k as __i18n_k } from '../i18n/index';
/* 2.0.36 (the user's request: 선수들간의 라이벌리): rivalries between players. At the first game day of each season the
   league's rivalries are drawn up from what the papers would make of them:

   - 동갑내기: two of the league's better players born the same year, at the same position (or both starters, both
     relievers), on different clubs;
   - 드래프트 동기: two first-round picks of the same draft;
   - 천적: a pitcher and a hitter who have met thirty times and more.

   A rivalry lasts while both are in the league. Our players' rivalries come first (the papers follow our club). When
   rivals meet the crowd is a little bigger (fans.ts), the papers write up the day one of ours outplays (or is
   outplayed by) his rival, and at the start of each season the year before is weighed up. */
import type { Player, PlayerId } from '../model/types';
import { addNews } from './news';
import { iga, wagwa } from './josa';
import { isForeign, isPitcher } from './players';
import { firstTeamIds, type LeagueState } from './state';
import { positionLabel } from './views';
import { PLAYER_RIVALS } from './tuning';

export const RIVALS = PLAYER_RIVALS;

export type RivalWhy = 'peers' | 'draft' | 'duel';

export interface Rivalry {
  a: PlayerId;
  b: PlayerId;
  why: RivalWhy;
  since: number;
}

const born = (p: Player) => Number(p.birthday.slice(0, 4));
const roleKey = (p: Player) => (isPitcher(p) ? p.role : (p.position ?? p.role));
const key = (a: PlayerId, b: PlayerId) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** The rivalries in force (this season's). */
export const rivalriesOf = (s: LeagueState): Rivalry[] => s.playerRivals?.list ?? [];

/** A player's rivals. */
export function rivalsOf(s: LeagueState, id: PlayerId): { id: PlayerId; why: RivalWhy; since: number }[] {
  return rivalriesOf(s)
    .filter((x) => x.a === id || x.b === id)
    .map((x) => ({ id: x.a === id ? x.b : x.a, why: x.why, since: x.since }));
}

/** What the rivalry is, in a few words. */
export function rivalText(s: LeagueState, me: PlayerId, other: PlayerId, why: RivalWhy): string {
  const p = s.players[me],
    o = s.players[other];
  if (!p || !o) return '';
  if (why === 'peers') return __i18n_k("league.rivals.text.14b62ed6", { year: born(p), pos: positionLabel(p) });
  if (why === 'draft') return __i18n_k("league.rivals.text.1884b087", { year: p.origin.draftYear ? p.origin.draftYear + 1 : '' });
  return isPitcher(p) ? __i18n_k("league.rivals.text.86d1981a") : __i18n_k("league.rivals.text.208e7ab2");
}

const inLeague = (s: LeagueState, id: PlayerId) => {
  const p = s.players[id];
  return !!p && p.status === 'active' && !!p.teamId && firstTeamIds(s).includes(p.teamId);
};

/** The season's rivalries: the old ones that hold, new ones up to the limit (ours first). */
export function drawRivals(s: LeagueState, year: number) {
  const old = rivalriesOf(s).filter((x) => inLeague(s, x.a) && inLeague(s, x.b));
  const taken = new Set(old.flatMap((x) => [x.a, x.b]));
  const seen = new Set(old.map((x) => key(x.a, x.b)));
  const me = s.user?.teamId ?? null;
  const pool = Object.values(s.players).filter((p) => inLeague(s, p.id) && p.scouting.current >= RIVALS.grade);
  const found: (Rivalry & { score: number })[] = [];
  const offer = (a: Player, b: Player, why: RivalWhy, score: number) => {
    if (a.id === b.id || seen.has(key(a.id, b.id))) return;
    seen.add(key(a.id, b.id));
    found.push({ a: a.id, b: b.id, why, since: year, score: score + (a.teamId === me || b.teamId === me ? 100 : 0) });
  };
  // 동갑내기 at the same post, on different clubs.
  const byPeer = new Map<string, Player[]>();
  for (const p of pool) if (!isForeign(p)) byPeer.set(`${born(p)}|${roleKey(p)}`, [...(byPeer.get(`${born(p)}|${roleKey(p)}`) ?? []), p]);
  for (const group of byPeer.values()) {
    const sorted = group.sort((x, y) => y.scouting.current - x.scouting.current);
    for (let i = 0; i < sorted.length; i++)
      for (let j = i + 1; j < sorted.length; j++) if (sorted[i]!.teamId !== sorted[j]!.teamId) offer(sorted[i]!, sorted[j]!, 'peers', sorted[i]!.scouting.current + sorted[j]!.scouting.current);
  }
  // 드래프트 동기: first-round picks of the same draft (ten picks a round, game assumption for the first ten).
  const byDraft = new Map<number, Player[]>();
  for (const p of pool) if (p.origin.draftYear && (p.origin.overallPick ?? 99) <= 10) byDraft.set(p.origin.draftYear, [...(byDraft.get(p.origin.draftYear) ?? []), p]);
  for (const group of byDraft.values()) {
    const sorted = group.sort((x, y) => y.scouting.current - x.scouting.current);
    for (let i = 0; i < sorted.length; i++) for (let j = i + 1; j < sorted.length; j++) offer(sorted[i]!, sorted[j]!, 'draft', sorted[i]!.scouting.current + sorted[j]!.scouting.current - 5);
  }
  // 천적: a hitter and a pitcher who have met often.
  for (const [k, m] of Object.entries(s.matchupsAll ?? {})) {
    if ((m[0] ?? 0) < RIVALS.duelPa) continue;
    const [b, p] = k.split('|') as [PlayerId, PlayerId];
    const hb = s.players[b],
      hp = s.players[p];
    if (!hb || !hp || !inLeague(s, b) || !inLeague(s, p) || hb.teamId === hp.teamId) continue;
    if (hb.scouting.current < RIVALS.grade && hp.scouting.current < RIVALS.grade) continue;
    offer(hp, hb, 'duel', hb.scouting.current + hp.scouting.current + (m[0] ?? 0) / 5);
  }
  found.sort((x, y) => y.score - x.score);
  const list = [...old];
  const mineCount = () => list.filter((x) => s.players[x.a]?.teamId === me || s.players[x.b]?.teamId === me).length;
  for (const r of found) {
    if (list.length >= RIVALS.max) break;
    if (taken.has(r.a) || taken.has(r.b)) continue;
    const mine = s.players[r.a]?.teamId === me || s.players[r.b]?.teamId === me;
    if (mine && mineCount() >= RIVALS.mine) continue;
    list.push({ a: r.a, b: r.b, why: r.why, since: r.since });
    taken.add(r.a);
    taken.add(r.b);
  }
  // The year before, weighed up (ours only).
  for (const r of old) weighUp(s, r, year - 1);
  s.playerRivals = { year, list };
}

export { rivalsMeet } from './fans';

const warIn = (p: Player, year: number) => p.career.filter((c) => c.year === year && !c.level).reduce((a, c) => a + c.war, 0);

function weighUp(s: LeagueState, r: Rivalry, year: number) {
  const me = s.user?.teamId;
  const a = s.players[r.a],
    b = s.players[r.b];
  if (!a || !b || !me || (a.teamId !== me && b.teamId !== me)) return;
  const [ours, theirs] = a.teamId === me ? [a, b] : [b, a];
  const wo = Math.round(warIn(ours, year) * 10) / 10,
    wt = Math.round(warIn(theirs, year) * 10) / 10;
  if (!wo && !wt) return;
  const date = `${year + 1}-03-20`;
  const won = wo >= wt;
  addNews(s, {
    id: `rival-season-${key(a.id, b.id)}-${year}`,
    date,
    kind: 'interview',
    title: won ? __i18n_k("league.rivals.text.cb902471", { ours: ours.name, theirs: theirs.name, year }) : __i18n_k("league.rivals.text.0e62d907", { ours: ours.name, theirs: theirs.name }),
    body: __i18n_k("league.rivals.text.443d1b1c", { year, ours: ours.name, theirs: theirs.name, wo, wt }),
    quotes: [],
    facts: { ours: ours.name, theirs: theirs.name, year },
    players: [ours.id, theirs.id],
    mine: true,
  });
}

/** After a game day: when one of ours met his rival and one clearly had the better of it, the papers say so. */
export function rivalDay(s: LeagueState, date: string) {
  if (s.phase !== 'regular') return;
  if (s.playerRivals?.year !== s.year) drawRivals(s, s.year);
  const me = s.user?.teamId;
  if (!me) return;
  for (const r of rivalriesOf(s)) {
    const a = s.players[r.a],
      b = s.players[r.b];
    if (!a || !b || (a.teamId !== me && b.teamId !== me)) continue;
    const box = Object.values(s.boxes ?? {}).find((x) => x.date === date && ((x.home === a.teamId && x.away === b.teamId) || (x.home === b.teamId && x.away === a.teamId)));
    if (!box) continue;
    const score = (p: Player) => {
      const side = box.home === p.teamId ? 1 : 0;
      const bat = box.bat[side].find((row) => row[0] === p.id);
      const pit = box.pit[side].find((row) => row[0] === p.id);
      if (pit) return { line: __i18n_k("league.rivals.text.0f443bb2", { ip: Math.floor((pit[1] as number) / 3), er: pit[4] as number }), v: (pit[1] as number) / 3 - 2 * (pit[4] as number) };
      if (bat) return { line: __i18n_k("league.rivals.text.b7c0fa98", { ab: bat[2] as number, h: bat[4] as number, hr: bat[6] as number }), v: (bat[4] as number) + 2 * (bat[6] as number) + 0.5 * (bat[5] as number) - 0.3 * (bat[2] as number) };
      return null;
    };
    const sa = score(a),
      sb = score(b);
    if (!sa || !sb || Math.abs(sa.v - sb.v) < 2) continue;
    const [win, lose, lw, ll] = sa.v > sb.v ? [a, b, sa, sb] : [b, a, sb, sa];
    addNews(s, {
      id: `rival-${key(a.id, b.id)}-${date}`,
      date,
      kind: 'interview',
      title: __i18n_k("league.rivals.text.cc3e0532", { win: win.name }),
      body: __i18n_k("league.rivals.text.3bd0b591", { why: rivalText(s, win.id, lose.id, r.why), win: iga(win.name), lose: wagwa(lose.name), win2: win.name, lw: lw.line, lose2: lose.name, ll: ll.line }),
      quotes: [],
      facts: { win: win.name, lose: lose.name },
      players: [win.id, lose.id],
      mine: true,
    });
  }
}
