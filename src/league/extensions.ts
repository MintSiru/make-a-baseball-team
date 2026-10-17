import { k as __i18n_k } from '../i18n/index';
/* Multi-year deals before free agency (비FA 다년계약, 1.7.0 from the 1.6 feedback). Since 2022 a KBO club may sign
   a player who has not reached free agency to a multi-year deal (구자욱 5년 120억, 박세웅 5년 90억 — RULES.md §2).
   Until 1.6 the game offered one only in the winter's salary talks, four years at 90% of his market value and only
   to a player a season or two from free agency. Now any of our domestic players short of free agency can be
   offered two to six years, in the season or the winter: the seasons before he would have reached free agency are
   paid like a team-controlled player's raise, the ones after near his market value (he gives a little for the
   security), and the deal starts next season. He answers at once; a no keeps the door shut for a month. */
import { rng } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { KBO_2026 } from '../rules/kbo2026';
import { renewSalary, salaryIn } from './contracts';
import { today } from './entry';
import { eok, marketValue } from './fa';
import { iga, wagwa } from './josa';
import { addNews } from './news';
import { ageIn, isForeign, keepValue } from './players';
import type { LeagueState } from './state';
import { traitsOf } from './traits';
import { DIFFICULTY } from './tuning';
import { featureClosed } from './features';
import { faSeasonsFor } from './offseason';

export const EXTENSION = {
  years: [2, 3, 4, 5, 6] as const,
  maxAge: 33,
  minValue: 45,
  /** A control season's pay as a share of his market value, at least the club's merit figure. */
  controlShare: 0.6,
  /** A free-agent season's pay as a share of his market value (security for him). */
  freeShare: 0.92,
  /** What a season past 31 is worth less each year. */
  agingPerYear: 0.06,
  accept: 0.62,
  /** Days before a player who said no will talk again. */
  cooldown: 30,
} as const;

export interface ExtensionOption {
  years: number;
  /** Pay each season (만 원). */
  annual: number;
  total: number;
}

/** Seasons to free agency (1.9.9: the latest the board set). */
const faSeasons = (p: Player) => faSeasonsFor(p, Infinity);
/** The season the deal starts (the next one; in the winter, the coming one). */
const startOf = (s: LeagueState) => (s.offseason ? s.offseason.year + 1 : s.year + 1);
const dateOf = (s: LeagueState) => (s.offseason ? `${s.offseason.year}-12-01` : today(s));
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Why we cannot offer him one, or null. */
export function extensionProblem(s: LeagueState, id: PlayerId): string | null {
  const u = s.user;
  const p = s.players[id];
  if (!u || !p || p.teamId !== u.teamId) return __i18n_k("league.extensions.text.184c07ee");
  if (isForeign(p)) return __i18n_k("league.extensions.text.a34a68b4");
  // 1.9.7: a history game has non-FA multi-year deals only from 2022 (features.ts).
  const closed = featureClosed('extension', startOf(s));
  if (closed) return closed;
  if (p.contract?.kind === 'development' || p.status !== 'active') return __i18n_k("league.extensions.text.026f3688");
  if (p.service.lastFreeAgencyAt !== undefined || faSeasons(p) - p.service.creditedSeasons <= 0) return __i18n_k("league.extensions.text.68d7e4c9");
  const start = startOf(s);
  if (p.contract?.salaries.some((x) => x.season > start)) return __i18n_k("league.extensions.text.a96b8581");
  if (p.proSince >= start) return __i18n_k("league.extensions.text.da623983");
  if (ageIn(p, start) > EXTENSION.maxAge) return __i18n_k("league.extensions.text.1340ac5e", { age: EXTENSION.maxAge + 1 });
  if (keepValue(p, start) < EXTENSION.minValue) return __i18n_k("league.extensions.text.05e9fedf");
  return extensionCooldown(s, id);
}

/** A player who said no lately: when he will talk again (null when he will now). */
export function extensionCooldown(s: LeagueState, id: PlayerId): string | null {
  const said = s.user?.extensionTalks?.[id];
  if (said && daysBetween(said, dateOf(s)) < EXTENSION.cooldown) return __i18n_k("league.extensions.text.748a8898", { date: said.slice(5).replace('-', '/') });
  return null;
}

