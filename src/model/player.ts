/* Building league players and the public view of them. */
import { hashUnit, rng, servedBeforeDraft, type DraftProspect } from '../draftroom';
import { altPositions, assignPosition, balancePositions } from './position';
import type { Player, PlayerId } from './types';
import { rollTraits } from '../league/traits';

/**
 * Left-handed throwers almost always bat left in the KBO (좌투우타 is a handful of players). Draft Room
 * draws the two hands independently, so most of its left-handed throwers bat right; this corrects it.
 */
export function batsFor(id: string, throws: '좌' | '우', bats: '좌' | '우' | '양'): '좌' | '우' | '양' {
  return throws === '좌' && bats === '우' && hashUnit(`${id}-bats`) < 0.97 ? '좌' : bats;
}

export const draftPlayerId = (draftYear: number, sourceId: string): PlayerId => `d${draftYear}-${sourceId}`;

/** Turns a Draft Room prospect into an amateur league player, splitting hidden and public ability. */
export function fromDraftProspect(p: DraftProspect, draftYear: number, poolSeed: string): Player {
  const position = assignPosition(p.role, p.futureTools, hashUnit(p.id + p.name));
  return {
    id: draftPlayerId(draftYear, p.id),
    name: p.name,
    birthday: p.birthday,
    birthplace: p.birthplace,
    height: p.height,
    weight: p.weight,
    throws: p.throwHand,
    bats: batsFor(draftPlayerId(draftYear, p.id), p.throwHand, p.batHand),
    role: p.role,
    position,
    alt: altPositions(position, p.futureTools, rng(`${poolSeed}|alt|${draftPlayerId(draftYear, p.id)}`)),
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
      traits: rollTraits(poolSeed, draftPlayerId(draftYear, p.id), p.personality, p.growthCurve),
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

/** A class of amateurs placed together (V0.12): KBO-like numbers at each spot, the best fits at the hard ones;
    their other positions follow the new main one. */
export function placeClass(players: Player[], poolSeed: string): Player[] {
  balancePositions(players, (p, pos) => {
    if (p.position === pos) return;
    p.position = pos;
    p.alt = altPositions(pos, p.scouting.futureTools, rng(`${poolSeed}|alt|${p.id}`));
  });
  return players;
}

export type PublicPlayer = Omit<Player, 'hidden'>;

/** What the user, AI clubs and the press may see. Strips hidden ability. */
export function publicView(p: Player): PublicPlayer {
  const { hidden: _hidden, ...rest } = p;
  return rest;
}

export function ageOn(birthday: string, date: string): number {
  // Called millions of times while a league is built (V0.14: a fifth of the time went to splitting strings),
  // so both dates are read digit by digit as y·10000 + m·100 + d.
  const born = ymd(birthday),
    on = ymd(date);
  return Math.floor(on / 10000) - Math.floor(born / 10000) - (on % 10000 < born % 10000 ? 1 : 0);
}

/** "2027-04-01" → 20270401, without making arrays; stops at anything that is not a digit or a dash. */
function ymd(s: string): number {
  let y = 0,
    m = 0,
    d = 0,
    part = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 45) {
      if (++part > 2) break;
      continue;
    }
    if (c < 48 || c > 57) break;
    if (part === 0) y = y * 10 + c - 48;
    else if (part === 1) m = m * 10 + c - 48;
    else d = d * 10 + c - 48;
  }
  return y * 10000 + m * 100 + d;
}
