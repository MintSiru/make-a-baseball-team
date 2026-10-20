/* 2.0.24: the kinds of slider and curve, the knuckle curve, and the arm angle drawn. */
import { describe, expect, it } from 'vitest';
import { createLeague } from '../src/league/history';
import { isPitcher } from '../src/league/players';
import { pitchLabel, pitchVariant, repertoire, VARIANT_LABELS } from '../src/league/pitches';
import { trackingOf } from '../src/league/tracking';

describe('sliders and curves by kind', () => {
  const s = createLeague('v2024-pitches');
  const arms = Object.values(s.players).filter((p) => isPitcher(p) && p.status === 'active');

  it('names each slider and curve by its kind, and the kind shows in its break', () => {
    const seen = new Set<string>();
    let vert = 0,
      sweep = 0;
    for (const p of arms) {
      const t = trackingOf(p);
      if (!t) continue;
      for (const x of t.pitches) {
        if (x.type !== 'SL' && x.type !== 'CB') {
          expect(x.variant).toBeUndefined();
          continue;
        }
        expect(x.variant).toBe(pitchVariant(p, x.type));
        seen.add(x.variant!);
        expect(pitchLabel(p, x.type)).toBe(VARIANT_LABELS[x.variant!]);
        if (x.variant === 'vertSL') vert += Math.abs(x.horizontal) - Math.abs(x.vertical - 0);
        if (x.variant === 'sweepSL') sweep += Math.abs(x.horizontal);
      }
    }
    // 2.0.29: and the hard slider of the hardest throwers.
    expect([...seen].sort()).toEqual(['drop', 'hardSL', 'power', 'slow', 'sweepSL', 'vertSL']);
    // A sweeping slider breaks across more than a vertical one, on the whole.
    const sl = (v: string) => arms.flatMap((p) => trackingOf(p)?.pitches.filter((x) => x.variant === v) ?? []);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    expect(mean(sl('sweepSL').map((x) => Math.abs(x.horizontal)))).toBeGreaterThan(mean(sl('vertSL').map((x) => Math.abs(x.horizontal))) + 8);
    expect(mean(sl('vertSL').map((x) => x.vertical))).toBeLessThan(mean(sl('sweepSL').map((x) => x.vertical)) - 5);
    expect(mean(sl('slow').map((x) => x.velocity))).toBeLessThan(mean(sl('power').map((x) => x.velocity)) - 8);
    expect(mean(sl('power').map((x) => x.spin))).toBeGreaterThan(mean(sl('slow').map((x) => x.spin)) + 300);
    expect(vert + sweep).not.toBeNaN();
  });

  it('gives some curveballers a knuckle curve, never with a curve too', () => {
    const reps = arms.map((p) => repertoire(p).map((x) => x.type));
    const kc = reps.filter((r) => r.includes('KC')).length,
      cb = reps.filter((r) => r.includes('CB')).length;
    expect(kc).toBeGreaterThan(0);
    expect(kc).toBeLessThan(cb);
    expect(reps.some((r) => r.includes('KC') && r.includes('CB'))).toBe(false);
  });
});

describe('a foreign player’s registered name', () => {
  it('keeps his full name beside a shorter registered one, and drops it when he goes back', async () => {
    const { apply } = await import('../src/league/actions');
    const { editOf } = await import('../src/league/editor');
    const { isForeign } = await import('../src/league/players');
    const s = createLeague('v2024-regname');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: { name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null } });
    const p = Object.values(s.players).find((x) => isForeign(x) && x.name.includes(' '))!;
    const full = p.name;
    const short = full.split(' ').at(-1)!;
    apply(s, { kind: 'editPlayer', id: p.id, edit: { ...editOf(p), name: short } });
    expect(p.name).toBe(short);
    expect(p.fullName).toBe(full);
    apply(s, { kind: 'editPlayer', id: p.id, edit: { ...editOf(p), name: full } });
    expect(p.fullName).toBeUndefined();
  });
});

