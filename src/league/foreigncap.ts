/* The foreign players' salary cap (V0.7.8, RULES.md §5; KBO 2023~).

   A club's three foreign players may cost at most $4M in a season: salary, signing bonus, transfer fee and
   options actually paid. Each re-signed player raises the cap by $100K for every season he has already
   played for the club. A new signing costs at most $1M. The Asia quota player is outside it with his own
   cap ($200K when new, +$100K a year with the club). Going over is allowed and punished after the season:
   a levy of 50% of the excess, 100% two seasons running (plus the next draft's second-round pick nine
   places later), 150% from the third.

   The books open on opening day with every foreign player's guaranteed money (a player let go mid-season
   stays on them), take in-season replacements as they sign and options as they are paid, and close after
   the season. An expansion club's extra foreign slot adds one new-signing cap (game assumption). */
import type { Player, TeamId } from '../model/types';
import { KBO_2026 } from '../rules/kbo2026';
import { MANWON_PER_USD, usdTotal } from './contracts';
import { addAlert } from './alerts';
import { foreignSlots } from './manager';
import { isForeign, isPitcher } from './players';
import { firstTeamIds, orgPlayers, type DraftSlot, type LeagueState } from './state';
import { OFFSEASON } from './tuning';

const F = KBO_2026.foreign;

/** Seasons he has played for the club before `season` (what a re-signing's tenure counts). */
export const tenureWith = (p: Player, teamId: TeamId, season: number) => p.career.filter((c) => c.teamId === teamId && !c.level && c.year < season).length;

/** An Asia quota player's own cap for `season`: $200K, and $100K more for each season with the club. */
export const asiaCapFor = (p: Player, teamId: TeamId, season: number) => F.asiaQuotaCapUSD + F.asiaQuotaRaisePerYearUSD * tenureWith(p, teamId, season);

/** First-team seasons he has played in the league before `season`. */
export const kboSeasons = (p: Pick<Player, 'career'>, season: number) => new Set(p.career.filter((c) => !c.level && c.year < season).map((c) => c.year)).size;

/** Under the optional veteran rule (1.2.0, LeagueState.foreignVeteran): a foreign player long enough in the league
    to be counted as one of its own — no foreign slot, outside the foreign salary cap. */
export const slotExempt = (s: LeagueState, p: Player, season: number) => !!s.foreignVeteran && isForeign(p) && kboSeasons(p, season) >= s.foreignVeteran;

/** The club's foreign players who take a foreign slot in `season`. */
export const slotForeigners = (s: LeagueState, teamId: TeamId, season: number) => orgPlayers(s, teamId).filter((p) => isForeign(p) && !slotExempt(s, p, season));

/** The club's regular foreign players under contract for `season` (the veterans the rule exempts aside). */
export const capPlayers = (s: LeagueState, teamId: TeamId, season: number) =>
  slotForeigners(s, teamId, season).filter((p) => !p.origin.asiaQuota && p.contract?.salaries.some((x) => x.season === season));

/** The club's cap for `season` with these players: $4M, the tenure raises, and an expansion club's extra slot. */
export function foreignCap(s: LeagueState, teamId: TeamId, season: number, players = capPlayers(s, teamId, season)): number {
  const extra = Math.max(0, foreignSlots(s, teamId, season).regular - F.regular);
  return F.clubTotalCapUSD + extra * F.newContractCapUSD + players.reduce((a, p) => a + F.tenureRaiseUSD * tenureWith(p, teamId, season), 0);
}

/** What these contracts cost at most (options counted in full), US dollars. */
export const foreignCost = (players: Player[]) => players.reduce((a, p) => a + usdTotal(p.contract), 0);
const guaranteed = (p: Player) => (p.contract?.usd ? p.contract.usd.bonus + p.contract.usd.salary : 0);

/** The season's books for a club, read only (worked out from the contracts when they were never opened,
    as in a save from before 0.7.8 in the middle of a season). */
export function booksOf(s: LeagueState, teamId: TeamId) {
  const b = s.foreignBooks?.[teamId];
  if (b && b.season === s.year) return b;
  const players = capPlayers(s, teamId, s.year);
  return { season: s.year, spent: players.reduce((a, p) => a + guaranteed(p), 0), cap: foreignCap(s, teamId, s.year, players) };
}

/** The season's books for a club, opened if need be (for writing). */
function foreignBooks(s: LeagueState, teamId: TeamId) {
  const books = (s.foreignBooks ??= {});
  const b = books[teamId];
  return b && b.season === s.year ? b : (books[teamId] = booksOf(s, teamId));
}

