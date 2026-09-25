/* Club identity: parent company and home stadium. Together with the market they set the difficulty
   of an expansion start (ROADMAP.md, 난이도 설계). Only labels live here for now; money and
   attendance effects arrive with the budget (V0.3) and finance (V0.6) systems. */

export type ParentCompanyType = 'conglomerate' | 'midsize' | 'namingRights' | 'citizen';

export const PARENT_COMPANY_TYPES: Record<ParentCompanyType, { label: string; summary: string }> = {
  conglomerate: { label: '대기업 계열', summary: '자금력이 가장 크지만 성적 기대치가 높고 인내심이 짧습니다.' },
  midsize: { label: '강소·중견기업', summary: '효율 경영. 성과가 나면 지원이 늘지만 지원금 상한이 낮습니다.' },
  namingRights: { label: '명명권 스폰서', summary: '모기업 없이 메인 스폰서의 명명권 수입으로 운영합니다. 스폰서가 바뀌면 구단명도 바뀝니다.' },
  citizen: { label: '시민구단', summary: '지자체 출자와 시민주주. 예산은 가장 적지만 지역 팬 충성도가 높습니다.' },
};

export type StadiumSize = 'small' | 'medium' | 'large' | 'dome';

export const STADIUM_SIZES: Record<StadiumSize, { label: string; capacity: [number, number] }> = {
  small: { label: '소형 임시 구장', capacity: [7000, 10000] },
  medium: { label: '중형 구장', capacity: [12000, 17000] },
  large: { label: '대형 신축 구장', capacity: [20000, 25000] },
  dome: { label: '돔구장', capacity: [15000, 20000] },
};

export type StadiumOwnership = 'municipalLease' | 'longTermOperation';

export const STADIUM_OWNERSHIP: Record<StadiumOwnership, { label: string }> = {
  municipalLease: { label: '지자체 소유 임대' },
  longTermOperation: { label: '장기 관리 위탁' },
};
