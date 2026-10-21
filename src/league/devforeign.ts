import { k as __i18n_k } from '../i18n/index';
/* 2.0.37 (the user's request; off by default): development foreign players (육성형 외국인 선수, a game rule after NPB's
   育成外国人 and the KBO's talk of one). With the rule on, each club may keep one or two young foreign prospects —
   eighteen to twenty-one, from the Dominican academies, Venezuela, Australia and the like — on development contracts
   at the minimum salary. They take no foreign slot and stay outside the foreign salary cap; they play in the futures
   league and grow like the club's own youngsters (foreign players otherwise come finished). From May 1, a club with a
   foreign slot open may register one (he then takes the slot, on a foreign contract from the winter). Three seasons
   in development and he is let go. Our club picks its prospects each winter; the other clubs sign and register
   theirs on their own. */
import { rng, type Tools } from '../draftroom';
import type { Player, PlayerId, TeamId } from '../model/types';
import { minimumSalaryFor } from '../rules/kbo2026';
import { addAlert } from './alerts';
import { foreignName, type Pool } from './foreign';
import { slotForeigners } from './foreigncap';
import { foreignSlots } from './manager';
import { noteMove } from './moves';
import { addNews } from './news';
import { developmentContract, leaveLeague, rescout, sign } from './offseason';
import { eulreul, iga } from './josa';
import { currentValue, isForeign, makeForeign } from './players';
import { isDevelopment, orgPlayers, type Decision, type LeagueState } from './state';

export const DEV_FOREIGN = {
  /** Ages when signed, the seasons in development, the prospects our club is shown, an AI club's chance to fill an
      open place a winter, and how far below his potential he starts (grade points, at random within). */
  ages: [18, 21] as const,
  seasons: 3,
  candidates: 8,
  aiFill: 0.6,
  raw: [11, 22] as const,
  /** His potential against a regular import's ability (makeForeign), and the chance of a real gem. */
  potential: -2,
  gem: { chance: 0.08, shift: 6 },
  /** An AI club registers him in the winter when he is this good and a slot is open. */
  promoteAt: 52,
};

const NATIONS: [string, Pool, number][] = [
  [__i18n_k("league.devforeign.text.2457fb18"), 'latin', 0.4],
  [__i18n_k("league.devforeign.text.c95139a2"), 'latin', 0.22],
  [__i18n_k("league.devforeign.text.b0447764"), 'latin', 0.06],
  [__i18n_k("league.devforeign.text.67a84e81"), 'latin', 0.06],
  [__i18n_k("league.devforeign.text.03b4aef6"), 'latin', 0.05],
  [__i18n_k("league.devforeign.text.b0e06d09"), 'latin', 0.05],
  [__i18n_k("league.devforeign.text.77dde5e9"), 'latin', 0.04],
  [__i18n_k("league.devforeign.text.5db69ec1"), 'west', 0.07],
  [__i18n_k("league.devforeign.text.8a9d64bd"), 'west', 0.05],
];

/** The rule's places a club (0 when off). */
export const devForeignPlaces = (s: LeagueState) => s.devForeign ?? 0;
/** A development foreign player still in development (no slot, outside the cap). */
export const isDevForeign = (p: Player) => isForeign(p) && !!p.origin.devForeign && isDevelopment(p);
export const devForeignersOf = (s: LeagueState, teamId: TeamId) => orgPlayers(s, teamId).filter(isDevForeign);
/** Seasons he has spent in development before `season`. */
const seasonsIn = (p: Player, season: number) => season - p.proSince;

