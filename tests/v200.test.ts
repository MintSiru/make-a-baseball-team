/* 2.0.0: arm slots and pitch tracking; the fielding awards. */
import { describe, expect, it } from 'vitest';
import { createLeague } from '../src/league/history';
import { isPitcher } from '../src/league/players';
import { averageVelocity, platoonFactor } from '../src/league/pitches';
import { armAngle, slotOf, trackingOf } from '../src/league/tracking';

describe('arm slots and tracking', () => {
  const s = createLeague('v200');
  const pitchers = Object.values(s.players).filter((p) => isPitcher(p) && p.status === 'active');

  it('gives every pitcher an arm slot, most of them three-quarters, a few sidearm and fewer underhand', () => {
    const slots = pitchers.map((p) => slotOf(armAngle(p)!));
    const share = (x: string) => slots.filter((y) => y === x).length / slots.length;
    expect(share('three')).toBeGreaterThan(0.5);
    expect(share('side')).toBeGreaterThan(0.05);
    expect(share('under')).toBeGreaterThan(0.01);
    expect(share('under')).toBeLessThan(share('side'));
    expect(armAngle(Object.values(s.players).find((p) => !isPitcher(p))!)).toBeNull();
    // 2.0.1 (the user's ranges): 46~60 overhand, 21~45 three-quarters, 0~20 sidearm, −1~−60 underhand, few at the ends.
    const angles = pitchers.map((p) => armAngle(p)!);
    expect(Math.max(...angles)).toBeLessThanOrEqual(60);
    expect(Math.min(...angles)).toBeGreaterThanOrEqual(-60);
    expect(slotOf(48)).toBe('over');
    expect(slotOf(45)).toBe('three');
    expect(slotOf(20)).toBe('side');
    expect(slotOf(-1)).toBe('under');
    const over = angles.filter((a) => a >= 46);
    expect(over.filter((a) => a >= 58).length).toBeLessThan(over.filter((a) => a >= 51 && a <= 55).length);
  });

  it('throws slower and splits wider from a low slot', () => {
    const by = (slot: string) => pitchers.filter((p) => slotOf(armAngle(p)!) === slot);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    const velo = (slot: string) => mean(by(slot).map((p) => averageVelocity(p) ?? 0));
    expect(velo('under')).toBeLessThan(velo('three') - 5);
    expect(velo('side')).toBeLessThan(velo('three'));
    expect(mean(by('side').map(platoonFactor))).toBeGreaterThan(mean(by('three').map(platoonFactor)));
  });

  it('reads every pitch: speed under the fastball, spin, a clock axis, and break', () => {
    const p = pitchers.find((x) => trackingOf(x) && trackingOf(x)!.pitches.length >= 3)!;
    const t = trackingOf(p)!;
    expect(t.release).toBeGreaterThan(0.5);
    expect(t.release).toBeLessThan(2.2);
    expect(t.extension).toBeGreaterThan(1.5);
    const [fb, ...rest] = t.pitches;
    for (const x of rest) expect(x.velocity).toBeLessThanOrEqual(fb!.velocity + 2);
    for (const x of t.pitches) expect(x.axis).toMatch(/^\d{1,2}:\d{2}$/);
    expect(fb!.vertical).toBeGreaterThan(0);
    // The same every time.
    expect(trackingOf(p)).toEqual(t);
  });
});

describe('the fielding awards', () => {
  it('name a pitcher, a glove at each position and a utility player each season', () => {
    const s = createLeague('v200-awards');
    const a = s.history.at(-1)!.awards!;
    expect(a.defense!.length).toBeGreaterThanOrEqual(9);
    expect(new Set(a.defense!.map((x) => x.pos)).size).toBe(a.defense!.length);
    expect(a.defense!.some((x) => x.pos === '투수')).toBe(true);
  });
});
