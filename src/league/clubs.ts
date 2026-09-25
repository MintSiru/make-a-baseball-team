/* The ten existing clubs as league teams. Names, colours and regions come from Draft Room; stadium
   names and seat counts are real (docs/RULES.md §10). Park factors are the game's own estimates. */
import DraftClubs from '../draftroom/clubs.js';
import type { ParentCompanyType } from '../club/types';
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
  hanwha: { name: '대전한화생명볼파크', seats: 22000, park: 1.0, parent: 'conglomerate', company: '한화그룹', founded: 1986 },
  lotte: { name: '사직야구장', seats: 24500, park: 1.0, parent: 'conglomerate', company: '롯데그룹', founded: 1982 },
  ssg: { name: '인천SSG랜더스필드', seats: 23000, park: 1.05, parent: 'conglomerate', company: '신세계그룹', founded: 2021 },
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
