import { k as __i18n_k } from '../i18n/index';
/* The league's memory for the 역대 tab (1.0.1): every club's retired numbers with the player's story and his
   numbers there, and the national team's tournaments. Display only. */
import type { BatTotals, PitTotals, Player, PlayerId, TeamId } from '../model/types';
import { finishText } from './international';
import { isForeign, isPitcher } from './players';
import { addInto, emptyBat, emptyPit, type LeagueState } from './state';
import { positionLabel, shortName, teamOf } from './views';

export interface RetiredNumber {
  teamId: TeamId;
  team: string;
  number: number;
  /** The winter the number was retired. */
  year: number;
  id: PlayerId;
  name: string;
  position: string;
  pitcher: boolean;
  /** First-team seasons with the club, and the years they span. */
  seasons: number;
  from: number | null;
  to: number | null;
  bat: BatTotals | null;
  pit: PitTotals | null;
  war: number;
  careerWar: number;
  honours: string[];
  hall: boolean;
  story: string[];
}

/** Every club's retired numbers, the user's club first, then by club and number. */
export function retiredNumbersView(s: LeagueState): RetiredNumber[] {
  const out: RetiredNumber[] = [];
  for (const t of s.teams) for (const r of t.retiredNumbers ?? []) out.push(retiredNumber(s, t.id, r));
  const mine = s.user?.teamId;
  return out.sort((a, b) => Number(b.teamId === mine) - Number(a.teamId === mine) || a.team.localeCompare(b.team, 'ko') || a.number - b.number);
}

function retiredNumber(s: LeagueState, teamId: TeamId, r: { number: number; playerId: PlayerId; name: string; year: number }): RetiredNumber {
  const team = teamOf(s, teamId)?.name ?? shortName(s, teamId);
  const p: Player | undefined = s.players[r.playerId];
  const base = { teamId, team, number: r.number, year: r.year, id: r.playerId, name: p?.name ?? r.name };
  if (!p) return { ...base, position: '', pitcher: false, seasons: 0, from: null, to: null, bat: null, pit: null, war: 0, careerWar: 0, honours: [], hall: false, story: [] };
  const major = p.career.filter((c) => !c.level);
  const here = major.filter((c) => c.teamId === teamId);
  const pitcher = isPitcher(p);
  const bat = here.some((c) => c.bat) ? emptyBat() : null;
  const pit = here.some((c) => c.pit) ? emptyPit() : null;
  for (const c of here) {
    if (bat && c.bat) addInto(bat, c.bat);
    if (pit && c.pit) addInto(pit, c.pit);
  }
  const war = here.reduce((a, c) => a + c.war, 0);
  const years = here.map((c) => c.year);
  const from = years.length ? Math.min(...years) : null;
  const to = years.length ? Math.max(...years) : null;
  const honours = honoursOf(s, p.id);
  const hall = (s.hallOfFame ?? []).some((h) => h.id === p.id);
  const best = [...here].sort((a, b) => b.war - a.war)[0];
  const story: string[] = [];
  if (isForeign(p)) story.push(__i18n_k("league.legacy.retiredNumber.8d08ffd5", { value: p.origin.nationality ?? __i18n_k("league.legacy.retiredNumber.380ce337") }));
  else if (p.origin.draftYear && p.origin.overallPick) story.push(__i18n_k("league.legacy.retiredNumber.b6618d6a", { draftYear: p.origin.draftYear, overallPick: p.origin.overallPick }));
  else if (p.origin.pathway) story.push(p.origin.pathway);
  const debut = major.length ? Math.min(...major.map((c) => c.year)) : null;
  if (debut) story.push(__i18n_k("league.legacy.retiredNumber.36545ce7", { debut: debut }));
  const elsewhere = [...new Set(major.filter((c) => c.teamId !== teamId).map((c) => shortName(s, c.teamId)))];
  if (from !== null) story.push(__i18n_k("league.legacy.retiredNumber.76721474", { shortName: shortName(s, teamId), from: from, to: to, length: here.length, value: elsewhere.length ? __i18n_k("league.legacy.retiredNumber.b1fbc56e", { value: elsewhere.join('·') }) : '' }));
  if (best && best.war >= 3) story.push(__i18n_k("league.legacy.retiredNumber.f16fe1e7", { year: best.year, value: best.war.toFixed(1) }));
  if (honours.length) story.push(honours.join(', '));
  const last = major.length ? Math.max(...major.map((c) => c.year)) : null;
  if (last) story.push(__i18n_k("league.legacy.retiredNumber.448a9493", { last: last, year: r.year, number: r.number, value: hall ? __i18n_k("league.legacy.retiredNumber.52ec09c3") : '' }));
  return { ...base, position: positionLabel(p), pitcher, seasons: here.length, from, to, bat, pit, war, careerWar: major.reduce((a, c) => a + c.war, 0), honours, hall, story };
}