/** A young prospect: a regular import's makings (makeForeign) as his potential, years below it now. */
export function makeDevForeign(seed: string, id: string, season: number): Player {
  const r = rng(`${seed}|dev-foreign|${id}`);
  const kind = r() < 0.6 ? 'pitcher' : 'hitter';
  const p = makeForeign(seed, id, season, { kind, asiaQuota: false });
  let x = r() * NATIONS.reduce((a, n) => a + n[2], 0);
  const [nationality, pool] = NATIONS.find((n) => (x -= n[2]) < 0) ?? NATIONS[0]!;
  const age = DEV_FOREIGN.ages[0] + Math.floor(r() * (DEV_FOREIGN.ages[1] - DEV_FOREIGN.ages[0] + 1));
  const gem = r() < DEV_FOREIGN.gem.chance ? DEV_FOREIGN.gem.shift : 0;
  const pot: Tools = {},
    cur: Tools = {};
  for (const [k, v] of Object.entries(p.hidden.current) as [keyof Tools, number][]) {
    pot[k] = Math.min(80, Math.max(25, v + DEV_FOREIGN.potential + gem));
    const raw = DEV_FOREIGN.raw[0] + r() * (DEV_FOREIGN.raw[1] - DEV_FOREIGN.raw[0]);
    // Legs come early, a pitcher's command and a hitter's eye last.
    cur[k] = Math.max(20, pot[k]! - raw * (k === 'speed' ? 0.4 : k === 'command' || k === 'eye' ? 1.15 : 1));
  }
  p.name = foreignName(pool, r);
  p.birthplace = nationality;
  p.birthday = `${season - age - 1}-${String(1 + Math.floor(r() * 12)).padStart(2, '0')}-${String(1 + Math.floor(r() * 28)).padStart(2, '0')}`;
  p.hidden = { ...p.hidden, current: cur, potential: pot, injuryRisk: 0.06 };
  if (p.velocity != null) p.velocity -= 5 + Math.floor(r() * 4);
  const text = pool === 'latin' ? __i18n_k("league.devforeign.text.bd1e31db", { nation: nationality }) : __i18n_k("league.devforeign.text.9be0b065", { nation: nationality });
  p.origin = { ...p.origin, nationality, devForeign: true, pathway: __i18n_k("league.devforeign.text.618bfd0a"), background: { level: 'indie', text, ask: 0 } };
  p.education = { ...p.education, region: nationality, pathText: `${nationality} · ${text}` };
  p.proSince = season;
  rescout(p, season, 0, r);
  p.scouting.tags = [__i18n_k("league.devforeign.text.82ee1a8f")];
  return p;
}

/** Our club's prospects this winter: the places left after those leaving, and a list to choose from. */
export function devForeignDecision(s: LeagueState, next: number): Decision | null {
  const u = s.user;
  const places = devForeignPlaces(s);
  if (!u || !places) return null;
  const staying = devForeignersOf(s, u.teamId).filter((p) => seasonsIn(p, next) < DEV_FOREIGN.seasons);
  const max = places - staying.length;
  if (max <= 0) return null;
  const ids: PlayerId[] = [];
  for (let i = 0; i < DEV_FOREIGN.candidates; i++) {
    const id = `df${next}-u${i}`;
    const p = makeDevForeign(s.seed, id, next);
    // Like the tryout's walk-ons: not anyone's, and forgotten unless signed.
    p.status = 'amateur';
    s.players[id] = p;
    ids.push(id);
  }
  return { kind: 'devForeign', candidates: ids, max };
}

/** Signs the ones we chose; the rest are forgotten. */
export function resolveDevForeign(s: LeagueState, d: Extract<Decision, { kind: 'devForeign' }>, ids: PlayerId[], next: number) {
  const u = s.user!;
  for (const id of d.candidates) {
    const p = s.players[id];
    if (!p) continue;
    if (ids.includes(id)) {
      sign(s, p, u.teamId, developmentContract(u.teamId, next));
      noteMove(s, p, 'foreignSign', null, u.teamId, __i18n_k("league.devforeign.text.618bfd0a"), `${next - 1}-12-10`);
    } else delete s.players[id];
  }
}

/** The scouts' choice: the best futures. */
export const autoDevForeign = (s: LeagueState, d: Extract<Decision, { kind: 'devForeign' }>) =>
  [...d.candidates].sort((a, b) => s.players[b]!.scouting.futureValue - s.players[a]!.scouting.futureValue).slice(0, d.max);

