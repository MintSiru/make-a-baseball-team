import { k as __i18n_k } from '../i18n/index';
/* 2.0.37 (the user's request; the 2004 오릭스–긴테쓰 case): in a league of twelve clubs or more, a club whose parent
   has covered a large share of its costs three seasons running may be merged into a healthier one. The winter it is
   proposed the papers break it, the players' association and the fans protest, and the board votes (our club's vote
   is ours to cast; the other clubs lean yes). Approved, the healthier club takes the merged club's best players and
   sends it its spares, and a new club is founded in the merged club's place — a new parent and a new name, the same
   ballpark — so the league keeps its number of clubs, as Rakuten was founded beside the merged Orix. Turned down, the
   club is sold to a new owner under a new name. A merger a decade at most. */
import { rng } from '../draftroom';
import type { TeamId } from '../model/types';
import { addAlert } from './alerts';
import { votesNeeded } from './board';
import { clubState } from './fans';
import { eulreul, iga } from './josa';
import { movePlayer } from './market';
import { milestone } from './milestones';
import { addNews } from './news';
import { isForeign, keepValue } from './players';
import { firstTeamIds, registeredIds, type Decision, type LeagueState } from './state';
import { FANS } from './tuning';

export const MERGER = { clubs: 12, ratio: 0.35, seasons: 3, chance: 0.5, every: 10, take: 8, yes: 0.65, keep: 0.6, follow: 0.15 };

const NICKNAMES = [__i18n_k("league.merger.text.6b9d548f"), __i18n_k("league.merger.text.ebdf4f1b"), __i18n_k("league.merger.text.d879a040"), __i18n_k("league.merger.text.a2310ede"), __i18n_k("league.merger.text.3ac2fc0b"), __i18n_k("league.merger.text.0ae10827"), __i18n_k("league.merger.text.5ae3f402"), __i18n_k("league.merger.text.cc1316b9")];
const COMPANIES = [__i18n_k("league.merger.text.3497e002"), __i18n_k("league.merger.text.c869fd6f"), __i18n_k("league.merger.text.13bf58c9"), __i18n_k("league.merger.text.78709406"), __i18n_k("league.merger.text.fc92c728"), __i18n_k("league.merger.text.e126cbed")];
const COLORS = ['#8e1b3a', '#0f6e5a', '#3b2f8f', '#b35900', '#1d5f8a', '#5a5a14'];

const revenueOf = (r: { revenue: Record<string, number> }) => Object.values(r.revenue).reduce((a, b) => a + b, 0);

/** Seasons in a row (latest first) the parent covered at least MERGER.ratio of the club's revenue. */
export function distressOf(s: LeagueState, teamId: TeamId): number {
  const reports = [...(s.clubs?.[teamId]?.reports ?? [])].sort((a, b) => b.year - a.year);
  let n = 0;
  for (const r of reports) {
    if (r.support / Math.max(1, revenueOf(r)) >= MERGER.ratio) n++;
    else break;
  }
  return n;
}

