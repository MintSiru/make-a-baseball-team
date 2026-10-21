import { k as __i18n_k } from '../i18n/index';
/* 2.0.36 (the user's requests): things that go round on social media about our players, now and then — rare, each
   with its own small mark:

   - 수달 논쟁: two young players argue on camera whether otters live in the river by the ballpark; the clip goes round
     and they go and look. Otters there: both lift for a while. Now and then one slips on the bank.
   - 방화 뒤 게임: a reliever who blew last night's game is seen gaming for hours afterwards — the fans cool a little,
     win or lose that game.
   - 먹방: a big man's eating video on the club's channel is a hit.
   - 챌린지: a player's dance challenge goes round.
   - 코치와 달리기: a coach races a foreign player for fun and the player's hamstring goes.
   - 외국인 선수 가족의 SNS: his wife, girlfriend or parent posts something the fans do not like.
   - 빵 셔틀: in a losing streak, a veteran is reported to have sent a junior out for bread — tactless, and his manager
     may send him down for it (discipline.ts).

   Each comes from its own stream (`viral|date`), our club only, like life.ts. */
import { rng } from '../draftroom';
import type { InjuryRecord, Player, TeamId } from '../model/types';
import { addAlert } from './alerts';
import { maybeDiscipline } from './discipline';
import { clubState } from './fans';
import { eulreul, iga, wagwa } from './josa';
import { adjustFans, note, setForm } from './life';
import { addNews } from './news';
import { ageIn, isForeign, isPitcher } from './players';
import { orgPlayers, type LeagueState } from './state';

export const VIRAL = {
  /** A game day's chance something goes round, and how often each kind (when it can happen at all). */
  daily: 0.025,
  weights: { otter: 0.6, gamer: 1.2, mukbang: 1, challenge: 1.4, coachRace: 0.35, foreignFamily: 0.6, bread: 0.8 },
  otter: { found: 0.5, form: 1.5, days: 14, fans: 3, slip: 0.08, slipDays: [3, 8] as const, maxAge: 25 },
  gamer: { er: 3, fans: -3, interest: 0.01 },
  mukbang: { weight: 98, fans: 4, interest: 0.008 },
  challenge: { maxAge: 28, fans: 3, interest: 0.006 },
  coachRace: { days: [10, 24] as const },
  foreignFamily: { fans: -4, interest: 0.008, form: -1, days: 7 },
  bread: { streak: 5, minAge: 31, fans: -3, interest: 0.008 },
};

export type ViralKind = keyof typeof VIRAL.weights;

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
const pick = <T>(xs: readonly T[], r: () => number) => xs[Math.floor(r() * xs.length)]!;

/** Our club's losing streak going into the day. */
export function losingStreakOf(s: LeagueState, teamId: TeamId): number {
  let n = 0;
  for (let i = s.scores.length - 1; i >= 0; i--) {
    const g = s.scores[i]!;
    if (g.home !== teamId && g.away !== teamId) continue;
    const [mine, theirs] = g.home === teamId ? [g.hs, g.as] : [g.as, g.hs];
    if (mine < theirs) n++;
    else break;
  }
  return n;
}

/** A reliever of ours who blew our last game (a loss in which he gave up three earned runs or more). */
function blewIt(s: LeagueState, teamId: TeamId): Player | null {
  const last = [...s.scores].reverse().find((g) => g.home === teamId || g.away === teamId);
  if (!last) return null;
  const home = last.home === teamId;
  if ((home ? last.hs : last.as) >= (home ? last.as : last.hs)) return null;
  const box = Object.values(s.boxes ?? {}).find((b) => b.date === last.date && b.home === last.home && b.away === last.away);
  if (!box) return null;
  const rows = box.pit[home ? 1 : 0];
  const bad = rows.slice(1).find((row) => (row[4] as number) >= VIRAL.gamer.er);
  return bad ? (s.players[bad[0] as string] ?? null) : null;
}