/** A slot is open for him at the club this season. */
export const slotOpen = (s: LeagueState, teamId: TeamId, season: number) =>
  slotForeigners(s, teamId, season).filter((p) => !p.origin.asiaQuota).length < foreignSlots(s, teamId, season).regular;

/** Registered: he takes a foreign slot (his contract a foreign one; the salary stays until the winter). */
export function promote(p: Player) {
  if (p.contract) p.contract.kind = 'foreign';
}

/** The winter's foreign step, before the clubs' own foreign moves: those three seasons in go, the others' contracts
    run on, and each AI club registers a prospect who is ready when a slot is open. */
export function devForeignBefore(s: LeagueState, next: number) {
  for (const t of s.teams) {
    if (!s.rosters[t.id]) continue;
    for (const p of devForeignersOf(s, t.id)) {
      if (seasonsIn(p, next) >= DEV_FOREIGN.seasons) {
        if (t.id === s.user?.teamId) {
          const title = __i18n_k("league.devforeign.text.74594b70", { name: p.name });
          addAlert(s, { id: `dev-foreign-out-${next}-${p.id}`, date: `${next - 1}-12-01`, kind: 'move', title, lines: [__i18n_k("league.devforeign.text.1a7082f8", { n: DEV_FOREIGN.seasons })], tone: 'bad', players: [p.id] });
        }
        noteMove(s, p, 'foreignOut', t.id, null, __i18n_k("league.devforeign.text.cf8d360f"), `${next - 1}-12-01`);
        leaveLeague(s, p, 'overseas');
        continue;
      }
      if (!p.contract!.salaries.some((x) => x.season === next)) p.contract!.salaries.push({ season: next, amount: minimumSalaryFor(next) });
      if (t.id !== s.user?.teamId && t.firstTeamFrom !== null && t.firstTeamFrom <= next && currentValue(p) >= DEV_FOREIGN.promoteAt && slotOpen(s, t.id, next)) {
        promote(p);
        noteMove(s, p, 'foreign', t.id, t.id, __i18n_k("league.devforeign.text.602df5ac"), `${next - 1}-12-01`);
        addNews(s, { id: `dev-foreign-up-${next}-${p.id}`, date: `${next - 1}-12-01`, kind: 'move', title: __i18n_k("league.devforeign.text.8de7f625", { club: t.short, name: p.name }), body: __i18n_k("league.devforeign.text.7cd75e8b", { club: iga(t.short), name: eulreul(p.name) }), quotes: [], facts: { club: t.short, player: p.name }, players: [p.id] });
      }
    }
  }
}

/** After the clubs' foreign moves: each AI club fills its open places now and then. */
export function devForeignAfter(s: LeagueState, next: number) {
  const places = devForeignPlaces(s);
  if (!places) return;
  const r = rng(`${s.seed}|dev-foreign-ai|${next}`);
  for (const t of s.teams) {
    if (t.id === s.user?.teamId || !s.rosters[t.id] || t.firstTeamFrom === null || t.firstTeamFrom > next) continue;
    let open = places - devForeignersOf(s, t.id).length;
    for (let i = 0; open > 0 && i < places; i++, open--) {
      if (r() >= DEV_FOREIGN.aiFill) continue;
      const p = makeDevForeign(s.seed, `df${next}-${t.id}-${i}`, next);
      sign(s, p, t.id, developmentContract(t.id, next));
      noteMove(s, p, 'foreignSign', null, t.id, __i18n_k("league.devforeign.text.618bfd0a"), `${next - 1}-12-10`);
    }
  }
}

/** In the season, from May 1: an AI club registers a prospect who has caught up, when a slot is open. */
export function devForeignSeason(s: LeagueState, teamId: TeamId, bar: number) {
  for (const p of devForeignersOf(s, teamId)) {
    if (currentValue(p) < bar || s.injuries[p.id] || !slotOpen(s, teamId, s.year)) continue;
    promote(p);
    noteMove(s, p, 'foreign', teamId, teamId, __i18n_k("league.devforeign.text.602df5ac"));
  }
}

