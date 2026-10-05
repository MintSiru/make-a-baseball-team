/* Gzip for saves (V0.14): a league of thirty seasons is some 20MB of JSON but a fifth of that packed. The
   browser's own CompressionStream does the work (Chrome 80, Safari 16.4, Firefox 113); where it is missing
   the text is kept as it is. */

export const canCompress = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

async function pipe(data: BlobPart, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([data]).stream().pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export const gzipText = (text: string) => pipe(text, new CompressionStream('gzip'));
export const gunzipText = async (data: Uint8Array | ArrayBuffer) => new TextDecoder().decode(await pipe(data as BlobPart, new DecompressionStream('gzip')));

/** Gzip's magic number: a packed save file can be loaded as well as a plain one. */
export const isGzip = (bytes: Uint8Array) => bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

/** Packs a save's text, checking that it unpacks to the same text; null when it cannot (keep the text). */
export async function packText(text: string): Promise<Uint8Array | null> {
  if (!canCompress()) return null;
  try {
    const gz = await gzipText(text);
    return (await gunzipText(gz)) === text ? gz : null;
  } catch {
    return null;
  }
}

/** A file the player picked: plain JSON, or gzip of it. */
export async function readSaveFile(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isGzip(bytes)) {
    if (!canCompress()) throw new Error('이 브라우저는 압축된 진행 파일을 열 수 없습니다.');
    return gunzipText(bytes);
  }
  return new TextDecoder().decode(bytes);
}
