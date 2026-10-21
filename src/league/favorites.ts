/* 2.0.34 (the user's request: 선수 즐겨찾기): players the general manager keeps an eye on — ours or anyone's — starred
   from the player's screen and listed together with this season's line (and, for a pitcher on a club, how ready
   his arm is). Kept with the club in the save. */
import type { Player, PlayerId } from '../model/types';
import { armReady, type ArmReady } from './manager';
import { ageIn, isPitcher } from './players';
import type { LeagueState } from './state';
import { positionLabel, rates, shortName } from './views';

export const FAVORITES_MAX = 60;

export const isFavorite = (s: LeagueState, id: PlayerId) => !!s.user?.favorites?.includes(id);

export function setFavorite(s: LeagueState, id: PlayerId, on: boolean) {
  const u = s.user;
  if (!u || !s.players[id]) return;
  const list = (u.favorites ?? []).filter((x) => x !== id);
  if (on) list.push(id);
  u.favorites = list.slice(-FAVORITES_MAX);
}

export interface FavoriteRow {
  id: PlayerId;
  name: string;
  team: string;
  pos: string;
  age: number;
  grade: number;
  /** This season's line in a few figures. */
  line: string;
  arm: ArmReady | null;
}

const lineOf = (s: LeagueState, p: Player) => {
  const l = s.lines[p.id];
  if (isPitcher(p)) {
    const pit = l?.pit;
    return pit?.outs ? `ERA ${rates.era(pit).toFixed(2)} · ${pit.w}-${pit.l}${pit.sv ? ` · ${pit.sv}SV` : ''}${pit.hld ? ` · ${pit.hld}HLD` : ''} · ${rates.ip(pit.outs)}IP` : '-';
  }
  const bat = l?.bat;
  return bat?.pa ? `${rates.fmt3(rates.avg(bat))} · ${bat.hr}HR · OPS ${rates.fmt3(rates.ops(bat))}` : '-';
};

export function favoritesView(s: LeagueState): FavoriteRow[] {
  const date = s.schedule[s.next]?.date ?? `${s.year}-04-01`;
  return (s.user?.favorites ?? [])
    .map((id) => s.players[id])
    .filter((p): p is Player => !!p)
    .map((p) => ({
      id: p.id,
      name: p.name,
      team: p.teamId ? shortName(s, p.teamId) : '-',
      pos: positionLabel(p),
      age: ageIn(p, s.year),
      grade: p.scouting.current,
      line: lineOf(s, p),
      arm: isPitcher(p) && p.teamId && p.status === 'active' ? armReady(s, p, date, p.role === 'SP') : null,
    }));
}
