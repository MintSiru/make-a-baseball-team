import { k as __i18n_k } from '../i18n/index';
/* 2.0.25 (the user's request): hit batters, the pitch thrown back (보복구), the benches clearing and the KBO's
   discipline. After each game: a batter hit by a pitch now and then brings both dugouts out — likelier when a star was
   hit, and much likelier when both sides hit someone (the second one read as payback). Most of the time the players
   only face each other; sometimes there is pushing, and now and then a fight. Whoever the umpires throw out (the
   pitcher who threw it back, a batter who charged the mound, a brawler) is suspended by the KBO's rewards and
   punishment committee (상벌위원회) for a few games with a fine, and the clubs pay a fine too. Each one is in the
   papers; our club's in a popup.

   The game itself is already played (its box score stands); what follows is the bench-clearing, the ejections in the
   story, and the suspensions after it. The numbers are game estimates after recent KBO rulings (a pitcher ejected for
   throwing at a batter: a few games and a fine of a few million won; a mound charge and punches: up to ten games). */
import { rng } from '../draftroom';
import type { Player, PlayerId, TeamId } from '../model/types';
import type { GameOut, TeamBox } from './engine/types';
import { addAlert } from './alerts';
import { eulreul, eunneun, iga } from './josa';
import { addNews } from './news';
import { isPitcher } from './players';
import type { LeagueState } from './state';

export const BRAWL = {
  /** A single hit batter brings the benches out this often (a star hit: this much more). 2.0.27: about half as often
      as before, so a league season has some six to nine (the KBO's own count), most of them stand-offs. */
  single: 0.006,
  star: { grade: 65, extra: 0.012 },
  /** Both sides hit someone: the second read as payback this often, and the benches out then. */
  payback: 0.035,
  paybackClear: 0.6,
  /** Once out, how far it goes: a stand-off, pushing, a fight. */
  shares: { standoff: 0.72, scuffle: 0.23, fight: 0.05 },
  /** Games suspended and fines (만원) by what he did. */
  bans: {
    payback: { games: [3, 6], fine: [200, 500] },
    charge: { games: [3, 7], fine: [200, 500] },
    fight: { games: [6, 10], fine: [500, 1000] },
  },
  /** Each club's fine (만원) after a scuffle or a fight. */
  clubFine: 500,
};

export type BrawlLevel = 'standoff' | 'scuffle' | 'fight';

export interface Brawl {
  gameId: string;
  date: string;
  level: BrawlLevel;
  /** The side whose batter was hit first, and (if it was payback) the side that hit back — 2.0.27: the same club,
      its pitcher answering for its batter (it was recorded as the other club before). */
  hit: TeamId;
  back?: TeamId;
  /** Players suspended for it, with their games and fines (만원). */
  bans: { id: PlayerId; teamId: TeamId; games: number; fine: number; why: 'payback' | 'charge' | 'fight' }[];
}

