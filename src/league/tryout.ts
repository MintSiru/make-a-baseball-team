import { k as __i18n_k } from '../i18n/index';
/* 1.9.6: the foreign players' tryout draft (외국인 선수 트라이아웃), for a league that plays history (rules/history.ts:
   1998 and 1999). The clubs meet the players the league invited in one camp and take turns: the last of last season
   first, round by round, each club as many as it has foreign places left (its own from last year re-signed or let
   go first). Every pick is paid the same: what he asks, at most the cap (12만 달러). Free signing replaces it in
   2000 (RULES.md §14, S96).

   The user's club picks in its turn (the foreign decision, one player a round, no talks); the AI clubs' picks before
   each of its turns are made first, so it sees who is gone. */
import { rng } from '../draftroom';
import { historicForeignCap, rulesFor } from '../rules/history';
import type { Player, PlayerId, TeamId } from '../model/types';
import { foreignContract } from './contracts';
import { playsHistory } from './era';
import { splitContract, usd } from './foreign';
import { foreignSlots } from './manager';
import { addNews } from './news';
import { foreignOn, sign } from './offseason';
import { currentValue, isPitcher, makeForeign } from './players';
import { firstTeamIds, type Decision, type LeagueState } from './state';

/** How many the league invites for each place to fill. */
const INVITED_PER_PLACE = 3;

export interface ForeignTryout {
  year: number;
  /** Invited players still unpicked. */
  pool: PlayerId[];
  /** Pick order (the last of last season first) and the places each club has to fill. */
  order: TeamId[];
  places: Record<TeamId, number>;
  picks: { teamId: TeamId; id: PlayerId | null; round: number }[];
  done?: boolean;
}

/** The season's foreign players come through the tryout draft. */
export const tryoutYear = (next: number) => playsHistory() && rulesFor(next).foreign.signing === 'tryout';

/** Opens the tryout (once a winter): the order, each club's open places and the invited players. */
export function openTryout(s: LeagueState, next: number): ForeignTryout {
  const legacy = (s.legacy ??= { clubs: [] });
  if (legacy.tryout?.year === next) return legacy.tryout;
  const table = s.history[s.history.length - 1]?.table ?? [];
  const clubs = firstTeamIds(s, next);
  const order = [...[...table].reverse().map((r) => r.teamId), ...clubs].filter((id, i, all) => clubs.includes(id) && all.indexOf(id) === i);
  const places = Object.fromEntries(order.map((id) => [id, Math.max(0, foreignSlots(s, id, next).regular - foreignOn(s, id).filter((p) => p.contract?.salaries.some((x) => x.season >= next)).length)]));
  const total = Object.values(places).reduce((a, b) => a + b, 0);
  const cap = historicForeignCap(next) ?? 120_000;
  const r = rng(`${s.seed}|tryout-pay|${next}`);
  const pool: PlayerId[] = [];
  for (let i = 0; i < total * INVITED_PER_PLACE; i++) {
    const p = makeForeign(s.seed, `ft${next}-${i}`, next, { kind: i % 5 < 3 ? 'pitcher' : 'hitter', asiaQuota: false });
    p.status = 'amateur';
    p.contract = foreignContract('', next, splitContract(p.origin.background!.ask, r), false, cap);
    s.players[p.id] = p;
    pool.push(p.id);
  }
  return (legacy.tryout = { year: next, pool, order, places, picks: [] });
}

/** Whose turn it is: the club and the round, or null when every place is filled (or nobody is left). */
function turn(t: ForeignTryout): { teamId: TeamId; round: number } | null {
  if (!t.pool.length) return null;
  const rounds = Math.max(0, ...Object.values(t.places));
  for (let round = 1; round <= rounds; round++)
    for (const teamId of t.order) {
      if ((t.places[teamId] ?? 0) < round) continue;
      if (!t.picks.some((x) => x.teamId === teamId && x.round === round)) return { teamId, round };
    }
  return null;
}

/** The AI club's pick: a pitcher while it has none, else the best left. */
function aiPick(s: LeagueState, t: ForeignTryout, teamId: TeamId): Player {
  const left = t.pool.map((id) => s.players[id]!);
  const pitchers = foreignOn(s, teamId).filter(isPitcher).length;
  const wanted = pitchers ? left : left.filter(isPitcher);
  return (wanted.length ? wanted : left).sort((a, b) => currentValue(b) - currentValue(a))[0]!;
}

/** Signs a pick at the tryout's pay. */
export function takeTryoutPick(s: LeagueState, t: ForeignTryout, teamId: TeamId, round: number, id: PlayerId | null) {
  t.picks.push({ teamId, id, round });
  if (!id) return;
  t.pool = t.pool.filter((x) => x !== id);
  const p = s.players[id]!;
  sign(s, p, teamId, { ...p.contract!, teamId });
}

/** Runs the AI clubs' picks up to the user's next turn (or to the end): the user's decision then, or null when the
    tryout is over (the players left go home). */
export function runTryout(s: LeagueState, next: number, userInIt: boolean): Decision | null {
  const t = openTryout(s, next);
  for (let n = 0; n < 200 && !t.done; n++) {
    const now = turn(t);
    if (!now) break;
    if (now.teamId === s.user?.teamId) {
      // Our club picks for itself; when it is not deciding (not yet in the first team), its turns pass.
      if (!userInIt) {
        takeTryoutPick(s, t, now.teamId, now.round, null);
        continue;
      }
      const log = t.picks.filter((x) => x.id).map((x) => __i18n_k("league.tryout.text.5b288d5f", { team: s.teams.find((y) => y.id === x.teamId)?.name ?? x.teamId, round: x.round, name: s.players[x.id!]!.name }));
      return { kind: 'foreign', candidates: [...t.pool], regular: 1, asia: 0, round: now.round, log, tryout: true };
    }
    takeTryoutPick(s, t, now.teamId, now.round, aiPick(s, t, now.teamId).id);
  }
  if (!t.done) closeTryout(s, t);
  return null;
}

function closeTryout(s: LeagueState, t: ForeignTryout) {
  t.done = true;
  for (const id of t.pool) delete s.players[id];
  t.pool = [];
  const signed = t.picks.filter((x) => x.id).length;
  if (!signed) return;
  const first = t.picks.find((x) => x.id)!;
  addNews(s, {
    id: `foreign-tryout-${t.year}`,
    date: `${t.year - 1}-12-15`,
    kind: 'move',
    title: __i18n_k("league.tryout.text.cf53653d", { n: signed }),
    body: __i18n_k("league.tryout.text.6ffd3eea", {
      year: t.year,
      team: s.teams.find((y) => y.id === first.teamId)?.name ?? first.teamId,
      name: s.players[first.id!]!.name,
      cap: usd(historicForeignCap(t.year) ?? 120_000),
    }),
    quotes: [],
    facts: { signed },
    players: t.picks.filter((x) => x.id).map((x) => x.id!),
    mine: t.picks.some((x) => x.id && x.teamId === s.user?.teamId),
  });
}
