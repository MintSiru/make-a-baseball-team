import { k as __i18n_k } from '../i18n/index';
/* 2.0.41 (the user's request: 추신수·서재응 같은 무소속 해외파): now and then a winter brings a Korean veteran home from a
   long career abroad — a big-league name who went to America out of high school, or one who made his name in Japan.
   He never played in the KBO, so no club holds his rights: he is an unattached domestic player (no foreign place),
   in his thirties, past his best but still useful, and he asks for a free agent's money.

   The real league sends such a player through a draft (2007 해외파 특별지명, then the two-year wait); the game lets any
   club sign him from the pool of unattached players instead — the same way as the overseas Koreans of kyopo.ts.
   Some sign with an AI club at once; the rest wait in the pool (시장 → 방출·자유계약) until the season ends. */
import { hashUnit, rng } from '../draftroom';
import DraftNames from '../draftroom/names.js';
import type { Player, TeamId } from '../model/types';
import { minimumSalaryFor } from '../rules/kbo2026';
import { addAlert } from './alerts';
import { eraName } from './eranames';
import { marketValue } from './fa';
import { addNews } from './news';
import { rosterLimit, sign } from './offseason';
import { ageIn, keepValue, makeForeign } from './players';
import { firstTeamIds, registeredIds, type LeagueState } from './state';

const names = DraftNames as unknown as { makeName: (r: () => number, used: Set<string>) => { name: string } };

export const ABROAD_VETS = {
  /** Chance of one in a winter (a second, rarely). */
  chance: 0.3,
  second: 0.15,
  /** From this season: Korean players went abroad out of school from the mid-1990s. */
  from: 2002,
  /** Share who made their name in America (the rest in Japan). */
  america: 0.65,
  /** His age when he comes home. */
  age: [31, 36] as const,
  /** An AI club signs him at once this often, if he is worth a place. */
  ai: 0.5,
  aiKeep: 45,
  /** What he asks: a free agent's annual, at least this share of it. */
  askShare: 0.8,
};

export const isAbroadVet = (p: Pick<Player, 'origin'>) => !!p.origin.abroadVet;

/** The winter before `next`: the veterans who come home (none most winters). */
export function abroadVetsWinter(s: LeagueState, next: number) {
  if (next < ABROAD_VETS.from) return;
  const key = `${s.seed}|abroadvet|${next}`;
  const u = hashUnit(key);
  const count = u < ABROAD_VETS.chance * ABROAD_VETS.second ? 2 : u < ABROAD_VETS.chance ? 1 : 0;
  if (!count) return;
  const used = new Set(Object.values(s.players).map((p) => p.name));
  const clubs = firstTeamIds(s, next).filter((id) => id !== s.user?.teamId);
  const arrived: Player[] = [];
  for (let i = 0; i < count; i++) {
    const p = makeAbroadVet(s, `av${next}-${i}`, next, used);
    s.players[p.id] = p;
    arrived.push(p);
    const room = clubs.filter((id) => registeredIds(s, id).length < rosterLimit(next));
    const club = room[Math.floor(hashUnit(`${key}|${i}|club`) * room.length)];
    if (club && hashUnit(`${key}|${i}|ai`) < ABROAD_VETS.ai && keepValue(p, next) >= ABROAD_VETS.aiKeep) signVet(s, p, club, next);
    else (s.pool ??= []).push(p.id);
  }
  const team = (id: TeamId | null) => s.teams.find((t) => t.id === id)?.name ?? '';
  addNews(s, {
    id: `abroadvet-${next}`,
    date: `${next - 1}-12-22`,
    kind: 'move',
    title: __i18n_k("league.abroadvets.text.01393d64", { n: arrived.length }),
    body: arrived
      .map((p) =>
        p.teamId
          ? __i18n_k("league.abroadvets.text.e8c6c659", { name: p.name, age: ageIn(p, next), from: p.origin.background!.text, team: team(p.teamId) })
          : __i18n_k("league.abroadvets.text.944db513", { name: p.name, age: ageIn(p, next), from: p.origin.background!.text }),
      )
      .join(' '),
    quotes: [],
    facts: { count: arrived.length },
    players: arrived.map((p) => p.id),
    mine: false,
  });
  const free = arrived.filter((p) => !p.teamId);
  if (s.user && free.length)
    addAlert(s, {
      id: `abroadvet-${next}`,
      date: `${next - 1}-12-22`,
      kind: 'move',
      title: __i18n_k("league.abroadvets.text.a74f081d", { n: free.length }),
      lines: [...free.map((p) => `${p.name} · ${p.origin.background!.text}`), __i18n_k("league.abroadvets.text.ed2b4285")],
      players: free.map((p) => p.id),
    });
}

/** What he asks to sign (만 원): a free agent's annual, while he has no KBO season. */
export function abroadVetAsk(p: Player, season: number): number {
  return Math.max(minimumSalaryFor(season), Math.round((marketValue(p, season).annual * ABROAD_VETS.askShare) / 1000) * 1000);
}

function signVet(s: LeagueState, p: Player, teamId: TeamId, next: number) {
  sign(s, p, teamId, { teamId, kind: 'standard', signedIn: next - 1, signingBonus: 0, salaries: [{ season: next, amount: abroadVetAsk(p, next) }] });
}

/** A Korean veteran from abroad: a big-league veteran's (or a Japanese-league player's) ability and record, a Korean
    name, and his years abroad as his path. */
function makeAbroadVet(s: LeagueState, id: string, next: number, used: Set<string>): Player {
  const kind = hashUnit(`${s.seed}|${id}|kind`) < 0.5 ? 'pitcher' : 'hitter';
  const america = hashUnit(`${s.seed}|${id}|where`) < ABROAD_VETS.america;
  let base = makeForeign(s.seed, id, next, { kind, asiaQuota: !america, veteran: america });
  for (let k = 1; k < 12 && !america && base.origin.background?.level !== 'npb'; k++) base = makeForeign(s.seed, `${id}~${k}`, next, { kind, asiaQuota: true });
  const [lo, hi] = ABROAD_VETS.age;
  const age = lo + Math.floor(hashUnit(`${s.seed}|${id}|age`) * (hi - lo + 1));
  const birthday = `${next - age - 1}${base.birthday.slice(4)}`;
  const r = rng(`${s.seed}|abroadvet-name|${id}`);
  const name = eraName(names.makeName(r, used).name, next - age - 1, `${s.seed}|abroadvet|${id}`, used);
  used.add(name);
  const text = base.origin.background!.text;
  // His hometown: one of a domestic player's (the generators' own places, rendered in every language).
  const homes = Object.values(s.players).filter((x) => x.origin.kind === 'draftClass' && !x.origin.kyopo && !x.origin.abroadVet && x.birthplace);
  const home = homes[Math.floor(hashUnit(`${s.seed}|${id}|home`) * homes.length)];
  const path = america ? __i18n_k("league.abroadvets.text.547db359") : __i18n_k("league.abroadvets.text.1226adf5");
  return {
    ...base,
    id,
    name,
    birthday,
    birthplace: home?.birthplace ?? '',
    origin: { kind: 'draftClass', pathway: __i18n_k("league.abroadvets.text.7a3b1ce6"), entryCategory: 'abroadVet', abroadVet: true, background: base.origin.background },
    education: { ...base.education, qualification: __i18n_k("league.abroadvets.text.7a3b1ce6"), region: home?.education.region ?? '', pathText: `${path} · ${text}` },
    status: 'freeAgent',
    proSince: next,
  };
}