/** Who each kind can happen to (empty: not today). */
function castFor(s: LeagueState, kind: ViralKind): Player[][] {
  const u = s.user!;
  const first = new Set(s.rosters[u.teamId]!.active);
  const fit = orgPlayers(s, u.teamId).filter((p) => p.status === 'active' && !s.injuries[p.id] && !s.away[p.id] && !s.abroad?.[p.id]);
  const onFirst = fit.filter((p) => first.has(p.id));
  switch (kind) {
    case 'otter': {
      const young = fit.filter((p) => ageIn(p, s.year) <= VIRAL.otter.maxAge);
      return young.length >= 2 ? [young] : [];
    }
    case 'gamer': {
      const p = blewIt(s, u.teamId);
      return p && first.has(p.id) ? [[p]] : [];
    }
    case 'mukbang':
      return [fit.filter((p) => p.weight >= VIRAL.mukbang.weight)].filter((x) => x.length);
    case 'challenge':
      return [fit.filter((p) => ageIn(p, s.year) <= VIRAL.challenge.maxAge)].filter((x) => x.length);
    case 'coachRace':
    case 'foreignFamily':
      return [onFirst.filter(isForeign)].filter((x) => x.length);
    case 'bread': {
      if (losingStreakOf(s, u.teamId) < VIRAL.bread.streak) return [];
      const old = onFirst.filter((p) => ageIn(p, s.year) >= VIRAL.bread.minAge);
      const young = fit.filter((p) => ageIn(p, s.year) <= 23);
      return old.length && young.length ? [old, young] : [];
    }
  }
}

/** Before the day's games: now and then, one of these. Returns the kind (or null). */
export function viralDay(s: LeagueState, date: string): ViralKind | null {
  const u = s.user;
  if (!u || s.phase !== 'regular') return null;
  const r = rng(`${s.seed}|viral|${date}`);
  if (r() >= VIRAL.daily) return null;
  const kinds = (Object.entries(VIRAL.weights) as [ViralKind, number][]).filter(([k]) => castFor(s, k).length);
  if (!kinds.length) return null;
  let x = r() * kinds.reduce((a, [, w]) => a + w, 0);
  const kind = (kinds.find(([, w]) => (x -= w) < 0) ?? kinds[0]!)[0];
  happen(s, kind, date, r);
  return kind;
}