const supportShare = (s: LeagueState, teamId: TeamId) => {
  const r = [...(s.clubs?.[teamId]?.reports ?? [])].sort((a, b) => b.year - a.year)[0];
  return r ? r.support / Math.max(1, revenueOf(r)) : 0.5;
};
const nameOf = (s: LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.name ?? id;

/** The winter's turn: now and then a merger is proposed. Our vote is asked when our club is in the league. */
export function mergerDecision(s: LeagueState, year: number): Decision | null {
  const u = s.user;
  const clubs = firstTeamIds(s, year);
  if (!u || clubs.length < MERGER.clubs) return null;
  if ((s.mergers ?? []).some((m) => year - m.year < MERGER.every)) return null;
  const r = rng(`${s.seed}|merger|${year}`);
  const weak = clubs
    .filter((id) => id !== u.teamId)
    .map((id) => ({ id, d: distressOf(s, id) }))
    .filter((x) => x.d >= MERGER.seasons)
    .sort((a, b) => b.d - a.d || clubState(s, a.id).popularity - clubState(s, b.id).popularity)[0];
  if (!weak || r() >= MERGER.chance) return null;
  const partner = clubs.filter((id) => id !== u.teamId && id !== weak.id).sort((a, b) => supportShare(s, a) - supportShare(s, b))[0];
  if (!partner) return null;
  const a = nameOf(s, weak.id),
    b = nameOf(s, partner);
  const date = `${year}-11-22`;
  addNews(s, { id: `merger-${year}-plan`, date, kind: 'move', title: __i18n_k("league.merger.text.40b6d162", { a, b }), body: __i18n_k("league.merger.text.c926a16f", { a, seasons: weak.d, b: iga(b), a2: eulreul(a) }), quotes: [], facts: { a, b }, players: [] });
  addNews(s, { id: `merger-${year}-union`, date, kind: 'move', title: __i18n_k("league.merger.text.d827edd4"), body: __i18n_k("league.merger.text.935d4d05", { a }), quotes: [], facts: { a, b }, players: [] });
  const playing = year >= u.firstTeamYear;
  if (!playing) {
    resolveMerger(s, { kind: 'merger', weak: weak.id, partner, needed: votesNeeded(clubs.length), clubs: clubs.length }, 'no', year);
    return null;
  }
  return { kind: 'merger', weak: weak.id, partner, needed: votesNeeded(clubs.length), clubs: clubs.length };
}

/** The board votes (ours given); approved, the merger; turned down, the sale. */
export function resolveMerger(s: LeagueState, d: Extract<Decision, { kind: 'merger' }>, vote: 'yes' | 'no', year: number) {
  const r = rng(`${s.seed}|merger-vote|${year}`);
  const voters = firstTeamIds(s, year).filter((id) => id !== s.user?.teamId);
  let yes = vote === 'yes' && year >= (s.user?.firstTeamYear ?? 0) ? 1 : 0;
  for (const id of voters) if (id === d.weak || id === d.partner || r() < MERGER.yes) yes++;
  const approved = yes >= d.needed;
  if (approved) merge(s, d.weak, d.partner, year, r);
  else sell(s, d.weak, year, r, yes, d.needed);
}

function newIdentity(s: LeagueState, teamId: TeamId, r: () => number) {
  const team = s.teams.find((t) => t.id === teamId)!;
  const used = new Set(s.teams.map((t) => t.short));
  const nick = NICKNAMES.filter((n) => !used.has(n))[Math.floor(r() * NICKNAMES.length) % Math.max(1, NICKNAMES.filter((n) => !used.has(n)).length)] ?? NICKNAMES[0]!;
  const company = COMPANIES[Math.floor(r() * COMPANIES.length)]!;
  const city = team.region.split('·')[0] ?? team.region;
  const old = team.name,
    oldShort = team.short;
  team.name = `${city} ${nick}`;
  team.short = nick;
  team.color = COLORS[Math.floor(r() * COLORS.length)]!;
  team.parent = { type: 'conglomerate', name: company };
  return { old, oldShort, name: team.name, company };
}

function merge(s: LeagueState, weak: TeamId, partner: TeamId, year: number, r: () => number) {
  const next = year + 1;
  const value = (id: string) => keepValue(s.players[id]!, next);
  // The merged club's best go to the healthier one; it sends back as many of its spares.
  const best = registeredIds(s, weak)
    .filter((id) => s.players[id]?.contract?.kind !== 'development')
    .sort((a, b) => value(b) - value(a))
    .slice(0, MERGER.take);
  const spares = registeredIds(s, partner)
    .filter((id) => !isForeign(s.players[id]!) && s.players[id]?.contract?.kind !== 'development')
    .sort((a, b) => value(a) - value(b))
    .slice(0, best.length);
  for (const id of best) movePlayer(s, s.players[id]!, partner);
  for (const id of spares) movePlayer(s, s.players[id]!, weak);
  const into = nameOf(s, partner);
  const oldPop = clubState(s, weak).popularity;
  const id = newIdentity(s, weak, r);
  const c = clubState(s, weak);
  c.popularity = Math.round(oldPop * MERGER.keep + (FANS.newClub.base + 50 * FANS.newClub.perMarket) * (1 - MERGER.keep));
  c.interest = FANS.newClub.novelty;
  clubState(s, partner).popularity += Math.round(oldPop * MERGER.follow);
  (s.mergers ??= []).push({ year, into: partner, absorbed: id.old, absorbedShort: id.oldShort, founded: id.name, teamId: weak, approved: true });
  milestone(s, year, __i18n_k("league.merger.text.8c205f11", { old: id.old, into, name: id.name }));
  const date = `${year}-12-02`;
  const title = __i18n_k("league.merger.text.9894ef87", { old: id.old, into });
  const body = __i18n_k("league.merger.text.d41812f4", { into: iga(into), old: id.old, n: best.length, company: id.company, name: eulreul(id.name), clubs: firstTeamIds(s, next).length });
  addNews(s, { id: `merger-${year}-done`, date, kind: 'move', title, body, quotes: [], facts: { old: id.old, into, name: id.name }, players: best });
  addAlert(s, { id: `merger-${year}-done`, date, kind: 'move', title, lines: [body] });
}

function sell(s: LeagueState, weak: TeamId, year: number, r: () => number, yes: number, needed: number) {
  const id = newIdentity(s, weak, r);
  (s.mergers ??= []).push({ year, into: null, absorbed: id.old, absorbedShort: id.oldShort, founded: id.name, teamId: weak, approved: false });
  milestone(s, year, __i18n_k("league.merger.text.b87b1463", { old: id.old, company: id.company, name: id.name }));
  const date = `${year}-12-02`;
  const title = __i18n_k("league.merger.text.72ae1d82", { old: id.old, company: id.company });
  const body = __i18n_k("league.merger.text.4f521e37", { yes, needed, company: id.company, old: id.old, name: id.name });
  addNews(s, { id: `merger-${year}-sold`, date, kind: 'move', title, body, quotes: [], facts: { old: id.old, name: id.name }, players: [] });
  addAlert(s, { id: `merger-${year}-sold`, date, kind: 'move', title, lines: [body] });
}

