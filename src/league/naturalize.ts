import { k as __i18n_k } from '../i18n/index';
/* 2.0.42 (the user's request: 장수 외국인의 귀화): now and then a foreign player who has played in the KBO for years takes
   Korean nationality. He no longer takes a foreign place: he is a domestic player on a domestic contract (three
   seasons at a free agent's price), exempt from service, his name and record as they were. Another club's player
   does it in the winter and it is news; ours tells the general manager first, and the club backs him or not — backing
   him frees a foreign place for a new signing and costs a domestic deal.

   The KBO has had no naturalized foreign player (the game's assumption, after the law's five years' residence);
   the chance is small and grows a little with the seasons he has played here. */
import { hashUnit } from '../draftroom';
import type { Player, TeamId } from '../model/types';
import { addAlert } from './alerts';
import { marketValue } from './fa';
import { iga } from './josa';
import { addNews } from './news';
import { ageIn, isForeign, keepValue } from './players';
import { traitsOf } from './traits';
import { firstTeamIds, orgPlayers, type Decision, type LeagueState } from './state';
import { minimumSalaryFor } from '../rules/kbo2026';

export const NATURALIZE = {
  /** KBO seasons first (the law's five years' residence), and an age limit. */
  seasons: 5,
  maxAge: 37,
  /** Chance in a winter: base, and per season past five (up to `most`). */
  chance: 0.03,
  perSeason: 0.01,
  most: 0.08,
  /** The domestic deal he signs (seasons). */
  years: 3,
  /** 2.0.42 (the user's request: 구단에 애정이 높을수록): his loyalty (the hidden trait, 50 average) moves the chance —
      × (1 + (loyalty − 50) × perLoyalty) — and seasons with his present club past the five more (× per season), up to
      `most` × `loyalMost` for the most devoted. */
  perLoyalty: 0.025,
  perClubSeason: 0.1,
  loyalMost: 2,
  /** What it does for his fans and his club's fans. */
  fans: 6,
  interest: 0.03,
};

/** First-team seasons he has played in the KBO. */
export const kboSeasons = (p: Player) => new Set(p.career.filter((c) => !c.level && c.teamId).map((c) => c.year)).size;

/** Whether he may ask this winter (before the season `next`). */
export function canNaturalize(s: LeagueState, p: Player, next: number): boolean {
  return isForeign(p) && !!p.teamId && p.status === 'active' && !p.origin.devForeign && kboSeasons(p) >= NATURALIZE.seasons && ageIn(p, next) <= NATURALIZE.maxAge && firstTeamIds(s, next).includes(p.teamId);
}

/** Whether he wants to this winter (drawn from his id: the same on every load). */
export function wantsToNaturalize(s: LeagueState, p: Player, next: number): boolean {
  if (!canNaturalize(s, p, next)) return false;
  return hashUnit(`${s.seed}|naturalize|${p.id}|${next}`) < naturalizeChance(p);
}

/** Seasons he has played for his present club. */
export const clubSeasons = (p: Player) => new Set(p.career.filter((c) => !c.level && c.teamId === p.teamId).map((c) => c.year)).size;

/** His chance in a winter: the seasons he has played here, his loyalty and his years with his club. */
export function naturalizeChance(p: Player): number {
  const N = NATURALIZE;
  const base = Math.min(N.most, N.chance + N.perSeason * (kboSeasons(p) - N.seasons));
  const loyal = Math.max(0.3, 1 + (traitsOf(p).loyalty - 50) * N.perLoyalty) * (1 + N.perClubSeason * Math.max(0, clubSeasons(p) - N.seasons));
  return Math.min(N.most * N.loyalMost, base * loyal);
}

/** The domestic deal he signs: a free agent's annual for three seasons. */
export function naturalizedDeal(p: Player, next: number) {
  return { years: NATURALIZE.years, annual: Math.max(minimumSalaryFor(next), Math.round(marketValue(p, next).annual / 1000) * 1000) };
}

