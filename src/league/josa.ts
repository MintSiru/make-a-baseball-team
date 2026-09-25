/* Korean particles that depend on the last syllable: 으로/로, 이/가, 을/를, 은/는. */

const lastSyllable = (word: string) => {
  const code = word.trim().charCodeAt(word.trim().length - 1) - 0xac00;
  return code >= 0 && code <= 11171 ? code % 28 : -1; // final consonant index (0 = none); -1 for non-Hangul
};

/** "두산으로", "LG로", "서울로" (ㄹ takes 로). */
export const ro = (w: string) => `${w}${lastSyllable(w) > 0 && lastSyllable(w) !== 8 ? '으로' : '로'}`;
export const iga = (w: string) => `${w}${lastSyllable(w) > 0 ? '이' : '가'}`;
export const eulreul = (w: string) => `${w}${lastSyllable(w) > 0 ? '을' : '를'}`;
export const wagwa = (w: string) => `${w}${lastSyllable(w) > 0 ? '과' : '와'}`;
export const eunneun = (w: string) => `${w}${lastSyllable(w) > 0 ? '은' : '는'}`;