const hitBatters = (b: TeamBox) => b.batting.filter((x) => x.hbp > 0);
const hittingPitchers = (b: TeamBox) => b.pitching.filter((x) => x.hbp > 0);
const pickIn = (r: () => number, [a, b]: number[]) => a! + Math.floor(r() * (b! - a! + 1));
const particleOf = (word: string, f: (w: string) => string) => f(word).slice(word.length);
/** Why each was thrown out, at length (2.0.27). */
const WHY_LONG: Record<Brawl['bans'][number]['why'], () => string> = {
  payback: () => __i18n_k("league.brawl.text.e579b0cc"),
  charge: () => __i18n_k("league.brawl.text.dd00e16b"),
  fight: () => __i18n_k("league.brawl.text.56b644b2"),
};
const short = (s: LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? id;

/** After a game: the benches may clear over a hit batter. */
export function brawlGame(s: LeagueState, out: GameOut, gameId: string, date: string): Brawl | null {
  const homeHit = hitBatters(out.home),
    awayHit = hitBatters(out.away);
  if (!homeHit.length && !awayHit.length) return null;
  const r = rng(`${s.seed}|brawl|${gameId}`);
  const star = (ids: { id: PlayerId }[]) => ids.some((x) => (s.players[x.id]?.scouting.current ?? 0) >= BRAWL.star.grade);
  let hit: 'home' | 'away',
    payback = false;
  if (homeHit.length && awayHit.length && r() < BRAWL.payback) {
    // Both sides hit someone and the second is read as payback: which came first is a coin toss.
    hit = r() < 0.5 ? 'home' : 'away';
    payback = true;
    if (r() >= BRAWL.paybackClear) return null;
  } else {
    hit = homeHit.length && (!awayHit.length || r() < 0.5) ? 'home' : 'away';
    const victims = hit === 'home' ? homeHit : awayHit;
    if (r() >= BRAWL.single + (star(victims) ? BRAWL.star.extra : 0)) return null;
  }
  const x = r();
  const level: BrawlLevel = x < BRAWL.shares.standoff ? 'standoff' : x < BRAWL.shares.standoff + BRAWL.shares.scuffle ? 'scuffle' : 'fight';
  const side = (k: 'home' | 'away') => (k === 'home' ? out.home : out.away);
  const other = (k: 'home' | 'away') => (k === 'home' ? 'away' : 'home');
  const best = (b: TeamBox) => s.players[[...hitBatters(b)].sort((a, c) => (s.players[c.id]?.scouting.current ?? 0) - (s.players[a.id]?.scouting.current ?? 0))[0]!.id]!;
  // The first batter hit (on the `hit` side) by the other side's pitcher; with payback, the `hit` side's pitcher
  // then hits one of theirs, and it is that batter who has had enough.
  const victim = best(side(hit));
  const thrower = s.players[hittingPitchers(side(other(hit)))[0]?.id ?? ''];
  const avenger = payback ? s.players[hittingPitchers(side(hit))[0]?.id ?? ''] : undefined;
  const victim2 = payback ? best(side(other(hit))) : undefined;
  const bans: Brawl['bans'] = [];
  const ban = (p: Player | undefined, teamId: TeamId, why: 'payback' | 'charge' | 'fight') => {
    if (!p || bans.some((b) => b.id === p.id)) return;
    const B = BRAWL.bans[why];
    // Fines in 만원, rounded to 10만 won (2.0.27: they were ten times too much).
    bans.push({ id: p.id, teamId, games: pickIn(r, B.games), fine: Math.round(pickIn(r, B.fine) / 10) * 10, why });
  };
  // The one who threw it back is thrown out whatever follows; a scuffle or a fight costs the batter who charged the
  // mound (the last one hit), and a fight the pitcher he went for too.
  if (avenger) ban(avenger, side(hit).teamId, 'payback');
  const charger = payback ? victim2 : victim;
  const chargerSide = payback ? other(hit) : hit;
  if (level !== 'standoff' && charger && !isPitcher(charger)) ban(charger, side(chargerSide).teamId, level === 'fight' ? 'fight' : 'charge');
  const target = payback ? avenger : thrower;
  if (level === 'fight' && target) ban(target, side(payback ? hit : other(hit)).teamId, 'fight');
  const brawl: Brawl = { gameId, date, level, hit: side(hit).teamId, ...(payback ? { back: side(hit).teamId } : {}), bans };
  settle(s, brawl, { victim, thrower, avenger, victim2, hitClub: side(hit).teamId, otherClub: side(other(hit)).teamId });
  return brawl;
}

/** The suspensions, the fines, the papers and our popup. */
function settle(s: LeagueState, b: Brawl, who: { victim: Player; thrower?: Player; avenger?: Player; victim2?: Player; hitClub: TeamId; otherClub: TeamId }) {
  const { victim, thrower, avenger, victim2, hitClub, otherClub } = who;
  const clubs = [hitClub, otherClub];
  const reasonOf = (why: Brawl['bans'][number]['why']) => (why === 'payback' ? __i18n_k("league.brawl.text.52902162") : why === 'charge' ? __i18n_k("league.brawl.text.0fa1bdba") : __i18n_k("league.brawl.text.078d81ca"));
  for (const x of b.bans) {
    const reason = reasonOf(x.why);
    const prev = s.suspended?.[x.id];
    (s.suspended ??= {})[x.id] = { reason, games: (prev?.games ?? 0) + x.games, ...(prev?.until ? { until: prev.until } : {}), since: b.date };
  }
  const mine = !!s.user && clubs.includes(s.user.teamId);
  if (s.user && b.level !== 'standoff' && clubs.includes(s.user.teamId)) {
    s.user.fund -= BRAWL.clubFine;
    s.user.ledger.push({ year: s.year, label: __i18n_k("league.brawl.text.2ab9515a"), amount: -BRAWL.clubFine });
  }
  const pair = clubs.map((id) => short(s, id)).join('·');
  const title =
    b.level === 'standoff'
      ? __i18n_k("league.brawl.text.b95f16a8", { pair, victim: victim.name })
      : b.level === 'scuffle'
        ? __i18n_k("league.brawl.text.bdce29c5", { pair })
        : __i18n_k("league.brawl.text.ded639c1", { pair });
  const lines: string[] = [];
  // 2.0.27: who threw at whom, with their clubs, so the first sentence reads on its own.
  lines.push(
    avenger && victim2
      ? __i18n_k("league.brawl.text.1ec8015c", { otherClub: short(s, otherClub), hitClub: short(s, hitClub), thrower: thrower?.name ?? '', victim: iga(victim.name), avenger: iga(avenger.name), victim2: eulreul(victim2.name) })
      : __i18n_k("league.brawl.text.9076f037", { otherClub: short(s, otherClub), hitClub: short(s, hitClub), thrower: thrower?.name ?? '', victim: victim.name }),
  );
  if (b.level === 'standoff') lines.push(__i18n_k("league.brawl.text.1c2809b7"));
  for (const x of b.bans) {
    const p = s.players[x.id]!;
    // 2.0.27: and why he was thrown out and punished.
    lines.push(__i18n_k("league.brawl.text.504348a9", { name: p.name, club: short(s, x.teamId), particle: particleOf(p.name, eunneun), why: WHY_LONG[x.why](), games: x.games, fine: x.fine.toLocaleString('ko-KR') }));
  }
  if (b.level !== 'standoff') lines.push(__i18n_k("league.brawl.text.7b8c67d8", { fine: BRAWL.clubFine }));
  addNews(s, { id: `brawl-${b.gameId}`, date: b.date, kind: 'game', title, body: lines.join(' '), quotes: [], facts: { level: b.level, suspended: b.bans.length }, players: [victim.id, ...b.bans.map((x) => x.id)], ...(mine ? { mine } : {}) });
  if (mine) addAlert(s, { id: `brawl-${b.gameId}`, date: b.date, kind: 'season', title, lines, ...(b.bans.some((x) => x.teamId === s.user!.teamId) ? { tone: 'bad' as const } : {}), players: [victim.id, ...b.bans.map((x) => x.id)] });
  (s.brawls ??= []).push(b);
}
