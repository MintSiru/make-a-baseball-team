/* Players the screens make up on the spot and the league does not hold yet — the in-season foreign market and the
   injury stand-ins (trade.ts foreignMarket, tempforeign.ts tempMarket): kept here for this tab so the player window
   can open them before they sign. */
import type { Player, PlayerId } from '../model/types';
import type { LeagueState } from '../league/state';

const shown = new Map<PlayerId, Player>();

/** Remembers the players on a market list (the latest list wins). */
export function previewPlayers(players: Player[]) {
  for (const p of players) shown.set(p.id, p);
}

/** The league with the player to open, if he is only on a market list. */
export function withPreview(league: LeagueState, id: PlayerId): LeagueState {
  if (league.players[id]) return league;
  const p = shown.get(id);
  return p ? { ...league, players: { ...league.players, [id]: p } } : league;
}
