import { k as __i18n_k } from '../i18n/index';
/* 1.9.6: overseas Korean players (해외 교포, 재일동포), for a league that plays history (RULES.md §14, S101–S102). From
   1983 to 2015 a few Korean players from Japan's professional and industrial leagues come over each winter (장명부,
   김일융, 김무종): counted as domestic players (no foreign place), signed as any unattached player. Through 1991 a
   club may play at most two of them in a game, and from 1995 put at most two on its entry; the game holds both as
   two on the first team at once (rules/history.ts kyopo; 1992–1994 no limit). After the foreign players came (1998)
   hardly any came, so after 1997 one now and then.

   Each winter's newcomers: half go straight to an AI club with room for one, the rest wait in the pool of
   unattached players (s.pool) for any club, ours included, until the season ends. */
import { hashUnit, rng } from '../draftroom';
import DraftNames from '../draftroom/names.js';
import { rulesFor } from '../rules/history';
import type { Player, TeamId } from '../model/types';
import { playsHistory } from './era';
import { eraName } from './eranames';
import { foreignName } from './foreign';
import { addNews } from './news';
import { addAlert } from './alerts';
import { leagueEvent } from './leagueevents';
import { sign } from './offseason';
import { ageIn, keepValue, makeForeign } from './players';
import { firstTeamIds, orgPlayers, type LeagueState } from './state';
import { renewSalary } from './contracts';
import { minimumSalaryFor } from '../rules/kbo2026';

const names = DraftNames as unknown as { makeName: (r: () => number, used: Set<string>) => { name: string } };

export const isKyopo = (p: Pick<Player, 'origin'>) => !!p.origin.kyopo;

/** How many overseas Korean players a club may have on its first team this season (null: no limit). */
export function kyopoLimit(year: number): number | null {
  if (!playsHistory()) return null;
  const k = rulesFor(year).kyopo;
  return k.maxPlay ?? k.maxEntry;
}

/** An AI club signs one only while it has fewer than this. */
const AI_MAX = 2;

/** The newcomers of the winter before `next` (none unless the year allows them). */
export function kyopoWinter(s: LeagueState, next: number) {
  if (!playsHistory() || !rulesFor(next).kyopo.allowed) return;
  const key = `${s.seed}|kyopo|${next}`;
  const u = hashUnit(key);
  const count = next <= 1997 ? 1 + Math.floor(u * 3) : u < 0.3 ? 1 : 0;
  const used = new Set(Object.values(s.players).map((p) => p.name));
  const clubs = firstTeamIds(s, next).filter((id) => id !== s.user?.teamId);
  const arrived: Player[] = [];
  for (let i = 0; i < count; i++) {
    const p = makeKyopo(s, `ky${next}-${i}`, next, used);
    s.players[p.id] = p;
    arrived.push(p);
    const room = clubs.filter((id) => orgPlayers(s, id).filter(isKyopo).length < AI_MAX);
    const club = room[Math.floor(hashUnit(`${key}|${i}|club`) * room.length)];
    if (club && hashUnit(`${key}|${i}|ai`) < 0.5 && keepValue(p, next) >= 40) signKyopo(s, p, club, next);
    else (s.pool ??= []).push(p.id);
  }
  if (!arrived.length) return;
  if (!Object.values(s.players).some((p) => isKyopo(p) && p.proSince < next)) leagueEvent(s, next, __i18n_k("league.kyopo.text.f14aaf8c", { name: arrived[0]!.name }));
  addNews(s, {
    id: `kyopo-${next}`,
    date: `${next - 1}-12-20`,
    kind: 'move',
    title: __i18n_k("league.kyopo.text.9b67504f", { n: arrived.length }),
    body: arrived
      .map((p) =>
        p.teamId
          ? __i18n_k("league.kyopo.text.898d7e0d", { name: p.name, age: ageIn(p, next), from: p.origin.background!.text, team: s.teams.find((t) => t.id === p.teamId)?.name ?? '' })
          : __i18n_k("league.kyopo.text.91f555e5", { name: p.name, age: ageIn(p, next), from: p.origin.background!.text }),
      )
      .join(' '),
    quotes: [],
    facts: { count: arrived.length },
    players: arrived.map((p) => p.id),
    mine: false,
  });
  // Ours to sign too: the ones still looking, in the market's unattached players (시장 → 방출·자유계약).
  const free = arrived.filter((p) => !p.teamId);
  if (s.user && free.length)
    addAlert(s, {
      id: `kyopo-${next}`,
      date: `${next - 1}-12-20`,
      kind: 'move',
      title: __i18n_k("league.kyopo.text.4224db84", { n: free.length }),
      lines: [...free.map((p) => `${p.name} · ${p.origin.background!.text}`), __i18n_k("league.kyopo.text.8042589f")],
    });
}

function signKyopo(s: LeagueState, p: Player, teamId: TeamId, next: number) {
  sign(s, p, teamId, { teamId, kind: 'standard', signedIn: next - 1, signingBonus: 0, salaries: [{ season: next, amount: Math.max(minimumSalaryFor(next), renewSalary(p, next)) }] });
}

/** A Korean player from Japan: a Japanese-league player's ability and record, a Korean name of his decade, and his
    Japanese name on record. */
function makeKyopo(s: LeagueState, id: string, next: number, used: Set<string>): Player {
  // A Japanese-league background (the Asia-quota generator's Japanese levels).
  const kind = hashUnit(`${s.seed}|${id}|kind`) < 0.6 ? 'pitcher' : 'hitter';
  let base = makeForeign(s.seed, id, next, { kind, asiaQuota: true });
  for (let k = 1; k < 12 && base.origin.nationality !== '일본'; k++) base = makeForeign(s.seed, `${id}~${k}`, next, { kind, asiaQuota: true });
  const r = rng(`${s.seed}|kyopo-name|${id}`);
  const born = Number(base.birthday.slice(0, 4));
  const name = eraName(names.makeName(r, used).name, born, `${s.seed}|kyopo|${id}`, used);
  const japanese = foreignName('japan', r);
  const text = base.origin.background!.text;
  return {
    ...base,
    id,
    name,
    birthplace: '일본',
    origin: { kind: 'draftClass', pathway: __i18n_k("league.kyopo.text.74fb91a0"), entryCategory: 'kyopo', nationality: '일본', kyopo: true, background: base.origin.background },
    education: { ...base.education, qualification: __i18n_k("league.kyopo.text.74fb91a0"), pathText: __i18n_k("league.kyopo.text.8136d32f", { japanese, text }) },
    status: 'freeAgent',
    proSince: next,
  };
}
