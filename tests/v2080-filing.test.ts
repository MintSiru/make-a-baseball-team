/* 2.0.80 (the user's request: FA 미신청): an eligible player of little market value does not file for free agency;
   he stays with his club on a renewed salary and keeps his rights for a later winter. Stars always file. */
import { describe, expect, it } from 'vitest';
import { openMarket } from '../src/league/fa';
import { filingChance, freeAgentsFor, isFreeAgent, unfiledFor } from '../src/league/offseason';
import { isForeign } from '../src/league/players';
import type { LeagueState } from '../src/league/state';
import { OFFSEASON } from '../src/league/tuning';
import type { Player } from '../src/model/types';
import { loadSave } from './helpers';

/** Makes him eligible this winter: first-time free agent, his contract ending now. */
function eligible(s: LeagueState, p: Player, opts: { war: number; grade: number; again?: boolean; age?: number }) {
  const next = s.year + 1;
  p.service.creditedSeasons = 9;
  if (opts.again) p.service.lastFreeAgencyAt = 4;
  else delete p.service.lastFreeAgencyAt;
  delete p.service.optionFree;
  if (p.contract) p.contract.salaries = p.contract.salaries.filter((x) => x.season < next);
  p.scouting.current = opts.grade;
  p.career = p.career.filter((r) => r.level);
  for (let y = next - 3; y < next; y++) p.career.push({ year: y, teamId: p.teamId!, age: 30, days: 150, bat: null, pit: null, war: opts.war });
  if (opts.age) p.birthday = `${next - opts.age}-03-01`;
}

describe('2.0.80: free agents who file, and who stay', () => {
  it('a star always files; a fringe veteran seldom; a second time and age 35 lower it', () => {
    const s = loadSave('2.0.79');
    const next = s.year + 1;
    const [a, b, c, d] = Object.values(s.players).filter((p) => p.status === 'active' && p.teamId && !isForeign(p) && p.teamId !== s.user!.teamId);
    eligible(s, a!, { war: 3, grade: 58 });
    eligible(s, b!, { war: 0.5, grade: 64 });
    eligible(s, c!, { war: 0.3, grade: 52, age: 31 });
    eligible(s, d!, { war: 0.3, grade: 52, again: true, age: 36 });
    expect(filingChance(a!, next)).toBe(1);
    expect(filingChance(b!, next)).toBe(1);
    expect(filingChance(c!, next)).toBeLessThan(0.4);
    expect(filingChance(d!, next)).toBeLessThan(filingChance(c!, next));
    expect(filingChance(d!, next)).toBeGreaterThanOrEqual(OFFSEASON.faFiling.min);
  });

  it('who does not file is not on the market, stays with his club, and may file the next winter', () => {
    const s = loadSave('2.0.79');
    s.pending = null;
    const next = s.year + 1;
    const me = s.user!.teamId;
    // Many of our own fringe players eligible: some of them stay.
    const ours = Object.values(s.players).filter((p) => p.teamId === me && p.status === 'active' && !isForeign(p)).slice(0, 12);
    for (const p of ours) eligible(s, p, { war: 0.2, grade: 51, age: 33 });
    const staying = unfiledFor(s, next);
    const mine = staying.filter((p) => p.teamId === me);
    expect(mine.length).toBeGreaterThan(3);
    const fas = new Set(freeAgentsFor(s, next).map((p) => p.id));
    for (const p of staying) {
      expect(isFreeAgent(p, next)).toBe(true);
      expect(fas.has(p.id)).toBe(false);
    }
    s.phase = 'offseason';
    const m = openMarket(s, next);
    for (const p of staying) {
      expect(m.talks[p.id]).toBeUndefined();
      expect(p.teamId).not.toBeNull();
    }
    const alert = s.alerts!.find((x) => x.id === `fa-unfiled-${next}`)!;
    expect(alert.players).toEqual(mine.map((p) => p.id));
    expect(alert.lines.join(' ')).toContain('다음 겨울');
    // A year on, still eligible: his own draw again (the rights are kept).
    const p = mine[0]!;
    p.contract = { ...p.contract!, salaries: [...(p.contract?.salaries ?? []), { season: next, amount: 5000 }] };
    p.service.creditedSeasons++;
    expect(isFreeAgent(p, next + 1)).toBe(true);
  });
});
