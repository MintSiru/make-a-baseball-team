/* Building league players and the public view of them. */
import { hashUnit, servedBeforeDraft, type DraftProspect } from '../draftroom';
import { assignPosition } from './position';
import type { Player, PlayerId } from './types';

export const draftPlayerId = (draftYear: number, sourceId: string): PlayerId => `d${draftYear}-${sourceId}`;

/** Turns a Draft Room prospect into an amateur league player, splitting hidden and public ability. */
export function fromDraftProspect(p: DraftProspect, draftYear: number, poolSeed: string): Player {
  return {
    id: draftPlayerId(draftYear, p.id),
    name: p.name,
    birthday: p.birthday,
    birthplace: p.birthplace,
    height: p.height,
    weight: p.weight,
    throws: p.throwHand,
    bats: p.batHand,
    role: p.role,
    position: assignPosition(p.role, p.futureTools, hashUnit(p.id + p.name)),
    archetype: p.archetype,
    personality: p.personality,
    velocity: p.velocity,
    twoWay: p.twoWay,
    origin: { kind: 'draftClass', draftYear, sourceId: p.id, pathway: p.pathway, entryCategory: p.entryCategory },
    education: {
      qualification: p.qualification,
      school: p.school,
      schoolTier: p.schoolTier,
      region: p.region,
      pathText: p.pathText,
      history: p.history,
    },
    amateur: { record: p.record, awards: p.awards, draftRank: p.rank, intent: p.intent ?? null },
    status: 'amateur',
    teamId: null,
    contract: null,
    service: { creditedSeasons: 0, carriedDays: 0, military: servedBeforeDraft(poolSeed, p) ? 'served' : 'pending' },
    hidden: {
      current: p.trueTools,
      potential: p.potentialTools,
      growthCurve: p.growthCurve,
      developmentRate: p.developmentRate,
      observerBias: p.observerBias,
      injuryRisk: p.risk,
    },
    scouting: {
      season: draftYear,
      tools: p.tools,
      futureTools: p.futureTools,
      current: p.ready,
      futureValue: p.scoutCeiling,
      floor: p.floorGrade,
      ceiling: p.ceilingGrade,
      uncertainty: p.uncertainty,
      tags: p.pickTags,
      strength: p.strength,
      weakness: p.weakness,
    },
    proSince: draftYear + 1,
    career: [],
  };
}

export type PublicPlayer = Omit<Player, 'hidden'>;

/** What the user, AI clubs and the press may see. Strips hidden ability. */
export function publicView(p: Player): PublicPlayer {
  const { hidden: _hidden, ...rest } = p;
  return rest;
}

export function ageOn(birthday: string, date: string): number {
  const [by, bm, bd] = birthday.split('-').map(Number) as [number, number, number];
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}
