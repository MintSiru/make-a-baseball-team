/* Korean particles that depend on the last syllable: 으로/로, 이/가, 을/를, 은/는. */

/** Final consonant of a number read aloud (1.2.0): 일·칠·팔 ㄹ, 영 ㅇ, 삼 ㅁ, 육 ㄱ, the rest none; 십 ㅂ, 백 ㄱ, 천·만 ㄴ. */
const DIGIT_FINAL = [21, 8, 0, 16, 0, 0, 1, 8, 8, 0];
const ZEROS_FINAL = [0, 17, 1, 4, 4];

const lastSyllable = (word: string) => {
  const w = word.trim();
  const digits = /(\d+)$/.exec(w)?.[1];
  if (digits && !/[.,]\d+$/.test(w)) {
    const zeros = /0*$/.exec(digits)![0].length;
    if (zeros === digits.length) return DIGIT_FINAL[0]!;
    return zeros ? (ZEROS_FINAL[Math.min(zeros, 4)] ?? 4) : DIGIT_FINAL[Number(digits.at(-1))]!;
  }
  const code = w.charCodeAt(w.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 ? code % 28 : -1; // final consonant index (0 = none); -1 for non-Hangul
};

/** "두산으로", "LG로", "서울로" (ㄹ takes 로). */
export const ro = (w: string) => `${w}${lastSyllable(w) > 0 && lastSyllable(w) !== 8 ? '으로' : '로'}`;
export const iga = (w: string) => `${w}${lastSyllable(w) > 0 ? '이' : '가'}`;
export const eulreul = (w: string) => `${w}${lastSyllable(w) > 0 ? '을' : '를'}`;
export const wagwa = (w: string) => `${w}${lastSyllable(w) > 0 ? '과' : '와'}`;
export const eunneun = (w: string) => `${w}${lastSyllable(w) > 0 ? '은' : '는'}`;