/** Opening day: every first-team club's books for the season. */
export function openForeignBooks(s: LeagueState) {
  s.foreignBooks = {};
  for (const teamId of firstTeamIds(s)) foreignBooks(s, teamId);
}

/** An in-season signing goes on the books (the Asia quota player does not count). */
export function chargeForeign(s: LeagueState, teamId: TeamId, p: Player) {
  if (p.origin.asiaQuota || !firstTeamIds(s).includes(teamId)) return;
  foreignBooks(s, teamId).spent += guaranteed(p);
}

/** Room left under the cap this season, US dollars (negative: over). */
export const capRoom = (s: LeagueState, teamId: TeamId) => {
  const b = booksOf(s, teamId);
  return b.cap - b.spent;
};

/** Options earned this season (a good season: WAR 2.5 for pitchers, 2.0 for hitters; game assumption). */
export function earnedOptions(p: Player, year: number): number {
  const opt = p.contract?.usd?.options ?? 0;
  if (!opt || !p.contract?.salaries.some((x) => x.season === year)) return 0;
  const war = p.career.find((c) => c.year === year && !c.level)?.war ?? 0;
  return war >= (isPitcher(p) ? OFFSEASON.foreign.keepWarPitcher : OFFSEASON.foreign.keepWarHitter) ? opt : 0;
}

export interface ForeignCapRecord {
  year: number;
  spent: number;
  cap: number;
  over: number;
  streak: number;
  /** 만 원. */
  levy: number;
}

/** After the season: options paid go on the books; a club over the cap pays the levy (the user's from its fund). */
export function settleForeignCap(s: LeagueState, year: number) {
  const books = s.foreignBooks ?? {};
  for (const teamId of firstTeamIds(s, year)) {
    const b = books[teamId]?.season === year ? books[teamId]! : null;
    if (!b) continue;
    const spent = b.spent + capPlayers(s, teamId, year).reduce((a, p) => a + earnedOptions(p, year), 0);
    const over = Math.max(0, spent - b.cap);
    const past = s.foreignCap?.[teamId] ?? [];
    const prev = past.find((r) => r.year === year - 1);
    const streak = over > 0 ? (prev && prev.over > 0 ? prev.streak + 1 : 1) : 0;
    const levy = over > 0 ? Math.round(over * F.capLevies[Math.min(streak, F.capLevies.length) - 1]! * MANWON_PER_USD) : 0;
    ((s.foreignCap ??= {})[teamId] ??= []).push({ year, spent, cap: b.cap, over, streak, levy });
    if (streak >= F.capPickDropFrom) ((s.foreignPickDrop ??= {})[year + 1] ??= []).push(teamId);
    const u = s.user;
    if (u && teamId === u.teamId && over > 0) {
      u.fund -= levy;
      u.ledger.push({ year, label: `외국인 샐러리캡 제재금 (초과 ${streak}년째)`, amount: -levy });
      const usd = (n: number) => `${Math.round(n / 10_000)}만 달러`;
      addAlert(s, {
        id: `foreign-cap-${year}`,
        date: `${year}-11-10`,
        kind: 'owner',
        title: '외국인 샐러리캡 초과',
        lines: [
          `외국인 선수 총액 ${usd(spent)} / 상한 ${usd(b.cap)} → 초과 ${usd(over)}`,
          `제재금 ${Math.round(levy / 10000)}억 (초과분의 ${Math.round(F.capLevies[Math.min(streak, F.capLevies.length) - 1]! * 100)}%)${streak >= F.capPickDropFrom ? `, ${year + 2} 신인 2라운드 지명권 9순위 하락` : ''}`,
        ],
        tone: 'bad',
      });
    }
  }
}

/** A club over the foreign cap two seasons running picks nine places later in the second round. */
export function applyForeignPickDrop(s: LeagueState, draftYear: number, slots: DraftSlot[]): DraftSlot[] {
  const drop = s.foreignPickDrop?.[draftYear];
  if (!drop?.length) return slots;
  const out = [...slots];
  for (const teamId of drop) {
    const i = out.findIndex((x) => x.teamId === teamId && x.label.startsWith('2R') && !x.via);
    if (i < 0) continue;
    const [slot] = out.splice(i, 1);
    out.splice(Math.min(out.length, i + 9), 0, slot!);
  }
  return out;
}