/** The deals we can put to him: two to six years, the same pay each season. */
export function extensionOptions(s: LeagueState, id: PlayerId): ExtensionOption[] {
  const p = s.players[id]!;
  const start = startOf(s);
  const market = marketValue(p, start).annual;
  const merit = renewSalary(p, start);
  const toFa = faSeasons(p) - p.service.creditedSeasons;
  const E = EXTENSION;
  return E.years
    .filter((years) => ageIn(p, start + years - 1) <= 38)
    .map((years) => {
      let sum = 0;
      for (let i = 0; i < years; i++) {
        const age = ageIn(p, start + i);
        const fade = Math.max(0.5, 1 - Math.max(0, age - 31) * E.agingPerYear);
        sum += i < toFa ? Math.max(merit, market * E.controlShare) : market * E.freeShare * fade;
      }
      const annual = Math.max(merit, Math.round(sum / years / 1000) * 1000);
      return { years, annual, total: annual * years };
    });
}

/** His answer to a deal: likelier from a loyal player, less so a season from free agency. */
export function extensionChance(s: LeagueState, p: Player, years: number): number {
  const toFa = faSeasons(p) - p.service.creditedSeasons;
  const loyal = (traitsOf(p).loyalty - 50) / 150;
  const easier = DIFFICULTY.salaryAccept[s.user!.settings.difficulty];
  return Math.max(0.1, Math.min(0.95, EXTENSION.accept + loyal + easier + (years >= 4 ? 0.05 : 0) - (toFa <= 1 ? 0.12 : 0)));
}

/** We offer him the deal; he signs or says no (a no shuts the door for a month). */
export function offerExtension(s: LeagueState, id: PlayerId, years: number): boolean {
  const problem = extensionProblem(s, id);
  if (problem) throw new Error(problem);
  const option = extensionOptions(s, id).find((x) => x.years === years);
  if (!option) throw new Error(__i18n_k("league.extensions.text.772f360c"));
  const u = s.user!;
  const p = s.players[id]!;
  const date = dateOf(s);
  const start = startOf(s);
  const yes = rng(`${s.seed}|extension|${id}|${date}|${years}`)() < extensionChance(s, p, years);
  const club = s.teams.find((t) => t.id === u.teamId)!.short;
  if (!yes) {
    (u.extensionTalks ??= {})[id] = date;
    (u.log ??= []).push({ year: s.year, text: __i18n_k("league.extensions.text.b3bd73f8", { name: p.name, years }) });
    return false;
  }
  delete u.extensionTalks?.[id];
  const kept = (p.contract?.salaries ?? []).filter((x) => x.season < start);
  if (!kept.some((x) => x.season === start - 1) && !s.offseason) kept.push({ season: s.year, amount: salaryIn(p, s.year) });
  p.contract = {
    teamId: u.teamId,
    kind: 'multiYear',
    signedIn: s.offseason ? s.offseason.year : s.year,
    signingBonus: 0,
    salaries: [...kept, ...Array.from({ length: years }, (_, i) => ({ season: start + i, amount: option.annual }))],
  };
  const text = __i18n_k("league.extensions.text.460d80fc", { name: p.name, years, money: eok(option.total), from: start, to: start + years - 1 });
  (u.log ??= []).push({ year: s.year, text });
  addNews(s, {
    id: `extension-${id}-${date}`,
    date,
    kind: 'interview',
    title: __i18n_k("league.extensions.text.5686494b", { club, name: wagwa(p.name), years, money: eok(option.total) }),
    body: __i18n_k("league.extensions.text.cdbc43ce", {
      club: iga(club),
      name: wagwa(p.name),
      years,
      money: eok(option.total),
      from: start,
      annual: eok(option.annual),
      who: iga(p.name),
    }),
    quotes: [],
    facts: { name: p.name, years, total: eok(option.total) },
    players: [id],
    mine: true,
  });
  return true;
}