/** A player's awards across the league's history: MVPs, rookie of the year, golden gloves, titles. */
export function honoursOf(s: LeagueState, id: PlayerId): string[] {
  let mvp = 0,
    rookie = 0,
    gg = 0;
  const titles = new Map<string, number>();
  for (const h of s.history) {
    const a = h.awards;
    if (!a) continue;
    if (a.mvp === id) mvp++;
    if (a.rookie === id) rookie++;
    gg += a.goldenGloves.filter((g) => g.id === id).length;
    for (const t of a.titles) if (t.id === id) titles.set(t.label, (titles.get(t.label) ?? 0) + 1);
  }
  const n = (label: string, k: number) => (k > 1 ? __i18n_k("league.legacy.honoursOf.n.37dd1cbe", { label: label, value: k }) : label);
  return [...(mvp ? [n('MVP', mvp)] : []), ...(rookie ? ['신인왕'] : []), ...(gg ? [n('골든글러브', gg)] : []), ...[...titles].map(([label, k]) => n(label, k))];
}

export interface NationalRow {
  id: string;
  year: number;
  name: string;
  result: string;
  medal: boolean;
  /** Squad size, how many from each club (most first), and the user's club's players. */
  squad: number;
  clubs: { team: string; n: number }[];
  ours: { id: PlayerId; name: string }[];
}

/** The national team's finished tournaments, newest first, with a tally of results. */
export function nationalView(s: LeagueState) {
  const rows: NationalRow[] = s.international
    .filter((e) => e.finish)
    .map((e) => {
      const count = new Map<string, number>();
      for (const id of e.squad) {
        const c = s.players[id]?.career.find((x) => x.year === e.year && !x.level) ?? s.players[id]?.career.find((x) => x.year === e.year);
        // Abroad, at school or otherwise without a KBO season that year.
        const team = c ? shortName(s, c.teamId) : '그 밖';
        count.set(team, (count.get(team) ?? 0) + 1);
      }
      const ours = s.user ? e.squad.filter((id) => s.players[id]?.career.some((x) => x.year === e.year && x.teamId === s.user!.teamId)) : [];
      return {
        id: e.id,
        year: e.year,
        name: e.name,
        result: finishText({ kind: e.kind ?? 'asianGames' }, e.finish!),
        medal: e.medal,
        squad: e.squad.length,
        clubs: [...count].map(([team, n]) => ({ team, n })).sort((a, b) => Number(a.team === '그 밖') - Number(b.team === '그 밖') || b.n - a.n),
        ours: ours.map((id) => ({ id, name: s.players[id]!.name })),
      };
    })
    .reverse();
  const wins = rows.filter((r) => r.result === '우승' || r.result === '금메달').length;
  const podiums = rows.filter((r) => ['우승', '금메달', __i18n_k("league.legacy.nationalView.podiums.3660fdbb"), __i18n_k("league.legacy.nationalView.podiums.4761b4b6"), __i18n_k("league.legacy.nationalView.podiums.dd08cf55"), __i18n_k("league.legacy.nationalView.podiums.7948ecf9"), __i18n_k("league.legacy.nationalView.podiums.82c2c27f")].includes(r.result)).length;
  return { rows, wins, podiums, exemptions: rows.filter((r) => r.medal).length };
}