/** He becomes a domestic player of his club. */
export function naturalize(s: LeagueState, p: Player, next: number) {
  const teamId = p.teamId as TeamId;
  const deal = naturalizedDeal(p, next);
  const from = p.origin.nationality ?? '';
  p.origin = { ...p.origin, kind: 'draftClass', entryCategory: 'naturalized', asiaQuota: false, naturalized: { year: next - 1, from } };
  delete p.origin.nationality;
  p.contract = { teamId, kind: 'multiYear', signedIn: next - 1, signingBonus: 0, salaries: Array.from({ length: deal.years }, (_, i) => ({ season: next + i, amount: deal.annual })) };
  p.service.military = 'exempt';
  const life = (p.life ??= {});
  life.fans = Math.min(30, (life.fans ?? 0) + NATURALIZE.fans);
  (life.events ??= []).push({ date: `${next - 1}-12-10`, text: __i18n_k("league.naturalize.text.8cbd7735", { years: deal.years }), tone: 'good' });
  const club = s.teams.find((t) => t.id === teamId);
  const mine = teamId === s.user?.teamId;
  addNews(s, {
    id: `naturalize-${p.id}`,
    date: `${next - 1}-12-10`,
    kind: 'move',
    title: __i18n_k("league.naturalize.text.ebc363d2", { club: club?.short ?? '', name: p.name }),
    body: __i18n_k("league.naturalize.text.a7dd9fb3", { n: kboSeasons(p), name: iga(p.name), years: deal.years, annual: Math.round(deal.annual / 1000) / 10 }),
    quotes: [],
    facts: { 선수: p.name },
    players: [p.id],
    mine,
  });
  if (mine) (s.user!.log ??= []).push({ year: next - 1, text: __i18n_k("league.naturalize.text.a49e3dea", { name: p.name, years: deal.years }) });
}

/** The AI clubs' players who naturalize this winter (their clubs always back a player still worth a place). */
export function naturalizeWinter(s: LeagueState, next: number) {
  for (const p of Object.values(s.players)) {
    if (p.teamId === s.user?.teamId || !wantsToNaturalize(s, p, next)) continue;
    if (keepValue(p, next) >= 45) naturalize(s, p, next);
  }
}

/** Our players who ask to naturalize this winter: a decision. */
export function naturalizeDecision(s: LeagueState, next: number): Decision | null {
  const u = s.user;
  if (!u) return null;
  const done = new Set(u.naturalizeAsked ?? []);
  const p = orgPlayers(s, u.teamId).find((x) => !done.has(`${x.id}|${next}`) && wantsToNaturalize(s, x, next));
  if (!p) return null;
  (u.naturalizeAsked ??= []).push(`${p.id}|${next}`);
  const deal = naturalizedDeal(p, next);
  addAlert(s, { id: `naturalize-ask-${p.id}-${next}`, date: `${next - 1}-12-10`, kind: 'life', title: __i18n_k("league.naturalize.text.3458b9da", { name: p.name }), lines: [__i18n_k("league.naturalize.text.b523b404", { n: kboSeasons(p) })], players: [p.id] });
  return { kind: 'naturalize', id: p.id, seasons: kboSeasons(p), years: deal.years, annual: deal.annual };
}

/** Back him (he naturalizes and signs the domestic deal) or not (he stays a foreign player, a little hurt). */
export function resolveNaturalize(s: LeagueState, d: Extract<Decision, { kind: 'naturalize' }>, answer: 'support' | 'decline', next: number) {
  const p = s.players[d.id];
  if (!p || p.teamId !== s.user?.teamId) return;
  if (answer === 'support') naturalize(s, p, next);
  else {
    const life = (p.life ??= {});
    life.fans = Math.max(-30, (life.fans ?? 0) - 2);
    (life.events ??= []).push({ date: `${next - 1}-12-10`, text: __i18n_k("league.naturalize.text.71a47bd4") });
    (s.user!.log ??= []).push({ year: next - 1, text: __i18n_k("league.naturalize.text.9ca3402e", { name: p.name }) });
  }
}

/** The scouts back a player still worth a place. */
export const autoNaturalize = (s: LeagueState, d: Extract<Decision, { kind: 'naturalize' }>, next: number): 'support' | 'decline' => (s.players[d.id] && keepValue(s.players[d.id]!, next) >= 50 ? 'support' : 'decline');

