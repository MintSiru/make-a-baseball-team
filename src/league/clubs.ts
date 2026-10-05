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
  kiwoom: { name: '고척스카이돔', seats: 16783, park: 0.98, parent: 'namingRights', company: '키움증권 (명명권)', founded: 2008 },
  nc: { name: '창원NC파크', seats: 22112, park: 1.01, parent: 'midsize', company: 'NC소프트', founded: 2011, firstTeam: 2013 },
  hanwha: { name: '대전한화생명볼파크', seats: 17000, park: 1.0, parent: 'conglomerate', company: '한화그룹', founded: 1986 },
  lotte: { name: '사직야구장', seats: 24500, park: 1.0, parent: 'conglomerate', company: '롯데그룹', founded: 1982 },
  ssg: { name: '인천SSG랜더스필드', seats: 23000, park: 1.05, parent: 'conglomerate', company: '신세계그룹', founded: 2000 }, // SK 와이번스로 창단, 2021년 SSG 인수
  kt: { name: '수원KT위즈파크', seats: 22067, park: 1.01, parent: 'conglomerate', company: 'KT', founded: 2013, firstTeam: 2015 },
  doosan: { name: '서울종합운동장 야구장 (잠실)', seats: 24411, park: 0.94, parent: 'conglomerate', company: '두산그룹', founded: 1982 },
  lg: { name: '서울종합운동장 야구장 (잠실)', seats: 24411, park: 0.94, parent: 'conglomerate', company: 'LG그룹', founded: 1990 },
  samsung: { name: '대구삼성라이온즈파크', seats: 24331, park: 1.06, parent: 'conglomerate', company: '삼성그룹', founded: 1982 },
  kia: { name: '광주기아챔피언스필드', seats: 20500, park: 1.0, parent: 'conglomerate', company: '현대자동차그룹', founded: 2001 },
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
  kiwoom: { name: '윤슬 아처스', short: '윤슬', color: '#5b21b6', company: '윤슬증권 (명명권)', stadium: '고척스카이돔' },
  nc: { name: '미리내 아이언스', short: '미리내', color: '#15803d', company: '미리내소프트', stadium: '창원 마산야구장' },
  hanwha: { name: '해든 메테오스', short: '해든', color: '#c2410c', company: '해든그룹', stadium: '대전 볼파크' },
  lotte: { name: '단비 크루저스', short: '단비', color: '#854d0e', company: '단비그룹', stadium: '사직야구장' },
  ssg: { name: '새봄 세일러스', short: '새봄', color: '#0f766e', company: '새봄그룹', stadium: '문학야구장' },
  kt: { name: '여울 볼츠', short: '여울', color: '#334155', company: '여울텔레콤', stadium: '수원야구장' },
  doosan: { name: '가람 하운즈', short: '가람', color: '#1e3a5f', company: '가람그룹', stadium: '잠실야구장' },
  lg: { name: '솔빛 코메츠', short: '솔빛', color: '#b42318', company: '솔빛그룹', stadium: '잠실야구장' },
  samsung: { name: '다솜 스태그스', short: '다솜', color: '#1d4ed8', company: '다솜그룹', stadium: '대구 볼파크' },
  kia: { name: '도담 레오파즈', short: '도담', color: '#9f1239', company: '도담자동차그룹', stadium: '광주 챔피언스필드' },
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
      if (v.length < r.min || v.length > r.max) out.push(`${who}: ${what}은 ${r.min}~${r.max}자로 정하세요.`);
    };
    len(t.name, CLUB_NAME, '구단명');
    len(t.short, CLUB_SHORT, '약칭');
    len(t.company, COMPANY_NAME, '모기업');
    len(t.stadium, BALLPARK_NAME, '구장 이름');
    if (!/^#[0-9a-f]{6}$/i.test(t.color)) out.push(`${who}: 색은 #rrggbb 형식이어야 합니다.`);
    for (const o of final) {
      if (o.id === t.id) continue;
      if (o.name === t.name) out.push(`${who}: 구단명 ${quoted(t.name)} 다른 구단이 쓰고 있습니다.`);
      if (o.short === t.short) out.push(`${who}: 약칭 ${quoted(t.short)} 다른 구단이 쓰고 있습니다.`);
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
