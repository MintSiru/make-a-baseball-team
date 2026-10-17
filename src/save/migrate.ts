/* Carrying a snapshot from an older simulation version into this one. A save holds the whole league
   state, so an older game can go on under the current rules: fields added since are filled in, and
   everything simulated from here follows the new rules (the history already played stays as it was).
   Versions without a league snapshot (0.1) cannot be carried over. */
import { SIM_VERSION } from '../core/version';
import type { LeagueState, NationalEntry } from '../league/state';
import { INTERNATIONAL } from '../league/international';
import { batsFor } from '../model/player';
import { altPositions } from '../model/position';
import { migrateAlt } from '../league/positions';
import { rng } from '../draftroom';
import { attendance, recordGate } from '../league/fans';
import { baseSupport, setGoals } from '../league/parent';
import { staffOf } from '../league/staff';
import { openMarket, roundDecision } from '../league/fa';
import { DIFFICULTY } from '../league/tuning';
import { rollPersonality, rollTraits } from '../league/traits';
import { FOREIGN_TYPES, foreignTypeOf } from '../league/players';
import { backfillDraftLog } from '../league/draftlog';
import { backfillMlb, rescoreMlb } from '../league/mlb';
import { nicknameWinter } from '../league/nicknames';
import { dealYears } from '../league/returnees';
import { logGrades } from '../league/offseason';

/** Simulation versions whose snapshots this build can carry forward. */
export const MIGRATABLE = ['0.2', '0.3', '0.4', '0.4.1', '0.5', '0.5.1', '0.6', '0.7', '0.7.6', '0.7.7', '0.7.8', '0.8.0', '0.11.0', '0.12.0', '0.16.0', '1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0', '1.6.0', '1.7.0', '1.7.1', '1.8.0', '1.8.1', '1.8.2', '1.8.4', '1.9.0', '1.9.3', '1.9.5', '1.9.8', '1.9.9', '2.0.0', '2.0.1', '2.0.2', '2.0.3', '2.0.4'];

type Loose = Record<string, unknown>;

