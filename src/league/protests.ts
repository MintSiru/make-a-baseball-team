import { k as __i18n_k } from '../i18n/index';
/* 2.0.28 (the user's request): arguing the call (판정 불복). Now and then after a close call a player, the manager or a
   coach goes out to argue it. Most of the time it ends there; sometimes the umpires throw him out — a player with a
   hot temper (논쟁성, traits.ts) far more often — and the KBO fines him, and a hothead who keeps at it sits out a game.
   The game is already played (its box score stands): this is the argument in the story, the fine and the suspension
   after it, like the bench-clearings (brawl.ts). An ejection is in the papers, ours in a popup; an argument that went
   no further is only on our own player's page. The numbers are game assumptions (a KBO season has some ten to fifteen
   ejections, most of them over a call; a fine of half a million to a million won). */
import { hashUnit, rng } from '../draftroom';
import type { Player, TeamId } from '../model/types';
import { addAlert } from './alerts';
import type { GameOut, TeamBox } from './engine/types';
import { iga } from './josa';
import { addNews } from './news';
import { staffOf } from './staff';
import type { LeagueState } from './state';
import { temperFactor } from './traits';

export const PROTESTS = {
  /** A side argues a call this often a game (the average temper; hotter lineups more). */
  perSide: 0.03,
  /** Who goes out: a player, the manager, a coach. */
  who: { player: 0.6, manager: 0.3 },
  /** The umpires throw him out this often: a player of average temper, × his temper factor; the manager; a coach. */
  eject: { player: 0.1, manager: 0.3, coach: 0.2, most: 0.7 },
  /** A player this hot (논쟁성) who is thrown out may sit out a game too. */
  ban: { temper: 1.8, chance: 0.35, games: 1 },
  /** Fines (만원). */
  fine: { player: 50, manager: 100, coach: 50 },
};

const short = (s: LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? id;
/** A coach's or manager's own temper (staff have no traits): from his id, × 0.6–1.6. */
const staffHeat = (id: string) => 0.6 + hashUnit(`staff-temper|${id}`);

/** After a game: each side may argue a call. */
export function protestGame(s: LeagueState, out: GameOut, gameId: string, date: string) {
  for (const [side, k] of [
    [out.home, 'home'],
    [out.away, 'away'],
  ] as const) {
    const r = rng(`${s.seed}|protest|${gameId}|${k}`);
    const players = [...side.batting.filter((b) => b.pa > 0), ...side.pitching].map((x) => s.players[x.id]).filter((p): p is Player => !!p);
    if (!players.length) continue;
    const heat = players.reduce((a, p) => a + temperFactor(p), 0) / players.length;
    if (r() >= PROTESTS.perSide * heat) continue;
    const w = r();
    if (w < PROTESTS.who.player) {
      // The hotter heads go out first.
      let x = r() * players.reduce((a, p) => a + temperFactor(p), 0);
      const p = players.find((q) => (x -= temperFactor(q)) < 0) ?? players.at(-1)!;
      const f = temperFactor(p);
      const life = (p.life ??= {});
      life.protests = (life.protests ?? 0) + 1;
      const ejected = r() < Math.min(PROTESTS.eject.most, PROTESTS.eject.player * f);
      if (!ejected) {
        if (p.teamId === s.user?.teamId) (life.events ??= []).push({ date, text: __i18n_k("league.protests.text.74a28135") });
        continue;
      }
      life.ejections = (life.ejections ?? 0) + 1;
      const banned = f >= PROTESTS.ban.temper && r() < PROTESTS.ban.chance;
      if (banned) {
        const prev = s.suspended?.[p.id];
        (s.suspended ??= {})[p.id] = { reason: __i18n_k("league.protests.text.bc04871e"), games: (prev?.games ?? 0) + PROTESTS.ban.games, ...(prev?.until ? { until: prev.until } : {}), since: date };
      }
      if (p.teamId === s.user?.teamId) (life.events ??= []).push({ date, text: __i18n_k("league.protests.text.c89e3d1d"), tone: 'bad' });
      report(s, side, gameId, date, {
        title: __i18n_k("league.protests.text.2f30d5a4", { club: short(s, side.teamId), name: p.name }),
        line: banned
          ? __i18n_k("league.protests.text.a48d4072", { name: iga(p.name), fine: PROTESTS.fine.player, games: PROTESTS.ban.games })
          : __i18n_k("league.protests.text.bad91aad", { name: iga(p.name), fine: PROTESTS.fine.player }),
        players: [p.id],
        bad: true,
      });
    } else {
      const manager = w < PROTESTS.who.player + PROTESTS.who.manager;
      const staff = staffOf(s, side.teamId);
      const who = manager ? staff.manager : r() < 0.5 ? staff.hitting : staff.pitching;
      if (!who || r() >= Math.min(PROTESTS.eject.most, (manager ? PROTESTS.eject.manager : PROTESTS.eject.coach) * staffHeat(who.id))) continue;
      const club = short(s, side.teamId);
      const role = manager ? __i18n_k("league.protests.text.daec431c") : who.role === 'hitting' ? __i18n_k("league.protests.text.8a5c9a74") : __i18n_k("league.protests.text.0b977195");
      report(s, side, gameId, date, {
        title: __i18n_k("league.protests.text.71eee772", { club, name: who.name, role }),
        line: __i18n_k("league.protests.text.2b0801cc", { club, name: who.name, role, particle: iga(role).slice(role.length), fine: manager ? PROTESTS.fine.manager : PROTESTS.fine.coach }),
        players: [],
        bad: true,
      });
    }
  }
}

function report(s: LeagueState, side: TeamBox, gameId: string, date: string, x: { title: string; line: string; players: string[]; bad: boolean }) {
  const mine = side.teamId === s.user?.teamId;
  const id = `protest-${gameId}-${side.teamId}`;
  addNews(s, { id, date, kind: 'game', title: x.title, body: x.line, quotes: [], facts: { 사유: __i18n_k("league.protests.text.0790461a") }, players: x.players, ...(mine ? { mine } : {}) });
  if (mine) addAlert(s, { id, date, kind: 'season', title: x.title, lines: [x.line], ...(x.bad ? { tone: 'bad' as const } : {}), players: x.players });
}
