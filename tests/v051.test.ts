/* V0.5.1: pitch repertoire, bullpen roles, platoon splits, uniform numbers, injuries, posting. */
import { beforeAll, describe, expect, it } from 'vitest';
import { createLeague } from '../src/league/history';
import { penRoles } from '../src/league/manager';
import { pitchGrades, repertoire, topVelocity } from '../src/league/pitches';
import { postingFee } from '../src/league/posting';
import { isPitcher } from '../src/league/players';
import { orgPlayers, type LeagueState } from '../src/league/state';
import { playerCard } from '../src/league/views';

let s: LeagueState;
beforeAll(() => {
  s = createLeague('v051-test');
}, 240_000);

describe('pitches', () => {
  it('splits the breaking-ball grade into pitches that average back to it', () => {
    const pitchers = Object.values(s.players).filter((p) => isPitcher(p) && p.status === 'active');
    for (const p of pitchers.slice(0, 50)) {
      const r = repertoire(p);
      expect(r.length).toBeGreaterThanOrEqual(2);
      expect(new Set(r.map((x) => x.type)).size).toBe(r.length);
      const rest = r.slice(2);
      const restMean = rest.length ? rest.reduce((a, x) => a + x.offset, 0) / rest.length : r[1]!.offset;
      expect(0.6 * r[0]!.offset + 0.3 * r[1]!.offset + 0.1 * restMean).toBeCloseTo(0, 6);
      expect(pitchGrades(p).every((g) => g.grade >= 20 && g.grade <= 80)).toBe(true);
      expect(topVelocity(p)).toBeGreaterThan(125);
    }
  });
  it('makes 좌투우타 rare', () => {
    const lefties = Object.values(s.players).filter((p) => p.throws === '좌' && p.status === 'active');
    expect(lefties.filter((p) => p.bats === '우').length / lefties.length).toBeLessThan(0.08);
  });
});

describe('bullpen and platoon', () => {
  it('gives each club one closer and one setup man', () => {
    for (const t of s.teams) {
      const pen = s.rosters[t.id]!.active.map((id) => s.players[id]!).filter(isPitcher).slice(5);
      if (pen.length < 5) continue;
      const roles = Object.values(penRoles(s, t.id, pen));
      expect(roles.filter((r) => r === 'CL')).toHaveLength(1);
      expect(roles.filter((r) => r === 'SU')).toHaveLength(1);
    }
  });
  it('keeps left/right splits that add up to the season line', () => {
    const p = Object.values(s.players).find((x) => {
      const c = x.career.find((r) => r.year === s.year - 1 && !r.level);
      return c?.bat && c.bat.pa > 300;
    })!;
    const b = p.career.find((r) => r.year === s.year - 1 && !r.level)!.bat!;
    expect(b.split!.L.hr + b.split!.R.hr).toBe(b.hr);
    expect(b.split!.L.h + b.split!.R.h).toBe(b.h);
    expect(b.split!.L.pa + b.split!.R.pa).toBe(b.pa - b.sh);
  });
});

describe('profile data', () => {
  it('numbers every player, unique within a club', () => {
    for (const t of s.teams) {
      const org = orgPlayers(s, t.id);
      const nums = org.map((p) => p.number);
      expect(nums.every((n) => n != null)).toBe(true);
      expect(new Set(nums).size).toBe(nums.length);
      for (const p of org) expect(p.contract?.kind === 'development' ? p.number! >= 100 : p.number! <= 99).toBe(true);
    }
  });
  it('builds career totals, highs and injuries', () => {
    const vet = Object.values(s.players).find((p) => p.career.filter((c) => !c.level && c.bat).length >= 5 && p.injuries?.length)!;
    const card = playerCard(s, vet.id)!;
    expect(card.totals.bat!.h).toBe(vet.career.filter((c) => !c.level).reduce((a, c) => a + (c.bat?.h ?? 0), 0));
    expect(card.highs.find((h) => h.label === '홈런')).toBeTruthy();
    expect(card.injuries.length).toBe(vet.injuries!.length);
  });
});

describe('posting', () => {
  it('charges 20% / 17.5% / 15% by tier', () => {
    expect(postingFee(10_000_000)).toBe(2_000_000);
    expect(postingFee(40_000_000)).toBe(5_000_000 + 2_625_000);
    expect(postingFee(113_000_000)).toBe(5_000_000 + 4_375_000 + 9_450_000);
  });
  it('sends about one player a year to the majors', () => {
    const signed = (s.transactions ?? []).filter((t) => t.text.startsWith('포스팅') && t.text.includes('계약 ('));
    expect(signed.length).toBeLessThanOrEqual(3 * 11);
  });
});
