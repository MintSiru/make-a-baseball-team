import { k as __i18n_k } from '../i18n/index';
/* The club's story (V0.7): a timeline of firsts and big moments, and achievements the general manager
   unlocks. Both are the user's club only and never touch the simulation. */
import type { StoredBox } from './boxscore';
import type { SeasonAwards } from './awards';
import type { LeagueState } from './state';
import { achievementAlert } from './alerts';
import { madePostseason } from './twelve';

export interface Achievement {
  id: string;
  label: string;
  note: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'founded', label: __i18n_k("league.milestones.aCHIEVEMENTS.label.22817f11"), note: __i18n_k("league.milestones.aCHIEVEMENTS.note.a0ce0ff1") },
  { id: 'firstWin', label: __i18n_k("league.milestones.aCHIEVEMENTS.label.322c05b0"), note: __i18n_k("league.milestones.aCHIEVEMENTS.note.64dd18b6") },
  { id: 'walkOff', label: __i18n_k("league.milestones.aCHIEVEMENTS.label.38f4c682"), note: __i18n_k("league.milestones.aCHIEVEMENTS.note.b7aae489") },
  { id: 'immaculate', label: __i18n_k("league.milestones.text.17fb66f7"), note: __i18n_k("league.milestones.text.6192e20a") },
  { id: 'noHitter', label: __i18n_k("league.milestones.aCHIEVEMENTS.label.b1faa7c8"), note: __i18n_k("league.milestones.aCHIEVEMENTS.note.b23a0740") },
  { id: 'winning', label: __i18n_k("league.milestones.aCHIEVEMENTS.label.d1db6ed1"), note: __i18n_k("league.milestones.aCHIEVEMENTS.note.e75e1289") },
  { id: 'playoffs', label: __i18n_k("league.milestones.aCHIEVEMENTS.label.83425fb3"), note: __i18n_k("league.milestones.aCHIEVEMENTS.note.7fb83a6e") },
  { id: 'pennant', label: __i18n_k("league.milestones.aCHIEVEMENTS.label.cef6f7cf"), note: __i18n_k("league.milestones.aCHIEVEMENTS.note.57469c0e") },
  { id: 'champion', label: __i18n_k("league.milestones.aCHIEVEMENTS.label.0b104a90"), note: '우승' },
  { id: 'dynasty', label: __i18n_k("league.milestones.aCHIEVEMENTS.label.c1954b65"), note: __i18n_k("league.milestones.aCHIEVEMENTS.note.04bc5c68") },
  { id: 'mvp', label: __i18n_k("league.milestones.aCHIEVEMENTS.label.e4b44955"), note: __i18n_k("league.milestones.aCHIEVEMENTS.note.429cf477") },
  { id: 'rookie', label: __i18n_k("league.milestones.aCHIEVEMENTS.label.6a9b2ed2"), note: __i18n_k("league.milestones.aCHIEVEMENTS.note.a5e5412b") },
  { id: 'homegrown', label: __i18n_k("league.milestones.aCHIEVEMENTS.label.b26207d9"), note: __i18n_k("league.milestones.aCHIEVEMENTS.note.c391f889") },
  { id: 'crowd', label: __i18n_k("league.milestones.aCHIEVEMENTS.label.2d4d1772"), note: __i18n_k("league.milestones.aCHIEVEMENTS.note.1121dbdf") },
  { id: 'sellouts', label: __i18n_k("league.milestones.aCHIEVEMENTS.label.df7f55a3"), note: __i18n_k("league.milestones.aCHIEVEMENTS.note.7eb7c6c4") },
  { id: 'profit', label: __i18n_k("league.milestones.aCHIEVEMENTS.label.8ad2d286"), note: __i18n_k("league.milestones.aCHIEVEMENTS.note.ecf319c1") },
  { id: 'posting', label: __i18n_k("league.milestones.aCHIEVEMENTS.label.9433ab29"), note: __i18n_k("league.milestones.aCHIEVEMENTS.note.b2a47079") },
  { id: 'retiredNumber', label: __i18n_k("league.milestones.aCHIEVEMENTS.label.adad27c2"), note: __i18n_k("league.milestones.aCHIEVEMENTS.note.0fb75504") },
  { id: 'hallOfFame', label: __i18n_k("league.milestones.aCHIEVEMENTS.label.6999864f"), note: __i18n_k("league.milestones.aCHIEVEMENTS.note.ffcebc4c") },
];

/** 1.9.7: the legacy start's own (a game that plays history): a title in each decade, the split season's both halves,
    the overseas Korean and tryout-draft players of their eras, and forty seasons. */
