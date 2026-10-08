import { k as __i18n_k } from '../i18n/index';
/* The ten existing clubs as league teams. Names, colours and regions come from Draft Room; stadium
   names and seat counts are real (docs/RULES.md §10). Park factors are the game's own estimates. */
import DraftClubs from '../draftroom/clubs.js';
import type { ParentCompanyType } from '../club/types';
import { eulreul } from './josa';
import type { Team } from '../model/types';

interface DraftClub {
  id: string;
  name: string;
  short: string;
  color: string;
  region: string;
}

const STADIUMS: Record<string, { name: string; seats: number; park: number; parent: ParentCompanyType; company: string; founded: number; firstTeam?: number }> = {
  kiwoom: { name: __i18n_k("league.clubs.kiwoom.name.a05613b6"), seats: 16783, park: 0.98, parent: 'namingRights', company: __i18n_k("league.clubs.kiwoom.company.9e69fb44"), founded: 2008 },
  nc: { name: __i18n_k("league.clubs.nc.name.a5272b83"), seats: 22112, park: 1.01, parent: 'midsize', company: __i18n_k("league.clubs.nc.company.dade0c6b"), founded: 2011, firstTeam: 2013 },
  hanwha: { name: __i18n_k("league.clubs.hanwha.name.6c009f1e"), seats: 17000, park: 1.0, parent: 'conglomerate', company: __i18n_k("league.clubs.hanwha.company.4ff3f14f"), founded: 1986 },
  lotte: { name: __i18n_k("league.clubs.lotte.name.392124c2"), seats: 24500, park: 1.0, parent: 'conglomerate', company: __i18n_k("league.clubs.lotte.company.e3fa752a"), founded: 1982 },
  ssg: { name: __i18n_k("league.clubs.ssg.name.811ec3ab"), seats: 23000, park: 1.05, parent: 'conglomerate', company: __i18n_k("league.clubs.ssg.company.db35c245"), founded: 2000 }, // SK 와이번스로 창단, 2021년 SSG 인수
  kt: { name: __i18n_k("league.clubs.kt.name.cdd90c0b"), seats: 22067, park: 1.01, parent: 'conglomerate', company: 'KT', founded: 2013, firstTeam: 2015 },
  doosan: { name: __i18n_k("league.clubs.doosan.name.70eae725"), seats: 24411, park: 0.94, parent: 'conglomerate', company: __i18n_k("league.clubs.doosan.company.8a15b66a"), founded: 1982 },
  lg: { name: __i18n_k("league.clubs.lg.name.70eae725"), seats: 24411, park: 0.94, parent: 'conglomerate', company: __i18n_k("league.clubs.lg.company.0e156b09"), founded: 1990 },
  samsung: { name: __i18n_k("league.clubs.samsung.name.3f5cb400"), seats: 24331, park: 1.06, parent: 'conglomerate', company: __i18n_k("league.clubs.samsung.company.b175f6f4"), founded: 1982 },
  kia: { name: __i18n_k("league.clubs.kia.name.89feb7a3"), seats: 20500, park: 1.0, parent: 'conglomerate', company: __i18n_k("league.clubs.kia.company.1d11be6b"), founded: 2001 },
};

export function existingTeams(): Team[] {
  return (DraftClubs as unknown as DraftClub[]).map((c) => {
    const s = STADIUMS[c.id]!;
    return {
      id: c.id,
      name: c.name,
      short: c.short,
      color: c.color,
      region: c.region,
      kind: 'existing',
      founded: s.founded,
      firstTeamFrom: s.firstTeam ?? s.founded,
      parent: { type: s.parent, name: s.company },
      stadium: { name: s.name, size: 'large', capacity: s.seats, ownership: 'municipalLease' },
    };
  });
}

export const parkFactor = (teamId: string) => STADIUMS[teamId]?.park ?? 1;

// ── Club names (V0.13) ──────────────────────────────────────────────────────────────────────────
// The game keeps the real club names (a free fan game, no logos; docs/PLAN-1.0.md §3). The player can
// rename the ten existing clubs in the settings, or switch to a ready-made fictional set. Only the labels
// change: ids, cities, ballparks' seats and park factors, owners' types and founding years stay.

/** What the player can rename: the club's name and short name, its colour, the owner's name, the ballpark. */
export interface ClubLabel {
  name: string;
  short: string;
  color: string;
  company: string;
  stadium: string;
}

export const labelOf = (t: Team): ClubLabel => ({ name: t.name, short: t.short, color: t.color, company: t.parent.name, stadium: t.stadium.name });

/** The real names, as a new league has them. */
export const realLabels = (): Record<string, ClubLabel> => Object.fromEntries(existingTeams().map((t) => [t.id, labelOf(t)]));

