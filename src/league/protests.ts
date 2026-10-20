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
import { absLevel } from './board';
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
  /** Of the arguments over a reviewed call, the share that is over the review itself (an ejection by the rules). */
  review: 0.15,
  /** Fines (만원). */
  fine: { player: 50, manager: 100, coach: 50 },
};

const short = (s: LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? id;
/** A coach's or manager's own temper (staff have no traits): from his id, × 0.6–1.6. */
const staffHeat = (id: string) => 0.6 + hashUnit(`staff-temper|${id}`);

export type Call = 'ballStrike' | 'outSafe' | 'homeRun' | 'fairFoul';
/** 2.0.28: what he argued — balls and strikes only while the umpires call them (no ABS, board.ts absLevel), out or
    safe, a home run or a foul, fair or foul. The last three go to video review, and arguing the review is an ejection
    by the rules: a share of those arguments are over the review. */
const CALLS: [Call, number][] = [
  ['ballStrike', 0.45],
  ['outSafe', 0.3],
  ['homeRun', 0.1],
  ['fairFoul', 0.15],
];
const CALL_LABEL: Record<Call, () => string> = { ballStrike: () => __i18n_k("league.protests.text.12724a8b"), outSafe: () => __i18n_k("league.protests.text.6426c9ce"), homeRun: () => __i18n_k("league.protests.text.7009ac28"), fairFoul: () => __i18n_k("league.protests.text.942381a7") };

function callOf(s: LeagueState, r: () => number): { call: Call; review: boolean } {
  const abs = absLevel(s.year);
  const calls = CALLS.filter(([c]) => c !== 'ballStrike' || abs < 2);
  let x = r() * calls.reduce((a, [, w]) => a + w, 0);
  const call = (calls.find(([, w]) => (x -= w) < 0) ?? calls.at(-1)!)[0];
  // Reviewed: the plays on the bases and the lines, and balls and strikes under the challenge system.
  const reviewable = call !== 'ballStrike' || abs === 1;
  return { call, review: reviewable && r() < PROTESTS.review };
}

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
    // With the ABS calling balls and strikes, a good part of the arguments is gone.
    const share = absLevel(s.year) >= 2 ? 1 - CALLS[0]![1] : 1;
    if (r() >= PROTESTS.perSide * heat * share) continue;
    const { call, review } = callOf(s, r);
    const what = CALL_LABEL[call]();
    const fineLine = (fine: number) => __i18n_k("league.protests.text.72ca063a", { fine });
    const w = r();
    if (w < PROTESTS.who.player) {
      // The hotter heads go out first.
      let x = r() * players.reduce((a, p) => a + temperFactor(p), 0);
      const p = players.find((q) => (x -= temperFactor(q)) < 0) ?? players.at(-1)!;
      const f = temperFactor(p);
      const life = (p.life ??= {});
      life.protests = (life.protests ?? 0) + 1;
      const ejected = review || r() < Math.min(PROTESTS.eject.most, PROTESTS.eject.player * f);
      if (!ejected) {
        if (p.teamId === s.user?.teamId) (life.events ??= []).push({ date, text: __i18n_k("league.protests.text.894a5be0", { call: what }) });
        continue;
      }
      life.ejections = (life.ejections ?? 0) + 1;
      const banned = f >= PROTESTS.ban.temper && r() < PROTESTS.ban.chance;
      if (banned) {
        const prev = s.suspended?.[p.id];
        (s.suspended ??= {})[p.id] = { reason: __i18n_k("league.protests.text.bc04871e"), games: (prev?.games ?? 0) + PROTESTS.ban.games, ...(prev?.until ? { until: prev.until } : {}), since: date };
      }
      if (p.teamId === s.user?.teamId) (life.events ??= []).push({ date, text: __i18n_k("league.protests.text.cb8b9e96", { call: what }), tone: 'bad' });
      const head = review ? __i18n_k("league.protests.text.07530bfe", { name: iga(p.name), call: what }) : __i18n_k("league.protests.text.cb19e81b", { name: iga(p.name), call: what });
      report(s, side, gameId, date, {
        title: __i18n_k("league.protests.text.2f30d5a4", { club: short(s, side.teamId), name: p.name }),
        line: [head, fineLine(PROTESTS.fine.player), banned ? __i18n_k("league.protests.text.d0840a10", { games: PROTESTS.ban.games }) : ''].filter(Boolean).join(' '),
        players: [p.id],
        bad: true,
      });
    } else {
      const manager = w < PROTESTS.who.player + PROTESTS.who.manager;
      const staff = staffOf(s, side.teamId);
      const who = manager ? staff.manager : r() < 0.5 ? staff.hitting : staff.pitching;
      if (!who || !(review || r() < Math.min(PROTESTS.eject.most, (manager ? PROTESTS.eject.manager : PROTESTS.eject.coach) * staffHeat(who.id)))) continue;
      const club = short(s, side.teamId);
      const role = manager ? __i18n_k("league.protests.text.daec431c") : who.role === 'hitting' ? __i18n_k("league.protests.text.8a5c9a74") : __i18n_k("league.protests.text.0b977195");
      const particle = iga(role).slice(role.length);
      const head = review
        ? __i18n_k("league.protests.text.a81e2102", { club, name: who.name, role, particle, call: what })
        : __i18n_k("league.protests.text.f4bafc6e", { club, name: who.name, role, particle, call: what });
      report(s, side, gameId, date, {
        title: __i18n_k("league.protests.text.71eee772", { club, name: who.name, role }),
        line: `${head} ${fineLine(manager ? PROTESTS.fine.manager : PROTESTS.fine.coach)}`,
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
