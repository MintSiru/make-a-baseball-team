/* en/ja localization: the display runtime and the resources. The Korean the simulation and the saves use never
   changes; the display locales only change what is shown. */
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { displayText, getLocale, k, t, type MessageKey } from '../src/i18n/index';
import { applyLocale, compactAmount, messageFor, registerKept, registerNames, translateFor } from '../src/i18n/runtime';

const key = (s: string) => s as MessageKey;

afterEach(() => applyLocale('ko', false));

describe('display locale', () => {
  it('leaves Korean exactly as k() makes it', () => {
    applyLocale('ko', false);
    expect(t(key('league.fa.tell.bd73c0e4'), { name: '김민준', n: 1 })).toBe(k(key('league.fa.tell.bd73c0e4'), { name: '김민준', n: 1 }));
    expect(displayText('김민준')).toBe('김민준');
  });

  it('switches t() to the locale, with plurals, and back', () => {
    applyLocale('en', false);
    expect(getLocale()).toBe('en');
    expect(t(key('league.fa.tell.bd73c0e4'), { name: '김민준', n: 1 })).toBe("Kim Min-jun has received offers from 1 club. We haven't made an offer yet.");
    expect(t(key('league.fa.tell.bd73c0e4'), { name: '김민준', n: 3 })).toContain('3 clubs');
    applyLocale('ja', false);
    expect(t(key('league.fa.tell.bd73c0e4'), { name: '김민준', n: 3 })).toContain('キム・ミンジュン');
    applyLocale('ko', false);
    expect(t(key('league.fa.tell.bd73c0e4'), { name: '김민준', n: 3 })).toContain('김민준');
  });

  it('keeps k() canonical Korean whatever the display locale', () => {
    applyLocale('en', false);
    expect(k(key('league.stops.watchStops.title.9b2951ae'))).toMatch(/[가-힣]/);
  });

  it('shows amounts in each locale', () => {
    expect(compactAmount(175_000_000, '₩')).toBe('₩175M');
    expect(compactAmount(6_460_000_000, '₩')).toBe('₩6.46B');
    expect(translateFor('en', '1억 7,500만 원')).toBe('₩175M');
    expect(translateFor('en', '40만 달러')).toBe('$400K');
    expect(translateFor('ja', '1억 7,500만')).toBe('1億7,500万');
    // A ko pattern with {value}억: English formats the amount, Japanese keeps 億 in its own text.
    expect(messageFor('en', key('league.movenews.moveNews.extra.58195e3f'), { value: '20' })).toBe('Cash: ₩2B');
    expect(messageFor('ja', key('league.movenews.moveNews.extra.58195e3f'), { value: '20' })).toContain('20億');
  });

  it('reads names from the tables, and the game’s own people even when a part is missing', () => {
    expect(translateFor('en', '김민준')).toBe('Kim Min-jun');
    expect(translateFor('ja', '제이크 밀러')).toBe('ジェイク・ミラー');
    // Words that look like names are not names.
    expect(translateFor('en', '정원')).toBe('정원');
    registerNames(['이훈']);
    expect(translateFor('en', '이훈')).toMatch(/^Lee /);
  });

  it('translates stored Korean text back through the resource patterns', () => {
    registerNames(['박현수', '심선재', '김태민']);
    registerKept(['울산 고래단']);
    expect(translateFor('en', 'SSG가 한화에 박현수를 내주고 심선재를 받는 1대1 트레이드를 했다.')).toBe('SSG sent Park Hyun-soo to Hanwha in exchange for Shim Sun-jae in a 1-for-1 trade.');
    const injury = translateFor('en', '울산 고래단 1루수 김태민이 퓨처스 경기에서 햄스트링 손상 진단을 받았다. 복귀까지 3주가량 걸릴 전망으로, 5월쯤 돌아올 것으로 보인다.');
    expect(injury).toContain('Kim Tae-min');
    expect(injury).toContain('울산 고래단');
    expect(injury).not.toMatch(/햄스트링|진단/);
  });

  it('never shows a half-translated text', () => {
    const s = '전혀 없는 문장인데 두산이 이겼다';
    const out = translateFor('en', s);
    expect(out === s || !/[가-힣]/.test(out)).toBe(true);
  });

  it('takes the other plural form for counts that are not plain numbers', () => {
    expect(messageFor('en', key('league.gamedetail.gameDetail.b0900d9e'), { innings: '5 2/3' })).toBe(' (5 2/3 innings)');
    expect(messageFor('en', key('league.gamedetail.gameDetail.b0900d9e'), { innings: 1 })).toBe(' (1 inning)');
  });
});

describe('resources', () => {
  it('pass npm run i18n:check with no critical findings', () => {
    const out = execFileSync('node', ['scripts/i18n-check.mjs', '--list', '0'], { encoding: 'utf8' });
    expect(out).toMatch(/critical 0, major 0/);
  }, 60_000);
});