/** Makes it happen (also for tests). */
export function happen(s: LeagueState, kind: ViralKind, date: string, r: () => number) {
  const u = s.user!;
  const cast = castFor(s, kind);
  if (!cast.length) return;
  const club = s.teams.find((t) => t.id === u.teamId)?.short ?? '';
  const mood = clubState(s, u.teamId);
  let title = '',
    body = '',
    tone: 'good' | 'bad' = 'good';
  const players: Player[] = [];
  let alert = false;
  switch (kind) {
    case 'otter': {
      const a = pick(cast[0]!, r);
      const b = pick(cast[0]!.filter((p) => p.id !== a.id), r);
      players.push(a, b);
      const found = r() < VIRAL.otter.found;
      const slip = r() < VIRAL.otter.slip ? pick([a, b], r) : null;
      title = __i18n_k("league.viral.text.0605c900", { a: a.name, b: b.name });
      body = __i18n_k("league.viral.text.19356ea1", { a: wagwa(a.name), b: iga(b.name) });
      if (found) {
        for (const p of [a, b]) {
          setForm(p, VIRAL.otter.form, date, VIRAL.otter.days, __i18n_k("league.viral.text.219b9dc4"));
          adjustFans(p, VIRAL.otter.fans);
        }
        body += ' ' + __i18n_k("league.viral.text.d8bd97dc");
      } else body += ' ' + __i18n_k("league.viral.text.860ad8e7");
      if (slip) {
        const days = VIRAL.otter.slipDays[0] + Math.floor(r() * (VIRAL.otter.slipDays[1] - VIRAL.otter.slipDays[0] + 1));
        s.injuries[slip.id] = { until: addDays(date, days + 1), days, onList: false, dtd: true, part: __i18n_k("league.viral.text.b0e0f19c") };
        body += ' ' + __i18n_k("league.viral.text.5dc5525a", { name: iga(slip.name), days });
        tone = 'bad';
        alert = true;
      }
      break;
    }
    case 'gamer': {
      const p = cast[0]![0]!;
      players.push(p);
      adjustFans(p, VIRAL.gamer.fans);
      mood.interest -= VIRAL.gamer.interest;
      title = __i18n_k("league.viral.text.8c18adda", { name: p.name });
      body = __i18n_k("league.viral.text.e972651e", { name: iga(p.name) });
      tone = 'bad';
      break;
    }
    case 'mukbang': {
      const p = pick(cast[0]!, r);
      players.push(p);
      adjustFans(p, VIRAL.mukbang.fans);
      mood.interest += VIRAL.mukbang.interest;
      title = __i18n_k("league.viral.text.01d66c53", { club, name: p.name });
      body = __i18n_k("league.viral.text.b05d49d8", { name: iga(p.name) });
      break;
    }
    case 'challenge': {
      const p = pick(cast[0]!, r);
      players.push(p);
      adjustFans(p, VIRAL.challenge.fans);
      mood.interest += VIRAL.challenge.interest;
      title = __i18n_k("league.viral.text.134f0a7b", { name: p.name });
      body = __i18n_k("league.viral.text.b9d0eb7c", { name: iga(p.name) });
      break;
    }
    case 'coachRace': {
      const p = pick(cast[0]!, r);
      players.push(p);
      const coach = s.clubs?.[u.teamId]?.staff?.[isPitcher(p) ? 'pitching' : 'fielding']?.name ?? __i18n_k("league.viral.text.95430629");
      const days = VIRAL.coachRace.days[0] + Math.floor(r() * (VIRAL.coachRace.days[1] - VIRAL.coachRace.days[0] + 1));
      const part = __i18n_k("league.viral.text.fe47f4a0");
      s.injuries[p.id] = { until: addDays(date, days), days, onList: true, part };
      const rec: InjuryRecord = { date, days, part };
      (p.injuries ??= []).push(rec);
      title = __i18n_k("league.viral.text.16a1d85d", { club, name: p.name });
      body = __i18n_k("league.viral.text.490ee4a5", { name: iga(p.name), coach, days });
      tone = 'bad';
      alert = true;
      break;
    }
    case 'foreignFamily': {
      const p = pick(cast[0]!, r);
      players.push(p);
      const who = pick([__i18n_k("league.viral.text.8f81be61"), __i18n_k("league.viral.text.5f0ae6a8"), __i18n_k("league.viral.text.0e330181"), __i18n_k("league.viral.text.7e3ccf68")], r);
      adjustFans(p, VIRAL.foreignFamily.fans);
      mood.interest -= VIRAL.foreignFamily.interest;
      setForm(p, VIRAL.foreignFamily.form, date, VIRAL.foreignFamily.days, __i18n_k("league.viral.text.0b9b15ef"));
      title = __i18n_k("league.viral.text.30fd6d76", { name: p.name, who });
      body = __i18n_k("league.viral.text.87dfb2ba", { name: p.name, who: iga(who) });
      tone = 'bad';
      break;
    }
    case 'bread': {
      const old = pick(cast[0]!, r);
      const young = pick(cast[1]!.filter((p) => p.id !== old.id), r) ?? cast[1]![0]!;
      players.push(old, young);
      const streak = losingStreakOf(s, u.teamId);
      adjustFans(old, VIRAL.bread.fans);
      mood.interest -= VIRAL.bread.interest;
      title = __i18n_k("league.viral.text.3ef82baf", { streak, club, name: old.name });
      body = __i18n_k("league.viral.text.42b081e1", { club: iga(club), streak, name: iga(old.name), young: eulreul(young.name) });
      tone = 'bad';
      maybeDiscipline(s, old, date, r);
      break;
    }
  }
  for (const p of players) note(p, date, title, tone);
  addNews(s, { id: `viral-${kind}-${date}`, date, kind: 'interview', title, body, quotes: [], facts: { club, event: title }, players: players.map((p) => p.id), mine: true });
  if (alert) addAlert(s, { id: `viral-${kind}-${date}`, date, kind: 'life', title, lines: [body], tone, players: players.map((p) => p.id) });
}
