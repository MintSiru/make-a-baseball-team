import { describe, expect, it } from 'vitest';
import { DRAFT_ROOM_DRAFT_YEAR, generateDraftPool, POOL_SIZE } from '../src/draftroom';
import { ageOn, fromDraftProspect, publicView } from '../src/model/player';
import { createWorld } from '../src/world/world';

describe('draft class players', () => {
  const world = createWorld('model-test');

  it('turns the whole Draft Room pool into amateurs of the 2026 draft', () => {
    expect(world.draftClass).toHaveLength(POOL_SIZE);
    expect(new Set(world.draftClass.map((p) => p.id)).size).toBe(POOL_SIZE);
    for (const p of world.draftClass) {
      expect(p.status).toBe('amateur');
      expect(p.teamId).toBeNull();
      expect(p.origin.draftYear).toBe(DRAFT_ROOM_DRAFT_YEAR);
      expect(p.id).toBe(`d2026-${p.origin.sourceId}`);
    }
  });

  it('keeps Draft Room ability values unchanged', () => {
    const pool = generateDraftPool('model-test');
    for (const [i, p] of world.draftClass.entries()) {
      const src = pool.players[i]!;
      expect(p.hidden.current).toEqual(src.trueTools);
      expect(p.hidden.potential).toEqual(src.potentialTools);
      expect(p.scouting.tools).toEqual(src.tools);
      expect(p.scouting.futureValue).toBe(src.scoutCeiling);
      expect(p.amateur.draftRank).toBe(src.rank);
    }
  });

  it('is deterministic for a seed and differs across seeds', () => {
    expect(createWorld('model-test').draftClass).toEqual(world.draftClass);
    expect(createWorld('other-seed').draftClass.map((p) => p.name)).not.toEqual(world.draftClass.map((p) => p.name));
  });

  it('marks prior military service only on pathways where Draft Room allows it', () => {
    const served = world.draftClass.filter((p) => p.service.military === 'served');
    const allowed = new Set(['독립구단', '해외독립 복귀', '마이너 복귀', '해외리그 복귀', 'MLB 경험 복귀', '대졸']);
    for (const p of served) expect(allowed.has(p.origin.pathway)).toBe(true);
    expect(world.draftClass.filter((p) => p.origin.pathway === '고졸').every((p) => p.service.military === 'pending')).toBe(true);
  });

  it('never exposes hidden ability in the public view', () => {
    const p = world.draftClass[0]!;
    const text = JSON.stringify(publicView(p));
    expect(publicView(p)).not.toHaveProperty('hidden');
    expect(text).not.toContain(String(p.hidden.developmentRate));
    expect(text).not.toContain(String(p.hidden.observerBias));
  });

  it('computes age on a date', () => {
    expect(ageOn('2007-09-25', '2026-09-24')).toBe(18);
    expect(ageOn('2007-09-25', '2026-09-25')).toBe(19);
  });

  it('builds the same player from the same prospect', () => {
    const src = generateDraftPool('model-test').players[5]!;
    expect(fromDraftProspect(src, 2026, 'model-test')).toEqual(world.draftClass[5]);
  });
});
