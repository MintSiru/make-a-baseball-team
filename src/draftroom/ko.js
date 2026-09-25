/* Korean particles and curated report conjugations. No model/network at runtime. */
// Ported from KBO-Draft-Room df4faad src/core/ko.js. See docs/UPSTREAM.md.

function finalSound(word) {
  const text = String(word)
    .trim()
    .replace(/[\s"'’”」』)\]}]+$/g, '');
  const ch = [...text].pop() || '',
    code = ch.codePointAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28;
  if (/[0-9]/.test(ch)) return [21, 8, 0, 16, 0, 0, 1, 8, 8, 0][Number(ch)];
  const letters = { L: 8, M: 16, N: 4, R: 8 };
  return letters[ch.toUpperCase()] || 0;
}
function particle(word, pair) {
  const j = finalSound(word),
    [withFinal, withoutFinal] = pair.split('/');
  return pair === '으로/로' ? (j && j !== 8 ? withFinal : withoutFinal) : j ? withFinal : withoutFinal;
}
function p(word, pair) {
  return String(word) + particle(word, pair);
}
// Only complete sentence endings in the hand-authored scouting catalog are transformed.
const endings = [
  ['갖춰졌다.', '갖춰졌습니다.'],
  ['보완해야 한다.', '보완해야 합니다.'],
  ['늘려야 한다.', '늘려야 합니다.'],
  ['만든다.', '만듭니다.'],
  ['흔들린다.', '흔들립니다.'],
  ['높아진다.', '높아집니다.'],
  ['빨라진다.', '빨라집니다.'],
  ['이어진다.', '이어집니다.'],
  ['따라간다.', '따라갑니다.'],
  ['뺏는다.', '뺏습니다.'],
  ['묶는다.', '묶습니다.'],
  ['보여준다.', '보여줍니다.'],
  ['한다.', '합니다.'],
  ['있다.', '있습니다.'],
  ['없다.', '없습니다.'],
  ['갖췄다.', '갖췄습니다.'],
  ['좋다.', '좋습니다.'],
  ['돋보인다.', '돋보입니다.'],
  ['간결하다.', '간결합니다.'],
  ['매력적이다.', '매력적입니다.'],
  ['위력적이다.', '위력적입니다.'],
  ['안정적이다.', '안정적입니다.'],
  ['과제다.', '과제입니다.'],
  ['편이다.', '편입니다.'],
  ['부족하다.', '부족합니다.'],
  ['필요하다.', '필요합니다.'],
];
function formal(text) {
  let out = String(text);
  for (const [from, to] of endings)
    if (out.endsWith(from)) {
      out = out.slice(0, -from.length) + to;
      break;
    }
  return out;
}
const api = { finalSound, particle, p, formal };
export default api;
