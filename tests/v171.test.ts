/* 1.7.1: where each pitch went and where the ball came down in the pitch-by-pitch relay, and a stop before our
   postseason games (watch live, see the result, or go on). */
import { describe, expect, it } from 'vitest';
import { apply, regularOver } from '../src/league/actions';
import { autoDecision } from '../src/league/expansion';
import { hitSpot, pitchFeed } from '../src/league/pitchfeed';
import { lastOurGame, ourNextGame } from '../src/league/postseason';
import { rng } from '../src/draftroom';
import { loadSave } from './v170.test';

describe('the relay shows where the ball went', () => {
  it('pitches by their call, balls in play by the words of the play', () => {
    const s = loadSave();
    const ids = Object.keys(s.pbp ?? {});
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids.slice(0, 3)) {
      const frames = pitchFeed(s, id)!;
      expect(pitchFeed(s, id)).toEqual(frames);
      for (const f of frames) {
        if (f.kind === 'pitch') {
          const loc = f.loc!;
          const inside = Math.abs(loc.x) <= 1 && Math.abs(loc.y) <= 1;
          if (loc.call === 'ball') expect(inside).toBe(false);
          if (loc.call === 'strike') expect(inside).toBe(true);
        } else expect(f.loc).toBeUndefined();
        if (f.kind === 'result') {
          const strikeoutOrWalk = /삼진|볼넷|몸에 맞는 공/.test(f.text);
          expect(!!f.hit).toBe(!strikeoutOrWalk);
        }
      }
    }
    const r = rng('spots');
    expect(hitSpot('1B', '우전 안타', r)!.angle).toBeGreaterThan(15);
    expect(hitSpot('1B', '좌전 안타', r)!.angle).toBeLessThan(-15);
    expect(hitSpot('HR', '중월 홈런 (솔로)', r)).toMatchObject({ kind: 'hr' });
    expect(hitSpot('HR', '좌월 홈런 (솔로)', r)!.dist).toBeGreaterThan(100);
    expect(hitSpot('OUT', '유격수 땅볼', r)).toMatchObject({ kind: 'ground', out: true });
    expect(hitSpot('OUT', '중견수 뜬공', r)).toMatchObject({ kind: 'fly', out: true });
    expect(Math.abs(hitSpot('OUT', '3루수 파울 뜬공', r)!.angle)).toBeGreaterThan(45);
    expect(hitSpot('K', '헛스윙 삼진', r)).toBeNull();
  });
});

describe('a stop before our postseason games', () => {
  it('a run of postseason days stops before our game; that one day can be played on its own', () => {
    const s = loadSave();
    for (let g = 0; g < 200 && !regularOver(s); g++) {
      if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
      else apply(s, { kind: 'regularEnd' });
    }
    apply(s, { kind: 'postseasonStart' });
    expect(s.bracket!.year).toBe(s.year);
    // Ours for this test: the club seeded first, which waits for the earlier rounds.
    const top = s.bracket!.seeds[0]!;
    s.user!.teamId = top;
    apply(s, { kind: 'postseason', stops: true });
    const next = ourNextGame(s)!;
    expect(next).not.toBeNull();
    expect(next.game).toBe(1);
    expect(s.bracket!.done).toBe(false);
    const before = s.scores.length;
    apply(s, { kind: 'postseasonRound', stops: true });
    expect(s.scores.length).toBe(before);
    // Watching it: the day is played, our box score has its play-by-play for the relay.
    apply(s, { kind: 'postseasonDay' });
    const id = lastOurGame(s)!;
    const box = s.boxes![id]!;
    expect([box.home, box.away]).toContain(top);
    expect(box.date > s.schedule.at(-1)!.date).toBe(true);
    expect(s.pbp?.[id]).toBeDefined();
    expect(ourNextGame(s)?.game ?? 2).toBe(2);
    // Without stops it goes to the end.
    apply(s, { kind: 'postseason' });
    expect(s.bracket!.done).toBe(true);
  }, 240_000);
});