export const LEGACY_ACHIEVEMENTS: Achievement[] = [
  { id: 'era1980', label: __i18n_k("league.milestones.text.db401fe8"), note: __i18n_k("league.milestones.text.9903bf85") },
  { id: 'era1990', label: __i18n_k("league.milestones.text.851d5b96"), note: __i18n_k("league.milestones.text.0d7fc86b") },
  { id: 'era2000', label: __i18n_k("league.milestones.text.c380fec3"), note: __i18n_k("league.milestones.text.e8d317f7") },
  { id: 'era2010', label: __i18n_k("league.milestones.text.b777fd1f"), note: __i18n_k("league.milestones.text.ee054afb") },
  { id: 'era2020', label: __i18n_k("league.milestones.text.dc528f29"), note: __i18n_k("league.milestones.text.6c7cfd5a") },
  { id: 'everyEra', label: __i18n_k("league.milestones.text.f3f185bf"), note: __i18n_k("league.milestones.text.3bb368c3") },
  { id: 'halves', label: __i18n_k("league.milestones.text.96202c05"), note: __i18n_k("league.milestones.text.24ab7a12") },
  { id: 'kyopoAce', label: __i18n_k("league.milestones.text.d2c0e40e"), note: __i18n_k("league.milestones.text.1146d0c9") },
  { id: 'tryoutGem', label: __i18n_k("league.milestones.text.5d7685e0"), note: __i18n_k("league.milestones.text.4def1e0c") },
  { id: 'fortySeasons', label: __i18n_k("league.milestones.text.18246f8e"), note: __i18n_k("league.milestones.text.6ab65e28") },
];

/** The achievements of this game: the legacy start's on top of everyone's. */
export const achievementsFor = (s: Pick<LeagueState, 'historical'>) => (s.historical ? [...ACHIEVEMENTS, ...LEGACY_ACHIEVEMENTS] : ACHIEVEMENTS);

/** Adds a line to the club timeline (once per key). */
export function milestone(s: LeagueState, year: number, text: string, key?: string) {
  const u = s.user;
  if (!u) return;
  if (key && u.timeline?.some((t) => t.key === key)) return;
  (u.timeline ??= []).push({ year, text, ...(key ? { key } : {}) });
}

/** Unlocks an achievement (once) and notes it on the timeline. */
export function unlock(s: LeagueState, id: string, year: number, detail = '') {
  const u = s.user;
  const a = achievementsFor(s).find((x) => x.id === id);
  if (!u || !a || u.achievements?.some((x) => x.id === id)) return;
  (u.achievements ??= []).push({ id, year });
  milestone(s, year, __i18n_k("league.milestones.unlock.742fa29d", { label: a.label, value: detail ? ` (${detail})` : '' }));
  const date = s.phase === 'regular' ? (s.schedule[Math.max(0, s.next - 1)]?.date ?? `${year}-03-01`) : `${year}-11-01`;
  achievementAlert(s, id, a.label, a.note, date, detail);
}

/** After each of the user's games: first win, walk-off, no-hitter. */
export function gameMoments(s: LeagueState, box: StoredBox) {
  const u = s.user;
  if (!u || (box.home !== u.teamId && box.away !== u.teamId)) return;
  const us = box.home === u.teamId ? 1 : 0;
  const them = 1 - us;
  const won = box.rhe[us][0] > box.rhe[them]![0];
  const year = Number(box.date.slice(0, 4));
  const opp = s.teams.find((t) => t.id === (us ? box.away : box.home))?.short ?? '';
  if (won) {
    if (!u.achievements?.some((x) => x.id === 'firstWin')) {
      unlock(s, 'firstWin', year, __i18n_k("league.milestones.gameMoments.7f5f8b64", { date: box.date, opp: opp }));
      milestone(s, year, __i18n_k("league.milestones.gameMoments.796a1239", { date: box.date, opp: opp }), 'firstWin');
    }
    // Home team scoring the winning run in its last half inning.
    if (us === 1 && box.line[1].length === box.line[0].length && (box.line[1].at(-1) ?? 0) > 0) unlock(s, 'walkOff', year, __i18n_k("league.milestones.gameMoments.7f5f8b64", { date: box.date, opp: opp }));
  }
  // 1.9.8: three strikeouts on nine pitches by one of ours.
  const imm = box.imm?.[us]?.[0];
  if (imm) unlock(s, 'immaculate', year, __i18n_k("league.milestones.text.da856f9f", { name: s.players[imm.pitcher]?.name ?? '', date: box.date, opp, inning: imm.inning }));
  if (box.rhe[them]![1] === 0 && box.line[them]!.length >= 9) {
    unlock(s, 'noHitter', year, __i18n_k("league.milestones.gameMoments.7f5f8b64", { date: box.date, opp: opp }));
    milestone(s, year, __i18n_k("league.milestones.gameMoments.fc4d5aab", { date: box.date, opp: opp }));
  }
}