export function migrateState(raw: unknown, from: string): LeagueState {
  const s = raw as LeagueState & Loose;
  // 0.2 → 0.3: the user's club, decisions, the staged offseason and the futures year.
  s.user ??= null;
  s.pending ??= null;
  s.offseason ??= null;
  s.futures ??= null;
  // 0.3 → 0.4: the third squad, national-team absences, the futures league shape.
  for (const r of Object.values(s.rosters)) (r as unknown as Loose).third ??= [];
  s.away ??= {};
  if (s.futures) {
    const f = s.futures as unknown as Loose & { schedule: { home: string; away: string }[] };
    f.teams ??= [...new Set(f.schedule.flatMap((g) => [g.home, g.away]))];
    f.training ??= {};
  }
  // A draft in progress: bonuses were paid at the pick before 0.4, so no negotiation afterwards.
  const d = s.offseason?.draft as (Loose & { bonusDone?: boolean; userDevelopmentDone?: boolean }) | null | undefined;
  if (d && from !== SIM_VERSION && ['0.2', '0.3'].includes(from)) {
    d.bonusDone = true;
    d.userDevelopmentDone = true;
  }
  // 0.5 added the second draft after 'special' (step 7): later offseason steps move one on.
  if (s.offseason && ['0.2', '0.3', '0.4', '0.4.1'].includes(from) && s.offseason.step >= 8) s.offseason.step += 1;
  // 0.5.1 added posting before free agency (step 4): only saves from before it move on (0.5.1 and
  // later already have the step).
  if (s.offseason && ['0.2', '0.3', '0.4', '0.4.1', '0.5'].includes(from) && s.offseason.step >= 4) s.offseason.step += 1;
  // 1.9.9 added the board's meeting as the offseason's first step (board.ts): every later step moves one on.
  if (s.offseason && MIGRATABLE.indexOf(from) >= 0 && MIGRATABLE.indexOf(from) <= MIGRATABLE.indexOf('1.9.8')) s.offseason.step += 1;
  // 0.5.1: left-handed throwers bat left as in the league (좌투우타 became rare).
  for (const p of Object.values(s.players)) p.bats = batsFor(p.id, p.throws, p.bats);
  // 0.6: the business side. Clubs get fans, prices and staff; this season's gates are rebuilt from the
  // games already played; the user's owner starts with its base support and neutral trust.
  if (!s.clubs) {
    for (const t of s.teams) if (s.rosters[t.id]) staffOf(s, t.id);
    s.gate = {};
    s.postseasonGate = 0;
    if (s.phase === 'regular' || s.phase === 'postseason')
      for (const g of s.scores) {
        g.att = attendance(s, g);
        recordGate(s, g.home, g.att);
      }
    const u = s.user;
    if (u) {
      u.support ??= Math.round(baseSupport(u.settings.parentType) * DIFFICULTY.money[u.settings.difficulty]);
      u.trust ??= 60;
      u.budgetScale ??= 1;
      if (s.phase === 'regular') setGoals(s, s.year);
    }
  }
  // 0.8: the free-agent market became a negotiation in rounds. A save waiting on the old one-pass market (or
  // the founding winter's free-agent list) opens the new market instead, on the same winter.
  const pending = s.pending as { kind: string } | null;
  if (s.offseason && pending && ['faMarket', 'freeAgents', 'ownFreeAgents'].includes(pending.kind)) {
    const o = s.offseason as typeof s.offseason & Loose;
    delete o.faOffers;
    delete o.faGift;
    o.fa = openMarket(s, o.year + 1);
    s.pending = roundDecision(o.fa);
  }
  // 0.11: a hitter's other positions became a list of up to three: where he has played most, then a draw.
  for (const p of Object.values(s.players)) if (p.position && !p.alt) migrateAlt(p, altPositions(p.position, p.scouting.futureTools ?? p.scouting.tools, rng(`${s.seed}|alt|${p.id}`)));
  // 0.12: several national-team events a year, each with an id, a result and the club's requests.
  for (const e of s.international as (NationalEntry & Loose)[]) {
    if (e.id) continue;
    const ev = INTERNATIONAL.find((x) => x.year === e.year && (x.kind === 'asianGames' || x.kind === 'olympics'));
    e.id = ev?.id ?? `${e.year}-asianGames`;
    e.kind = ev?.kind ?? 'asianGames';
    e.finish = ev?.finish ?? (e.medal ? (e.kind === 'olympics' ? 'third' : 'champion') : 'fourth');
    e.left = true;
    e.asked = true;
  }
  // 1.0.0 is 0.16.0 renamed: the same simulation, so a 0.16.0 snapshot needs nothing more for it.
  // 1.1.0: everyone gets a growth type and hidden traits (drawn as a new player's are: from his personality and
  // Draft Room growth curve, on a stream of their own); foreign players, who came without, get a personality and a
  // type read from their abilities.
  for (const p of Object.values(s.players)) {
    const foreign = p.origin.kind === 'foreign';
    if (foreign) {
      if (!p.personality) p.personality = rollPersonality(s.seed, p.id);
      if (!FOREIGN_TYPES.has(p.archetype)) p.archetype = foreignTypeOf(p);
    }
    p.hidden.traits ??= rollTraits(s.seed, p.id, p.personality, foreign ? undefined : p.hidden.growthCurve);
  }
  // 1.2.0 adds the All-Star game (it starts with the next voting), interviews, more of life and an optional foreign
  // veteran rule (off): nothing to fill in.
  // 1.3.0: a postseason saved before it went game by game was played all at once already (no bracket: over); a
  // foreign signing waiting without talks signs at the listed price; nothing to fill in either.
  // 1.4.0: postseason lines start with the next postseason game (none were kept before); staff hired before were all
  // strangers; nothing to fill in.
  // 1.6.0: players grow and age on the new curves (a 27–32 prime) from the next winter; a club founded before has no
  // scenario (a free founding) and stops at all the moments (stops.ts) unless the settings say otherwise.
  if (s.user) s.user.settings.scenario ??= null;
  // 1.7.0: the draft record, read back from the players still in the league (draftlog.ts); draft-day grades and
  // future grades once a season start with the next draft and winter.
  backfillDraftLog(s);
  backfillMlb(s, dealYears);
  // 1.7.1: the big-league seasons on the revised scale; a late glove only for a starter (the games from now on).
  rescoreMlb(s);
  // 1.8.0: staff contracts on paper (staffdeals.ts) — the length left and a manager's bonus; the first season is not known.
  const base = s.offseason ? s.offseason.year : s.year - 1;
  for (const c of Object.values(s.clubs ?? {}))
    for (const m of Object.values(c.staff ?? {}))
      if (m && m.years === undefined) {
        m.years = Math.max(1, m.until - base);
        m.bonus = m.role === 'manager' ? Math.round((m.salary * 0.35 * m.years) / 1000) * 1000 : 0;
      }
  // 1.9.0: postseason entries (postentry.ts). A club that stops before its postseason games stops for its entry too;
  // a season past the deadlines lets everyone in this year, and a postseason under way plays its round as it stands.
  const stops = s.user?.settings.stops;
  if (stops?.includes('bigGame') && !stops.includes('postEntry')) stops.push('postEntry');
  // 1.9.3: the fans' nicknames from the record so far (no news for them).
  if (s.history.length) nicknameWinter(s, s.history.at(-1)!.year, false);
  // The ability graph starts from today's report.
  for (const p of Object.values(s.players)) if (!p.gradeLog && (p.status === 'active' || p.status === 'military' || p.status === 'freeAgent')) logGrades(p, p.scouting.season);
  s.sim = SIM_VERSION;
  return s;
}