/** A fictional set, for players who prefer it (and the fallback if a rights holder ever asks). */
export const FICTIONAL_LABELS: Record<string, ClubLabel> = {
  kiwoom: { name: __i18n_k("league.clubs.kiwoom.name.1b403219"), short: __i18n_k("league.clubs.kiwoom.short.78eed986"), color: '#5b21b6', company: __i18n_k("league.clubs.kiwoom.company.e231f172"), stadium: __i18n_k("league.clubs.kiwoom.stadium.a05613b6") },
  nc: { name: __i18n_k("league.clubs.nc.name.2eebb133"), short: __i18n_k("league.clubs.nc.short.4d3fb597"), color: '#15803d', company: __i18n_k("league.clubs.nc.company.1fde9887"), stadium: __i18n_k("league.clubs.nc.stadium.222fe2e8") },
  hanwha: { name: __i18n_k("league.clubs.hanwha.name.adba86e1"), short: __i18n_k("league.clubs.hanwha.short.43660434"), color: '#c2410c', company: __i18n_k("league.clubs.hanwha.company.58db21c0"), stadium: __i18n_k("league.clubs.hanwha.stadium.b385d89b") },
  lotte: { name: __i18n_k("league.clubs.lotte.name.fa2e365d"), short: __i18n_k("league.clubs.lotte.short.e17134b8"), color: '#854d0e', company: __i18n_k("league.clubs.lotte.company.e19fd74f"), stadium: __i18n_k("league.clubs.lotte.stadium.392124c2") },
  ssg: { name: __i18n_k("league.clubs.ssg.name.2153e3d7"), short: __i18n_k("league.clubs.ssg.short.d3880cf9"), color: '#0f766e', company: __i18n_k("league.clubs.ssg.company.688225ae"), stadium: __i18n_k("league.clubs.ssg.stadium.4e22ae29") },
  kt: { name: __i18n_k("league.clubs.kt.name.8160952f"), short: __i18n_k("league.clubs.kt.short.81304eb7"), color: '#334155', company: __i18n_k("league.clubs.kt.company.eb02fd71"), stadium: __i18n_k("league.clubs.kt.stadium.7ddc350e") },
  doosan: { name: __i18n_k("league.clubs.doosan.name.c543ee80"), short: __i18n_k("league.clubs.doosan.short.54c234fe"), color: '#1e3a5f', company: __i18n_k("league.clubs.doosan.company.049dd563"), stadium: __i18n_k("league.clubs.doosan.stadium.46ce1cb8") },
  lg: { name: __i18n_k("league.clubs.lg.name.e7487def"), short: __i18n_k("league.clubs.lg.short.8b463ebc"), color: '#b42318', company: __i18n_k("league.clubs.lg.company.adb34c5f"), stadium: __i18n_k("league.clubs.lg.stadium.46ce1cb8") },
  samsung: { name: __i18n_k("league.clubs.samsung.name.fface78f"), short: __i18n_k("league.clubs.samsung.short.a09de961"), color: '#1d4ed8', company: __i18n_k("league.clubs.samsung.company.6f9a7f4b"), stadium: __i18n_k("league.clubs.samsung.stadium.a00ad132") },
  kia: { name: __i18n_k("league.clubs.kia.name.883eca5d"), short: __i18n_k("league.clubs.kia.short.f261dc09"), color: '#9f1239', company: __i18n_k("league.clubs.kia.company.e0e156a1"), stadium: __i18n_k("league.clubs.kia.stadium.51d9696d") },
};

export const CLUB_NAME = { min: 2, max: 14 };
export const CLUB_SHORT = { min: 1, max: 4 };
export const COMPANY_NAME = { min: 2, max: 20 };
export const BALLPARK_NAME = { min: 2, max: 20 };

/** What is wrong with a set of labels, one line per problem (empty: fine). Names and short names must
    differ from every other club's, ours and the rival's included; two clubs may share a ballpark. */
export function labelProblems(teams: Team[], labels: Record<string, ClubLabel>): string[] {
  const out: string[] = [];
  const final = teams.map((t) => (t.kind === 'existing' && labels[t.id] ? { ...labelOf(t), ...trimmed(labels[t.id]!), id: t.id } : { ...labelOf(t), id: t.id }));
  for (const t of final) {
    if (!labels[t.id] || teams.find((x) => x.id === t.id)?.kind !== 'existing') continue;
    const who = labelOf(teams.find((x) => x.id === t.id)!).short;
    const len = (v: string, r: { min: number; max: number }, what: string) => {
      if (v.length < r.min || v.length > r.max) out.push(__i18n_k("league.clubs.labelProblems.len.48b83f17", { who: who, what: what, min: r.min, max: r.max }));
    };
    len(t.name, CLUB_NAME, __i18n_k("league.clubs.labelProblems.3417788b"));
    len(t.short, CLUB_SHORT, __i18n_k("league.clubs.labelProblems.7d2842b0"));
    len(t.company, COMPANY_NAME, __i18n_k("league.clubs.labelProblems.cf76b767"));
    len(t.stadium, BALLPARK_NAME, __i18n_k("league.clubs.labelProblems.f61c862b"));
    if (!/^#[0-9a-f]{6}$/i.test(t.color)) out.push(__i18n_k("league.clubs.labelProblems.991eb0c5", { who: who }));
    for (const o of final) {
      if (o.id === t.id) continue;
      if (o.name === t.name) out.push(__i18n_k("league.clubs.labelProblems.07562d3d", { who: who, quoted: quoted(t.name) }));
      if (o.short === t.short) out.push(__i18n_k("league.clubs.labelProblems.add5a10f", { who: who, quoted: quoted(t.short) }));
    }
  }
  return [...new Set(out)];
}

/** "두산"을, "LG"를: the particle follows the word, not the quote mark. */
const quoted = (w: string) => `"${w}"${eulreul(w).slice(w.length)}`;
const trimmed = (l: ClubLabel): ClubLabel => ({ name: l.name.trim(), short: l.short.trim(), color: l.color.trim(), company: l.company.trim(), stadium: l.stadium.trim() });

/** Renames existing clubs (others are left alone). Articles already written keep the old names. */
export function renameClubs(teams: Team[], labels: Record<string, ClubLabel>) {
  const problems = labelProblems(teams, labels);
  if (problems.length) throw new Error(problems[0]);
  for (const t of teams) {
    const l = labels[t.id];
    if (t.kind !== 'existing' || !l) continue;
    const x = trimmed(l);
    t.name = x.name;
    t.short = x.short;
    t.color = x.color;
    t.parent = { ...t.parent, name: x.company };
    t.stadium = { ...t.stadium, name: x.stadium };
  }
}
