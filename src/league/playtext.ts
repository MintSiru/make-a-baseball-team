/* Play-by-play in Korean (V0.7). Only the wording is picked here (from a hash of the game and event,
   never the simulation's random stream); the facts come from the engine's log. */
import { hashUnit } from '../draftroom';
import type { PlayEvent } from './engine/types';

const pick = <T,>(xs: T[], key: string) => xs[Math.floor(hashUnit(key) * xs.length)]!;

const OUTS = ['유격수 땅볼', '2루수 땅볼', '3루수 땅볼', '1루수 땅볼', '투수 땅볼', '중견수 뜬공', '좌익수 뜬공', '우익수 뜬공', '2루수 직선타', '유격수 뜬공', '3루수 파울 뜬공', '포수 파울 뜬공'];
const SINGLES = ['좌전 안타', '중전 안타', '우전 안타', '내야 안타', '유격수 옆 빠지는 안타', '투수 맞고 굴절된 안타'];
const DOUBLES = ['좌중간 2루타', '우중간 2루타', '좌익선상 2루타', '우익선상 2루타', '펜스 직격 2루타'];
const TRIPLES = ['우중간 3루타', '좌중간 3루타', '우익선상 3루타'];
const HOMERS = ['좌월 홈런', '중월 홈런', '우월 홈런', '좌중월 홈런', '우중월 홈런'];
const DPS = ['유격수 병살타', '2루수 병살타', '3루수 병살타', '투수 병살타'];
const ERRORS = ['유격수 실책으로 출루', '3루수 실책으로 출루', '2루수 실책으로 출루', '1루수 실책으로 출루', '좌익수 실책으로 출루'];

export function playText(ev: PlayEvent, key: string, name: (id: string) => string): string {
  if (ev.k === 'pitch') return `투수 교체: ${name(ev.out)} → ${name(ev.p)}`;
  const who = name(ev.b);
  const what = (() => {
    switch (ev.res) {
      case 'HR':
        return `${pick(HOMERS, key)}${ev.runs >= 4 ? ' (만루 홈런)' : ev.runs > 1 ? ` (${ev.runs}점)` : ' (솔로)'}`;
      case '3B':
        return pick(TRIPLES, key);
      case '2B':
        return pick(DOUBLES, key);
      case '1B':
        return pick(SINGLES, key);
      case 'BB':
        return '볼넷';
      case 'HBP':
        return '몸에 맞는 공';
      case 'K':
        return pick(['헛스윙 삼진', '루킹 삼진', '삼진'], key);
      case 'DP':
        return pick(DPS, key);
      case 'SF':
        return pick(['좌익수 희생플라이', '중견수 희생플라이', '우익수 희생플라이'], key);
      case 'SH':
        return '희생번트';
      case 'E':
        return pick(ERRORS, key);
      default:
        return pick(OUTS, key);
    }
  })();
  const runs = ev.res !== 'HR' && ev.runs > 0 ? ` · ${ev.runs}점` : '';
  return `${who}: ${what}${runs}`;
}

export const halfLabel = (i: number, top: boolean) => `${i}회${top ? '초' : '말'}`;

/** The key moment lines for a headline: the go-ahead or big hits. */
export function scoringPlays(log: PlayEvent[]): Extract<PlayEvent, { k: 'pa' }>[] {
  return log.filter((e): e is Extract<PlayEvent, { k: 'pa' }> => e.k === 'pa' && e.runs > 0);
}