/** After the season (accounts settled): the year's rank, postseason, awards, crowds and money. */
export function seasonMoments(s: LeagueState, year: number, awards: SeasonAwards | undefined) {
  const u = s.user;
  const h = s.history.find((x) => x.year === year);
  if (!u || !h) return;
  const row = h.table.find((r) => r.teamId === u.teamId);
  if (row) {
    if (row.pct >= 0.5) unlock(s, 'winning', year, __i18n_k("league.milestones.seasonMoments.44b431c7", { w: row.w, l: row.l }));
    if (madePostseason(h, u.teamId)) {
      unlock(s, 'playoffs', year);
      milestone(s, year, __i18n_k("league.milestones.seasonMoments.58b18668", { year: year, rank: row.rank }), 'playoffs');
    }
    if (row.rank === 1) {
      unlock(s, 'pennant', year);
      milestone(s, year, __i18n_k("league.milestones.seasonMoments.d8ad4c92", { year: year, w: row.w, l: row.l }));
    }
  }
  if (h.champion === u.teamId) {
    unlock(s, 'champion', year);
    milestone(s, year, __i18n_k("league.milestones.seasonMoments.623ff410", { year: year }));
    const titles = s.history.filter((x) => x.champion === u.teamId).length;
    if (titles >= 3) unlock(s, 'dynasty', year, __i18n_k("league.milestones.seasonMoments.f343d132", { titles: titles }));
  }
  const name = (id: string | null) => (id ? s.players[id]?.name : null);
  const ours = (id: string | null) => !!id && s.players[id]?.career.find((c) => c.year === year && !c.level)?.teamId === u.teamId;
  if (awards && ours(awards.mvp)) {
    unlock(s, 'mvp', year, name(awards.mvp)!);
    milestone(s, year, `${name(awards.mvp)} ${year} MVP`);
  }
  if (awards && ours(awards.rookie)) {
    unlock(s, 'rookie', year, name(awards.rookie)!);
    milestone(s, year, __i18n_k("league.milestones.seasonMoments.1e910b86", { name: name(awards.rookie), year: year }));
  }
  for (const p of Object.values(s.players)) {
    const c = p.career.find((x) => x.year === year && !x.level && x.teamId === u.teamId);
    if (c && c.war >= 5 && p.origin.draftYear && p.career.every((x) => x.teamId === u.teamId)) unlock(s, 'homegrown', year, `${p.name} WAR ${c.war.toFixed(1)}`);
  }
  if (s.historical) legacyMoments(s, year);
  const report = s.clubs?.[u.teamId]?.reports.find((r) => r.year === year);
  if (report) {
    if (report.fans >= 1_000_000) unlock(s, 'crowd', year, __i18n_k("league.milestones.seasonMoments.d8e22743", { value: report.fans.toLocaleString('ko-KR') }));
    if (report.operating >= 0 && report.homeGames) unlock(s, 'profit', year);
    if ((report.sellouts ?? 0) >= 30) unlock(s, 'sellouts', year, __i18n_k("league.milestones.seasonMoments.29555f1e", { sellouts: report.sellouts }));
  }
}

/** 1.9.7: the legacy achievements at the end of a season. */
function legacyMoments(s: LeagueState, year: number) {
  const u = s.user!;
  const titles = s.history.filter((h) => h.champion === u.teamId).map((h) => h.year);
  const decades = [1980, 1990, 2000, 2010, 2020];
  if (titles.includes(year)) {
    const d = Math.floor(year / 10) * 10;
    if (decades.includes(d)) unlock(s, `era${d}`, year, String(year));
  }
  if (decades.every((d) => titles.some((y) => y >= d && y < d + 10))) unlock(s, 'everyEra', year);
  // Both halves of a split season: unlocked when the postseason is drawn (historic.ts).
  for (const p of Object.values(s.players)) {
    const c = p.career.find((x) => x.year === year && !x.level && x.teamId === u.teamId);
    if (!c) continue;
    if (p.origin.kyopo && c.war >= 5) unlock(s, 'kyopoAce', year, `${p.name} WAR ${c.war.toFixed(1)}`);
    if (p.id.startsWith('ft') && c.war >= 4) unlock(s, 'tryoutGem', year, `${p.name} WAR ${c.war.toFixed(1)}`);
  }
  if (year - u.firstTeamYear + 1 >= 40) unlock(s, 'fortySeasons', year);
}
