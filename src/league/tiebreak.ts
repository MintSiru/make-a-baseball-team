import { k as __i18n_k } from '../i18n/index';
/* 1.9.5 (the user's request): the tiebreaker (타이브레이커 결정전). When the regular season ends with two clubs level on
   winning percentage for first place, or for the last place in the postseason, they play one more game: at the park
   of the club ahead on head-to-head (then run differential), played until it is decided, counted in the regular
   season like the KBO's (1986, 2021, 2024; RULES.md §1). A tie for any other place is broken by head-to-head as
   before. With two leagues each league's table stands as it is (no tiebreaker). */
import { rulesFor } from '../rules/history';
import { addAlert } from './alerts';
import { addNews } from './news';
import { eulreul, iga, wagwa } from './josa';
import { standings } from './standings';
import { firstTeamIds, type LeagueState } from './state';
import { sidesOf } from './twelve';

/** The game id of a tiebreaker: `${year}-tb-${place}-${n}`. */
export const isTiebreaker = (id: string) => id.includes('-tb-');

/** The places a tie is played off for: first, and the last postseason place (none for a split season). */
function places(s: LeagueState): number[] {
  if (sidesOf(s)) return [];
  if (!s.historical) return [1, 5];
  const f = rulesFor(s.year).postseason;
  return f === 'five' ? [1, 5] : f === 'four' || f === 'fourWithin3' ? [1, 4] : [];
}

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);

/** At the end of the regular season: schedules the next tiebreaker the table needs (one at a time, the next day),
    or nothing. A tiebreaker that ends level is played again. */
export function addTiebreaker(s: LeagueState): boolean {
  const table = standings(firstTeamIds(s), s.scores);
  const last = s.schedule.at(-1)?.date ?? `${s.year}-10-01`;
  for (const place of places(s)) {
    const a = table[place - 1],
      b = table[place];
    if (!a || !b || a.pct !== b.pct) continue;
    const played = s.scores.filter((g) => g.id.startsWith(`${s.year}-tb-${place}-`));
    // Decided once a tiebreaker for this place has a winner (it then leads the table).
    if (played.some((g) => g.hs !== g.as)) continue;
    if (played.length >= 3) continue;
    const id = `${s.year}-tb-${place}-${played.length + 1}`;
    if (s.schedule.some((g) => g.id === id)) continue;
    s.schedule.push({ id, date: addDays(last, 1), home: a.teamId, away: b.teamId });
    if (!played.length) {
      const name = (t: string) => s.teams.find((x) => x.id === t)?.name ?? t;
      const what = place === 1 ? __i18n_k("league.tiebreak.text.cef6f7cf") : __i18n_k("league.tiebreak.text.fad7f1cb", { place });
      const title = __i18n_k("league.tiebreak.text.d96e6eac", { a: name(a.teamId), b: name(b.teamId), what: eulreul(what) });
      const body = __i18n_k("league.tiebreak.text.3200d494", { a: wagwa(name(a.teamId)), b: iga(name(b.teamId)), home: name(a.teamId), what: eulreul(what) });
      addNews(s, { id: `tb-${s.year}-${place}`, date: last, kind: 'season', title, body, quotes: [], facts: { place }, players: [], mine: s.user?.teamId === a.teamId || s.user?.teamId === b.teamId });
      if (s.user && (s.user.teamId === a.teamId || s.user.teamId === b.teamId)) addAlert(s, { id: `tb-${s.year}-${place}`, date: last, kind: 'season', title, lines: [body] });
    }
    return true;
  }
  return false;
}