describe('the Asia quota’s own replacement', () => {
  it('counts the Asia quota player apart from the other foreign players', async () => {
    const { canReplaceForeign, foreignMarket, replaceForeign, replacementsLeft } = await import('../src/league/trade');
    const { isForeign } = await import('../src/league/players');
    const { orgPlayers } = await import('../src/league/state');
    const s = createLeague('v2024-asia');
    expect(s.phase).toBe('regular');
    const team = s.teams.find((t) => orgPlayers(s, t.id).some((p) => isForeign(p) && p.origin.asiaQuota))!.id;
    const asia = () => orgPlayers(s, team).find((p) => isForeign(p) && p.origin.asiaQuota && p.teamId === team)!;
    const regular = () => orgPlayers(s, team).find((p) => isForeign(p) && !p.origin.asiaQuota && p.teamId === team)!;
    const pick = (a: boolean) => foreignMarket(s, team).find((p) => !!p.origin.asiaQuota === a && !s.players[p.id])!;
    expect(replacementsLeft(s, team)).toEqual({ regular: 2, asia: 1 });
    replaceForeign(s, team, asia().id, pick(true).id);
    expect(replacementsLeft(s, team)).toEqual({ regular: 2, asia: 0 });
    // The Asia quota's one is spent; the others' two are still there.
    expect(canReplaceForeign(s, team, asia().id, pick(true).id)).not.toBeNull();
    expect(canReplaceForeign(s, team, regular().id, pick(false).id)).toBeNull();
    replaceForeign(s, team, regular().id, pick(false).id);
    replaceForeign(s, team, regular().id, pick(false).id);
    expect(replacementsLeft(s, team)).toEqual({ regular: 0, asia: 0 });
    expect(canReplaceForeign(s, team, regular().id, pick(false).id)).not.toBeNull();
  });
});

describe('more than one posting a winter', () => {
  it('lets a club post as many as the game allows, the KBO’s one by default', async () => {
    const { apply } = await import('../src/league/actions');
    const { postingMax } = await import('../src/league/posting');
    const s = createLeague('v2024-posting');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: { name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null } });
    expect(postingMax(s)).toBe(1);
    apply(s, { kind: 'postingMax', max: 3 });
    expect(postingMax(s)).toBe(3);
    apply(s, { kind: 'postingMax', max: 7 });
    expect(postingMax(s)).toBe(3);
    apply(s, { kind: 'postingMax', max: null });
    expect(s.postingMax).toBeUndefined();
  });
});

describe('losing a first-round pick for the salary cap', () => {
  it('takes the club’s first pick away only with the option on', async () => {
    const { applyPickDrop } = await import('../src/league/cap');
    const s = createLeague('v2024-forfeit');
    const slots = ['a', 'b', 'c', 'a', 'b', 'c'].map((teamId, i) => ({ teamId, i }));
    s.pickForfeit = { 2030: ['b'] };
    const out = applyPickDrop(s, 2030, slots);
    expect(out.map((x) => x.i)).toEqual([0, 2, 3, 4, 5]);
    expect(applyPickDrop(s, 2031, slots)).toEqual(slots);
  });
});

describe('the national team and the crowds', () => {
  it('fills the ballparks after a world title and empties them a little after an early exit, fading over a year', async () => {
    const { INTERNATIONAL, internationalCrowd } = await import('../src/league/international');
    const wbc = INTERNATIONAL.find((e) => e.kind === 'wbc' && e.year >= 2026)!;
    const at = (days: number) => new Date(Date.parse(wbc.dates.to) + days * 86400000).toISOString().slice(0, 10);
    expect(internationalCrowd([{ id: wbc.id, finish: 'champion' }], at(1))).toBeGreaterThan(1.09);
    expect(internationalCrowd([{ id: wbc.id, finish: 'champion' }], at(200))).toBeLessThan(1.05);
    expect(internationalCrowd([{ id: wbc.id, finish: 'champion' }], at(400))).toBe(1);
    expect(internationalCrowd([{ id: wbc.id, finish: 'first' }], at(30))).toBeLessThan(0.96);
    expect(internationalCrowd([{ id: wbc.id, finish: 'first' }], at(-5))).toBe(1);
  });
});

describe('players who will not join a superteam', () => {
  it('turns down last season’s champion, and some players are like that', async () => {
    const { antiSuperteam, faPrice, fitOf, superteams } = await import('../src/league/fa');
    const s = createLeague('v2024-super');
    const next = s.year + 1;
    s.history.push({ ...s.history.at(-1)!, year: s.year, champion: 'lg' });
    expect(superteams(s, next)).toContain('lg');
    const p = Object.values(s.players).find((x) => x.status === 'active' && x.teamId === 'doosan')!;
    const talk = { id: p.id, from: 'doosan', grade: 'A', price: faPrice(p, next), ask: 1, floor: 1, demands: [{ kind: 'noSuperteam' }], loyalty: 0, patience: 3, offers: {}, interest: {} } as never;
    const o = faPrice(p, next);
    expect(fitOf(s, talk, 'lg', o, next).k).toBeLessThan(0.2);
    expect(fitOf(s, talk, 'doosan', o, next).k).toBeGreaterThanOrEqual(1);
    const share = Object.values(s.players).filter(antiSuperteam).length / Object.keys(s.players).length;
    expect(share).toBeGreaterThan(0.03);
    expect(share).toBeLessThan(0.12);
  });
});
