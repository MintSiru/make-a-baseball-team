import { k as __i18n_k } from '../i18n/index';
/* Stops at the moments that matter (1.6.0, from the 1.4 review): a run of days ("1주", "한 달", "정규시즌 끝까지")
   ends early when one of our regulars is out for three weeks or more, a week before the trade deadline, after our
   first first-team game, and when our place in the postseason is settled either way. Each is a setting (all on by
   default). A stop only ends the run: the days played are the same days, so the season itself does not change. */
import type { Player, PlayerId } from '../model/types';
import { KBO_2026 } from '../rules/kbo2026';
import { addAlert } from './alerts';
import { firstTeamIds, type LeagueState } from './state';
import { standings } from './standings';

export type StopKind = 'injury' | 'deadline' | 'debut' | 'race';
export const STOP_KINDS: StopKind[] = ['injury', 'deadline', 'debut', 'race'];
export const STOP_LABEL: Record<StopKind, string> = {
  injury: __i18n_k("league.stops.sTOP_LABEL.injury.8609c770"),
  deadline: __i18n_k("league.stops.sTOP_LABEL.deadline.9b2951ae"),
  debut: __i18n_k("league.stops.sTOP_LABEL.debut.d6f96edd"),
  race: __i18n_k("league.stops.sTOP_LABEL.race.41b44b9f"),
};
/** Out this long or more stops the run. */
const LONG = 21;
/** The places that reach the postseason in one league. */
const SPOTS = 5;

export const stopsOf = (s: LeagueState): StopKind[] => s.user?.settings.stops ?? STOP_KINDS;

const deadlineWeek = (year: number) => {
  const [m, d] = KBO_2026.trade.deadline.split('-').map(Number);
  const t = new Date(Date.UTC(year, m! - 1, d! - 7));
  return t.toISOString().slice(0, 10);
};

/** A regular: on the first-team roster and among the better half of it. */
function regular(s: LeagueState, p: Player): boolean {
  const r = s.rosters[p.teamId!];
  return !!r?.active.includes(p.id) && p.scouting.current >= 50;
}

/** Where our club stands against the postseason line: 'in', 'out' or still open. */
export function raceState(s: LeagueState): 'in' | 'out' | null {
  const u = s.user;
  if (!u || s.twelve?.format === 'two') return null;
  const ids = firstTeamIds(s, s.year);
  if (!ids.includes(u.teamId)) return null;
  const rows = standings(ids, s.scores);
  const left: Record<string, number> = {};
  for (let i = s.next; i < s.schedule.length; i++) {
    const g = s.schedule[i]!;
    left[g.home] = (left[g.home] ?? 0) + 1;
    left[g.away] = (left[g.away] ?? 0) + 1;
  }
  const me = rows.find((r) => r.teamId === u.teamId)!;
  const others = rows.filter((r) => r.teamId !== u.teamId);
  const myMax = me.w + (left[u.teamId] ?? 0);
  // In: at most four others can still reach our wins. Out: five others already have more than we can reach.
  if (others.filter((r) => r.w + (left[r.teamId] ?? 0) >= me.w).length < SPOTS) return 'in';
  if (others.filter((r) => r.w > myMax).length >= SPOTS) return 'out';
  return null;
}

/** Watches a run of days; call after each day: true when the run should stop there. */
export function watchStops(s: LeagueState): () => boolean {
  const u = s.user;
  const on = new Set(stopsOf(s));
  if (!u || !on.size || s.phase !== 'regular') return () => false;
  const hurt = new Set<PlayerId>(Object.keys(s.injuries));
  const race = raceState(s);
  const first = firstTeamIds(s, s.year).includes(u.teamId);
  const played = () => s.scores.filter((g) => g.home === u.teamId || g.away === u.teamId).length;
  const debutDue = on.has('debut') && first && s.year === u.firstTeamYear && played() === 0;
  return () => {
    const last = s.schedule[s.next - 1]?.date ?? '';
    const coming = s.schedule[s.next]?.date;
    if (on.has('injury')) {
      for (const [id, inj] of Object.entries(s.injuries)) {
        if (hurt.has(id)) continue;
        hurt.add(id);
        const p = s.players[id];
        if (inj.dtd || inj.days < LONG || p?.teamId !== u.teamId || !regular(s, p)) continue;
        addAlert(s, { id: `stop-injury-${id}-${last}`, date: last, kind: 'injury', title: __i18n_k("league.stops.watchStops.title.1f9adc78", { name: p.name, value: inj.part ?? __i18n_k("league.stops.watchStops.title.501fb802") }), lines: [__i18n_k("league.stops.watchStops.lines.cf8199a2", { value: Math.round(inj.days / 7), until: inj.until })], tone: 'bad', players: [id] });
        return true;
      }
    }
    if (on.has('deadline') && first && coming) {
      const week = deadlineWeek(s.year);
      if (last < week && coming >= week) {
        addAlert(s, { id: `stop-deadline-${s.year}`, date: last, kind: 'season', title: __i18n_k("league.stops.watchStops.title.9b2951ae"), lines: [__i18n_k("league.stops.watchStops.lines.0a521729")] });
        return true;
      }
    }
    if (debutDue && played() > 0) {
      addAlert(s, { id: `stop-debut-${s.year}`, date: last, kind: 'achievement', title: __i18n_k("league.stops.watchStops.title.fa9df9f2"), lines: [__i18n_k("league.stops.watchStops.lines.998b94c9")], tone: 'good' });
      return true;
    }
    if (on.has('race') && !race) {
      const now = raceState(s);
      if (now) {
        addAlert(s, { id: `stop-race-${s.year}`, date: last, kind: 'season', title: now === 'in' ? __i18n_k("league.stops.watchStops.title.2436b1e6") : __i18n_k("league.stops.watchStops.title.7344d498"), lines: [now === 'in' ? __i18n_k("league.stops.watchStops.lines.886f62d0") : __i18n_k("league.stops.watchStops.lines.13c627fd")], tone: now === 'in' ? 'good' : 'bad' });
        return true;
      }
    }
    return false;
  };
}
