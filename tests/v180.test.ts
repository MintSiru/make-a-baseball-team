/* 1.8.0: the 1.7 feedback — free agency at a glance, staff contracts, asking the owner for a free agent, an
   NPB-style postseason for two leagues, and the scenario 부상병동. */
import { describe, expect, it } from 'vitest';
import { faOutlook } from '../src/league/faclock';
import { isForeign } from '../src/league/players';
import { rosterView } from '../src/league/views';
import { endRegular, loadSave } from './helpers';
import { autoDecision } from '../src/league/expansion';
import { askOwnerChance, askOwnerProblem } from '../src/league/ownerask';
import { apply } from '../src/league/actions';
import { STAFF_ROLES, staffOf } from '../src/league/staff';
import { dismissalCost, extendProblem, fireProblem, staffTerms } from '../src/league/staffdeals';

describe('free agency at a glance', () => {
  it('every domestic player has a season he files after, counted from his registered seasons and contract', () => {
    const s = loadSave();
    expect(s.phase).toBe('regular');
    const players = Object.values(s.players).filter((p) => p.status === 'active' && p.teamId);
    for (const p of players) {
      const fa = faOutlook(s, p);
      if (isForeign(p) || p.contract?.kind === 'development') {
        expect(fa.year).toBeNull();
        continue;
      }
      expect(fa.year).toBeGreaterThanOrEqual(s.year);
      const until = Math.max(0, ...(p.contract?.salaries ?? []).map((x) => x.season));
      expect(fa.year).toBeGreaterThanOrEqual(until);
      expect(fa.left).toBe(fa.year! - s.year + 1);
    }
    // A player one registered season short files after this one; two short, after the next.
    const p = structuredClone(players.find((x) => !isForeign(x) && x.contract?.kind !== 'development' && !x.contract?.salaries.some((y) => y.season > s.year))!);
    p.service = { ...p.service, creditedSeasons: 7, lastFreeAgencyAt: undefined };
    p.origin = { ...p.origin, entryCategory: 'highSchool' };
    expect(faOutlook(s, p).year).toBe(s.year);
    p.service.creditedSeasons = 6;
    expect(faOutlook(s, p).year).toBe(s.year + 1);
    // After a free-agent deal, four more seasons.
    p.service.lastFreeAgencyAt = 8;
    p.service.creditedSeasons = 9;
    expect(faOutlook(s, p)).toMatchObject({ again: true, year: s.year + 2 });
    // Every club's roster shows it.
    const other = s.teams.find((t) => t.id !== s.user!.teamId && s.rosters[t.id])!;
    expect(rosterView(s, other.id).active.every((r) => typeof r.fa.short === 'string')).toBe(true);
  });
});

describe('staff contracts in detail', () => {
  it('every head has his terms; ours can be extended in the last season or dismissed (pay still owed, an interim in)', () => {
    const s = loadSave();
    const u = s.user!;
    const staff = staffOf(s, u.teamId);
    for (const role of STAFF_ROLES) expect(staffTerms(staff[role])).toContain(String(staff[role].until));
    // AI clubs' managers on paper: a signing bonus and a length.
    const other = s.teams.find((t) => t.id !== u.teamId && s.clubs?.[t.id])!;
    const m = staffOf(s, other.id).manager;
    expect(m.years).toBeGreaterThanOrEqual(1);
    expect(staffTerms(m)).toMatch(/총액|연봉/);

    // An extension: only in the last season.
    const coach = staff.hitting;
    coach.until = s.year + 3;
    expect(extendProblem(s, 'hitting')).not.toBeNull();
    coach.until = s.year;
    expect(extendProblem(s, 'hitting')).toBeNull();
    const before = coach.salary;
    apply(s, { kind: 'staffExtend', role: 'hitting', years: 2 });
    expect(coach.until).toBe(s.year + 2);
    expect(coach.salary).toBeGreaterThan(before);

    // Dismissing the manager: the rest of his pay is owed, an interim takes the post until the winter.
    const boss = staffOf(s, u.teamId).manager;
    boss.until = s.year + 1;
    const owed = dismissalCost(s, 'manager');
    expect(owed).toBeGreaterThan(boss.salary);
    apply(s, { kind: 'staffFire', role: 'manager' });
    const interim = staffOf(s, u.teamId).manager;
    expect(interim.interim).toBe(true);
    expect(interim.until).toBe(s.year);
    expect(interim.name).not.toBe(boss.name);
    const dead = (u.deadMoney ?? []).filter((d) => d.label.includes(boss.name)).reduce((a, d) => a + d.amount, 0);
    expect(dead).toBe(owed);
    expect(s.news!.some((n) => n.id.startsWith('fire-') && n.mine)).toBe(true);
    expect(fireProblem(s, 'manager')).not.toBeNull();
  });
});

describe('asking the owner for a free agent', () => {
  it('once a winter: a yes pays his deal like a gift, a no costs a little trust; a conglomerate says yes more', () => {
    const s = loadSave();
    endRegular(s);
    apply(s, { kind: 'postseason' });
    apply(s, { kind: 'nextSeason' });
    for (let i = 0; i < 300 && s.pending?.kind !== 'faRound'; i++) {
      if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
      else apply(s, { kind: 'nextSeason' });
    }
    expect(s.pending?.kind).toBe('faRound');
    const m = s.offseason!.fa!;
    const u = s.user!;
    delete m.gift;
    const target = m.order.find((id) => !askOwnerProblem(s, id))!;
    expect(target).toBeDefined();
    // The parent's type and trust move the odds.
    u.settings.parentType = 'conglomerate';
    u.trust = 70;
    const rich = askOwnerChance(s, target);
    u.settings.parentType = 'citizen';
    expect(askOwnerChance(s, target)).toBeLessThan(rich);
    u.trust = 30;
    expect(askOwnerChance(s, target)).toBeLessThan(rich);
    // A sure yes: the owner pays his deal (the market's gift), and nobody can be asked again this winter.
    u.settings.parentType = 'conglomerate';
    u.trust = 100;
    const trust = u.trust;
    apply(s, { kind: 'askOwner', id: target });
    if (m.asked!.yes) {
      expect(m.gift?.id).toBe(target);
      expect(u.trust).toBe(trust);
    } else expect(u.trust).toBe(trust - 3);
    const another = m.order.find((id) => id !== target);
    expect(askOwnerProblem(s, another!)).not.toBeNull();
  }, 240_000);
});
